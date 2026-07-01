import logging
from supabase import Client
from core.exceptions import AuthenticationError
from .schemas import AuthResponse, UserInfo

logger = logging.getLogger(__name__)

class AuthService:
    @staticmethod
    def signup(email: str, password: str, supabase: Client = None) -> AuthResponse:
        email = email.strip().lower()
        try:
            # We need admin access to create users directly and bypass email confirmation easily if needed
            supabase.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True
            })
            
            auth_response = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            
            logger.info(f"Signup successful (Supabase) for user {auth_response.user.id}")
            return AuthResponse(
                access_token=auth_response.session.access_token,
                refresh_token=auth_response.session.refresh_token,
                user=UserInfo(id=auth_response.user.id, email=auth_response.user.email)
            )
        except Exception as e:
            logger.error(f"Supabase signup failed: {str(e)}")
            raise AuthenticationError(str(e))

    @staticmethod
    def login(email: str, password: str, supabase: Client = None) -> AuthResponse:
        email = email.strip().lower()
        try:
            response = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            logger.info(f"Login successful (Supabase) for user {response.user.id}")
            return AuthResponse(
                access_token=response.session.access_token,
                refresh_token=response.session.refresh_token,
                user=UserInfo(id=response.user.id, email=response.user.email)
            )
        except Exception as e:
            logger.warning(f"Login failed (Supabase): {str(e)}")
            raise AuthenticationError("Invalid email or password")

    @staticmethod
    def logout(user_id: str, supabase: Client = None) -> None:
        try:
            supabase.auth.admin.sign_out(user_id)
        except Exception as e:
            logger.warning(f"Supabase logout failed for user {user_id}, ignoring: {str(e)}")

    @staticmethod
    def refresh(refresh_token: str, supabase: Client = None) -> AuthResponse:
        try:
            response = supabase.auth.refresh_session(refresh_token)
            return AuthResponse(
                access_token=response.session.access_token,
                refresh_token=response.session.refresh_token,
                user=UserInfo(id=response.user.id, email=response.user.email)
            )
        except Exception as e:
            logger.warning(f"Refresh failed: {str(e)}")
            raise AuthenticationError("Session expired. Please log in again.")

    @staticmethod
    def get_me(payload: dict) -> UserInfo:
        return UserInfo(id=payload.get("id"), email=payload.get("email"))
