/**
 * 右侧知识来源面板
 *
 * 展示当前回答引用的知识库片段，包含：
 *  - 知识标题
 *  - 内容摘要（前200字）
 *  - 相关度（TF-IDF score）
 *  - 置信度（归一化后，相对最高分）
 *  - 来源 / 分类标签
 *  - 加载态 / 空状态
 */
import { Typography, Divider, Progress, Empty, Tag, Skeleton, Tooltip } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import type { SearchResult } from '../../types'

const { Text, Title } = Typography

interface Props {
  sources: SearchResult[]
  loading?: boolean
}

export default function SourcePanel({ sources, loading = false }: Props) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题栏 */}
      <div
        style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Title level={5} style={{ margin: 0, fontSize: 14 }}>
          📚 知识来源
        </Title>
        {sources.length > 0 && (
          <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
            {sources.length} 条
          </Tag>
        )}
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading ? (
          // 加载骨架
          <div>
            {[1, 2].map((i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <Skeleton active paragraph={{ rows: 2 }} title={{ width: '60%' }} />
                {i < 2 && <Divider style={{ margin: '12px 0' }} />}
              </div>
            ))}
          </div>
        ) : sources.length === 0 ? (
          // 空状态
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Text type="secondary" style={{ fontSize: 12 }}>
                发送问题后，<br />这里会展示引用的知识片段
              </Text>
            }
            style={{ marginTop: 48 }}
          />
        ) : (
          sources.map((src, idx) => (
            <div key={src.id}>
              {idx > 0 && <Divider style={{ margin: '12px 0' }} />}
              <SourceCard source={src} rank={idx + 1} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function SourceCard({ source, rank }: { source: SearchResult; rank: number }) {
  const scorePercent = Math.round(source.score * 100)
  const confPercent = Math.round(source.confidence * 100)
  const excerpt = source.content.slice(0, 200).trimEnd() + (source.content.length > 200 ? '…' : '')

  return (
    <div>
      {/* 标题行 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            background: rank === 1 ? '#1677ff' : '#d9d9d9',
            color: '#fff',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          {rank}
        </div>
        <Text strong style={{ fontSize: 13, lineHeight: '1.4', flex: 1 }}>
          {source.title}
        </Text>
      </div>

      {/* 内容摘要 */}
      <div
        style={{
          fontSize: 12,
          color: '#595959',
          lineHeight: '1.55',
          marginBottom: 8,
          background: '#fafafa',
          padding: '6px 10px',
          borderRadius: 6,
          borderLeft: '3px solid #1677ff',
        }}
      >
        {excerpt}
      </div>

      {/* 标签行 */}
      <div style={{ marginBottom: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        <Tag style={{ fontSize: 11, margin: 0 }}>{source.category}</Tag>
        {source.source && (
          <Tag color="default" style={{ fontSize: 11, margin: 0 }}>
            {source.source}
          </Tag>
        )}
      </div>

      {/* 相关度 + 置信度 */}
      <div style={{ display: 'flex', gap: 12 }}>
        <Tooltip title={`TF-IDF 相关度：${scorePercent}%`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
              相关度
            </Text>
            <Progress
              percent={scorePercent}
              size="small"
              style={{ width: 50, margin: 0 }}
              strokeColor={scorePercent > 50 ? '#52c41a' : scorePercent > 25 ? '#faad14' : '#d9d9d9'}
              showInfo={false}
            />
            <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{scorePercent}%</Text>
          </div>
        </Tooltip>

        <Tooltip title={`归一化置信度：${confPercent}%（相对最高分）`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
              置信度
            </Text>
            <Progress
              percent={confPercent}
              size="small"
              style={{ width: 50, margin: 0 }}
              strokeColor={confPercent > 70 ? '#1677ff' : '#bfbfbf'}
              showInfo={false}
            />
            <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{confPercent}%</Text>
          </div>
        </Tooltip>
      </div>

      {/* 标签 chips */}
      {source.tags.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {source.tags.slice(0, 4).map((tag) => (
            <Tag key={tag} style={{ fontSize: 10, margin: 0, padding: '0 5px', lineHeight: '16px' }}>
              {tag}
            </Tag>
          ))}
        </div>
      )}
    </div>
  )
}
