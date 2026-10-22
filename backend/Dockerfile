FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 预下载 jieba 缓存（加快冷启动）
RUN python3 -c "import jieba; jieba.lcut('初始化')" 2>/dev/null || true

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
