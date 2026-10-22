/**
 * 单条消息气泡
 *
 * 功能：
 *  - 用户消息（右侧蓝色）
 *  - AI 回复（左侧，按风险等级变色）
 *  - 风险等级标签 + 风险类型标签
 *  - 置信度进度条
 *  - 高风险"转人工"按钮（内嵌在气泡底部）
 *  - 知识来源引用数量
 *  - 处理耗时（调试用，次要展示）
 */
import { Tag, Typography, Space, Progress, Button, Tooltip } from 'antd'
import {
  UserOutlined,
  RobotOutlined,
  WarningOutlined,
  StopOutlined,
  CustomerServiceOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import type { LocalMessage, RiskLevel } from '../../types'

const { Text, Paragraph } = Typography

// ── 风险等级 → 样式配置 ──────────────────────────────────
const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; tagColor: string; bgColor: string; borderColor: string }
> = {
  none: { label: '', tagColor: 'default', bgColor: '#f6f8fa', borderColor: 'transparent' },
  low: {
    label: '提示',
    tagColor: 'gold',
    bgColor: '#fffbe6',
    borderColor: '#ffe58f',
  },
  medium: {
    label: '警告',
    tagColor: 'orange',
    bgColor: '#fff7e6',
    borderColor: '#ffd591',
  },
  high: {
    label: '已拦截',
    tagColor: 'red',
    bgColor: '#fff2f0',
    borderColor: '#ffccc7',
  },
}

const RISK_TYPE_LABEL: Record<string, string> = {
  guaranteed_return: '保证收益',
  stock_recommendation: '直接荐股',
  market_prediction: '市场预测',
  personal_advice: '个性化建议',
  no_knowledge_base: '知识库无命中',
}

const CATEGORY_LABEL: Record<string, string> = {
  basic_knowledge: '基础知识',
  product_inquiry: '产品咨询',
  risk_education: '风险教育',
  operation_guide: '操作指引',
  compliance_law: '法规合规',
  faq: '常见问题',
  general: '通用',
}

interface Props {
  message: LocalMessage
  onTransfer?: () => void
}

export default function MessageBubble({ message, onTransfer }: Props) {
  const isUser = message.role === 'user'
  const risk = message.risk_assessment
  const riskLevel: RiskLevel = risk?.level ?? 'none'
  const cfg = RISK_CONFIG[riskLevel]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      {/* ── 头像 ───────────────────────────────────────────── */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: isUser
            ? '#1677ff'
            : riskLevel === 'high'
            ? '#ff4d4f'
            : '#1677ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 14,
          color: '#fff',
        }}
      >
        {isUser ? (
          <UserOutlined />
        ) : riskLevel === 'high' ? (
          <StopOutlined />
        ) : (
          <RobotOutlined />
        )}
      </div>

      {/* ── 消息内容区 ─────────────────────────────────────── */}
      <div style={{ maxWidth: '76%', minWidth: 0 }}>
        {/* 风险标签行（仅 AI 消息 + 有风险时显示） */}
        {!isUser && riskLevel !== 'none' && (
          <div style={{ marginBottom: 5, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <Tag
              color={cfg.tagColor}
              icon={<WarningOutlined />}
              style={{ fontSize: 11, lineHeight: '18px' }}
            >
              {cfg.label}
            </Tag>
            {risk?.type && (
              <Tag color="default" style={{ fontSize: 11, lineHeight: '18px' }}>
                {RISK_TYPE_LABEL[risk.type] ?? risk.type}
              </Tag>
            )}
            {message.question_category && (
              <Tag color="blue" style={{ fontSize: 11, lineHeight: '18px' }}>
                {CATEGORY_LABEL[message.question_category] ?? message.question_category}
              </Tag>
            )}
          </div>
        )}

        {/* 气泡主体 */}
        <div
          style={{
            background: isUser ? '#1677ff' : cfg.bgColor,
            color: isUser ? '#fff' : '#262626',
            borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
            padding: '10px 14px',
            border: isUser ? 'none' : `1px solid ${cfg.borderColor}`,
          }}
        >
          <Paragraph
            style={{
              margin: 0,
              color: isUser ? '#fff' : '#262626',
              fontSize: 14,
              lineHeight: '1.65',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {message.content}
          </Paragraph>
        </div>

        {/* ── 元信息行（仅 AI 消息） ─────────────────────── */}
        {!isUser && (
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {/* 置信度 */}
            {message.confidence !== undefined && message.confidence > 0 && (
              <Tooltip title={`综合置信度：${(message.confidence * 100).toFixed(1)}%`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                    置信度
                  </Text>
                  <Progress
                    percent={Math.round(message.confidence * 100)}
                    size="small"
                    style={{ width: 56, margin: 0 }}
                    strokeColor={
                      message.confidence > 0.6
                        ? '#52c41a'
                        : message.confidence > 0.3
                        ? '#faad14'
                        : '#d9d9d9'
                    }
                    showInfo={false}
                  />
                  <Text style={{ fontSize: 11, color: '#8c8c8c' }}>
                    {Math.round(message.confidence * 100)}%
                  </Text>
                </div>
              </Tooltip>
            )}

            {/* 知识来源数 */}
            {message.sources && message.sources.length > 0 && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                📚 {message.sources.length} 条知识来源
              </Text>
            )}

            {/* 处理耗时 */}
            {message.processing_ms !== undefined && (
              <Tooltip title="后端处理耗时">
                <Space size={2}>
                  <ClockCircleOutlined style={{ fontSize: 10, color: '#bfbfbf' }} />
                  <Text style={{ fontSize: 10, color: '#bfbfbf' }}>
                    {message.processing_ms}ms
                  </Text>
                </Space>
              </Tooltip>
            )}

            {/* 高/中风险 → 转人工按钮（内嵌） */}
            {message.transfer_to_human && onTransfer && (
              <Button
                size="small"
                icon={<CustomerServiceOutlined />}
                onClick={onTransfer}
                danger={riskLevel === 'high'}
                style={{ fontSize: 11, height: 22, padding: '0 8px' }}
              >
                转人工客服
              </Button>
            )}
          </div>
        )}

        {/* 时间戳 */}
        <Text
          type="secondary"
          style={{
            fontSize: 11,
            display: 'block',
            marginTop: 2,
            textAlign: isUser ? 'right' : 'left',
          }}
        >
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </div>
    </div>
  )
}
