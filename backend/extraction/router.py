from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from core.config import settings
from auth.dependencies import get_current_user
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
    user: dict = Depends(get_current_user)
):
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
        data = await process_business_card(images_to_process)
        return ExtractionResponse(success=True, data=data)
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Extraction failed: {error_msg}")
        return ExtractionResponse(success=False, error=error_msg)
