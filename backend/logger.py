import os
import logging

from logging.handlers import TimedRotatingFileHandler


class SimpleAppLogger:
    def __init__(self, dir, name: str, level):
        """
        Simple logger that logs into `{dir}/{name}.log.yyyy-mm-dd`. \\
        Logging file changes every day at midnight.
        """
        assert level in (
            "CRITICAL",
            "ERROR",
            "WARNING",
            "INFO",
            "DEBUG",
            "NOTSET",
            logging.CRITICAL,
            logging.ERROR,
            logging.WARNING,
            logging.INFO,
            logging.DEBUG,
            logging.NOTSET,
        ), "Logging level is not correct."
        # self.dir = dir
        self.name = name
        self.level = level
        dir = os.path.abspath(dir)
        os.makedirs(dir, exist_ok=True)
        self.file_path = os.path.join(dir, f"{name}.log")

    def get_logger(self):
        """
        Setup logging for the application.
        """
        handler = TimedRotatingFileHandler(
            self.file_path, when="midnight", interval=1, backupCount=10
        )
        handler.suffix = "%Y-%m-%d"
        handler.extMatch = r"^\d{4}-\d{2}-\d{2}$"
        formatter = logging.Formatter(
            "%(asctime)s - (%(name)s - %(filename)s:%(funcName)s) - [%(levelname)s] - %(message)s"
        )
        handler.setFormatter(formatter)
        logger = logging.getLogger()
        logger.setLevel(self.level)
        logger.addHandler(handler)
        return logger


if __name__ == "__main__":
    logger = SimpleAppLogger("logs", "simple_logger", logging.DEBUG).get_logger()
    logger.info("Information message")
    logger.critical("Critical test.")
