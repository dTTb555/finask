# -*- coding: utf-8 -*-
"""
风险相关数据模型
"""
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel


class RiskLevel(str, Enum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class RiskType(str, Enum):
    GUARANTEED_RETURN = "guaranteed_return"        # 保证收益
    STOCK_RECOMMENDATION = "stock_recommendation"  # 直接荐股
    MARKET_PREDICTION = "market_prediction"        # 市场预测
    PERSONAL_ADVICE = "personal_advice"            # 个性化投资建议
    NO_KNOWLEDGE_BASE = "no_knowledge_base"        # 知识库无依据
    PERSONAL_PRIVACY = "personal_privacy"          # 隐私/账户查询


class RiskAssessment(BaseModel):
    level: RiskLevel = RiskLevel.NONE
    type: Optional[RiskType] = None
    confidence: float = 0.0          # 0~1，规则命中深度
    reason: str = ""                 # 内部原因说明
    hit_rules: List[str] = []        # 命中的规则 ID
    suggestion: str = ""             # 给用户的合规提示文本
    transfer_to_human: bool = False  # 是否建议转人工
