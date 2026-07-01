import logging
import time
from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from supabase import create_client, Client
from core.config import settings
from core.exceptions import AuthenticationError

logger = logging.getLogger(__name__)

# Simple cache for Supabase token validation: token -> (user_dict, expire_time)
_token_cache = {}
CACHE_TTL = 300  # cache for 5 minutes (300 seconds)

def get_supabase() -> Client | None:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.error("Supabase credentials not configured in environment")
        raise Exception("Supabase credentials not configured")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise AuthenticationError("Missing or invalid Authorization header")
        
    parts = auth_header.split(" ")
    if len(parts) < 2:
        raise AuthenticationError("Missing or invalid Authorization token")
    token = parts[1]
    
    # Check cache first
    now = time.time()
    cached = _token_cache.get(token)
    if cached:
        user_data, expire_time = cached
        if now < expire_time:
            return user_data
        else:
            # Remove expired token from cache
            _token_cache.pop(token, None)

    # Supabase Auth: Delegate token validation to the Supabase client
    try:
        supabase = get_supabase()
        response = supabase.auth.get_user(token)
        if not response or not response.user:
            raise AuthenticationError("Invalid token")
        user_data = {"id": response.user.id, "email": response.user.email}
        
        # Cache the successful validation
        # Prevent unbounded growth: clear expired entries if cache is large
        if len(_token_cache) > 500:
            for k, (_, exp) in list(_token_cache.items()):
                if now >= exp:
                    _token_cache.pop(k, None)
        
        _token_cache[token] = (user_data, now + CACHE_TTL)
        return user_data
    except Exception as e:
        logger.warning(f"Supabase Token Validation Error: {str(e)}")
        raise AuthenticationError("Token expired" if "expired" in str(e).lower() else "Invalid token")

