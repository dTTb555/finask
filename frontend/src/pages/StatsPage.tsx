/**
 * 运营统计页
 *
 * 展示：
 *  - 数字卡片：总问题数、高风险数、转人工数、知识库未命中
 *  - 风险类型分布（Tag 列表）
 *  - 高频问题 Top 10（表格）
 *  - 最近问答记录（表格，含展开查看答案）
 */
import { useEffect, useState, useCallback } from 'react'
import {
  Layout, Typography, Row, Col, Card, Statistic, Table, Tag, Button,
  Space, Tooltip, Spin, Alert, Divider, Badge,
} from 'antd'
import {
  MessageOutlined, WarningOutlined, CustomerServiceOutlined,
  QuestionCircleOutlined, ReloadOutlined, ArrowLeftOutlined, FireOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { analyticsApi } from '../api/client'
import type { AnalyticsOverview, TopQuestion, RecentLog, RiskDistributionItem, RiskLevel } from '../types'

const { Header, Content } = Layout
const { Title, Text } = Typography

// ── 风险等级 → 颜色映射 ────────────────────────────────────
const RISK_COLOR: Record<RiskLevel, string> = {
  none: 'default',
  low: 'gold',
  medium: 'orange',
  high: 'red',
}
const RISK_LABEL: Record<RiskLevel, string> = {
  none: '正常',
  low: '低风险',
  medium: '中风险',
  high: '高风险',
}
const RISK_TYPE_LABEL: Record<string, string> = {
  guaranteed_return: '保证收益',
  stock_recommendation: '直接荐股',
  market_prediction: '市场预测',
  personal_advice: '个性化建议',
  no_knowledge_base: '知识库未命中',
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

export default function StatsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [topQ, setTopQ] = useState<TopQuestion[]>([])
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([])
  const [riskDist, setRiskDist] = useState<RiskDistributionItem[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ov, tq, rl, rd] = await Promise.all([
        analyticsApi.overview(),
        analyticsApi.topQuestions(10),
        analyticsApi.recentLogs(20),
        analyticsApi.riskDistribution(),
      ])
      setOverview(ov)
      setTopQ(tq)
      setRecentLogs(rl)
      setRiskDist(rd)
    } catch (e: unknown) {
      setError((e as Error).message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── 高频问题表格列 ────────────────────────────────────────
  const topQColumns: ColumnsType<TopQuestion> = [
    {
      title: '#',
      dataIndex: '_rank',
      width: 40,
      render: (_: unknown, __: TopQuestion, idx: number) => (
        <Text style={{ color: idx < 3 ? '#fa8c16' : '#8c8c8c', fontWeight: idx < 3 ? 700 : 400 }}>
          {idx + 1}
        </Text>
      ),
    },
    {
      title: '问题内容',
      dataIndex: 'question',
      ellipsis: true,
      render: (v: string) => <Text>{v}</Text>,
    },
    {
      title: '次数',
      dataIndex: 'cnt',
      width: 60,
      align: 'center',
      sorter: (a, b) => b.cnt - a.cnt,
      render: (v: number) => (
        <Badge count={v} color={v >= 3 ? '#f50' : '#108ee9'} showZero />
      ),
    },
    {
      title: '风险',
      dataIndex: 'risk_level',
      width: 90,
      render: (v: RiskLevel) => (
        <Tag color={RISK_COLOR[v]} style={{ fontSize: 11 }}>{RISK_LABEL[v]}</Tag>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 90,
      render: (v: string | null) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{v ? (CATEGORY_LABEL[v] ?? v) : '—'}</Text>
      ),
    },
  ]

  // ── 最近记录表格列 ────────────────────────────────────────
  const recentColumns: ColumnsType<RecentLog> = [
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 80,
      render: (v: string) => (
        <Text style={{ fontSize: 11, color: '#8c8c8c' }}>
          {new Date(v).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          <br />
          <span style={{ fontSize: 10 }}>
            {new Date(v).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
          </span>
        </Text>
      ),
    },
    {
      title: '问题',
      dataIndex: 'question',
      ellipsis: true,
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: '风险',
      dataIndex: 'risk_level',
      width: 85,
      render: (v: RiskLevel, row: RecentLog) => (
        <div>
          <Tag color={RISK_COLOR[v]} style={{ fontSize: 11, marginBottom: 2 }}>
            {RISK_LABEL[v]}
          </Tag>
          {row.risk_type && (
            <div>
              <Text style={{ fontSize: 10, color: '#8c8c8c' }}>
                {RISK_TYPE_LABEL[row.risk_type] ?? row.risk_type}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: '拦截',
      dataIndex: 'is_blocked',
      width: 55,
      align: 'center',
      render: (v: boolean) =>
        v ? <Tag color="red" style={{ fontSize: 11 }}>是</Tag>
          : <Tag color="default" style={{ fontSize: 11 }}>否</Tag>,
    },
    {
      title: '转人工',
      dataIndex: 'transfer',
      width: 65,
      align: 'center',
      render: (v: boolean) =>
        v ? <Tag color="orange" style={{ fontSize: 11 }}>是</Tag>
          : <Tag color="default" style={{ fontSize: 11 }}>否</Tag>,
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      width: 72,
      align: 'center',
      render: (v: number) => (
        <Text style={{ fontSize: 12, color: v > 0.5 ? '#52c41a' : v > 0.2 ? '#faad14' : '#d9d9d9' }}>
          {v > 0 ? `${(v * 100).toFixed(0)}%` : '—'}
        </Text>
      ),
    },
    {
      title: '来源数',
      dataIndex: 'sources_cnt',
      width: 65,
      align: 'center',
      render: (v: number) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      {/* ── Header ────────────────────────────────────────── */}
      <Header
        style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
          height: 56,
        }}
      >
        <Space>
          <Link to="/chat">
            <Button icon={<ArrowLeftOutlined />} size="small" type="text" />
          </Link>
          <span style={{ fontSize: 18 }}>📊</span>
          <Text strong style={{ fontSize: 15 }}>运营统计</Text>
          <Text type="secondary" style={{ fontSize: 13 }}>FinAsk · 数据看板</Text>
        </Space>
        <Button icon={<ReloadOutlined />} size="small" onClick={load} loading={loading}>
          刷新
        </Button>
      </Header>

      {/* ── Content ───────────────────────────────────────── */}
      <Content style={{ padding: '20px 24px' }}>
        {error && (
          <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />
        )}

        <Spin spinning={loading} tip="加载中...">
          {/* ── 数字卡片 ──────────────────────────────────── */}
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={8} md={4}>
              <Card bordered={false} style={{ textAlign: 'center' }}>
                <Statistic
                  title="总问题数"
                  value={overview?.total ?? 0}
                  prefix={<MessageOutlined style={{ color: '#1677ff' }} />}
                  valueStyle={{ color: '#1677ff', fontSize: 28 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card bordered={false} style={{ textAlign: 'center' }}>
                <Statistic
                  title="高风险拦截"
                  value={overview?.high_risk ?? 0}
                  prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />}
                  valueStyle={{ color: '#ff4d4f', fontSize: 28 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card bordered={false} style={{ textAlign: 'center' }}>
                <Statistic
                  title="中风险问题"
                  value={overview?.medium_risk ?? 0}
                  prefix={<WarningOutlined style={{ color: '#fa8c16' }} />}
                  valueStyle={{ color: '#fa8c16', fontSize: 28 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card bordered={false} style={{ textAlign: 'center' }}>
                <Statistic
                  title="转人工次数"
                  value={overview?.transferred ?? 0}
                  prefix={<CustomerServiceOutlined style={{ color: '#722ed1' }} />}
                  valueStyle={{ color: '#722ed1', fontSize: 28 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card bordered={false} style={{ textAlign: 'center' }}>
                <Statistic
                  title="知识库未命中"
                  value={overview?.no_kb ?? 0}
                  prefix={<QuestionCircleOutlined style={{ color: '#8c8c8c' }} />}
                  valueStyle={{ color: '#8c8c8c', fontSize: 28 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card bordered={false} style={{ textAlign: 'center' }}>
                <Statistic
                  title="拦截率"
                  value={
                    overview && overview.total > 0
                      ? ((overview.blocked / overview.total) * 100).toFixed(1)
                      : 0
                  }
                  suffix="%"
                  valueStyle={{ color: '#cf1322', fontSize: 28 }}
                />
              </Card>
            </Col>
          </Row>

          {/* ── 风险类型分布 ──────────────────────────────── */}
          {riskDist.length > 0 && (
            <Card
              title={<><WarningOutlined style={{ color: '#fa8c16' }} /> 风险类型分布</>}
              bordered={false}
              style={{ marginTop: 16 }}
              bodyStyle={{ padding: '12px 16px' }}
            >
              <Space wrap size={10}>
                {riskDist.map((item) => (
                  <Tooltip key={item.risk_type} title={`共 ${item.cnt} 次`}>
                    <Tag
                      color={
                        item.risk_type === 'stock_recommendation' ? 'red'
                        : item.risk_type === 'guaranteed_return' ? 'red'
                        : item.risk_type === 'market_prediction' ? 'orange'
                        : item.risk_type === 'personal_advice' ? 'gold'
                        : 'default'
                      }
                      style={{ fontSize: 13, padding: '3px 10px', cursor: 'default' }}
                    >
                      {RISK_TYPE_LABEL[item.risk_type] ?? item.risk_type}
                      <Text style={{ marginLeft: 6, fontWeight: 700 }}>{item.cnt}</Text>
                    </Tag>
                  </Tooltip>
                ))}
              </Space>
            </Card>
          )}

          <Row gutter={16} style={{ marginTop: 16 }}>
            {/* ── 高频问题 ────────────────────────────────── */}
            <Col xs={24} lg={10}>
              <Card
                title={<><FireOutlined style={{ color: '#fa8c16' }} /> 高频问题 Top 10</>}
                bordered={false}
                bodyStyle={{ padding: 0 }}
                style={{ height: '100%' }}
              >
                <Table
                  dataSource={topQ}
                  columns={topQColumns}
                  rowKey="question"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: '暂无数据' }}
                />
              </Card>
            </Col>

            {/* ── 最近问答记录 ──────────────────────────────── */}
            <Col xs={24} lg={14}>
              <Card
                title={<><MessageOutlined style={{ color: '#1677ff' }} /> 最近问答记录</>}
                bordered={false}
                bodyStyle={{ padding: 0 }}
                style={{ height: '100%' }}
              >
                <Table
                  dataSource={recentLogs}
                  columns={recentColumns}
                  rowKey="id"
                  pagination={{ pageSize: 10, size: 'small', hideOnSinglePage: true }}
                  size="small"
                  locale={{ emptyText: '暂无数据' }}
                  expandable={{
                    expandedRowRender: (row: RecentLog) => (
                      <div
                        style={{
                          background: '#fafafa',
                          padding: '10px 14px',
                          borderRadius: 6,
                          fontSize: 13,
                          color: '#595959',
                          lineHeight: 1.6,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        <Text strong style={{ display: 'block', marginBottom: 4 }}>
                          回答内容：
                        </Text>
                        {row.answer}
                      </div>
                    ),
                    rowExpandable: () => true,
                  }}
                />
              </Card>
            </Col>
          </Row>
        </Spin>
      </Content>
    </Layout>
  )
}
