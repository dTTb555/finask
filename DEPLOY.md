# FinAsk — 公网部署指南

> 本指南将 FinAsk 部署到公网，让任何人都能访问。
> 推荐方案：**后端 Railway + 前端 Vercel**，两个都免费，10 分钟完成。

---

## 前提

- GitHub 账号（用于连接 Railway 和 Vercel）
- 先把代码推送到 GitHub 仓库

### 推送代码到 GitHub

```bash
cd finask
git init
git add .
git commit -m "feat: FinAsk AI投顾问答系统"

# 在 GitHub 上新建仓库（不要初始化 README），然后：
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

---

## 第一步：部署后端到 Railway

### 1.1 注册 Railway

访问 https://railway.app → 用 GitHub 账号登录

### 1.2 新建项目

1. 点击 **「New Project」**
2. 选择 **「Deploy from GitHub repo」**
3. 选择你的 FinAsk 仓库
4. Railway 会问你从哪个目录部署 → 填写 **`finask/backend`**（或在下面设置 Root Directory）

### 1.3 设置环境变量

在 Railway 项目 → **Variables** 标签页，添加：

| 变量名 | 值 |
|---|---|
| `LLM_PROVIDER` | `mock` |
| `CORS_ORIGINS` | `*`（先填 * 等前端部署后再改成具体域名） |

### 1.4 确认启动命令

Railway 会自动读取 `Procfile`，启动命令为：
```
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### 1.5 等待部署完成

部署成功后，Railway 会给你一个地址，类似：
```
https://finask-backend-production.up.railway.app
```

### 1.6 验证后端

```bash
curl https://finask-backend-production.up.railway.app/health
# 应返回：{"status":"ok","version":"0.2.0"}
```

---

## 第二步：部署前端到 Vercel

### 2.1 注册 Vercel

访问 https://vercel.com → 用 GitHub 账号登录

### 2.2 导入项目

1. 点击 **「Add New → Project」**
2. 选择你的 GitHub 仓库
3. **Root Directory** 填写 **`finask/frontend`**
4. Framework Preset 选 **Vite**

### 2.3 配置环境变量

在 Vercel 项目设置 → **Environment Variables**，添加：

| 变量名 | 值 |
|---|---|
| `VITE_API_BASE_URL` | `https://finask-backend-production.up.railway.app`（填你的 Railway 地址） |

### 2.4 部署

点击 **Deploy**，等待约 1 分钟，完成后获得地址：
```
https://finask.vercel.app
```

---

## 第三步：回到 Railway 更新 CORS

前端部署后，回到 Railway → Variables，将 `CORS_ORIGINS` 改为：
```
https://finask.vercel.app
```
（支持多个时用逗号分隔：`https://finask.vercel.app,https://finask-xxx.vercel.app`）

然后 Railway 会自动重新部署。

---

## 验证部署

```bash
# 1. 后端健康检查
curl https://finask-backend-production.up.railway.app/health

# 2. 测试问答接口
curl -X POST https://finask-backend-production.up.railway.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "什么是基金净值"}'

# 3. 测试拦截
curl -X POST https://finask-backend-production.up.railway.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "茅台股票能买吗"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('blocked:', d['answer']['is_blocked'])"
```

---

## 访问地址汇总（部署完成后填写）

| 页面 | 公网地址 |
|---|---|
| 主问答界面 | https://finask.vercel.app/chat |
| 运营统计 | https://finask.vercel.app/stats |
| 知识库管理 | https://finask.vercel.app/admin/knowledge |
| 后端 API 文档 | https://finask-backend-production.up.railway.app/docs |

---

## 常见问题

**Q：Railway 免费额度够吗？**
A：Railway Hobby Plan 每月 $5 免费额度，Demo 展示完全够用。

**Q：前端访问后端报跨域错误？**
A：检查 Railway 环境变量 `CORS_ORIGINS` 是否包含你的 Vercel 域名。

**Q：Railway 冷启动慢（第一次请求 30 秒）？**
A：免费版会休眠，升级 $5/月 可关闭休眠；或提交演示时先访问一次 `/health` 唤醒。

**Q：analytics.db 会不会丢失？**
A：Railway 的文件系统是临时的，重新部署后 SQLite 数据会清空。对于 Demo 演示可以接受；生产环境需挂载 Volume 或换用云数据库。

**Q：知识库 knowledge_base.json 会不会重置？**
A：同上，通过 API 修改的知识库在重部署后会回到初始状态。建议演示前不要重部署。
