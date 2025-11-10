import os
import re
import logging
from logging.handlers import TimedRotatingFileHandler

def _normalize_level(level):
    """
    Accept 'INFO'/'info' or an int like logging.INFO (20).
    Returns the numeric level or raises ValueError.
    """
    if isinstance(level, str):
        name = level.upper()
        if name in logging._nameToLevel:  # official mapping in stdlib
            return logging._nameToLevel[name]
        raise ValueError(f"Invalid logging level name: {level!r}")
    if isinstance(level, int):
        # Ensure it's one of the known numeric levels
        if level in logging._levelToName:
            return level
        raise ValueError(f"Invalid logging level number: {level}")
    raise TypeError(f"Level must be str or int, got {type(level).__name__}")

class SimpleAppLogger:
    def __init__(self, dir: str, name: str, level):
        """
        Logs to {dir}/{name}.{pid}.log rotated nightly; keeps 10 backups.
        Per-process files avoid Windows rename/lock conflicts.
        """
        self.name = name
        self.level = _normalize_level(level)  # <-- strict validation here
        dir = os.path.abspath(dir)
        os.makedirs(dir, exist_ok=True)

        pid = os.getpid()
        self.file_path = os.path.join(dir, f"{name}.{pid}.log")

    def get_logger(self) -> logging.Logger:
        logger = logging.getLogger(self.name)   # don't touch root
        logger.setLevel(self.level)
        logger.propagate = False

        # Avoid duplicate handlers if called multiple times
        abs_path = os.path.abspath(self.file_path)
        for h in logger.handlers:
            if isinstance(h, TimedRotatingFileHandler) and getattr(h, "baseFilename", "") == abs_path:
                return logger

        handler = TimedRotatingFileHandler(
            self.file_path, when="midnight", interval=1, backupCount=10,
            encoding="utf-8", delay=True
        )
        handler.suffix = "%Y-%m-%d"
        handler.extMatch = re.compile(r"^\d{4}-\d{2}-\d{2}$")

        fmt = "%(asctime)s - (%(name)s - %(filename)s:%(funcName)s) - [%(levelname)s] - %(message)s"
        handler.setFormatter(logging.Formatter(fmt))
        logger.addHandler(handler)
        return logger
