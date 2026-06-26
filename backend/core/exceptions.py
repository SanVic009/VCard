from fastapi import Request, status, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging

logger = logging.getLogger(__name__)

class AuthenticationError(Exception):
    def __init__(self, message: str):
        self.message = message

class AuthorizationError(Exception):
    def __init__(self, message: str):
        self.message = message

async def authentication_error_handler(request: Request, exc: AuthenticationError):
    logger.warning(f"AuthenticationError: {exc.message}")
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"error": {"code": "unauthorized", "message": exc.message}},
    )

async def authorization_error_handler(request: Request, exc: AuthorizationError):
    logger.warning(f"AuthorizationError: {exc.message}")
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={"error": {"code": "forbidden", "message": exc.message}},
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    if errors:
        first = errors[0]
        field = ".".join(str(x) for x in first.get("loc", []))
        msg = f"Validation failed: {first.get('msg')} on field '{field}'"
    else:
        msg = "Validation failed"
    logger.warning(f"RequestValidationError: {msg}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": {"code": "validation_error", "message": msg}},
    )

async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(f"HTTPException {exc.status_code}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": f"http_{exc.status_code}", "message": exc.detail}},
    )

async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": {"code": "internal_error", "message": "An internal server error occurred."}},
    )
