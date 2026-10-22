# -*- coding: utf-8 -*-
"""
知识库检索服务

功能：
  1. 知识库加载（JSON 文件，启动时一次性读入内存）
  2. jieba 分词 + TF-IDF 向量化
  3. 余弦相似度排序，返回 TopK
  4. 置信度 = 归一化的相似度得分
  5. 支持增删改查（CRUD）
  6. 低于 min_score 的结果被过滤，触发 no_knowledge_base 风险
"""
import json
import math
import os
from typing import List, Optional
from collections import Counter
from datetime import datetime

import jieba

from app.config import settings
from app.models.knowledge import KnowledgeItem, KnowledgeItemCreate, KnowledgeItemUpdate, SearchResult

_DATA_PATH = os.path.join(os.path.dirname(__file__), "../data/knowledge_base.json")

# ─────────────────────────────────────────────────────────────────────────────
# 注入金融领域专业词汇，避免 jieba 将复合金融词达拆分
# ─────────────────────────────────────────────────────────────────────────────
_FINANCE_TERMS = [
    "定投", "净值", "基金净值", "单位净值", "累计净值",
    "市盈率", "市净率", "股票型", "债券型", "混合型",
    "货币基金", "指数基金", "沪深300", "中证500", "上证50",
    "申购费", "赎回费", "管理费", "托管费",
    "风险等级", "适当性", "投资顾问", "基金经理",
    "止损", "仓位", "杠杆", "融资融券",
    "保本", "稳赚不赔", "零风险", "无风险",
    "资产配置", "分散投资", "股债平衡",
    "定期定额", "成本平均", "未知价",
    "信用风险", "利率风险", "流动性风险", "系统性风险",
    "ETF", "PE", "PB", "NAV",
]
for _term in _FINANCE_TERMS:
    jieba.add_word(_term, freq=10000)

# ─────────────────────────────────────────────────────────────────────────────
# 内存知识库
# ─────────────────────────────────────────────────────────────────────────────
_items: List[KnowledgeItem] = []
_id_index: dict = {}       # id -> KnowledgeItem
_tfidf_cache: dict = {}    # id -> {term: tf-idf weight}
_idf: dict = {}            # term -> idf


def _tokenize(text: str) -> List[str]:
    """
    jieba 分词，保留长度>=2 的 token。
    金融专业词已通过 add_word 注入，不会被达拆分。
    """
    tokens = jieba.lcut(text)
    return [t.strip() for t in tokens if len(t.strip()) >= 2]


def _build_tfidf():
    """对所有 knowledge item 构建 TF-IDF 索引"""
    global _tfidf_cache, _idf

    # 文档集
    docs: List[List[str]] = []
    for item in _items:
        tokens = _tokenize(item.title + " " + item.content)
        docs.append(tokens)

    N = len(docs)
    if N == 0:
        _idf = {}
        _tfidf_cache = {}
        return

    # DF
    df: dict = {}
    for tokens in docs:
        for term in set(tokens):
            df[term] = df.get(term, 0) + 1

    # IDF：log((N+1)/(df+1)) + 1（平滑）
    _idf = {term: math.log((N + 1) / (cnt + 1)) + 1.0 for term, cnt in df.items()}

    # TF-IDF per document
    _tfidf_cache = {}
    for item, tokens in zip(_items, docs):
        tf_raw = Counter(tokens)
        total = len(tokens) if tokens else 1
        vec = {term: (cnt / total) * _idf.get(term, 1.0) for term, cnt in tf_raw.items()}
        _tfidf_cache[item.id] = vec


def _cosine(vec_a: dict, vec_b: dict) -> float:
    """计算两个稀疏向量的余弦相似度"""
    common_terms = set(vec_a.keys()) & set(vec_b.keys())
    if not common_terms:
        return 0.0
    dot = sum(vec_a[t] * vec_b[t] for t in common_terms)
    norm_a = math.sqrt(sum(v ** 2 for v in vec_a.values()))
    norm_b = math.sqrt(sum(v ** 2 for v in vec_b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _rebuild_index():
    """重建 id 索引和 TF-IDF"""
    global _id_index
    _id_index = {item.id: item for item in _items}
    _build_tfidf()


# ─────────────────────────────────────────────────────────────────────────────
# 知识库初始化（模块加载时执行）
# ─────────────────────────────────────────────────────────────────────────────
def _load():
    global _items
    if not os.path.exists(_DATA_PATH):
        _items = []
        _rebuild_index()
        return
    with open(_DATA_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    _items = [KnowledgeItem(**d) for d in raw]
    _rebuild_index()


_load()


# ─────────────────────────────────────────────────────────────────────────────
# 公开 API
# ─────────────────────────────────────────────────────────────────────────────
def get_all() -> List[KnowledgeItem]:
    return list(_items)


def get_by_id(item_id: str) -> Optional[KnowledgeItem]:
    return _id_index.get(item_id)


def search(query: str,
           top_k: Optional[int] = None,
           min_score: Optional[float] = None) -> List[SearchResult]:
    """
    TF-IDF 检索，返回 SearchResult 列表（已按相关度降序排序）。

    SearchResult 额外包含 confidence 字段（0~1），
    计算方式：归一化后的余弦得分（最高分对应 1.0）
    """
    k = top_k or settings.SEARCH_TOP_K
    threshold = min_score if min_score is not None else settings.SEARCH_MIN_SCORE

    query_tokens = _tokenize(query)
    if not query_tokens:
        return []

    # 构造查询向量
    tf_raw = Counter(query_tokens)
    total = len(query_tokens)
    query_vec = {term: (cnt / total) * _idf.get(term, 1.0)
                 for term, cnt in tf_raw.items()
                 if term in _idf}

    if not query_vec:
        return []

    # 对所有文档计算得分
    scores: List[tuple] = []
    for item in _items:
        doc_vec = _tfidf_cache.get(item.id, {})
        score = _cosine(query_vec, doc_vec)
        if score >= threshold:
            scores.append((item, score))

    if not scores:
        return []

    # 排序取 TopK
    scores.sort(key=lambda x: x[1], reverse=True)
    scores = scores[:k]

    # 归一化：最高分作为基准计算 confidence
    max_score = scores[0][1]

    results: List[SearchResult] = []
    for item, score in scores:
        confidence = round(score / max_score if max_score > 0 else score, 4)
        results.append(SearchResult(
            item_id=item.id,
            id=item.id,
            title=item.title,
            content=item.content,
            category=item.category,
            tags=item.tags,
            source=item.source,
            version=item.version,
            score=round(score, 4),
            confidence=confidence,
        ))
    return results


def create_item(data: KnowledgeItemCreate) -> KnowledgeItem:
    new_id = f"kb_{len(_items) + 1:03d}_custom"
    item = KnowledgeItem(
        id=new_id,
        title=data.title,
        content=data.content,
        category=data.category,
        tags=data.tags or [],
        source=data.source or "",
        created_at=datetime.now(),
    )
    _items.append(item)
    _rebuild_index()
    _persist()
    return item


def update_item(item_id: str, updates: KnowledgeItemUpdate) -> Optional[KnowledgeItem]:
    item = _id_index.get(item_id)
    if not item:
        return None
    update_data = updates.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(item, k, v)
    item.version = (item.version or 1) + 1     # 版本号自增
    item.updated_at = datetime.now()            # 更新时间戳
    _rebuild_index()
    _persist()
    return item


def delete_item(item_id: str) -> bool:
    global _items
    if item_id not in _id_index:
        return False
    _items = [i for i in _items if i.id != item_id]
    _rebuild_index()
    _persist()
    return True


def _persist():
    """将内存数据写回 JSON 文件"""
    data = [
        {
            "id": item.id,
            "title": item.title,
            "content": item.content,
            "category": item.category,
            "tags": item.tags,
            "source": item.source,
            "version": item.version or 1,
            "created_at": item.created_at.isoformat() if item.created_at else "",
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        }
        for item in _items
    ]
    with open(_DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
