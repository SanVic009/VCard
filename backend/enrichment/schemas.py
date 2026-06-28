from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Any
from datetime import datetime

class EnrichmentRequest(BaseModel):
    card_id: str

class EnrichmentStatusResponse(BaseModel):
    status: str
    company_id: Optional[str] = None

class CompanyDetailResponse(BaseModel):
    id: str
    created_at: datetime
    updated_at: datetime
    name: Optional[str] = None
    website: Optional[str] = None
    location: Optional[str] = None
    products: List[Any] = []
    services: List[Any] = []
    technologies: List[str] = []
    raw_data: Optional[Any] = None
    enrichment_status: str
    enrichment_error: Optional[str] = None
    card_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
