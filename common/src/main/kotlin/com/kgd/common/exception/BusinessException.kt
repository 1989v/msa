package com.kgd.common.exception

open class BusinessException(
    val errorCode: ErrorCode,
    message: String = errorCode.message,
    cause: Throwable? = null
) : RuntimeException(message, cause)

class NotFoundException(resource: String, id: Any? = null) : BusinessException(
    errorCode = ErrorCode.NOT_FOUND,
    message = if (id != null) "$resource (id=$id)을(를) 찾을 수 없습니다" else "${resource}을(를) 찾을 수 없습니다"
)

class UnauthorizedException(
    message: String = ErrorCode.UNAUTHORIZED.message
) : BusinessException(errorCode = ErrorCode.UNAUTHORIZED, message = message)

class ForbiddenException(
    message: String = ErrorCode.FORBIDDEN.message
) : BusinessException(errorCode = ErrorCode.FORBIDDEN, message = message)

class DuplicateResourceException(resource: String) : BusinessException(
    errorCode = ErrorCode.DUPLICATE_RESOURCE,
    message = "$resource 이(가) 이미 존재합니다"
)
