/**
 * 转人工弹窗（模拟）
 */
import { Modal, Result, Typography, Space } from 'antd'
import { CustomerServiceOutlined } from '@ant-design/icons'

const { Text } = Typography

interface Props {
  visible: boolean
  onClose: () => void
}

export default function TransferModal({ visible, onClose }: Props) {
  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={400}
      centered
    >
      <Result
        icon={<CustomerServiceOutlined style={{ color: '#1677ff', fontSize: 48 }} />}
        title="正在为您转接人工客服"
        subTitle={
          <Space direction="vertical" size={4} style={{ marginTop: 8 }}>
            <Text type="secondary">您的问题已记录，客服将为您提供专业解答</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              请保持页面不关闭，稍后客服将主动联系您
            </Text>
          </Space>
        }
      />
    </Modal>
  )
}
