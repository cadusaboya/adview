import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

from .settings import *  # noqa

DEBUG = False

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "test_db.sqlite3",
    }
}

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {
    **REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {}),
    "payment": "1000/hour",
}

ASAAS_API_KEY = "test_asaas_key"
ASAAS_BASE_URL = "https://sandbox.asaas.com/api/v3"
ASAAS_WEBHOOK_TOKEN = "abc123"
