import logging
import time
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from auth.router import router as auth_router, limiter
from cards.router import router as cards_router
from extraction.router import router as extraction_router
from enrichment.router import router as enrichment_router
from database import engine, Base, USE_LOCAL_AUTH
from core.config import settings

from auth.dependencies import get_supabase
from core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    authentication_error_handler,
    authorization_error_handler,
    global_exception_handler,
    validation_exception_handler,
    http_exception_handler,
)

from core.logging_config import setup_logging, request_id_ctx_var
import uuid

# Configure logging at startup
setup_logging(settings.environment, settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if USE_LOCAL_AUTH:
        logger.info("Initializing app with LOCAL Auth Mode.")
        try:
            Base.metadata.create_all(bind=engine)
            from sqlalchemy import text
            with engine.connect() as conn:
                conn.execute(text("""
                CREATE OR REPLACE FUNCTION handle_update_timestamp()
                RETURNS TRIGGER AS $$
                BEGIN
                  NEW.updated_at = now();
                  RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
                """))
                
                conn.execute(text("""
                DROP TRIGGER IF EXISTS update_extraction_jobs_updated_at ON extraction_jobs;
                CREATE TRIGGER update_extraction_jobs_updated_at
                BEFORE UPDATE ON extraction_jobs
                FOR EACH ROW
                EXECUTE FUNCTION handle_update_timestamp();
                """))
                
                conn.execute(text("""
                DROP TRIGGER IF EXISTS update_enrichment_jobs_updated_at ON enrichment_jobs;
                CREATE TRIGGER update_enrichment_jobs_updated_at
                BEFORE UPDATE ON enrichment_jobs
                FOR EACH ROW
                EXECUTE FUNCTION handle_update_timestamp();
                """))
                
                conn.execute(text("""
                CREATE OR REPLACE FUNCTION increment_extraction_attempts(job_id uuid)
                RETURNS void AS $$
                BEGIN
                  UPDATE extraction_jobs
                  SET attempts = attempts + 1
                  WHERE id = job_id;
                END;
                $$ LANGUAGE plpgsql;
                """))
                
                conn.execute(text("""
                CREATE OR REPLACE FUNCTION increment_enrichment_attempts(job_id uuid)
                RETURNS void AS $$
                BEGIN
                  UPDATE enrichment_jobs
                  SET attempts = attempts + 1
                  WHERE id = job_id;
                END;
                $$ LANGUAGE plpgsql;
                """))
                conn.commit()
            logger.info("Local database tables verified/created successfully.")
        except Exception as e:
            logger.error(f"Failed to create local database tables: {e}", exc_info=True)
            raise e
    else:
        logger.info("Initializing app with SUPABASE Auth Mode.")
        try:
            supabase = get_supabase()
            if supabase:
                logger.info("Supabase connection configured correctly.")
        except Exception as e:
            logger.warning(f"Supabase connection issue detected on startup: {e}")
    yield

app = FastAPI(title="Business Card Scanner API", version="1.0.0", lifespan=lifespan)

# Rate Limiter
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(RateLimitExceeded)
def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    logger.warning(f"Rate limit exceeded: {request.method} {request.url.path}")
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "error": {
                "code": "RATE_LIMITED",
                "message": "Too many requests."
            }
        }
    )

# Custom Exception Handlers
app.add_exception_handler(AuthenticationError, authentication_error_handler)
app.add_exception_handler(AuthorizationError, authorization_error_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)

# CORS Middleware
origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
if len(origins) == 1 and origins[0] == "*":
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Security Response Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if settings.environment == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Logging Middleware for all requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Extract request ID from headers (X-Request-ID) if present, otherwise generate UUID
    request_id = request.headers.get("x-request-id") or request.headers.get("X-Request-ID")
    if not request_id:
        request_id = str(uuid.uuid4())
        
    token = request_id_ctx_var.set(request_id)
    try:
        logger.info(f"Request started: {request.method} {request.url.path}")
        start_time = time.time()
        
        response = await call_next(request)
        
        duration_ms = int((time.time() - start_time) * 1000)
        logger.info(f"Request completed: {request.method} {request.url.path} - Status: {response.status_code} - Duration: {duration_ms}ms")
        
        if 400 <= response.status_code < 500:
            logger.warning(f"4xx response returned: {response.status_code} for {request.method} {request.url.path}")
        elif response.status_code >= 500:
            logger.error(f"5xx response returned: {response.status_code} for {request.method} {request.url.path}")
            
        response.headers["X-Request-ID"] = request_id
        return response
    finally:
        request_id_ctx_var.reset(token)

app.include_router(auth_router)
app.include_router(cards_router)
app.include_router(extraction_router, prefix="/extraction", tags=["Extraction"])
app.include_router(enrichment_router)

@app.get("/")
@app.head("/")
def read_root():

    return {"status": "ok", "auth_mode": "local" if USE_LOCAL_AUTH else "supabase"}


@app.get("/health")
@app.head("/health")
def health_check():
    return {
        "status": "ok",
        "version": settings.app_version,
        "environment": settings.environment
    }
