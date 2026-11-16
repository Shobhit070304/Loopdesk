import os
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("DB_URL")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
AUTH_SECRET = os.getenv("AUTH_SECRET", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GOOGLE_CLIENT_ID = os.getenv("AUTH_GOOGLE_ID")
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-3.8-flash")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
IS_PRODUCTION = ENVIRONMENT == "production"
WEBHOOK_RATE_LIMIT_PER_MINUTE = int(os.getenv("WEBHOOK_RATE_LIMIT_PER_MINUTE", "50"))
