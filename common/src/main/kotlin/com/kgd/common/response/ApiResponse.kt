package com.kgd.common.response

import com.kgd.common.exception.ErrorCode

data class ApiResponse<T>(
    val success: Boolean,
    val data: T? = null,
    val error: ErrorDetail? = null
) {
    data class ErrorDetail(
        val code: String,
        val message: String
    )

    companion object {
        fun <T> success(data: T): ApiResponse<T> =
            ApiResponse(success = true, data = data)

        fun <T> success(): ApiResponse<T> =
            ApiResponse(success = true)

        fun <T> error(errorCode: ErrorCode): ApiResponse<T> =
            ApiResponse(
                success = false,
                error = ErrorDetail(
                    code = errorCode.name,
                    message = errorCode.message
                )
            )

        fun <T> error(code: String, message: String): ApiResponse<T> =
            ApiResponse(
                success = false,
                error = ErrorDetail(code = code, message = message)
            )
    }
}
