import json
import re
import logging
from typing import Dict, Any, Optional
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3-flash",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash"
]

PROMPT_TEMPLATE_WEBSITE = """You are a company research and product extraction agent.
Given a company website URL, research the company using Google Search grounding and find its details:
1. Legal/Common Company Name
2. Headquarters Location (City, State/Country)
3. Products offered (names and short descriptions)
4. Services offered (names and short descriptions)
5. Technologies used (e.g. programming languages, frameworks, cloud providers, software tools)

Company Website: {company_url}

Steps:
1. Visit the URL. Check /products, /services, /shop, /catalog, /solutions, /about pages.
2. If needed, web search: "site:{company_url} products" or "<company name> product catalog".
3. Extract every distinct product, service, and technology. Do NOT hallucinate.

Return ONLY valid JSON, no markdown, no explanation:
{{
  "company_name": "<name>",
  "website": "{company_url}",
  "location": "<location or null>",
  "products": [
    {{
      "name": "<product name>",
      "description": "<short description>"
    }}
  ],
  "services": [
    {{
      "name": "<service name>",
      "description": "<short description>"
    }}
  ],
  "technologies": [
    "<technology name>"
  ]
}}
"""

PROMPT_TEMPLATE_NAME = """You are a company research and product extraction agent.
Given a company name, research the company using Google Search grounding and find its details:
1. Legal/Common Company Name
2. Headquarters Location (City, State/Country)
3. Products offered (names and short descriptions)
4. Services offered (names and short descriptions)
5. Technologies used (e.g. programming languages, frameworks, cloud providers, software tools)

Company Name: {company_name}

Steps:
1. Perform web search: "<company_name> official website", "<company_name> products", or "<company_name> services technologies".
2. Find their official website URL and list of offerings.
3. Extract every distinct product, service, and technology. Do NOT hallucinate.

Return ONLY valid JSON, no markdown, no explanation:
{{
  "company_name": "{company_name}",
  "website": "<official website url or null>",
  "location": "<location or null>",
  "products": [
    {{
      "name": "<product name>",
      "description": "<short description>"
    }}
  ],
  "services": [
    {{
      "name": "<service name>",
      "description": "<short description>"
    }}
  ],
  "technologies": [
    "<technology name>"
  ]
}}
"""

def clean_json_response(raw: str) -> str:
    raw = raw.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    if match:
        return match.group(1).strip()
    return raw

class EnrichmentService:
    def __init__(self, api_key: Optional[str]):
        self.api_key = api_key
        if not api_key or api_key == "your_gemini_api_key_here":
            logger.warning("Gemini API key is not configured. Enrichment will fail.")

    def enrich_company(self, website: Optional[str], name: Optional[str], on_attempt=None) -> Dict[str, Any]:
        if not self.api_key or self.api_key == "your_gemini_api_key_here":
            raise ValueError("GEMINI_API_KEY is not configured in the environment.")

        # Build prompt depending on website or name
        if website and website.strip():
            company_url = website.strip()
            # Ensure protocol is present for Gemini Search
            if not company_url.startswith(("http://", "https://")):
                company_url = "https://" + company_url
            prompt = PROMPT_TEMPLATE_WEBSITE.format(company_url=company_url)
        elif name and name.strip():
            prompt = PROMPT_TEMPLATE_NAME.format(company_name=name.strip())
        else:
            raise ValueError("Neither website nor company name is available for enrichment.")

        client = genai.Client(api_key=self.api_key)

        last_error = None
        for idx, model in enumerate(MODELS):
            if on_attempt:
                on_attempt()
            try:
                if idx > 0:
                    logger.debug(f"Retrying Gemini enrichment with model: {model} (attempt {idx + 1})")
                else:
                    logger.info(f"Enriching company info using model: {model}...")
                
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        tools=[types.Tool(google_search=types.GoogleSearch())],
                        temperature=0.1,
                    ),
                )
                raw_text = response.text
                if not raw_text:
                    raise ValueError("Model returned empty response text")

                # Log Gemini raw response (truncated)
                logger.debug(f"Gemini raw response (truncated): {raw_text[:500]}...")

                clean_text = clean_json_response(raw_text)
                result = json.loads(clean_text)
                
                # Validate response structure, ensuring lists exist
                if not isinstance(result.get("products"), list):
                    result["products"] = []
                if not isinstance(result.get("services"), list):
                    result["services"] = []
                if not isinstance(result.get("technologies"), list):
                    result["technologies"] = []

                # Ensure default values are populated if missing
                if not result.get("company_name") and name:
                    result["company_name"] = name
                if not result.get("website") and website:
                    result["website"] = website

                return result
            except Exception as e:
                logger.warning(f"Error using model {model}: {e}")
                last_error = e

        if last_error:
            logger.error(f"Gemini enrichment failed after trying all models: {last_error}")
            raise last_error
        logger.error("Gemini enrichment failed: All Gemini models failed to generate response.")
        raise RuntimeError("All Gemini models failed to generate response.")
