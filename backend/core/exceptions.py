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
    logger.warning(f"RequestValidationError: Invalid request details: {errors}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request.",
                "details": errors
            }
        },
    )

async def http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code >= 500:
        logger.error(f"HTTPException {exc.status_code}: {exc.detail}")
    else:
        logger.warning(f"HTTPException {exc.status_code}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": f"http_{exc.status_code}", "message": exc.detail}},
    )

async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred."
            }
        },
    )

