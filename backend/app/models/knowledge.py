# -*- coding: utf-8 -*-
"""
知识库相关数据模型
"""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from enum import Enum


class KnowledgeCategory(str, Enum):
    BASIC = "基础知识"
    PRODUCT = "产品介绍"
    RISK = "风险提示"
    OPERATION = "操作指引"
    COMPLIANCE = "法规合规"
    FAQ = "常见问题"


class KnowledgeItem(BaseModel):
    id: str
    title: str
    content: str
    category: KnowledgeCategory
    tags: List[str] = []
    source: str = ""
    version: int = 1                         # 每次更新自增，用于追溯变更
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None    # 最近一次更新时间


class KnowledgeItemCreate(BaseModel):
    title: str
    content: str
    category: KnowledgeCategory
    tags: List[str] = []
    source: str = ""


class KnowledgeItemUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[KnowledgeCategory] = None
    tags: Optional[List[str]] = None
    source: Optional[str] = None


class SearchResult(BaseModel):
    """知识检索结果，包含置信度"""
    item_id: str    # 对应知识库条目 id，便于前端追溯
    id: str         # 兼容旧字段（同 item_id）
    title: str
    content: str
    category: KnowledgeCategory
    tags: List[str] = []
    source: str = ""
    version: int = 1    # 知识版本号，用于追溯
    score: float        # TF-IDF 余弦相似度原始值
    confidence: float   # 归一化置信度（相对于最高分）
