import logging
import datetime
import json
import contextvars
from pythonjsonlogger import jsonlogger

# Context variable to hold the request ID for the duration of the request
request_id_ctx_var = contextvars.ContextVar("request_id", default=None)

class RequestIdFilter(logging.Filter):
    """
    A filter that injects the current request ID from contextvars into the log record.
    """
    def filter(self, record):
        record.request_id = request_id_ctx_var.get()
        return True

class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """
    JSON formatter for production logging.
    Every log line is a JSON object with: timestamp, level, module, message, request_id (if in request context).
    """
    def add_fields(self, log_record, record, message_dict):
        # We construct the JSON object with precise fields
        dt = datetime.datetime.fromtimestamp(record.created, datetime.timezone.utc)
        log_record["timestamp"] = dt.isoformat().replace("+00:00", "Z")
        log_record["level"] = record.levelname
        log_record["module"] = record.name
        log_record["message"] = record.getMessage()
        
        request_id = getattr(record, "request_id", None)
        if request_id:
            log_record["request_id"] = request_id
            
        if record.exc_info:
            log_record["exc_info"] = self.formatException(record.exc_info)
            
        # Clean up any extraneous keys automatically populated by pythonjsonlogger
        for key in list(log_record.keys()):
            if key not in ["timestamp", "level", "module", "message", "request_id", "exc_info"]:
                log_record.pop(key, None)

class CustomTextFormatter(logging.Formatter):
    """
    Text formatter for development logging.
    Formats logs as: timestamp | level | module | message [request_id: UUID]
    """
    def format(self, record):
        dt = datetime.datetime.fromtimestamp(record.created, datetime.timezone.utc)
        timestamp = dt.isoformat().replace("+00:00", "Z")
        request_id = getattr(record, "request_id", None)
        req_part = f" [request_id={request_id}]" if request_id else ""
        
        msg = f"{timestamp} | {record.levelname} | {record.name} | {record.getMessage()}{req_part}"
        if record.exc_info:
            msg += "\n" + self.formatException(record.exc_info)
        return msg

def setup_logging(environment: str = "development", log_level: str = "INFO"):
    """
    Configures the root logger and redirects standard framework loggers (e.g. uvicorn)
    to flow through the centralized formatting system.
    """
    root_logger = logging.getLogger()
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    root_logger.setLevel(numeric_level)
    
    # Remove existing root logger handlers
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)
        
    console_handler = logging.StreamHandler()
    console_handler.setLevel(numeric_level)
    console_handler.addFilter(RequestIdFilter())
    
    if environment.lower() == "production":
        formatter = CustomJsonFormatter()
    else:
        formatter = CustomTextFormatter()
        
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # Propagate framework/server logs through root logger to maintain formatting consistency
    for uvicorn_logger_name in ["uvicorn", "uvicorn.access", "uvicorn.error"]:
        u_logger = logging.getLogger(uvicorn_logger_name)
        u_logger.handlers = []
        u_logger.propagate = True
