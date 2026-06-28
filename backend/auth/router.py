import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from supabase import Client
from .dependencies import get_supabase, get_current_user
from database import get_db, USE_LOCAL_AUTH
from .schemas import SignupRequest, LoginRequest, RefreshRequest, AuthResponse, UserInfo, MessageResponse
from .service import AuthService
from slowapi import Limiter
from slowapi.util import get_remote_address
from core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
# TODO: Switch slowapi storage to Redis if deploying multiple instances to share rate limit state.
# Example: limiter = Limiter(key_func=get_remote_address, storage_uri="redis://localhost:6379", ...)
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],
    enabled=settings.rate_limit_enabled
)

@router.post("/signup", response_model=AuthResponse)
@limiter.limit("5/minute")
def signup(request: Request, body: SignupRequest, supabase: Client | None = Depends(get_supabase), db: Session = Depends(get_db)):
    logger.info("Signup attempt received")
    return AuthService.signup(email=body.email, password=body.password, use_local_auth=USE_LOCAL_AUTH, db=db, supabase=supabase)

@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, supabase: Client | None = Depends(get_supabase), db: Session = Depends(get_db)):
    logger.info("Login attempt received")
    return AuthService.login(email=body.email, password=body.password, use_local_auth=USE_LOCAL_AUTH, db=db, supabase=supabase)

@router.post("/logout", response_model=MessageResponse)
def logout(current_user: dict = Depends(get_current_user), supabase: Client | None = Depends(get_supabase)):
    logger.info("Logout requested")
    AuthService.logout(user_id=current_user.get("id"), use_local_auth=USE_LOCAL_AUTH, supabase=supabase)
    return MessageResponse(message="Logged out")

@router.post("/refresh", response_model=AuthResponse)
@limiter.limit("20/minute")
def refresh(request: Request, body: RefreshRequest, supabase: Client | None = Depends(get_supabase)):
    logger.info("Session refresh requested")
    return AuthService.refresh(refresh_token=body.refresh_token, use_local_auth=USE_LOCAL_AUTH, supabase=supabase)

@router.get("/me", response_model=UserInfo)
def get_me(current_user: dict = Depends(get_current_user)):
    logger.debug("User profile retrieved")
    return AuthService.get_me(current_user)
