import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

USE_LOCAL_AUTH = os.getenv("USE_LOCAL_AUTH", "false").lower() == "true"
DATABASE_URL = os.getenv("DATABASE_URL")

engine = None
SessionLocal = None

if USE_LOCAL_AUTH:
    if not DATABASE_URL:
        raise Exception("DATABASE_URL is not set but USE_LOCAL_AUTH is true")
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    if not SessionLocal:
        yield None
        return
        
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
