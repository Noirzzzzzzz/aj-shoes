import os

LOG_DIR = os.getenv("LOG_DIR") or "logs"
os.makedirs(LOG_DIR, exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "[%(asctime)s] %(levelname)s %(name)s: %(message)s"
        },
        "concise": {"format": "%(levelname)s %(message)s"}
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "concise"},
        "file": {
            "class": "logging.FileHandler",
            "filename": os.path.join(LOG_DIR, "app.log"),
            "formatter": "default",
            "encoding": "utf-8",
        },
    },
    "loggers": {
        "django": {"handlers": ["console","file"], "level": "INFO"},
        "frontend": {"handlers": ["file","console"], "level": "INFO", "propagate": False},
    },
}
