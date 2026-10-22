# -*- coding: utf-8 -*-
"""
/api/session 路由
"""
from fastapi import APIRouter, HTTPException
from app.services import chat_service

router = APIRouter()


@router.get("/session/{session_id}", summary="获取会话详情")
async def get_session(session_id: str) -> dict:
    session = chat_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return session.model_dump()


@router.post("/session/{session_id}/transfer", summary="转接人工客服")
async def transfer_to_human(session_id: str) -> dict:
    ok = chat_service.transfer_session(session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {"session_id": session_id, "status": "transferred"}
