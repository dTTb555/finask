# FinAsk — 提交说明

## 1. 可访问产品 URL

> 本 Demo 为本地运行版本，按以下步骤启动后可访问：

| 页面 | 地址 |
|---|---|
| 主问答界面 | http://localhost:5173/chat |
| 运营统计看板 | http://localhost:5173/stats |
| 知识库管理后台 | http://localhost:5173/admin/knowledge |
| 后端 API 文档 | http://localhost:8000/docs |

**启动方式**（详见 README.md）：
```bash
# 后端
cd finask/backend && source venv/bin/activate && uvicorn main:app --port 8000

# 前端（新终端）
cd finask/frontend && npm run dev
```

---

## 2. 源代码说明

```
finask/
├── backend/     Python 3.9 + FastAPI 后端
└── frontend/    React 18 + Vite + TypeScript 前端
```

核心文件索引：

| 文件 | 职责 |
|---|---|
| `backend/app/services/risk_detector.py` | 合规规则引擎（5类风险 × 正则规则） |
| `backend/app/services/knowledge_search.py` | TF-IDF 检索（jieba 分词 + sklearn） |
| `backend/app/services/chat_service.py` | 主链路编排（检测→检索→生成→置信度→组装） |
| `backend/app/services/llm_service.py` | LLM 封装（Mock/OpenAI/Qwen 三档） |
| `backend/app/services/analytics_store.py` | SQLite 统计读写 |
| `backend/app/data/knowledge_base.json` | 20 条构造知识库（含 version 字段） |
| `frontend/src/pages/ChatPage.tsx` | 主对话界面（来源面板、风险标签、转人工） |
| `frontend/src/pages/StatsPage.tsx` | 运营统计（越界告警、高频未答、趋势图） |
| `frontend/src/pages/AdminPage.tsx` | 知识库管理（CRUD + 检索预览） |

---

## 3. 测试说明

详见 **TESTS.md**，覆盖：
- 主链路正常问答（4 类）
- 合规拦截边界（3 类 HIGH / 2 类 MEDIUM）
- 知识缺口发现
- 接口异常与边界参数
- 端对端冒烟测试（Python 脚本）

---

## 4. 演示视频脚本

详见 **DEMO_SCRIPT.md**，包含 60-180 秒操作步骤说明，可按脚本录制屏幕演示视频。

---

## 5. AI 使用与验证记录

### 5.1 AI 使用说明

本项目全程使用 **MyFlicker（CodeFlicker AI 编程助手）** 辅助开发，具体使用方式如下：

#### 设计阶段
- 使用 AI 进行产品需求拆解，生成系统架构图（RAG 链路、合规规则引擎设计）
- AI 辅助设计 5 类合规风险分类体系和 4 级风险等级体系
- AI 辅助构造 20 条匿名金融投教 FAQ 知识库

#### 实现阶段
- AI 负责后端核心模块的代码生成：`risk_detector.py`（规则引擎）、`knowledge_search.py`（TF-IDF 检索）、`chat_service.py`（主链路编排）、`analytics_store.py`（SQLite 统计）
- AI 负责前端页面实现：`ChatPage.tsx`（对话界面）、`StatsPage.tsx`（统计看板）、`AdminPage.tsx`（知识库管理）

#### 质量保障阶段
- AI 以代码审查员身份对项目做完整代码审查，发现 17 个问题，按严重程度分类
- AI 设计 28 条验收测试用例（10 类场景）
- AI 逐项修复代码审查发现的问题（词典错别字、合规回答逻辑、隐私场景识别等 10 项）
- AI 生成端对端冒烟测试脚本并执行验证

### 5.2 AI 生成内容验证方式

| 验证项 | 验证方式 | 结论 |
|---|---|---|
| 合规拦截逻辑 | curl 测试 7 类问题，对比预期拦截行为 | ✅ 高风险全部拦截，中风险均触发合规提示 |
| 知识检索准确性 | 问基金净值/定投等知识问题，核对 `sources` 字段 | ✅ Top1 命中率 100%（已覆盖知识库问题） |
| 词典正确性 | Python 脚本断言检查 6 个关键词 | ✅ 错别字全部修正 |
| 隐私识别 | 问"我的账户持仓"，验证 `risk_type=personal_privacy` | ✅ 正确识别，返回专属合规文案 |
| 置信度合理性 | 同一问题下检查 `confidence` 值范围 | ✅ MEDIUM 风险无命中时 confidence≥0.5 |
| 统计接口 | 对话后调用 `/api/analytics/overview`，验证数据更新 | ✅ 数据实时写入 SQLite |

### 5.3 已知 AI 生成局限

- 规则引擎基于正则，AI 生成的规则覆盖常见表达，但无法枚举所有边缘情况
- Mock LLM 回答质量取决于知识库内容质量，AI 构造的投教内容已尽量贴近真实表述
- 知识库条数（20 条）为 Demo 级别，真实场景需人工扩充和专业审核

---

## 6. 关键答案可追溯示例

以下为实际 API 响应节选，展示答案来源追溯：

**问题**：`什么是基金净值？`

**响应关键字段**：
```json
{
  "answer": {
    "content": "基金净值是衡量基金价值的重要指标，分为单位净值和累计净值…",
    "is_blocked": false,
    "transfer_to_human": false,
    "confidence": 0.8475
  },
  "risk_assessment": {
    "level": "none",
    "type": null
  },
  "sources": [
    {
      "item_id": "kb_001",
      "title": "什么是基金净值",
      "score": 0.72,
      "source": "基金投资者教育手册第3章",
      "content_preview": "基金净值是衡量基金价值的重要指标，分为单位净值和累计净值两种…"
    }
  ]
}
```

**问题**：`茅台股票现在能买吗？`（高风险拦截）

**响应关键字段**：
```json
{
  "answer": {
    "content": "根据监管要求，本系统无法提供具体股票投资建议…",
    "is_blocked": true,
    "transfer_to_human": true,
    "confidence": 0.0
  },
  "risk_assessment": {
    "level": "high",
    "type": "stock_recommendation",
    "confidence": 0.88,
    "hit_rules": ["rule_sr_001"]
  },
  "sources": []
}
```
