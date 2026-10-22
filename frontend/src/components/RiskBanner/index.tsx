/**
 * 顶部风险提示横幅
 *
 * - low   → 蓝色 info
 * - medium → 橙色 warning
 * - high  → 红色 error + "转人工"按钮
 */
import { Alert, Button } from 'antd'
import { CustomerServiceOutlined } from '@ant-design/icons'
import type { RiskAssessment, RiskLevel } from '../../types'

interface Props {
  risk: RiskAssessment
  onTransfer: () => void
}

const RISK_TYPE_LABELS: Record<string, string> = {
  guaranteed_return: '保证收益',
  stock_recommendation: '直接荐股',
  market_prediction: '市场预测',
  personal_advice: '个性化投资建议',
  no_knowledge_base: '知识库无命中',
}

const ALERT_TYPE: Record<RiskLevel, 'info' | 'warning' | 'error'> = {
  none: 'info',
  low: 'info',
  medium: 'warning',
  high: 'error',
}

export default function RiskBanner({ risk, onTransfer }: Props) {
  if (risk.level === 'none') return null

  const alertType = ALERT_TYPE[risk.level]
  const typeLabel = risk.type ? RISK_TYPE_LABELS[risk.type] ?? risk.type : ''

  let message = ''
  if (risk.level === 'high') {
    message = `⚠️ 检测到【${typeLabel}】风险，已按合规要求拦截，无法继续回答该类问题。`
  } else if (risk.level === 'medium') {
    message = `💡 检测到【${typeLabel}】相关内容，已提供通用知识回答，如需个性化建议请咨询专业人士。`
  } else {
    message = `ℹ️ 本次回答仅供参考，不构成投资建议。`
  }

  return (
    <Alert
      type={alertType}
      message={message}
      showIcon={false}
      style={{ borderRadius: 0, padding: '8px 16px', fontSize: 13 }}
      action={
        risk.transfer_to_human ? (
          <Button
            size="small"
            icon={<CustomerServiceOutlined />}
            onClick={onTransfer}
            danger={risk.level === 'high'}
          >
            转人工
          </Button>
        ) : undefined
      }
      closable
    />
  )
}
