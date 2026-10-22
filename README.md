# FinAsk — AI 投顾智能问答助手

> 面向 App 内投教/客服场景的 AI 智能问答 Demo，在合规边界内提供可追溯、可解释的金融知识回答，并持续暴露知识缺口。

**🌐 线上 Demo**：https://finask-oa.netlify.app/chat
**📦 源码仓库**：https://github.com/dTTb555/finask
**⚙️ 后端 API**：https://finask-backend-9df8.onrender.com/docs

> 注：后端部署在 Render 免费实例，15 分钟无请求会休眠，首次访问需等待约 30 秒冷启动。

---

## 目标用户

| 角色 | 使用方式 |
|---|---|
| **普通投资者** | 通过对话界面提问基金/投资基础知识，获得来源可追溯的回答 |
| **合规运营人员** | 通过统计看板实时监控越界问题、高频未答与风险告警 |
| **知识库维护者** | 通过管理后台对知识条目进行增删改、检索预览，闭合知识更新链路 |

---

## 核心设计

### 整体架构

```
用户提问
   │
   ▼
┌─────────────────────────────────────────────────────┐
│               合规风险检测（规则引擎）                    │
│  guaranteed_return / stock_recommendation /          │
│  market_prediction / personal_advice /               │
│  personal_privacy                                    │
└───────────────┬─────────────────────────────────────┘
                │
        HIGH 风险？─── YES ──→ 拦截 + 合规文案 + 转人工标记
                │
               NO
                │
                ▼
┌─────────────────────────────────────────────────────┐
│          知识库检索（TF-IDF + jieba 分词）               │
│  · 对用户问题分词 + 扩充金融专业词                         │
│  · 余弦相似度排序，返回 Top-K 结果（含来源、分数）           │
└───────────────┬─────────────────────────────────────┘
                │
       无命中？─── YES ──→ no_knowledge_base LOW 风险标记
                │
               NO
                │
                ▼
┌─────────────────────────────────────────────────────┐
│                LLM 回答生成（RAG）                       │
│  · 将检索到的知识片段作为上下文 prompt                     │
│  · Mock 模式：基于 context 拼装回答                      │
│  · 生产模式：OpenAI / 通义千问                           │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│             置信度计算 & 响应组装                         │
│  confidence = 检索置信度 × 风险惩罚系数                    │
│  · MEDIUM 无命中 → 直接用合规 suggestion                 │
│  · 来源列表附带 item_id、score、原文标题                   │
└─────────────────────────────────────────────────────┘
                │
                ▼
          返回前端展示（答案 + 来源 + 风险等级 + 转人工按钮）
```

### 知识库设计

- **存储格式**：本地 JSON（`knowledge_base.json`），每条记录含 `id / title / content / category / tags / source / version / created_at / updated_at`
- **更新方式**：通过 REST API（`PUT /api/knowledge/{id}`）在线编辑，变更立即生效
- **版本字段**：每次更新 `version` 自增，`updated_at` 记录时间，便于追溯知识变更历史
- **检索机制**：TF-IDF 向量化 + jieba 中文分词，加载时自动为金融专业词提权（`jieba.add_word`）
- **知识缺口发现**：`no_knowledge_base` 命中时，问题自动写入 SQLite `chat_logs`，运营看板可按 `risk_type=no_knowledge_base` 过滤，直接导出缺口问题列表

### 合规拦截设计

| 风险类型 | 等级 | 拦截策略 | 转人工 |
|---|---|---|---|
| `guaranteed_return` 保证收益 | 🔴 HIGH | 强制拦截，返回监管引用文案 | ✅ |
| `stock_recommendation` 直接荐股 | 🔴 HIGH | 强制拦截 | ✅ |
| `market_prediction` 市场预测 | 🔴 HIGH | 强制拦截 | ✅ |
| `personal_advice` 个性化投资建议 | 🟠 MEDIUM | 不拦截，返回合规提示 + 建议转顾问 | ✅ |
| `personal_privacy` 账户/隐私查询 | 🟠 MEDIUM | 不拦截，告知无法访问账户 | ✅ |
| `no_knowledge_base` 未收录问题 | 🟡 LOW | 返回兜底文案，记录缺口 | ❌ |

### 置信度与转人工条件

```
confidence = retrieval_score × penalty_factor
  retrieval_score: TOP1 检索分 + 多命中加成（最高 +0.15）
  penalty_factor:  HIGH=0.0 / MEDIUM=0.6 / LOW=0.9 / NONE=1.0
                   MEDIUM无命中时用规则置信度替代检索分

转人工触发条件:
  · risk.level == HIGH  → 强制转（is_blocked=true）
  · risk.level == MEDIUM → 建议转（transfer_to_human=true，用户可主动点击）
```

---

## AI 角色定位

FinAsk 中 AI 扮演 **"有知识边界的投教助手"**，而非投资顾问：

- ✅ **能做**：解释金融概念、介绍产品特征、说明投资风险、引导适当性评估
- ❌ **不做**：推荐具体股票/基金、预测市场涨跌、承诺收益、访问用户账户数据
- 🔄 **不确定时**：返回来源可追溯的知识内容 + 建议咨询持牌顾问

所有回答必须可追溯到知识库条目（`sources` 字段含 `item_id / title / score / content 摘要`）。

---

## 数据说明

| 数据项 | 说明 | 敏感度 |
|---|---|---|
| `knowledge_base.json` | 构造的匿名金融投教 FAQ（20 条），覆盖基础知识/产品介绍/风险教育/合规话术 | 无（公开投教内容） |
| `analytics.db` | SQLite，记录问答日志（无用户 PII，仅 session_id 为 UUID） | 低 |
| LLM 调用 | 默认 Mock 模式，不发送任何数据到外部；生产接入 OpenAI/Qwen 时，仅发送问题+知识片段，不含用户身份 | 低 |

所有知识内容均基于公开的监管文件、投资者教育材料构造，不含真实业务数据，无需脱敏。

---

## 快速启动

### 环境要求
- Python **3.9+**（测试环境：3.9.6）
- Node.js **18+**

### 后端

```bash
cd finask/backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # 默认 Mock 模式，无需 API Key
uvicorn main:app --reload --port 8000
```

### 前端

```bash
cd finask/frontend
npm install
npm run dev                     # http://localhost:5173
```

### 访问入口

| 地址 | 功能 |
|---|---|
| `http://localhost:5173/chat` | 🏦 主问答界面（含风险提示、来源面板、转人工） |
| `http://localhost:5173/stats` | 📊 运营统计看板（越界告警、高频未答、趋势图） |
| `http://localhost:5173/admin/knowledge` | 📚 知识库管理（增删改查、检索预览） |
| `http://localhost:8000/docs` | 🔧 FastAPI 交互式接口文档 |

---

## API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/chat` | 核心问答（风险检测→检索→LLM→返回） |
| GET | `/api/knowledge` | 获取所有知识条目 |
| POST | `/api/knowledge` | 新增知识条目 |
| PUT | `/api/knowledge/{id}` | 更新知识条目（version 自增） |
| DELETE | `/api/knowledge/{id}` | 删除知识条目 |
| GET | `/api/knowledge/search?q=` | 知识检索预览 |
| GET | `/api/analytics/overview` | 统计概览 |
| GET | `/api/analytics/top-questions` | 高频问题 Top N |
| GET | `/api/analytics/recent-logs` | 最近问答记录 |
| GET | `/api/analytics/risk-distribution` | 风险类型分布 |
| GET | `/api/analytics/daily-trend` | 每日趋势 |
| GET | `/api/analytics/knowledge-gaps` | 知识缺口列表（未命中高频问题） |

---

## 已知边界与局限

### 技术边界

| 项目 | 现状 | 影响 |
|---|---|---|
| 知识库检索 | TF-IDF 关键词匹配，无语义理解 | 同义问法可能漏召回 |
| 知识库规模 | 20 条 Demo 数据 | 覆盖范围有限 |
| LLM 默认 Mock | 基于模板拼接，不调外部 API | 回答缺乏自然语言质量 |
| 会话存储 | 内存字典，重启清空 | 无历史上下文持久化 |
| 知识版本 | 仅 version 字段计数，无 diff 记录 | 无法回滚到历史版本 |
| 检索分词 | jieba 默认词典 + 金融词扩充 | 新兴金融词可能分词错误 |

### 合规边界

- 本系统**不提供**投资建议，所有回答仅供投资者教育目的
- `MEDIUM` 风险回答附带"建议咨询持牌投资顾问"提示，但不强制拦截
- 规则引擎基于关键词正则，**无法覆盖所有表达方式**，存在误判和漏判
- 不具备真实的适当性评估能力（未接入用户风险评级数据）

---

## 未做事项（Future Work）

- [ ] **语义检索**：将 TF-IDF 升级为 embedding 向量检索（如 FAISS + text-embedding-3-small）
- [ ] **知识版本 diff**：记录每次编辑的字段变更，支持版本回滚
- [ ] **规则引擎升级**：接入 NLI 模型进行意图分类，降低正则误判率
- [ ] **用户适当性**：接入用户风险评级，按 R1-R5 动态调整回答策略
- [ ] **知识自动入库**：PDF/Word 文档解析 + 自动切片，降低知识维护门槛
- [ ] **多轮对话**：持久化会话历史，支持追问和上下文理解
- [ ] **回答质量评价**：用户点赞/点踩反馈，驱动知识更新优先级
- [ ] **A/B 测试**：不同合规话术的用户满意度对比
- [ ] **合规审计日志**：结构化导出，对接合规系统
- [ ] **生产部署**：Dockerfile + Nginx 反代 + HTTPS

---

## 项目结构

```
finask/
├── README.md                    ← 本文件（题目要求说明）
├── SUBMISSION.md                ← 提交说明（URL/源码/测试/AI记录）
├── TESTS.md                     ← 完整测试说明（curl示例+预期结果）
├── DEMO_SCRIPT.md               ← 演示视频脚本（60-180秒）
├── .gitignore
│
├── backend/
│   ├── main.py                  ← FastAPI 入口，路由挂载
│   ├── requirements.txt
│   ├── .env / .env.example
│   └── app/
│       ├── config.py            ← 环境变量读取
│       ├── models/              ← Pydantic 数据模型
│       │   ├── chat.py          ← 请求/响应模型（含 AnswerPayload, sources）
│       │   ├── risk.py          ← 风险模型（RiskLevel/RiskType/RiskAssessment）
│       │   └── knowledge.py     ← 知识库模型（含 version 字段）
│       ├── routes/
│       │   ├── chat.py          ← POST /api/chat
│       │   ├── knowledge.py     ← CRUD /api/knowledge
│       │   ├── session.py       ← /api/session
│       │   └── analytics.py    ← /api/analytics/* 统计接口
│       ├── services/
│       │   ├── risk_detector.py ← 合规规则引擎（5类风险 × 正则规则）
│       │   ├── knowledge_search.py ← TF-IDF 检索（jieba + sklearn）
│       │   ├── llm_service.py   ← Mock/OpenAI/Qwen LLM 封装
│       │   ├── chat_service.py  ← 主链路编排（检测→检索→生成→组装）
│       │   └── analytics_store.py ← SQLite 统计读写
│       └── data/
│           ├── knowledge_base.json  ← 知识库（20条，含version字段）
│           └── analytics.db         ← 自动生成，gitignored
│
└── frontend/
    ├── vite.config.ts           ← Vite 开发代理 /api → :8000
    ├── src/
    │   ├── pages/
    │   │   ├── ChatPage.tsx     ← 主对话界面
    │   │   ├── AdminPage.tsx    ← 知识库管理后台
    │   │   └── StatsPage.tsx    ← 运营统计看板
    │   ├── components/
    │   │   ├── ChatWindow/      ← 对话列表
    │   │   ├── MessageBubble/   ← 消息气泡（含风险标签/置信度/转人工）
    │   │   ├── SourcePanel/     ← 知识来源展示面板
    │   │   ├── RiskBanner/      ← 高风险拦截提示横幅
    │   │   └── TransferModal/   ← 转人工弹窗
    │   └── api/
    │       ├── client.ts        ← Axios 封装
    │       ├── chatApi.ts       ← 问答接口
    │       ├── knowledgeApi.ts  ← 知识库接口
    │       └── analyticsApi.ts  ← 统计接口
    └── package.json
```
