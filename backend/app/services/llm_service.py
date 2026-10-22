# -*- coding: utf-8 -*-
"""
LLM 服务 — 支持 Mock / OpenAI / Qwen 三种模式

Mock 模式（默认）：
  - 如果有检索结果，基于 TOP1 知识片段生成结构化回答
  - 如果无检索结果，返回通用兜底回复
  - 模拟流式延迟感（sync，实际无延迟）

模式切换：.env 中设置 LLM_PROVIDER=mock|openai|qwen
"""
import asyncio
import textwrap
from typing import List

import httpx

from app.config import settings
from app.models.knowledge import SearchResult


# ─────────────────────────────────────────────────────────────────────────────
# Mock 模型实现
# ─────────────────────────────────────────────────────────────────────────────
def _mock_answer(question: str, sources: List[SearchResult]) -> str:
    if not sources:
        return (
            "感谢您的提问。目前知识库中暂未收录与该问题直接相关的内容，"
            "建议您参考官方文档或联系人工客服进一步了解。"
        )

    top = sources[0]

    # 取知识内容前 300 字作为摘要
    content_preview = top.content[:300].rstrip()
    if len(top.content) > 300:
        content_preview += "……"

    # 构造来源引用行
    source_refs = "\n".join(
        f"  [{i+1}] 《{s.title}》（相关度 {s.confidence:.0%}）"
        for i, s in enumerate(sources)
    )

    answer = textwrap.dedent(f"""\
        {content_preview}

        ---
        **参考来源：**
        {source_refs}

        _以上内容来自知识库，仅供参考，不构成投资建议。_
    """)
    return answer.strip()


# ─────────────────────────────────────────────────────────────────────────────
# OpenAI 实现（真实调用，需配置 OPENAI_API_KEY）
# ─────────────────────────────────────────────────────────────────────────────
async def _openai_answer(question: str, sources: List[SearchResult]) -> str:
    context = "\n\n".join(
        f"[知识片段 {i+1}] {s.title}:\n{s.content[:400]}"
        for i, s in enumerate(sources)
    ) if sources else "无相关知识库内容"

    system_prompt = (
        "你是一位专业的金融投教助手，服务于理财平台。"
        "基于以下知识库内容回答用户问题，保持客观、专业，不进行个人投资建议。\n\n"
        f"知识库内容：\n{context}"
    )

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
            json={
                "model": settings.OPENAI_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": question},
                ],
                "max_tokens": 600,
                "temperature": 0.3,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


# ─────────────────────────────────────────────────────────────────────────────
# 通义千问实现（DashScope API）
# ─────────────────────────────────────────────────────────────────────────────
async def _qwen_answer(question: str, sources: List[SearchResult]) -> str:
    context = "\n\n".join(
        f"[知识片段 {i+1}] {s.title}:\n{s.content[:400]}"
        for i, s in enumerate(sources)
    ) if sources else "无相关知识库内容"

    system_prompt = (
        "你是一位专业的金融投教助手。"
        "根据以下知识库内容回答用户问题，保持客观专业，不做个人投资建议。\n\n"
        f"知识库内容：\n{context}"
    )

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
            headers={
                "Authorization": f"Bearer {settings.QWEN_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.QWEN_MODEL,
                "input": {
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": question},
                    ]
                },
                "parameters": {"result_format": "message", "max_tokens": 600},
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["output"]["choices"][0]["message"]["content"]


# ─────────────────────────────────────────────────────────────────────────────
# 统一入口
# ─────────────────────────────────────────────────────────────────────────────
async def generate_answer(question: str, sources: List[SearchResult]) -> str:
    """
    根据 LLM_PROVIDER 环境变量路由到对应实现。
    Mock 模式下同步生成，OpenAI/Qwen 模式下异步调用。
    """
    provider = settings.LLM_PROVIDER.lower()

    if provider == "mock":
        # Mock 无需真实 await，wrap 为协程
        await asyncio.sleep(0)
        return _mock_answer(question, sources)
    elif provider == "openai":
        return await _openai_answer(question, sources)
    elif provider == "qwen":
        return await _qwen_answer(question, sources)
    else:
        # 未知 provider 降级为 mock
        await asyncio.sleep(0)
        return _mock_answer(question, sources)
