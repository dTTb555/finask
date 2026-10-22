"""
全局配置 — 从 .env 读取
"""
from pydantic_settings import BaseSettings
from typing import List, Union
import json


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
    # 支持字符串（逗号分隔）或 JSON 数组，均可
    # 例：CORS_ORIGINS=* 或 CORS_ORIGINS=https://finask.netlify.app
    CORS_ORIGINS: str = "*"

    # 检索
    SEARCH_TOP_K: int = 3
    SEARCH_MIN_SCORE: float = 0.15

    # 合规
    RISK_USE_LLM: bool = False          # 是否启用 LLM 辅助风险检测

    @property
    def cors_origins_list(self) -> List[str]:
        """将 CORS_ORIGINS 字符串解析为列表"""
        v = self.CORS_ORIGINS.strip()
        if v == "*":
            return ["*"]
        if v.startswith("["):
            try:
                return json.loads(v)
            except Exception:
                pass
        return [s.strip() for s in v.split(",") if s.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
