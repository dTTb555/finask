# -*- coding: utf-8 -*-
"""
/api/analytics 路由 — 运营统计
"""
from fastapi import APIRouter, Query
from app.services import analytics_store

router = APIRouter()


@router.get("/analytics/overview", summary="统计概览（总量、高风险、转人工等）")
async def overview() -> dict:
    return analytics_store.get_overview()


@router.get("/analytics/top-questions", summary="高频问题 Top N")
async def top_questions(limit: int = Query(10, ge=1, le=50)) -> list:
    return analytics_store.get_top_questions(limit)


@router.get("/analytics/recent-logs", summary="最近问答记录")
async def recent_logs(limit: int = Query(20, ge=1, le=100)) -> list:
    return analytics_store.get_recent_logs(limit)


@router.get("/analytics/risk-distribution", summary="风险类型分布")
async def risk_distribution() -> list:
    return analytics_store.get_risk_distribution()


@router.get("/analytics/daily-trend", summary="每日问题数趋势")
async def daily_trend(days: int = Query(7, ge=1, le=30)) -> list:
    return analytics_store.get_daily_trend(days)


@router.get("/analytics/knowledge-gaps", summary="知识缺口列表（知识库未命中的高频问题）")
async def knowledge_gaps(limit: int = Query(20, ge=1, le=100)) -> list:
    """
    返回 risk_type=no_knowledge_base 的高频问题，
    供运营人员发现知识缺口、决定是否补充知识库。
    """
    return analytics_store.get_knowledge_gaps(limit)
