import logging
from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from supabase import create_client, Client
from sqlalchemy.orm import Session
from database import get_db, USE_LOCAL_AUTH
from core.config import settings
from core.security import verify_jwt
from core.exceptions import AuthenticationError

logger = logging.getLogger(__name__)

def get_supabase() -> Client | None:
    if USE_LOCAL_AUTH:
        return None
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.error("Supabase credentials not configured in environment")
        raise Exception("Supabase credentials not configured")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def get_current_user(request: Request, db: Session = Depends(get_db)) -> dict:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise AuthenticationError("Missing or invalid Authorization header")
        
    parts = auth_header.split(" ")
    if len(parts) < 2:
        raise AuthenticationError("Missing or invalid Authorization token")
    token = parts[1]
    
    if USE_LOCAL_AUTH:
        payload = verify_jwt(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            logger.warning("Token decoding failed: 'sub' (user_id) missing from payload")
            raise AuthenticationError("Invalid token")
            
        if not db:
            logger.error("Database session dependency failed inside get_current_user")
            raise Exception("Database connection missing")
            
        from models import User
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            logger.warning(f"Authentication failed: User {user_id} not found in local database")
            raise AuthenticationError("Invalid token")
        return {"id": str(user.id), "email": user.email}
    else:
        # Supabase Auth: Delegate token validation to the Supabase client
        try:
            supabase = get_supabase()
            response = supabase.auth.get_user(token)
            if not response or not response.user:
                raise AuthenticationError("Invalid token")
            return {"id": response.user.id, "email": response.user.email}
        except Exception as e:
            logger.warning(f"Supabase Token Validation Error: {str(e)}")
            raise AuthenticationError("Token expired" if "expired" in str(e).lower() else "Invalid token")

