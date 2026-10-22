/**
 * API 客户端封装
 * 开发模式：VITE_API_BASE_URL 为空，Vite proxy 将 /api 转发到 http://localhost:8000
 * 生产模式：VITE_API_BASE_URL=https://api.yourdomain.com
 */
import axios from 'axios'
import type {
  ChatRequest,
  ChatResponse,
  KnowledgeItem,
  KnowledgeItemCreate,
  SearchResult,
  Stats,
  AnalyticsOverview,
  TopQuestion,
  RecentLog,
  RiskDistributionItem,
  DailyTrendItem,
} from '../types'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',  // 开发时走 Vite proxy，生产时用 .env 里的地址
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// 响应拦截：统一错误处理
http.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || err.message || '请求失败'
    console.error('[API Error]', msg)
    return Promise.reject(new Error(msg))
  }
)

// ── Chat API ──────────────────────────────────────────────
export const chatApi = {
  send: (req: ChatRequest): Promise<ChatResponse> =>
    http.post<ChatResponse>('/api/chat', req).then((r) => r.data),

  getStats: (): Promise<Stats> =>
    http.get<Stats>('/api/stats').then((r) => r.data),
}

// ── Session API ───────────────────────────────────────────
export const sessionApi = {
  get: (sessionId: string) =>
    http.get(`/api/session/${sessionId}`).then((r) => r.data),

  transfer: (sessionId: string) =>
    http.post(`/api/session/${sessionId}/transfer`).then((r) => r.data),
}

// ── Knowledge API ─────────────────────────────────────────
export const knowledgeApi = {
  list: (): Promise<KnowledgeItem[]> =>
    http.get<KnowledgeItem[]>('/api/knowledge').then((r) => r.data),

  get: (id: string): Promise<KnowledgeItem> =>
    http.get<KnowledgeItem>(`/api/knowledge/${id}`).then((r) => r.data),

  search: (q: string, minScore?: number): Promise<SearchResult[]> =>
    http
      .get<SearchResult[]>('/api/knowledge/search', {
        params: { q, min_score: minScore },
      })
      .then((r) => r.data),

  create: (data: KnowledgeItemCreate): Promise<KnowledgeItem> =>
    http.post<KnowledgeItem>('/api/knowledge', data).then((r) => r.data),

  update: (id: string, data: Partial<KnowledgeItemCreate>): Promise<KnowledgeItem> =>
    http.put<KnowledgeItem>(`/api/knowledge/${id}`, data).then((r) => r.data),

  delete: (id: string): Promise<void> =>
    http.delete(`/api/knowledge/${id}`).then(() => undefined),
}

export default http

// ── Analytics API ──────────────────────────────────
export const analyticsApi = {
  overview: (): Promise<AnalyticsOverview> =>
    http.get<AnalyticsOverview>('/api/analytics/overview').then((r) => r.data),

  topQuestions: (limit = 10): Promise<TopQuestion[]> =>
    http.get<TopQuestion[]>('/api/analytics/top-questions', { params: { limit } }).then((r) => r.data),

  recentLogs: (limit = 20): Promise<RecentLog[]> =>
    http.get<RecentLog[]>('/api/analytics/recent-logs', { params: { limit } }).then((r) => r.data),

  riskDistribution: (): Promise<RiskDistributionItem[]> =>
    http.get<RiskDistributionItem[]>('/api/analytics/risk-distribution').then((r) => r.data),

  dailyTrend: (days = 7): Promise<DailyTrendItem[]> =>
    http.get<DailyTrendItem[]>('/api/analytics/daily-trend', { params: { days } }).then((r) => r.data),
}
