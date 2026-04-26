package com.kgd.sevensplit.presentation.resolver

import com.kgd.sevensplit.domain.common.TenantId
import org.springframework.core.MethodParameter
import org.springframework.web.bind.MissingRequestHeaderException
import org.springframework.web.bind.support.WebDataBinderFactory
import org.springframework.web.context.request.NativeWebRequest
import org.springframework.web.method.support.HandlerMethodArgumentResolver
import org.springframework.web.method.support.ModelAndViewContainer

/**
 * TenantIdHeaderArgumentResolver — `@TenantHeader` 파라미터를 `X-User-Id` 헤더에서 꺼내
 * [TenantId] 로 매핑한다.
 *
 * ## 동작
 *  - 헤더 존재 + non-blank → `TenantId(value)` 반환.
 *  - 헤더 누락 or blank → `MissingRequestHeaderException` 을 던져 400 으로 응답.
 *
 * ## 등록
 * [com.kgd.sevensplit.presentation.config.WebMvcConfig] 에서 `addArgumentResolvers` 로 등록.
 */
class TenantIdHeaderArgumentResolver : HandlerMethodArgumentResolver {

    override fun supportsParameter(parameter: MethodParameter): Boolean =
        parameter.hasParameterAnnotation(TenantHeader::class.java) &&
            parameter.parameterType == TenantId::class.java

    override fun resolveArgument(
        parameter: MethodParameter,
        mavContainer: ModelAndViewContainer?,
        webRequest: NativeWebRequest,
        binderFactory: WebDataBinderFactory?
    ): Any {
        val headerValue = webRequest.getHeader(HEADER_NAME)
        if (headerValue.isNullOrBlank()) {
            throw MissingRequestHeaderException(HEADER_NAME, parameter)
        }
        return TenantId(headerValue)
    }

    companion object {
        const val HEADER_NAME: String = "X-User-Id"
    }
}
