import logging
import secure
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from auth.router import router as auth_router, limiter
from cards.router import router as cards_router
from extraction.router import router as extraction_router
from database import engine, Base, USE_LOCAL_AUTH
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

# Configure logging at startup to follow format: timestamp | level | module | message
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)
logger = logging.getLogger(__name__)

secure_headers = secure.Secure()

@asynccontextmanager
async def lifespan(app: FastAPI):
    if USE_LOCAL_AUTH:
        logger.info("Initializing app with LOCAL Auth Mode.")
        try:
            Base.metadata.create_all(bind=engine)
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
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Custom Exception Handlers
app.add_exception_handler(AuthenticationError, authentication_error_handler)
app.add_exception_handler(AuthorizationError, authorization_error_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Secure Headers Middleware
@app.middleware("http")
async def set_secure_headers(request: Request, call_next):
    response = await call_next(request)
    secure_headers.framework.fastapi(response)
    return response

# Logging Middleware for all requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(f"{request.method} {request.url.path} | Status: {response.status_code} | Duration: {duration:.4f}s")
    return response

app.include_router(auth_router)
app.include_router(cards_router)
app.include_router(extraction_router, prefix="/extraction", tags=["Extraction"])

@app.get("/")
def read_root():
    return {"status": "ok", "auth_mode": "local" if USE_LOCAL_AUTH else "supabase"}
