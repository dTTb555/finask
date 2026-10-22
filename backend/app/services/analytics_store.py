# -*- coding: utf-8 -*-
"""
运营统计存储 — 基于 stdlib sqlite3，无额外依赖

数据库文件：backend/app/data/analytics.db
表结构：
  chat_logs  — 每次对话的日志记录
"""
import os
import sqlite3
import threading
from datetime import datetime
from typing import List, Dict, Any, Optional

_DB_PATH = os.path.join(os.path.dirname(__file__), "../data/analytics.db")

# sqlite3 连接不是线程安全的，用线程本地存储
_local = threading.local()


def _get_conn() -> sqlite3.Connection:
    if not hasattr(_local, "conn") or _local.conn is None:
        _local.conn = sqlite3.connect(_DB_PATH, check_same_thread=False)
        _local.conn.row_factory = sqlite3.Row
    return _local.conn


def _init_db():
    """初始化数据库表（幂等）"""
    os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS chat_logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  TEXT    NOT NULL,
            question    TEXT    NOT NULL,
            answer      TEXT    NOT NULL,
            risk_level  TEXT    NOT NULL DEFAULT 'none',
            risk_type   TEXT,
            is_blocked  INTEGER NOT NULL DEFAULT 0,
            transfer    INTEGER NOT NULL DEFAULT 0,
            confidence  REAL    NOT NULL DEFAULT 0.0,
            sources_cnt INTEGER NOT NULL DEFAULT 0,
            category    TEXT,
            created_at  TEXT    NOT NULL
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_created_at ON chat_logs(created_at)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_risk_level ON chat_logs(risk_level)
    """)
    conn.commit()
    conn.close()


# 模块加载时初始化
_init_db()


# ─────────────────────────────────────────────────────────────────────────────
# 写入
# ─────────────────────────────────────────────────────────────────────────────
def log_chat(
    session_id: str,
    question: str,
    answer: str,
    risk_level: str,
    risk_type: Optional[str],
    is_blocked: bool,
    transfer: bool,
    confidence: float,
    sources_cnt: int,
    category: Optional[str],
):
    """记录一次对话到 SQLite"""
    conn = _get_conn()
    conn.execute(
        """
        INSERT INTO chat_logs
            (session_id, question, answer, risk_level, risk_type,
             is_blocked, transfer, confidence, sources_cnt, category, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            session_id,
            question,
            answer[:500],   # 答案截断，避免太长
            risk_level,
            risk_type,
            int(is_blocked),
            int(transfer),
            confidence,
            sources_cnt,
            category,
            datetime.now().isoformat(),
        ),
    )
    conn.commit()


# ─────────────────────────────────────────────────────────────────────────────
# 查询 — 统计概览
# ─────────────────────────────────────────────────────────────────────────────
def get_overview() -> Dict[str, Any]:
    """
    返回统计概览：
      total / high_risk / transferred / no_kb / blocked
    """
    conn = _get_conn()
    row = conn.execute("""
        SELECT
            COUNT(*)                                   AS total,
            SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END)   AS high_risk,
            SUM(CASE WHEN risk_level = 'medium' THEN 1 ELSE 0 END) AS medium_risk,
            SUM(transfer)                              AS transferred,
            SUM(is_blocked)                            AS blocked,
            SUM(CASE WHEN risk_type = 'no_knowledge_base' THEN 1 ELSE 0 END) AS no_kb
        FROM chat_logs
    """).fetchone()

    return {
        "total": row["total"] or 0,
        "high_risk": row["high_risk"] or 0,
        "medium_risk": row["medium_risk"] or 0,
        "transferred": row["transferred"] or 0,
        "blocked": row["blocked"] or 0,
        "no_kb": row["no_kb"] or 0,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 查询 — 高频问题 Top N
# ─────────────────────────────────────────────────────────────────────────────
def get_top_questions(limit: int = 10) -> List[Dict[str, Any]]:
    """
    按问题文本分组统计出现频次，取 Top N。
    （简单精确匹配，生产环境可改为聚类或关键词归组）
    """
    conn = _get_conn()
    rows = conn.execute(
        """
        SELECT question, COUNT(*) AS cnt,
               MAX(risk_level) AS risk_level,
               MAX(category)   AS category
        FROM chat_logs
        GROUP BY question
        ORDER BY cnt DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [dict(r) for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# 查询 — 最近问答记录
# ─────────────────────────────────────────────────────────────────────────────
def get_recent_logs(limit: int = 20) -> List[Dict[str, Any]]:
    conn = _get_conn()
    rows = conn.execute(
        """
        SELECT id, session_id, question, answer, risk_level, risk_type,
               is_blocked, transfer, confidence, sources_cnt, category, created_at
        FROM chat_logs
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["is_blocked"] = bool(d["is_blocked"])
        d["transfer"] = bool(d["transfer"])
        result.append(d)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# 查询 — 风险类型分布
# ─────────────────────────────────────────────────────────────────────────────
def get_risk_distribution() -> List[Dict[str, Any]]:
    conn = _get_conn()
    rows = conn.execute(
        """
        SELECT risk_type, COUNT(*) AS cnt
        FROM chat_logs
        WHERE risk_type IS NOT NULL
        GROUP BY risk_type
        ORDER BY cnt DESC
        """
    ).fetchall()
    return [dict(r) for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# 查询 — 每日问题数趋势（最近 N 天）
# ─────────────────────────────────────────────────────────────────────────────
def get_daily_trend(days: int = 7) -> List[Dict[str, Any]]:
    conn = _get_conn()
    rows = conn.execute(
        """
        SELECT DATE(created_at) AS date,
               COUNT(*) AS total,
               SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) AS high_risk
        FROM chat_logs
        WHERE created_at >= DATE('now', ?)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
        """,
        (f"-{days} days",),
    ).fetchall()
    return [dict(r) for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# 查询 — 知识缺口（未命中的高频问题）
# ─────────────────────────────────────────────────────────────────────────────
def get_knowledge_gaps(limit: int = 20) -> List[Dict[str, Any]]:
    """
    返回 risk_type=no_knowledge_base 的问题按频次排序，
    供运营发现知识库缺口。
    """
    conn = _get_conn()
    rows = conn.execute(
        """
        SELECT question,
               COUNT(*) AS cnt,
               MAX(created_at) AS last_seen
        FROM chat_logs
        WHERE risk_type = 'no_knowledge_base'
        GROUP BY question
        ORDER BY cnt DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [dict(r) for r in rows]
