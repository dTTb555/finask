# -*- coding: utf-8 -*-
"""
FinAsk Backend — FastAPI 应用入口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes.chat import router as chat_router
from app.routes.knowledge import router as knowledge_router
from app.routes.session import router as session_router
from app.routes.analytics import router as analytics_router

app = FastAPI(
    title="FinAsk API",
    description="金融智能问答助手 — 后端服务",
    version="0.2.0",
)

# CORS — 生产时 CORS_ORIGINS 包含实际前端域名，或设为 "*" 允许所有来源（Demo 可接受）
_cors_origins = settings.cors_origins_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials="*" not in _cors_origins,   # allow_credentials 与 * 不兼容
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由注册
app.include_router(chat_router, prefix="/api", tags=["Chat"])
app.include_router(knowledge_router, prefix="/api", tags=["Knowledge"])
app.include_router(session_router, prefix="/api", tags=["Session"])
app.include_router(analytics_router, prefix="/api", tags=["Analytics"])


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "version": "0.2.0"}
