# FinAsk — 测试说明

> 覆盖主链路、数据/接口异常、合规边界三大类测试。
> 前提：后端运行在 `http://localhost:8000`，前端运行在 `http://localhost:5173`。

---

## 一、快速冒烟测试（Python 脚本）

```bash
cd finask/backend
source venv/bin/activate
python3 - << 'EOF'
import sys
sys.path.insert(0, '.')

# ── 1. 词典正确性 ─────────────────────────────────────────
from app.services.knowledge_search import _FINANCE_TERMS
assert "净值" in _FINANCE_TERMS and "净値" not in _FINANCE_TERMS
assert "沪深300" in _FINANCE_TERMS and "沪淳300" not in _FINANCE_TERMS
assert "债券型" in _FINANCE_TERMS
print("✅ 词典无错别字")

# ── 2. 合规规则引擎 ───────────────────────────────────────
from app.services.risk_detector import detect_risk
from app.models.risk import RiskType, RiskLevel

cases = [
    ("稳赚不赔的理财产品",      RiskType.GUARANTEED_RETURN,   RiskLevel.HIGH),
    ("推荐一只好股票",          RiskType.STOCK_RECOMMENDATION, RiskLevel.HIGH),
    ("明年大盘会涨吗",          RiskType.MARKET_PREDICTION,    RiskLevel.HIGH),
    ("我有10万元应该怎么投资",   RiskType.PERSONAL_ADVICE,      RiskLevel.MEDIUM),
    ("我的账户持仓是多少",       RiskType.PERSONAL_PRIVACY,     RiskLevel.MEDIUM),
]
for q, exp_type, exp_level in cases:
    r = detect_risk(q)
    assert r.type == exp_type,  f"[{q}] type: {r.type} != {exp_type}"
    assert r.level == exp_level, f"[{q}] level: {r.level} != {exp_level}"
    assert r.suggestion,        f"[{q}] suggestion 为空"
print("✅ 5 类合规规则全部命中")

# ── 3. 置信度不归零 ───────────────────────────────────────
r = detect_risk("我有50万元想做稳健投资")
assert r.confidence > 0.5, f"置信度过低: {r.confidence}"
print(f"✅ personal_advice confidence={r.confidence}")

print("\n🎉 冒烟测试通过")
EOF
```

---

## 二、主链路测试（curl）

### 2.1 正常知识问答

```bash
# 测试：基础知识问题，应有 sources，无风险拦截
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "什么是基金净值", "session_id": null}' \
  | python3 -m json.tool

# 预期：
# answer.is_blocked = false
# answer.confidence > 0.5
# sources 非空，sources[0].item_id = "kb_001"
# risk_assessment.level = "none"
```

```bash
# 测试：定投知识
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "基金定投有什么优势", "session_id": null}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('confidence:', d['answer']['confidence'], '| sources:', len(d['sources']))"

# 预期：confidence > 0.5，sources >= 1
```

```bash
# 测试：风险教育知识
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "什么是系统性风险", "session_id": null}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('blocked:', d['answer']['is_blocked'], '| sources:', len(d['sources']))"

# 预期：is_blocked = false，sources >= 1
```

### 2.2 知识库无命中（no_knowledge_base）

```bash
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "黄金期货怎么交易", "session_id": null}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('risk_type:', d['risk_assessment']['type'], '| is_blocked:', d['answer']['is_blocked'])"

# 预期：risk_type = "no_knowledge_base"，is_blocked = false
# 说明：知识缺口被记录，不拦截，返回兜底提示
```

---

## 三、合规边界测试

### 3.1 HIGH 风险 — 强制拦截

```bash
# 保证收益
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "有没有稳赚不赔、保证收益的理财产品", "session_id": null}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); r=d['risk_assessment']; print(f'level={r[\"level\"]} type={r[\"type\"]} blocked={d[\"answer\"][\"is_blocked\"]} transfer={d[\"answer\"][\"transfer_to_human\"]}')"

# 预期：level=high, type=guaranteed_return, is_blocked=true, transfer_to_human=true
```

```bash
# 直接荐股
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "茅台股票现在能买吗", "session_id": null}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); r=d['risk_assessment']; print(f'level={r[\"level\"]} type={r[\"type\"]} blocked={d[\"answer\"][\"is_blocked\"]}')"

# 预期：level=high, type=stock_recommendation, is_blocked=true
```

```bash
# 市场预测
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "明年A股会涨吗，现在是不是底部", "session_id": null}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); r=d['risk_assessment']; print(f'level={r[\"level\"]} type={r[\"type\"]} blocked={d[\"answer\"][\"is_blocked\"]}')"

# 预期：level=high, type=market_prediction, is_blocked=true
```

### 3.2 MEDIUM 风险 — 合规提示，不拦截

```bash
# 个性化投资建议
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "我有10万元应该怎么投资", "session_id": null}' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d['risk_assessment']
a = d['answer']
print(f'level={r[\"level\"]} type={r[\"type\"]}')
print(f'blocked={a[\"is_blocked\"]} transfer={a[\"transfer_to_human\"]}')
print(f'confidence={a[\"confidence\"]}')
print(f'answer_preview={a[\"content\"][:60]}...')
"

# 预期：
# level=medium, type=personal_advice
# is_blocked=false（不强制拦截）
# transfer_to_human=true
# confidence >= 0.5（不归零）
# answer 包含合规提示，不是"暂未收录"
```

```bash
# 隐私/账户查询
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "我的账户持仓是多少", "session_id": null}' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d['risk_assessment']
a = d['answer']
print(f'type={r[\"type\"]} level={r[\"level\"]}')
print(f'answer_preview={a[\"content\"][:80]}...')
"

# 预期：
# type=personal_privacy, level=medium
# answer 说明无法访问账户信息，不是知识问答
```

---

## 四、知识库 CRUD 测试

### 4.1 查询所有条目

```bash
curl -s http://localhost:8000/api/knowledge | python3 -c "import sys,json; items=json.load(sys.stdin); print(f'知识库条数: {len(items)}')"
# 预期：≥ 20
```

### 4.2 新增条目

```bash
curl -s -X POST http://localhost:8000/api/knowledge \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试知识条目",
    "content": "这是一条测试知识，用于验证新增功能",
    "category": "测试",
    "tags": ["测试"],
    "source": "单元测试"
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print('新增 id:', d['id'], 'version:', d.get('version', 'N/A'))"
# 预期：返回含 id 的完整 KnowledgeItem，version=1
```

### 4.3 更新条目

```bash
# 先获取一个已有 id，如 kb_001
curl -s -X PUT http://localhost:8000/api/knowledge/kb_001 \
  -H "Content-Type: application/json" \
  -d '{"content": "更新后的内容（测试版本递增）"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('updated_at:', d.get('updated_at'), 'version:', d.get('version', 'N/A'))"
# 预期：updated_at 更新，version 自增
```

### 4.4 检索接口

```bash
curl -s "http://localhost:8000/api/knowledge/search?q=基金净值" \
  | python3 -c "import sys,json; items=json.load(sys.stdin); [print(f'  [{i[\"item_id\"]}] score={i[\"score\"]:.3f} {i[\"title\"]}') for i in items]"
# 预期：kb_001 排在 top1，score > 0.3
```

---

## 五、统计接口测试

```bash
# 对话几次后查看统计概览
curl -s http://localhost:8000/api/analytics/overview | python3 -m json.tool
# 预期：total > 0，各字段数值合理

# 高频问题
curl -s "http://localhost:8000/api/analytics/top-questions?limit=5" | python3 -m json.tool

# 风险分布
curl -s http://localhost:8000/api/analytics/risk-distribution | python3 -m json.tool

# 知识缺口（未命中问题）
curl -s "http://localhost:8000/api/analytics/knowledge-gaps?limit=10" | python3 -m json.tool
# 预期：返回 risk_type=no_knowledge_base 的高频问题列表
```

---

## 六、接口异常与边界测试

### 6.1 空消息

```bash
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "", "session_id": null}' | python3 -m json.tool
# 预期：HTTP 422（FastAPI 自动校验）
```

### 6.2 超长消息

```bash
LONG_MSG=$(python3 -c "print('基金' * 500)")
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"$LONG_MSG\", \"session_id\": null}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('processing_ms:', d.get('processing_ms'))"
# 预期：正常返回，不崩溃
```

### 6.3 不存在的知识条目

```bash
curl -s http://localhost:8000/api/knowledge/not_exist_id
# 预期：HTTP 404，{"detail": "知识条目 not_exist_id 不存在"}
```

### 6.4 知识检索关键词为空

```bash
curl -s "http://localhost:8000/api/knowledge/search?q=%20"
# 预期：HTTP 400，{"detail": "查询关键词不能为空"}
```

### 6.5 统计接口参数越界

```bash
curl -s "http://localhost:8000/api/analytics/top-questions?limit=999"
# 预期：HTTP 422（limit 上限 50）
```

---

## 七、验收测试矩阵（28 条）

| # | 场景类型 | 测试问题 | 预期 risk_type | 预期 is_blocked | 预期有 sources |
|---|---|---|---|---|---|
| 1 | 基础知识 | 什么是基金净值 | none | false | ✅ |
| 2 | 基础知识 | PE 市盈率怎么计算 | none | false | ✅ |
| 3 | 产品介绍 | 基金定投有什么优势 | none | false | ✅ |
| 4 | 产品介绍 | 货币基金和银行存款有什么区别 | none | false | ✅ |
| 5 | 风险教育 | 什么是系统性风险 | none | false | ✅ |
| 6 | 风险教育 | R3 风险等级适合哪些人 | none | false | ✅ |
| 7 | 操作指南 | 基金赎回 T+3 是什么意思 | none | false | ✅ |
| 8 | 合规法规 | 证监会对投资顾问有什么要求 | none | false | ✅ |
| 9 | 保证收益 | 有保证收益的基金吗 | guaranteed_return | **true** | ❌ |
| 10 | 保证收益 | 稳赚不赔的理财推荐一下 | guaranteed_return | **true** | ❌ |
| 11 | 直接荐股 | 茅台股票现在能买吗 | stock_recommendation | **true** | ❌ |
| 12 | 直接荐股 | 推荐几只好股票 | stock_recommendation | **true** | ❌ |
| 13 | 直接荐股 | 买什么股票能涨 | stock_recommendation | **true** | ❌ |
| 14 | 市场预测 | 明年 A 股会涨吗 | market_prediction | **true** | ❌ |
| 15 | 市场预测 | 现在是不是底部 | market_prediction | **true** | ❌ |
| 16 | 个性化建议 | 我有 10 万元怎么投资 | personal_advice | false | ❌ |
| 17 | 个性化建议 | 保守型投资者应该买什么 | personal_advice | false | ❌ |
| 18 | 隐私查询 | 我的账户持仓是多少 | personal_privacy | false | ❌ |
| 19 | 隐私查询 | 帮我查一下我的余额 | personal_privacy | false | ❌ |
| 20 | 知识缺口 | 黄金期货怎么交易 | no_knowledge_base | false | ❌ |
| 21 | 知识缺口 | 比特币值得投资吗 | high/no_kb | **true**/false | ❌ |
| 22 | 多轮会话 | 第一问：什么是定投 → 第二问：每月定投多少合适 | none/personal_advice | false/false | ✅/❌ |
| 23 | 来源追溯 | 验证 sources[0].item_id 可在知识库中查到 | - | - | ✅ |
| 24 | 置信度 | MEDIUM 风险无命中 confidence ≥ 0.5 | personal_advice | false | - |
| 25 | 知识更新 | 新增条目 → 立即检索到 | - | - | ✅ |
| 26 | 统计写入 | 对话后 analytics/overview total 增加 | - | - | - |
| 27 | 知识缺口统计 | analytics/knowledge-gaps 包含 #20 的问题 | - | - | - |
| 28 | 参数校验 | 空消息返回 422 | - | - | - |
