from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from core.config import settings
from auth.dependencies import get_current_user, get_supabase
from supabase import Client
from extraction.service import process_business_card
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class ImagePayload(BaseModel):
    image_base64: str
    mime_type: str

class ExtractionRequest(BaseModel):
    image_base64: Optional[str] = None
    mime_type: Optional[str] = None
    images: Optional[List[ImagePayload]] = None
    card_id: Optional[str] = None

class ExtractionResult(BaseModel):
    name: Optional[str]
    title: Optional[str]
    company: Optional[str]
    address: Optional[str]
    emails: List[str]
    phones: List[str]
    websites: List[str]
    raw_extraction: str

class ExtractionResponse(BaseModel):
    success: bool
    data: Optional[ExtractionResult] = None
    error: Optional[str] = None

@router.post("/extract", response_model=ExtractionResponse)
async def extract_card(
    request: ExtractionRequest,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    user_id = user.get("id")
    job_id = None
    try:
        if request.images:
            images_to_process = [{"image_base64": img.image_base64, "mime_type": img.mime_type} for img in request.images]
        elif request.image_base64 and request.mime_type:
            images_to_process = [{"image_base64": request.image_base64, "mime_type": request.mime_type}]
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No image data provided."
            )
            
        # 1. Before calling HuggingFace: insert extraction_jobs row with status 'pending'
        try:
            job_data = {
                "card_id": request.card_id,
                "user_id": user_id,
                "status": "pending",
                "attempts": 0
            }
            job_res = supabase.table("extraction_jobs").insert(job_data).execute()
            if job_res.data:
                job_id = job_res.data[0]["id"]
        except Exception as e:
            logger.error(f"Failed to insert extraction job in Supabase: {e}")

        # Define attempt increment callback
        def on_attempt():
            if job_id:
                try:
                    supabase.rpc("increment_extraction_attempts", {"job_id": job_id}).execute()
                except Exception as e:
                    logger.error(f"Failed to increment attempts in Supabase: {e}")

        # Call extraction service
        data = await process_business_card(images_to_process, on_attempt=on_attempt)
        
        # 2. On success: update status 'completed', store result and raw_response
        if job_id:
            try:
                supabase.table("extraction_jobs").update({
                    "status": "completed",
                    "result": data,
                    "raw_response": data.get("raw_extraction")
                }).eq("id", job_id).execute()
            except Exception as e:
                logger.error(f"Failed to update extraction job success in Supabase: {e}")
                
        return ExtractionResponse(success=True, data=data)
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Extraction failed: {error_msg}")
        
        # 3. On failure: update status 'failed', store last_error
        if job_id:
            try:
                supabase.table("extraction_jobs").update({
                    "status": "failed",
                    "last_error": error_msg
                }).eq("id", job_id).execute()
            except Exception as update_err:
                logger.error(f"Failed to update extraction job failure in Supabase: {update_err}")
                
        return ExtractionResponse(success=False, error=error_msg)
