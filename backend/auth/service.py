import logging
from sqlalchemy.orm import Session
from supabase import Client
from passlib.context import CryptContext
from core.exceptions import AuthenticationError
from .schemas import AuthResponse, UserInfo
from core.security import create_access_token, create_refresh_token

logger = logging.getLogger(__name__)

# Moving the hashing logic here for local auth
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

class AuthService:
    @staticmethod
    def signup(email: str, password: str, use_local_auth: bool, db: Session = None, supabase: Client = None) -> AuthResponse:
        email = email.strip().lower()
        if use_local_auth:
            from models import User
            if not db:
                logger.error("Signup failed: Database connection missing")
                raise Exception("Database connection missing")
            
            existing_user = db.query(User).filter(User.email == email).first()
            if existing_user:
                logger.warning("Signup failed: Email already registered")
                raise AuthenticationError("Email already registered")
                
            new_user = User(
                email=email,
                hashed_password=get_password_hash(password)
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            
            access_token = create_access_token(data={"sub": str(new_user.id), "email": new_user.email})
            refresh_token = create_refresh_token(data={"sub": str(new_user.id), "email": new_user.email})
            logger.info(f"Signup successful (Local Auth) for user {new_user.id}")
            return AuthResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                user=UserInfo(id=str(new_user.id), email=new_user.email)
            )
        else:
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
    def login(email: str, password: str, use_local_auth: bool, db: Session = None, supabase: Client = None) -> AuthResponse:
        email = email.strip().lower()
        if use_local_auth:
            from models import User
            if not db:
                logger.error("Login failed: Database connection missing")
                raise Exception("Database connection missing")
                
            user = db.query(User).filter(User.email == email).first()
            if not user or not verify_password(password, user.hashed_password):
                logger.warning("Login failed: Invalid credentials")
                raise AuthenticationError("Invalid email or password")
                
            access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
            refresh_token = create_refresh_token(data={"sub": str(user.id), "email": user.email})
            logger.info(f"Login successful (Local Auth) for user {user.id}")
            return AuthResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                user=UserInfo(id=str(user.id), email=user.email)
            )
        else:
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
    def logout(user_id: str, use_local_auth: bool, supabase: Client = None) -> None:
        if use_local_auth:
            # Local auth logout is stateless, just client-side token drop
            pass
        else:
            try:
                supabase.auth.admin.sign_out(user_id)
            except Exception as e:
                logger.warning(f"Supabase logout failed for user {user_id}, ignoring: {str(e)}")

    @staticmethod
    def refresh(refresh_token: str, use_local_auth: bool, supabase: Client = None) -> AuthResponse:
        if use_local_auth:
            from jose import jwt, JWTError
            from core.config import settings
            from core.security import verify_jwt
            try:
                payload = verify_jwt(refresh_token)
                if payload.get("type") != "refresh":
                    raise AuthenticationError("Invalid token type")
                user_id = payload.get("sub")
                email = payload.get("email")
                access_token = create_access_token(data={"sub": user_id, "email": email})
                new_refresh_token = create_refresh_token(data={"sub": user_id, "email": email})
                return AuthResponse(
                    access_token=access_token,
                    refresh_token=new_refresh_token,
                    user=UserInfo(id=user_id, email=email)
                )
            except (JWTError, AuthenticationError):
                raise AuthenticationError("Session expired. Please log in again.")
        else:
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
