"""
全局配置 — 从 .env 读取
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # LLM
    LLM_PROVIDER: str = "mock"          # mock | openai | qwen
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-3.5-turbo"
    QWEN_API_KEY: str = ""
    QWEN_MODEL: str = "qwen-turbo"

    # 服务
    PORT: int = 8000
    # 生产时在环境变量里设置 CORS_ORIGINS，多个用逗号分隔
    # 例：CORS_ORIGINS=https://finask.vercel.app,https://your-domain.com
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000", "*"]

    # 检索
    SEARCH_TOP_K: int = 3
    SEARCH_MIN_SCORE: float = 0.15

    # 合规
    RISK_USE_LLM: bool = False          # 是否启用 LLM 辅助风险检测

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
