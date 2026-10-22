# -*- coding: utf-8 -*-
"""
对话相关数据模型
"""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum

from app.models.risk import RiskAssessment
from app.models.knowledge import SearchResult


class SessionStatus(str, Enum):
    ACTIVE = "active"
    TRANSFERRED = "transferred"
    CLOSED = "closed"


class Message(BaseModel):
    role: str                    # "user" | "assistant"
    content: str
    timestamp: datetime = Field(default_factory=datetime.now)


class Session(BaseModel):
    id: str
    status: SessionStatus = SessionStatus.ACTIVE
    created_at: datetime = Field(default_factory=datetime.now)
    messages: List[Message] = []


class ChatRequest(BaseModel):
    session_id: Optional[str] = None   # 首次为空，后续传入
    message: str
    user_id: str = "demo_user"


class AnswerPayload(BaseModel):
    content: str
    is_blocked: bool = False
    transfer_to_human: bool = False
    confidence: float = 0.0     # 综合置信度 0~1


class ChatResponse(BaseModel):
    session_id: str
    question: str
    question_category: str = "general"   # 问题分类
    answer: AnswerPayload
    risk_assessment: RiskAssessment
    sources: List[SearchResult] = []
    processing_ms: int = 0
