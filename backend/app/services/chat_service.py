# -*- coding: utf-8 -*-
"""
Chat 服务 — 核心链路编排

完整处理流程：
  1. 合规风险识别（risk_detector）
  2. 问题分类（基于风险检测结果 + 关键词）
  3. 知识库检索（knowledge_search）
  4. 无命中时补充 no_knowledge_base 风险
  5. Mock/LLM 模型生成回答（llm_service）
  6. 置信度计算（检索置信度 × 风险调整系数）
  7. 转人工判断
  8. 组装 ChatResponse
"""
import uuid
import time
from datetime import datetime
from typing import Optional, Dict

from app.models.chat import (
    ChatRequest, ChatResponse, AnswerPayload,
    Message, Session, SessionStatus,
)
from app.models.risk import RiskLevel, RiskType, RiskAssessment
from app.models.knowledge import SearchResult
from app.services import knowledge_search, risk_detector, llm_service
from app.services import analytics_store

# ─────────────────────────────────────────────────────────────────────────────
# 内存会话存储（Demo 用，重启即清空）
# ─────────────────────────────────────────────────────────────────────────────
_sessions: Dict[str, Session] = {}


# ─────────────────────────────────────────────────────────────────────────────
# 问题分类（QuestionCategory）
# ─────────────────────────────────────────────────────────────────────────────
_CATEGORY_KEYWORDS = {
    "basic_knowledge": ["基金净值", "净值", "市盈率", "PE", "股票", "债券",
                        "分红", "配股", "ETF", "指数", "资产配置", "止损"],
    "product_inquiry": ["定投", "货币基金", "债券基金", "股票基金", "混合基金",
                        "活期", "定期", "银行理财", "基金经理"],
    "risk_education": ["风险等级", "R1", "R2", "R3", "R4", "R5",
                       "系统性风险", "适当性", "仓位", "分散"],
    "operation_guide": ["申购", "赎回", "T+1", "T+3", "持仓", "季报", "年报"],
    "compliance_law": ["监管", "证监会", "基金法", "投保基金", "12386"],
    "faq": ["亏损", "怎么办", "应该", "建议", "选择", "怎么选"],
}


def _classify_question(text: str) -> str:
    """简单关键词匹配分类，返回类别名称"""
    for category, keywords in _CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                return category
    return "general"


# ─────────────────────────────────────────────────────────────────────────────
# 置信度计算
# ─────────────────────────────────────────────────────────────────────────────
def _compute_final_confidence(
        sources: list,
        risk: RiskAssessment,
        has_answer: bool) -> float:
    """
    综合置信度 = 检索置信度 × 风险惩罚系数

    检索置信度：
      - 有命中结果：TOP1 score × 加成（命中数量）
      - 无命中结果：0.1（兜底）

    风险惩罚：
      - HIGH  →  ×0.0（被拦截，不计置信度）
      - MEDIUM → ×0.6
      - LOW   → ×0.9
      - NONE  → ×1.0
    """
    if not has_answer:
        return 0.0

    if sources:
        base = sources[0].score
        bonus = min(len(sources) * 0.05, 0.15)
        retrieval_conf = min(base + bonus, 1.0)
    else:
        # MEDIUM 风险无命中时，用规则置信度作为基础（而非 0.1）
        # 避免 personal_advice 场景置信度被拉到 ~6%
        if risk.level == RiskLevel.MEDIUM and risk.confidence > 0:
            retrieval_conf = risk.confidence
        else:
            retrieval_conf = 0.1

    penalty = {
        RiskLevel.HIGH: 0.0,
        RiskLevel.MEDIUM: 0.6,
        RiskLevel.LOW: 0.9,
        RiskLevel.NONE: 1.0,
    }.get(risk.level, 1.0)

    return round(retrieval_conf * penalty, 4)


# ─────────────────────────────────────────────────────────────────────────────
# 会话管理
# ─────────────────────────────────────────────────────────────────────────────
def _get_or_create_session(session_id: Optional[str]) -> Session:
    if session_id and session_id in _sessions:
        return _sessions[session_id]
    new_id = session_id or str(uuid.uuid4())
    session = Session(
        id=new_id,
        status=SessionStatus.ACTIVE,
        created_at=datetime.now(),
        messages=[],
    )
    _sessions[new_id] = session
    return session


def get_session(session_id: str) -> Optional[Session]:
    return _sessions.get(session_id)


def transfer_session(session_id: str) -> bool:
    session = _sessions.get(session_id)
    if not session:
        return False
    session.status = SessionStatus.TRANSFERRED
    return True


# ─────────────────────────────────────────────────────────────────────────────
# 主链路
# ─────────────────────────────────────────────────────────────────────────────
async def handle_chat(req: ChatRequest) -> ChatResponse:
    t_start = time.time()

    # ── 1. 获取/创建会话 ─────────────────────────────────
    session = _get_or_create_session(req.session_id)

    # ── 2. 合规风险识别 ───────────────────────────────────
    risk = risk_detector.detect_risk(req.message)

    # ── 3. 问题分类 ───────────────────────────────────────
    question_category = _classify_question(req.message)

    # ── 4. 知识库检索 ─────────────────────────────────────
    #    HIGH 风险直接拦截，无需检索
    sources: list = []
    if risk.level != RiskLevel.HIGH:
        sources = knowledge_search.search(req.message)

    # ── 5. 无命中 → 补充 no_knowledge_base 风险 ──────────
    if risk.level == RiskLevel.NONE and not sources:
        risk = RiskAssessment(
            level=RiskLevel.LOW,
            type=RiskType.NO_KNOWLEDGE_BASE,
            confidence=0.70,
            reason="未在知识库中找到相关内容",
            hit_rules=[],
            suggestion=risk_detector.COMPLIANCE_REPLIES[RiskType.NO_KNOWLEDGE_BASE],
            transfer_to_human=False,
        )

    # ── 6. 决定是否被拦截 ─────────────────────────────────
    is_blocked = risk.level == RiskLevel.HIGH

    # ── 7. 生成回答 ───────────────────────────────────────
    if is_blocked:
        # HIGH 风险：直接用合规拦截文案
        answer_text = risk.suggestion
    elif risk.level == RiskLevel.MEDIUM and not sources:
        # MEDIUM 风险且知识库无命中（personal_advice / personal_privacy）：
        # 使用规则引擎的合规建议文案，不返回"知识库未收录"的兜底
        answer_text = risk.suggestion
    else:
        answer_text = await llm_service.generate_answer(req.message, sources)

    # ── 8. 转人工判断 ─────────────────────────────────────
    transfer_to_human = risk.transfer_to_human

    # ── 9. 置信度计算 ─────────────────────────────────────
    confidence = _compute_final_confidence(
        sources=sources,
        risk=risk,
        has_answer=not is_blocked,
    )

    # ── 10. 记录消息到会话 ────────────────────────────────
    session.messages.append(Message(
        role="user",
        content=req.message,
        timestamp=datetime.now(),
    ))
    session.messages.append(Message(
        role="assistant",
        content=answer_text,
        timestamp=datetime.now(),
    ))

    processing_ms = round((time.time() - t_start) * 1000)

    # ── 11. 写入统计日志（非阻塞，忽略异常）─────────────────
    try:
        analytics_store.log_chat(
            session_id=session.id,
            question=req.message,
            answer=answer_text,
            risk_level=risk.level.value,
            risk_type=risk.type.value if risk.type else None,
            is_blocked=is_blocked,
            transfer=transfer_to_human,
            confidence=confidence,
            sources_cnt=len(sources),
            category=question_category,
        )
    except Exception:
        pass  # 统计失败不影响主链路

    return ChatResponse(
        session_id=session.id,
        question=req.message,
        question_category=question_category,
        answer=AnswerPayload(
            content=answer_text,
            is_blocked=is_blocked,
            transfer_to_human=transfer_to_human,
            confidence=confidence,
        ),
        risk_assessment=risk,
        sources=sources,
        processing_ms=processing_ms,
    )


def get_stats() -> dict:
    total_sessions = len(_sessions)
    total_messages = sum(len(s.messages) for s in _sessions.values())
    transferred = sum(
        1 for s in _sessions.values()
        if s.status == SessionStatus.TRANSFERRED
    )
    return {
        "total_sessions": total_sessions,
        "total_messages": total_messages,
        "transferred_sessions": transferred,
        "knowledge_items": len(knowledge_search.get_all()),
    }
