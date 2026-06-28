from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class CardBase(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    address: Optional[str] = None
    emails: List[str] = []
    phones: List[str] = []
    websites: List[str] = []
    image_url: Optional[str] = None
    raw_extraction: Optional[str] = None

class CardCreate(CardBase):
    pass

class CardUpdate(CardBase):
    pass

class CardResponse(CardBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    image_url: Optional[str] = None
    company_id: Optional[str] = None
    raw_extraction: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CardListResponse(BaseModel):
    cards: List[CardResponse]
    total: int
