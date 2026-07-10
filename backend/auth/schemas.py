from pydantic import BaseModel, EmailStr, Field

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class UserInfo(BaseModel):
    id: str
    email: str

class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserInfo

class MessageResponse(BaseModel):
    message: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr
