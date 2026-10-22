/**
 * 主对话页面
 * 布局：Header + 左侧对话区 + 右侧知识来源面板
 */
import { useState, useRef, useCallback } from 'react'
import { Layout, Input, Button, Typography, Space, Tooltip, message as antMessage } from 'antd'
import {
  SendOutlined,
  CustomerServiceOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { chatApi, sessionApi } from '../api/client'
import type { LocalMessage, SearchResult, RiskAssessment } from '../types'
import ChatWindow from '../components/ChatWindow'
import SourcePanel from '../components/SourcePanel'
import RiskBanner from '../components/RiskBanner'
import TransferModal from '../components/TransferModal'

const { Header, Content } = Layout
const { Text } = Typography

// ── 欢迎消息 ─────────────────────────────────────────────
const WELCOME_MSG: LocalMessage = {
  localId: 'welcome',
  role: 'assistant',
  content:
    '您好！我是 FinAsk 金融智能问答助手 🏦\n\n我可以解答金融基础知识、基金投资、风险管理等问题，回答均基于合规知识库。\n\n💡 点击下方快捷问题，或直接输入您的问题：',
  timestamp: new Date().toISOString(),
}

const QUICK_QUESTIONS = [
  '什么是基金净值？',
  '基金定投有什么优势？',
  '货币基金和银行活期有什么区别？',
  '如何评估基金风险等级？',
  '基金亏损了应该怎么办？',
]

export default function ChatPage() {
  const [messages, setMessages] = useState<LocalMessage[]>([WELCOME_MSG])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | undefined>()

  // 最新一条 AI 回复的附加信息（用于右侧面板）
  const [currentSources, setCurrentSources] = useState<SearchResult[]>([])
  const [latestRisk, setLatestRisk] = useState<RiskAssessment | null>(null)

  const [transferVisible, setTransferVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return

      setError(null)

      // ── 立即渲染用户气泡 ─────────────────────────────
      const userMsg: LocalMessage = {
        localId: `user_${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMsg])
      setInputValue('')
      setLoading(true)
      setCurrentSources([])
      setLatestRisk(null)

      try {
        const resp = await chatApi.send({ session_id: sessionId, message: trimmed })

        setSessionId(resp.session_id)
        setLatestRisk(resp.risk_assessment)
        setCurrentSources(resp.sources)

        const aiMsg: LocalMessage = {
          localId: `ai_${Date.now()}`,
          role: 'assistant',
          content: resp.answer.content,
          timestamp: new Date().toISOString(),
          risk_assessment: resp.risk_assessment,
          sources: resp.sources,
          is_blocked: resp.answer.is_blocked,
          transfer_to_human: resp.answer.transfer_to_human,
          confidence: resp.answer.confidence,
          question_category: resp.question_category,
          processing_ms: resp.processing_ms,
        }
        setMessages((prev) => [...prev, aiMsg])
      } catch (err: unknown) {
        const errMsg = (err as Error).message || '请求失败，请稍后重试'
        setError(errMsg)
        antMessage.error(errMsg)
      } finally {
        setLoading(false)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
    },
    [loading, sessionId]
  )

  const handleTransfer = async () => {
    if (sessionId) {
      try {
        await sessionApi.transfer(sessionId)
      } catch {
        // 转人工接口失败不阻塞弹窗
      }
    }
    setTransferVisible(true)
  }

  return (
    <Layout style={{ height: '100vh', background: '#f0f2f5' }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <Header
        style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 6px rgba(0,0,0,0.10)',
          zIndex: 10,
          height: 56,
        }}
      >
        <Space>
          <span style={{ fontSize: 20 }}>🏦</span>
          <Text strong style={{ fontSize: 16 }}>FinAsk</Text>
          <Text type="secondary" style={{ fontSize: 13 }}>金融智能问答助手</Text>
        </Space>
        <Space>
          {/* 有风险时 Header 也露出"转人工"按钮 */}
          {latestRisk?.transfer_to_human && (
            <Button
              icon={<CustomerServiceOutlined />}
              onClick={handleTransfer}
              size="small"
              danger
            >
              转人工
            </Button>
          )}
          <Tooltip title="知识库管理">
            <Link to="/admin/knowledge">
              <Button icon={<SettingOutlined />} size="small" />
            </Link>
          </Tooltip>
          <Tooltip title="运营统计">
            <Link to="/stats">
              <Button icon={<BarChartOutlined />} size="small" />
            </Link>
          </Tooltip>
          <Tooltip title="本系统基于合规知识库回答，不提供投资建议">
            <Button icon={<QuestionCircleOutlined />} size="small" type="text" />
          </Tooltip>
        </Space>
      </Header>

      {/* ── Main ────────────────────────────────────────────── */}
      <Content style={{ display: 'flex', overflow: 'hidden', padding: '12px 16px', gap: 12 }}>
        {/* 左侧：对话区 */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            minWidth: 0,
          }}
        >
          {/* 风险提示横幅 */}
          {latestRisk && latestRisk.level !== 'none' && (
            <RiskBanner risk={latestRisk} onTransfer={handleTransfer} />
          )}

          {/* 消息列表 */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ChatWindow
              messages={messages}
              loading={loading}
              error={error}
              onTransfer={handleTransfer}
            />
          </div>

          {/* 快捷问题 */}
          <div style={{ padding: '8px 16px 4px', borderTop: '1px solid #f5f5f5' }}>
            <Space size={6} wrap>
              {QUICK_QUESTIONS.map((q) => (
                <Button
                  key={q}
                  size="small"
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                  style={{ fontSize: 12, borderColor: '#d0e4ff', color: '#1677ff' }}
                >
                  {q}
                </Button>
              ))}
            </Space>
          </div>

          {/* 输入区 */}
          <div
            style={{
              padding: '10px 16px 12px',
              borderTop: '1px solid #f0f0f0',
              display: 'flex',
              gap: 8,
            }}
          >
            <Input
              ref={inputRef as never}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPressEnter={() => sendMessage(inputValue)}
              placeholder="输入您的问题，按 Enter 发送..."
              disabled={loading}
              style={{ flex: 1 }}
              size="large"
              maxLength={500}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              size="large"
              loading={loading}
              onClick={() => sendMessage(inputValue)}
              disabled={!inputValue.trim()}
            >
              发送
            </Button>
          </div>
        </div>

        {/* 右侧：知识来源面板 */}
        <div
          style={{
            width: 300,
            background: '#fff',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            flexShrink: 0,
          }}
        >
          <SourcePanel sources={currentSources} loading={loading} />
        </div>
      </Content>

      {/* 转人工弹窗 */}
      <TransferModal visible={transferVisible} onClose={() => setTransferVisible(false)} />
    </Layout>
  )
}
