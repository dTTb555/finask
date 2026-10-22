/**
 * 全局 TypeScript 类型定义（与后端 Pydantic 模型严格对应）
 */

// ── 风险相关 ─────────────────────────────────────────────
export type RiskLevel = 'none' | 'low' | 'medium' | 'high'

export type RiskType =
  | 'guaranteed_return'       // 保证收益
  | 'stock_recommendation'    // 直接荐股
  | 'market_prediction'       // 市场预测
  | 'personal_advice'         // 个性化投资建议
  | 'no_knowledge_base'       // 知识库无依据

export interface RiskAssessment {
  level: RiskLevel
  type: RiskType | null
  confidence: number
  reason: string
  hit_rules: string[]
  suggestion: string
  transfer_to_human: boolean   // ← 新增
}

// ── 知识库相关 ───────────────────────────────────────────
export type KnowledgeCategory =
  | '基础知识'
  | '产品介绍'
  | '风险提示'
  | '操作指引'
  | '法规合规'
  | '常见问题'

export interface KnowledgeItem {
  id: string
  title: string
  content: string
  category: KnowledgeCategory
  tags: string[]
  source: string
  created_at: string
}

export interface KnowledgeItemCreate {
  title: string
  content: string
  category: KnowledgeCategory
  tags: string[]
  source: string
}

/** 检索结果 — 后端 SearchResult（展平结构，含置信度） */
export interface SearchResult {
  id: string
  title: string
  content: string
  category: KnowledgeCategory
  tags: string[]
  source: string
  score: number        // TF-IDF 余弦相似度原始值
  confidence: number   // 归一化置信度（相对最高分）
}

// ── 对话相关 ─────────────────────────────────────────────

/** 前端本地维护的消息对象（含 UI 所需扩展字段） */
export interface LocalMessage {
  localId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  // 仅 assistant 消息有以下字段
  risk_assessment?: RiskAssessment
  sources?: SearchResult[]
  is_blocked?: boolean
  transfer_to_human?: boolean
  confidence?: number           // answer.confidence
  question_category?: string
  processing_ms?: number
}

export interface ChatRequest {
  session_id?: string
  message: string
  user_id?: string
}

export interface AnswerPayload {
  content: string
  is_blocked: boolean
  transfer_to_human: boolean
  confidence: number   // ← 新增
}

/** 与后端 ChatResponse 完全对应 */
export interface ChatResponse {
  session_id: string
  question: string
  question_category: string    // ← 新增
  answer: AnswerPayload
  risk_assessment: RiskAssessment
  sources: SearchResult[]      // ← 原 SourceReference[] 改为 SearchResult[]
  processing_ms: number        // ← 新增
}

// ── 旧版会话统计（/api/stats）───────────────────────────
export interface Stats {
  total_sessions: number
  total_messages: number
  transferred_sessions: number
  knowledge_items: number
}

// ── 运营统计（/api/analytics/*）───────────────────────
export interface AnalyticsOverview {
  total: number
  high_risk: number
  medium_risk: number
  transferred: number
  blocked: number
  no_kb: number
}

export interface TopQuestion {
  question: string
  cnt: number
  risk_level: RiskLevel
  category: string | null
}

export interface RecentLog {
  id: number
  session_id: string
  question: string
  answer: string
  risk_level: RiskLevel
  risk_type: RiskType | null
  is_blocked: boolean
  transfer: boolean
  confidence: number
  sources_cnt: number
  category: string | null
  created_at: string
}

export interface RiskDistributionItem {
  risk_type: RiskType
  cnt: number
}

export interface DailyTrendItem {
  date: string
  total: number
  high_risk: number
}
