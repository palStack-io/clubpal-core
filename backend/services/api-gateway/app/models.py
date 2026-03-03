from pydantic import BaseModel, Field, validator, EmailStr
from typing import Optional
from datetime import datetime


# User models
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = Field(None, max_length=200)

    @validator('username')
    def username_alphanumeric(cls, v):
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Username must be alphanumeric (underscores and hyphens allowed)')
        return v.lower()

    @validator('email')
    def email_lowercase(cls, v):
        return v.lower()


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str]
    avatar_url: Optional[str] = None
    is_admin: bool
    is_active: bool = True
    email_verified: bool
    onboarding_complete: bool = False
    password_changed: bool = True
    created_at: datetime
    last_login_at: Optional[datetime]


class SessionResponse(BaseModel):
    user: UserResponse
    session_token: str
    expires_at: datetime


# Invite models
class InviteSendRequest(BaseModel):
    email: EmailStr
    group_id: int
    invited_by: int
    group_name: str


class InviteValidateRequest(BaseModel):
    token: str


class InviteAcceptRequest(BaseModel):
    token: str
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    password: Optional[str] = Field(None, min_length=8)


class InviteResponse(BaseModel):
    invite_token: str
    expires_at: datetime
    user_exists: bool


class InviteValidateResponse(BaseModel):
    valid: bool
    email: str
    group_name: str
    invited_by_name: str
    user_exists: bool
    expires_at: datetime


class InviteAcceptResponse(BaseModel):
    user: UserResponse
    session_token: str
    group: dict


# Email verification models
class EmailVerifyRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


# Admin models
class AdminUserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None
    is_admin: bool = False
    email_verified: bool = False


# Profile update
class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=200)
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    avatar_url: Optional[str] = None


# Admin update
class UserAdminUpdate(BaseModel):
    full_name: Optional[str] = None
    is_admin: Optional[bool] = None
    email_verified: Optional[bool] = None
    is_active: Optional[bool] = None


# Session info
class SessionInfo(BaseModel):
    session_token: str
    created_at: datetime
    expires_at: datetime
    last_used_at: Optional[datetime] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


# Discover preferences
from typing import List

class UserPreferencesUpdate(BaseModel):
    location_address: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    radius_dining: Optional[int] = 10
    radius_hiking: Optional[int] = 25
    radius_arts: Optional[int] = 10
    activities: Optional[List[str]] = None
    book_genres: Optional[List[str]] = None
    movie_genres: Optional[List[str]] = None
    game_types: Optional[List[str]] = None


class UserPreferencesResponse(BaseModel):
    user_id: int
    location_address: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    radius_dining: int = 10
    radius_hiking: int = 25
    radius_arts: int = 10
    activities: List[str] = ["dining", "movies", "books", "hiking", "gaming", "arts"]
    book_genres: List[str] = []
    movie_genres: List[str] = []
    game_types: List[str] = ["video_game", "board_game"]
    onboarding_complete: bool = False
    last_loaded_at: Optional[datetime] = None
