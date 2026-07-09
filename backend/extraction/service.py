import json
import base64
import os
import httpx
import logging
from io import BytesIO
from PIL import Image
from tenacity import retry, stop_after_attempt, wait_exponential, RetryCallState

logger = logging.getLogger(__name__)

HF_API_KEY = os.environ.get("HUGGINGFACE_API_KEY", "").strip()
HF_BACKUP_API_KEY = os.environ.get("HUGGINGFACE_BACKUP_API_KEY", "").strip()
HF_MODEL_ID = os.environ.get("HUGGINGFACE_MODEL_ID", "google/gemma-4-26B-A4B-it:novita")
TIMEOUT_SECONDS = int(os.environ.get("EXTRACTION_TIMEOUT_SECONDS", "30"))
MAX_RETRIES = int(os.environ.get("EXTRACTION_MAX_RETRIES", "3"))
HF_API_URL = "https://router.huggingface.co/v1/chat/completions"

class ExtractionError(Exception):
    pass

class NonRetryableExtractionError(ExtractionError):
    pass

def should_retry(retry_state: RetryCallState) -> bool:
    if not retry_state.outcome.failed:
        return False
    exception = retry_state.outcome.exception()
    if isinstance(exception, NonRetryableExtractionError):
        return False
    return True

def validate_image(image_base64: str) -> None:
    try:
        image_data = base64.b64decode(image_base64)
        img = Image.open(BytesIO(image_data))
        img.verify()
        
        # Verify sizes
        img = Image.open(BytesIO(image_data))
        width, height = img.size
        if width < 50 or height < 50:
            raise NonRetryableExtractionError("Image too small. Minimum size is 50x50.")
    except NonRetryableExtractionError:
        raise
    except Exception as e:
        logger.error(f"Image validation failed: {e}")
        raise NonRetryableExtractionError("Invalid image data.")

def build_prompt() -> str:
    return """You are a business card data extraction assistant.
Extract all information from the business card image and return it as a JSON object.

Return ONLY valid JSON. No explanation. No markdown. No code blocks.

Use this exact schema:
{
  "name":     "full name or null",
  "title":    "job title or null",
  "company":  "company name or null",
  "address":  "full address as single string or null",
  "emails":   ["list of emails, empty array if none"],
  "phones":   ["list of phones, empty array if none"],
  "websites": ["list of websites, empty array if none"]
}

Rules:
- Use null for missing strings, [] for missing arrays.
- Do not invent information not visible on the card.
- Include all emails, phones, and websites found.
- Return nothing except the JSON object.
"""

def parse_and_validate_gemma_json(raw_text: str) -> dict:
    normalized = raw_text.strip()
    if normalized.startswith("```json"):
        normalized = normalized[7:]
    elif normalized.startswith("```"):
        normalized = normalized[3:]
    if normalized.endswith("```"):
        normalized = normalized[:-3]
    normalized = normalized.strip()

    try:
        parsed = json.loads(normalized)
    except json.JSONDecodeError:
        raise NonRetryableExtractionError("AI returned an unreadable response.")

    def coerce_string(val):
        if not val or not isinstance(val, str) or val.strip().lower() == "null":
            return None
        return val.strip()

    def coerce_array(val):
        if not val or not isinstance(val, list):
            return []
        return [str(v).strip() for v in val if v]

    emails = coerce_array(parsed.get("emails", []))
    emails = [e.lower() for e in emails]

    return {
        "name": coerce_string(parsed.get("name")),
        "title": coerce_string(parsed.get("title")),
        "company": coerce_string(parsed.get("company")),
        "address": coerce_string(parsed.get("address")),
        "emails": emails,
        "phones": coerce_array(parsed.get("phones", [])),
        "websites": coerce_array(parsed.get("websites", [])),
        "raw_extraction": raw_text
    }

def log_retry_attempt(retry_state: RetryCallState):
    logger.debug(f"Tenacity retry attempt {retry_state.attempt_number} for call_huggingface_api after error: {retry_state.outcome.exception()}")

@retry(
    stop=stop_after_attempt(MAX_RETRIES),
    wait=wait_exponential(multiplier=2, min=2, max=10),
    retry=should_retry,
    before_sleep=log_retry_attempt,
    reraise=True
)
async def call_huggingface_api(images: list, on_attempt=None) -> str:
    if on_attempt:
        on_attempt()

    api_keys = []
    if HF_API_KEY:
        api_keys.append(HF_API_KEY)
    if HF_BACKUP_API_KEY and HF_BACKUP_API_KEY not in api_keys:
        api_keys.append(HF_BACKUP_API_KEY)

    if not api_keys:
        raise NonRetryableExtractionError("AI service authentication failed.")

    content = [
        {
            "type": "text",
            "text": build_prompt()
        }
    ]
    for img in images:
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:{img['mime_type']};base64,{img['image_base64']}"
            }
        })

    payload = {
        "model": HF_MODEL_ID,
        "messages": [
            {
                "role": "user",
                "content": content
            }
        ]
    }

    last_exception = None
    for api_key in api_keys:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
                response = await client.post(HF_API_URL, json=payload, headers=headers)
                
                if response.status_code == 401:
                    logger.warning("Hugging Face API token returned 401 Unauthorized. Trying next key if available.")
                    last_exception = ExtractionError("AI service authentication failed.")
                    continue
                if response.status_code == 429:
                    logger.warning("Hugging Face API token returned 429 Rate Limited. Trying next key if available.")
                    last_exception = ExtractionError("AI service rate limit reached.")
                    continue
                if response.status_code == 422:
                    raise NonRetryableExtractionError("AI service rejected the request payload.")
                
                response.raise_for_status()
                
                data = response.json()
                raw_text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                logger.debug(f"Raw Gemma response: {raw_text[:500]}")
                return raw_text

        except httpx.TimeoutException:
            logger.warning("Hugging Face API timeout. Trying next key if available.")
            last_exception = ExtractionError("AI service timed out.")
            continue
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 503:
                logger.warning("Hugging Face API 503 unavailable. Trying next key if available.")
                last_exception = ExtractionError("AI service temporarily unavailable.")
                continue
            logger.warning(f"Hugging Face HTTP Error {e.response.status_code}: {e.response.text[:200]}. Trying next key if available.")
            last_exception = ExtractionError("AI service encountered a network error.")
            continue
        except httpx.RequestError as e:
            logger.warning(f"Hugging Face request error: {e}. Trying next key if available.")
            last_exception = ExtractionError("AI service network error.")
            continue
        except NonRetryableExtractionError:
            raise

    if last_exception:
        raise last_exception
    raise NonRetryableExtractionError("AI service authentication failed.")

async def process_business_card(images: list, on_attempt=None) -> dict:
    for img in images:
        validate_image(img["image_base64"])
    raw_text = await call_huggingface_api(images, on_attempt=on_attempt)
    return parse_and_validate_gemma_json(raw_text)
