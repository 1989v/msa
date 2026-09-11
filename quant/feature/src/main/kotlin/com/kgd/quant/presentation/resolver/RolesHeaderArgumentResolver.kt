package com.kgd.quant.presentation.resolver

import org.springframework.core.MethodParameter
import org.springframework.web.bind.support.WebDataBinderFactory
import org.springframework.web.context.request.NativeWebRequest
import org.springframework.web.method.support.HandlerMethodArgumentResolver
import org.springframework.web.method.support.ModelAndViewContainer

/**
 * RolesHeaderArgumentResolver — `@RolesHeader` 파라미터를 `X-User-Roles` 헤더에서 꺼내
 * `Set<String>` 으로 매핑.
 *
 * gateway `AuthenticationGatewayFilter` 가 JWT roles 를 콤마 구분으로 주입한다.
 *
 * Type 비교 없이 어노테이션만 본다 (TenantIdHeaderArgumentResolver 와 동일 패턴 — value class
 * generic 영향 회피).
 */
class RolesHeaderArgumentResolver : HandlerMethodArgumentResolver {

    override fun supportsParameter(parameter: MethodParameter): Boolean =
        parameter.hasParameterAnnotation(RolesHeader::class.java)

    override fun resolveArgument(
        parameter: MethodParameter,
        mavContainer: ModelAndViewContainer?,
        webRequest: NativeWebRequest,
        binderFactory: WebDataBinderFactory?,
    ): Any {
        val raw = webRequest.getHeader(HEADER_NAME)
        return raw?.split(',')
            ?.map { it.trim() }
            ?.filter { it.isNotEmpty() }
            ?.toSet()
            ?: emptySet<String>()
    }

    companion object {
        const val HEADER_NAME: String = "X-User-Roles"
    }
}
