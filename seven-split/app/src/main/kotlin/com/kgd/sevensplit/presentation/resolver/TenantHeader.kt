package com.kgd.sevensplit.presentation.resolver

/**
 * TenantHeader — 컨트롤러 메서드 파라미터에 붙여 `X-User-Id` 헤더를 `TenantId` 로 주입한다.
 *
 * ## 전제
 * - Gateway 에서 JWT 검증 후 `X-User-Id` 를 신뢰할 수 있는 값으로 세팅한다.
 * - 본 서비스는 헤더만 신뢰한다 (JWT 파싱을 중복하지 않음).
 *
 * ## 실패
 * - 헤더 누락 → `MissingRequestHeaderException` → 400 BAD_REQUEST 로 매핑.
 *
 * 자세한 주입 로직은 [TenantIdHeaderArgumentResolver] 참조.
 */
@Target(AnnotationTarget.VALUE_PARAMETER)
@Retention(AnnotationRetention.RUNTIME)
annotation class TenantHeader
