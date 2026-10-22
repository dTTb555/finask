# -*- coding: utf-8 -*-
"""
/api/knowledge 路由 — 知识库 CRUD
"""
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from app.models.knowledge import (
    KnowledgeItem, KnowledgeItemCreate, KnowledgeItemUpdate, SearchResult
)
from app.services import knowledge_search

router = APIRouter()


@router.get("/knowledge", response_model=List[KnowledgeItem], summary="获取所有知识库条目")
async def list_knowledge() -> List[KnowledgeItem]:
    return knowledge_search.get_all()


@router.get("/knowledge/search", response_model=List[SearchResult], summary="知识库检索")
async def search_knowledge(
    q: str = Query(..., description="检索关键词"),
    top_k: Optional[int] = Query(None, description="返回条数，默认取配置值"),
    min_score: Optional[float] = Query(None, description="最低相关度阈值"),
) -> List[SearchResult]:
    if not q.strip():
        raise HTTPException(status_code=400, detail="查询关键词不能为空")
    return knowledge_search.search(q, top_k=top_k, min_score=min_score)


@router.get("/knowledge/{item_id}", response_model=KnowledgeItem, summary="获取单条知识库条目")
async def get_knowledge(item_id: str) -> KnowledgeItem:
    item = knowledge_search.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"知识条目 {item_id} 不存在")
    return item


@router.post("/knowledge", response_model=KnowledgeItem, status_code=201, summary="新增知识条目")
async def create_knowledge(data: KnowledgeItemCreate) -> KnowledgeItem:
    return knowledge_search.create_item(data)


@router.put("/knowledge/{item_id}", response_model=KnowledgeItem, summary="更新知识条目")
async def update_knowledge(item_id: str, data: KnowledgeItemUpdate) -> KnowledgeItem:
    item = knowledge_search.update_item(item_id, data)
    if not item:
        raise HTTPException(status_code=404, detail=f"知识条目 {item_id} 不存在")
    return item


@router.delete("/knowledge/{item_id}", summary="删除知识条目")
async def delete_knowledge(item_id: str) -> dict:
    ok = knowledge_search.delete_item(item_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"知识条目 {item_id} 不存在")
    return {"deleted": item_id}
