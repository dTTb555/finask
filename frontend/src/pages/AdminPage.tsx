/**
 * 知识库管理后台页面
 */
import { useState, useEffect } from 'react'
import {
  Layout,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Typography,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { knowledgeApi } from '../api/client'
import type { KnowledgeItem, KnowledgeCategory, KnowledgeItemCreate } from '../types'

const { Header, Content } = Layout
const { TextArea } = Input
const { Text } = Typography

const CATEGORIES: KnowledgeCategory[] = [
  '基础知识', '产品介绍', '风险提示', '操作指引', '法规合规', '常见问题',
]

const CATEGORY_COLORS: Record<string, string> = {
  基础知识: 'blue',
  产品介绍: 'green',
  风险提示: 'orange',
  操作指引: 'cyan',
  法规合规: 'purple',
  常见问题: 'default',
}

export default function AdminPage() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterKeyword, setFilterKeyword] = useState('')
  const [form] = Form.useForm()

  const loadItems = async () => {
    setLoading(true)
    try {
      const data = await knowledgeApi.list({
        category: filterCategory || undefined,
        keyword: filterKeyword || undefined,
      })
      setItems(data)
    } catch (err: unknown) {
      message.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [filterCategory])

  const handleSearch = () => loadItems()

  const openCreate = () => {
    setEditingItem(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (item: KnowledgeItem) => {
    setEditingItem(item)
    form.setFieldsValue({
      ...item,
      tags: item.tags.join(', '),
    })
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await knowledgeApi.delete(id)
      message.success('删除成功')
      loadItems()
    } catch (err: unknown) {
      message.error((err as Error).message)
    }
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    const payload: KnowledgeItemCreate = {
      ...values,
      tags: values.tags
        ? values.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : [],
    }
    try {
      if (editingItem) {
        await knowledgeApi.update(editingItem.id, payload)
        message.success('更新成功')
      } else {
        await knowledgeApi.create(payload)
        message.success('创建成功')
      }
      setModalOpen(false)
      loadItems()
    } catch (err: unknown) {
      message.error((err as Error).message)
    }
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 100,
      render: (id: string) => <Text code style={{ fontSize: 11 }}>{id}</Text>,
    },
    {
      title: '标题',
      dataIndex: 'title',
      render: (title: string, item: KnowledgeItem) => (
        <Tooltip title={item.content.slice(0, 100) + '...'}>
          <Text>{title}</Text>
        </Tooltip>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
      render: (cat: string) => (
        <Tag color={CATEGORY_COLORS[cat] || 'default'}>{cat}</Tag>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 200,
      render: (tags: string[]) => (
        <Space size={2} wrap>
          {tags.slice(0, 3).map((t) => (
            <Tag key={t} style={{ fontSize: 11 }}>{t}</Tag>
          ))}
          {tags.length > 3 && <Text type="secondary" style={{ fontSize: 11 }}>+{tags.length - 3}</Text>}
        </Space>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 160,
      render: (s: string) => <Text type="secondary" style={{ fontSize: 12 }}>{s}</Text>,
    },
    {
      title: '操作',
      width: 120,
      render: (_: unknown, item: KnowledgeItem) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(item)}
          />
          <Popconfirm
            title="确认删除该条目？"
            onConfirm={() => handleDelete(item.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Header
        style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          height: 56,
        }}
      >
        <Space>
          <Link to="/chat">
            <Button icon={<ArrowLeftOutlined />} size="small" type="text" />
          </Link>
          <span style={{ fontSize: 18 }}>📚</span>
          <Text strong>知识库管理</Text>
          <Text type="secondary" style={{ fontSize: 13 }}>
            共 {items.length} 条
          </Text>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增条目
        </Button>
      </Header>

      <Content style={{ padding: 20 }}>
        {/* 筛选栏 */}
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="全部分类"
            allowClear
            style={{ width: 140 }}
            value={filterCategory || undefined}
            onChange={(v) => setFilterCategory(v || '')}
          >
            {CATEGORIES.map((c) => (
              <Select.Option key={c} value={c}>{c}</Select.Option>
            ))}
          </Select>
          <Input
            placeholder="搜索标题/内容"
            style={{ width: 200 }}
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
            onPressEnter={handleSearch}
            suffix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          />
          <Button onClick={handleSearch} icon={<SearchOutlined />}>
            搜索
          </Button>
        </Space>

        {/* 表格 */}
        <Table
          columns={columns}
          dataSource={items}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          style={{ background: '#fff', borderRadius: 8 }}
          size="middle"
        />
      </Content>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingItem ? '编辑知识条目' : '新增知识条目'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={640}
        okText={editingItem ? '更新' : '创建'}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="知识条目标题" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Select placeholder="选择分类">
              {CATEGORIES.map((c) => (
                <Select.Option key={c} value={c}>{c}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="content" label="正文内容" rules={[{ required: true }]}>
            <TextArea rows={6} placeholder="知识内容（200-500字为宜）" />
          </Form.Item>
          <Form.Item name="source" label="来源">
            <Input placeholder="如：《基金投资者教育手册》第3章" />
          </Form.Item>
          <Form.Item name="tags" label="标签（逗号分隔）">
            <Input placeholder="如：基金, 净值, 投教" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
