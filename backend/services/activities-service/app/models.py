from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


# Activity models
class ActivityCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, max_length=50)
    icon: Optional[str] = Field(None, max_length=50)
    metadata: Optional[Dict[str, Any]] = None


class ActivityUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, max_length=50)
    icon: Optional[str] = Field(None, max_length=50)
    metadata: Optional[Dict[str, Any]] = None


class ActivityResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    category: Optional[str]
    icon: Optional[str]
    metadata: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    usage_count: int


# Category models
class CategoryResponse(BaseModel):
    category: str
    count: int
