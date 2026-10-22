# -*- coding: utf-8 -*-
"""
合规风险检测服务 — 规则引擎

功能：
  1. 用户问题分类（5 类风险）
  2. 置信度计算（规则匹配深度 + 关键词权重）
  3. 转人工判断（high 风险自动转，medium 风险建议转）
"""
import re
from typing import List, Tuple, Optional
from app.models.risk import RiskLevel, RiskType, RiskAssessment


# ─────────────────────────────────────────────────────────────────────────────
# 规则定义结构：(rule_id, patterns, risk_type, risk_level, base_confidence)
# patterns 支持正则；命中越多条同类规则，置信度越高
# ─────────────────────────────────────────────────────────────────────────────
_RULES: List[Tuple[str, List[str], RiskType, RiskLevel, float]] = [

    # ── 保证收益 ──────────────────────────────────────────────────────
    ("rule_gr_001",
     [r"保证.*收益", r"保证.*回报", r"保证.*赚钱", r"保证.*盈利",
      r"稳赚不赔", r"零风险.*高收益", r"无风险.*高收益",
      r"承诺.*收益", r"承诺.*回报", r"保本.*高收益",
      r"100%.*收益", r"绝对.*盈利", r"肯定.*赚"],
     RiskType.GUARANTEED_RETURN, RiskLevel.HIGH, 0.90),

    # ── 直接荐股 ──────────────────────────────────────────────────────
    ("rule_sr_001",
     [r"推荐.*股票", r"哪只股票.*好", r"哪支股票.*买",
      r"这只股票.*能买", r"这支股票.*值得",
      r"[A-Za-z]*\d{6}.*买", r"\d{6}.*值得",
      r"茅台.*买", r"比亚迪.*买", r"宁德.*买",
      r"腾讯.*买", r"阿里.*买", r"平安.*买"],
     RiskType.STOCK_RECOMMENDATION, RiskLevel.HIGH, 0.90),

    ("rule_sr_002",
     [r".*股票.*能买吗", r".*股票.*值得买吗",
      r".*股.*现在.*合适吗", r"现在买.*股.*吗",
      r"哪个.*股票.*涨", r".*股票.*会涨吗",
      r"推荐.*个股", r"买什么股"],
     RiskType.STOCK_RECOMMENDATION, RiskLevel.HIGH, 0.88),

    # ── 市场预测 ──────────────────────────────────────────────────────
    ("rule_mp_001",
     [r"大盘.*会.*涨", r"大盘.*会.*跌",
      r"A股.*明年", r"股市.*今年.*走势",
      r"牛市.*什么时候", r"熊市.*什么时候",
      r"大盘.*预测", r"行情.*预测",
      r"指数.*会到.*点", r"底部.*在哪", r"顶部.*在哪"],
     RiskType.MARKET_PREDICTION, RiskLevel.HIGH, 0.88),

    ("rule_mp_002",
     [r"明天.*涨|明天.*跌", r"下周.*行情",
      r"今年.*大盘", r"市场.*走势.*预测",
      r"现在.*底部", r"现在是否.*顶部",
      r"后市.*怎么看", r"未来.*走势"],
     RiskType.MARKET_PREDICTION, RiskLevel.HIGH, 0.84),

    # ── 个性化投资建议 ──────────────────────────────────────────────────
    ("rule_pa_001",
     [r"我应该.*投资", r"帮我.*投资.*建议",
      r"我有.*万.*怎么投", r"我有.*元.*怎么买",
      r"帮我.*配置.*资产", r"帮我.*规划.*投资",
      r"我.*适合.*买什么", r"给我.*推荐.*买"],
     RiskType.PERSONAL_ADVICE, RiskLevel.MEDIUM, 0.85),

    ("rule_pa_002",
     [r"投多少.*比例", r"股票.*债券.*各.*多少",
      r"怎么.*分配.*资金", r"我.*买什么.*好",
      r"保守型.*买什么", r"激进型.*买什么",
      r"多少钱.*买.*基金"],
     RiskType.PERSONAL_ADVICE, RiskLevel.MEDIUM, 0.78),

    # ── 隐私/账户查询 ──────────────────────────────────────────────────
    ("rule_pp_001",
     [r"我的账户", r"我的持仓", r"我的交易记录", r"我的资产",
      r"我的密码", r"我的身份证", r"我的银行卡",
      r"帮我查.*账户", r"查一下我的", r"我的余额"],
     RiskType.PERSONAL_PRIVACY, RiskLevel.MEDIUM, 0.82),
]

# ─────────────────────────────────────────────────────────────────────────────
# 合规回复模板
# ─────────────────────────────────────────────────────────────────────────────
COMPLIANCE_REPLIES = {
    RiskType.GUARANTEED_RETURN: (
        "根据《证券法》及相关监管规定，任何金融机构或人员均不得以任何形式"
        "承诺或保证收益。投资有风险，过往业绩不代表未来表现。"
        "如需了解具体产品，建议联系专业持牌投资顾问。"
    ),
    RiskType.STOCK_RECOMMENDATION: (
        "根据监管要求，本系统无法提供具体股票投资建议。"
        "股票投资需根据您的个人财务状况、风险承受能力综合判断，"
        "建议咨询持牌投资顾问，并充分了解相关风险后再做决策。"
    ),
    RiskType.MARKET_PREDICTION: (
        "市场走势受多种宏观、行业及个体因素影响，无法准确预测。"
        "本系统可为您介绍影响市场的一般性规律和知识，"
        "但无法提供具体的涨跌判断。"
    ),
    RiskType.PERSONAL_ADVICE: (
        "投资决策因人而异，取决于个人资产状况、风险偏好和投资目标。"
        "以下提供相关投资知识供参考，具体方案请在完成风险承受能力评估后"
        "咨询持牌投资顾问。"
    ),
    RiskType.PERSONAL_PRIVACY: (
        "本系统是金融知识问答助手，无法访问您的个人账户、持仓或交易信息。"
        "如需查询账户信息，请通过官方 App、网银或拨打客服热线操作。"
        "如遇账户安全问题，请立即联系人工客服处理。"
    ),
    RiskType.NO_KNOWLEDGE_BASE: (
        "抱歉，当前知识库暂未收录该问题的相关内容。"
        "您可以尝试提问关于基金基础、定投策略、风险管理等话题，"
        "或联系人工客服获取帮助。"
    ),
}

# 转人工阈值配置
_TRANSFER_HUMAN_THRESHOLD = {
    RiskLevel.HIGH: True,    # 高风险：强制转人工
    RiskLevel.MEDIUM: True,  # 中风险：建议转人工
    RiskLevel.LOW: False,
    RiskLevel.NONE: False,
}


def detect_risk(text: str) -> RiskAssessment:
    """
    对用户问题进行合规风险检测。

    返回 RiskAssessment，字段包括：
      - level: none/low/medium/high
      - type: 风险类型
      - confidence: 0~1，基于规则命中数量和权重计算
      - reason: 拦截原因
      - hit_rules: 命中的规则 ID 列表
      - suggestion: 给用户的合规提示
      - transfer_to_human: 是否需要转人工
    """
    level_order = {
        RiskLevel.NONE: 0,
        RiskLevel.LOW: 1,
        RiskLevel.MEDIUM: 2,
        RiskLevel.HIGH: 3,
    }

    # 收集所有命中
    hits: List[Tuple[str, RiskType, RiskLevel, float]] = []
    for rule_id, patterns, risk_type, risk_level, base_conf in _RULES:
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                hits.append((rule_id, risk_type, risk_level, base_conf))
                break  # 同一规则只算一次

    if not hits:
        return RiskAssessment(
            level=RiskLevel.NONE,
            type=None,
            confidence=0.0,
            reason="",
            hit_rules=[],
            suggestion="",
            transfer_to_human=False,
        )

    # 按风险等级找最高
    best_level = RiskLevel.NONE
    best_type: Optional[RiskType] = None
    hit_rule_ids: List[str] = []

    # 统计各类型命中次数，用于置信度加成
    type_hit_count: dict = {}
    type_max_conf: dict = {}

    for rule_id, risk_type, risk_level, base_conf in hits:
        hit_rule_ids.append(rule_id)
        type_hit_count[risk_type] = type_hit_count.get(risk_type, 0) + 1
        type_max_conf[risk_type] = max(type_max_conf.get(risk_type, 0.0), base_conf)
        if level_order[risk_level] > level_order[best_level]:
            best_level = risk_level
            best_type = risk_type

    # 置信度计算：基础置信度 + 多规则命中加成（每多命中一条 +0.03，上限 0.99）
    base_confidence = type_max_conf.get(best_type, 0.80)
    hit_bonus = min((type_hit_count.get(best_type, 1) - 1) * 0.03, 0.09)
    confidence = min(base_confidence + hit_bonus, 0.99)

    reason_map = {
        RiskType.GUARANTEED_RETURN: "问题涉及保证收益承诺，属于监管禁止行为",
        RiskType.STOCK_RECOMMENDATION: "问题包含直接荐股意图，不在合规服务范围内",
        RiskType.MARKET_PREDICTION: "问题涉及市场走势预测，无法提供确定性判断",
        RiskType.PERSONAL_ADVICE: "问题涉及个性化投资建议，需专业顾问评估",
        RiskType.PERSONAL_PRIVACY: "问题涉及个人账户或隐私信息，本系统无法访问",
    }

    return RiskAssessment(
        level=best_level,
        type=best_type,
        confidence=round(confidence, 4),
        reason=reason_map.get(best_type, ""),
        hit_rules=list(set(hit_rule_ids)),
        suggestion=COMPLIANCE_REPLIES.get(best_type, ""),
        transfer_to_human=_TRANSFER_HUMAN_THRESHOLD.get(best_level, False),
    )
