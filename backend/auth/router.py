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

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

@router.post("/signup", response_model=AuthResponse)
@limiter.limit("5/minute")
def signup(request: Request, body: SignupRequest, supabase: Client | None = Depends(get_supabase), db: Session = Depends(get_db)):
    logger.info(f"Signup attempt for email: {body.email}")
    return AuthService.signup(email=body.email, password=body.password, use_local_auth=USE_LOCAL_AUTH, db=db, supabase=supabase)

@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, supabase: Client | None = Depends(get_supabase), db: Session = Depends(get_db)):
    logger.info(f"Login attempt for email: {body.email}")
    return AuthService.login(email=body.email, password=body.password, use_local_auth=USE_LOCAL_AUTH, db=db, supabase=supabase)

@router.post("/logout", response_model=MessageResponse)
def logout(current_user: dict = Depends(get_current_user), supabase: Client | None = Depends(get_supabase)):
    logger.info(f"Logout requested for user: {current_user.get('email')}")
    AuthService.logout(user_id=current_user.get("id"), use_local_auth=USE_LOCAL_AUTH, supabase=supabase)
    return MessageResponse(message="Logged out")

@router.post("/refresh", response_model=AuthResponse)
@limiter.limit("20/minute")
def refresh(request: Request, body: RefreshRequest, supabase: Client | None = Depends(get_supabase)):
    logger.info("Session refresh requested")
    return AuthService.refresh(refresh_token=body.refresh_token, use_local_auth=USE_LOCAL_AUTH, supabase=supabase)

@router.get("/me", response_model=UserInfo)
def get_me(current_user: dict = Depends(get_current_user)):
    logger.debug(f"User profile retrieved for: {current_user.get('email')}")
    return AuthService.get_me(current_user)
