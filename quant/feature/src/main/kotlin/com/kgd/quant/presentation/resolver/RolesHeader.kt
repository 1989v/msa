package com.kgd.quant.presentation.resolver

/**
 * RolesHeader — `X-User-Roles` 헤더(gateway AuthenticationGatewayFilter 가 JWT roles claim 을
 * 콤마 구분으로 주입) 를 `Set<String>` 으로 매핑한다.
 *
 * - 헤더 미존재 시 빈 집합 반환 (anonymous 흐름 — 보호된 endpoint 는 컨트롤러에서 직접 거부).
 * - 운영에서는 gateway 가 JWT 미통과 요청을 401 로 차단하므로 본 헤더는 신뢰 가능.
 */
@Target(AnnotationTarget.VALUE_PARAMETER)
@Retention(AnnotationRetention.RUNTIME)
annotation class RolesHeader
