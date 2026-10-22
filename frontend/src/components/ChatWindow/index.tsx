/**
 * 对话消息列表
 * - 自动滚动到底部
 * - loading：显示"思考中"骨架
 * - error：显示错误提示
 * - 空状态（只有欢迎消息时）
 */
import { useEffect, useRef } from 'react'
import { Spin, Alert } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import type { LocalMessage } from '../../types'
import MessageBubble from '../MessageBubble'

interface Props {
  messages: LocalMessage[]
  loading: boolean
  error: string | null
  onTransfer?: () => void
}

export default function ChatWindow({ messages, loading, error, onTransfer }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '16px 16px 4px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {messages.map((msg) => (
        <MessageBubble key={msg.localId} message={msg} onTransfer={onTransfer} />
      ))}

      {/* 加载状态 */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 40 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#1677ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <RobotOutlined style={{ color: '#fff', fontSize: 14 }} />
          </div>
          <div
            style={{
              background: '#f6f8fa',
              borderRadius: '4px 16px 16px 16px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Spin size="small" />
            <span style={{ color: '#8c8c8c', fontSize: 13 }}>正在思考中...</span>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {error && !loading && (
        <div style={{ paddingLeft: 40 }}>
          <Alert
            type="error"
            message={`请求失败：${error}`}
            showIcon
            style={{ borderRadius: 8, fontSize: 13 }}
          />
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
