# -*- coding: utf-8 -*-
"""
/api/chat 路由
"""
from fastapi import APIRouter
from app.models.chat import ChatRequest, ChatResponse
from app.services import chat_service

router = APIRouter()


@router.post("/chat", response_model=ChatResponse, summary="发送问题并获取回答")
async def chat(req: ChatRequest) -> ChatResponse:
    """
    核心问答接口。

    处理流程：合规检测 → 问题分类 → 知识检索 → LLM 生成 → 置信度计算 → 组装响应
    """
    return await chat_service.handle_chat(req)
