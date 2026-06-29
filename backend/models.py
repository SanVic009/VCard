import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

class Company(Base):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    name = Column(Text, nullable=True, index=True)
    website = Column(Text, nullable=True, index=True)
    location = Column(Text, nullable=True)

    products = Column(JSONB, nullable=False, server_default='[]')
    services = Column(JSONB, nullable=False, server_default='[]')
    technologies = Column(JSONB, nullable=False, server_default='[]')
    raw_data = Column(JSONB, nullable=True)

    enrichment_status = Column(Text, nullable=False, default="pending")
    enrichment_error = Column(Text, nullable=True)

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
    
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)


class ExtractionJob(Base):
    __tablename__ = "extraction_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    card_id = Column(UUID(as_uuid=True), ForeignKey("business_cards.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    status = Column(Text, nullable=False, default="pending")
    attempts = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)
    raw_response = Column(Text, nullable=True)
    result = Column(JSONB, nullable=True)


class EnrichmentJob(Base):
    __tablename__ = "enrichment_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    card_id = Column(UUID(as_uuid=True), ForeignKey("business_cards.id", ondelete="CASCADE"), nullable=True, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    status = Column(Text, nullable=False, default="pending")
    attempts = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)
    raw_response = Column(JSONB, nullable=True)
    skipped_reason = Column(Text, nullable=True)


