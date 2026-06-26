import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

class BusinessCard(Base):
    __tablename__ = "business_cards"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    image_url = Column(Text, nullable=True)
    name = Column(Text, nullable=True)
    title = Column(Text, nullable=True)
    company = Column(Text, nullable=True)
    address = Column(Text, nullable=True)
    
    emails = Column(JSONB, nullable=False, server_default='[]')
    phones = Column(JSONB, nullable=False, server_default='[]')
    websites = Column(JSONB, nullable=False, server_default='[]')
    raw_extraction = Column(Text, nullable=True)
