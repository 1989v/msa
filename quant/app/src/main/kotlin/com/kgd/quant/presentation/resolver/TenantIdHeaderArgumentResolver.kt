package com.kgd.quant.presentation.resolver

import com.kgd.quant.domain.common.TenantId
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
 * [com.kgd.quant.presentation.config.WebMvcConfig] 에서 `addArgumentResolvers` 로 등록.
 */
class TenantIdHeaderArgumentResolver : HandlerMethodArgumentResolver {

    override fun supportsParameter(parameter: MethodParameter): Boolean =
        // TenantId 는 @JvmInline value class 라 컴파일 후 parameterType 이 String 으로 보일 수 있다.
        // type 체크를 생략하고 어노테이션 존재만 본다.
        parameter.hasParameterAnnotation(TenantHeader::class.java)

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
        // value class 라 JVM signature 가 String. resolver 는 raw String 을 반환하면
        // Spring 이 method invoke 시 Kotlin compiler-generated wrapping 으로 TenantId 가 됨.
        return headerValue
    }

    companion object {
        const val HEADER_NAME: String = "X-User-Id"
    }
}
