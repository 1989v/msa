package com.kgd.common.feature

/**
 * common 모듈에서 제공하는 선택적 기능 목록.
 * 각 서비스의 Application 클래스에서 필요한 기능만 명시적으로 활성화한다.
 *
 * ```kotlin
 * @SpringBootApplication
 * @EnableCommonFeatures([CommonFeature.SECURITY, CommonFeature.WEB_CLIENT])
 * class MyApplication
 * ```
 */
enum class CommonFeature {

    /**
     * JWT 토큰 생성/검증 (JwtUtil, JwtProperties) + AES 암복호화 (AesUtil).
     *
     * 필요 설정:
     * - `jwt.secret` — HMAC 서명 키 (최소 32바이트)
     * - `jwt.access-expiry` — access 토큰 만료 시간 (초, 기본 1800)
     * - `jwt.refresh-expiry` — refresh 토큰 만료 시간 (초, 기본 604800)
     * - `encryption.aes-key` — AES-256 암호화 키 (최소 32바이트)
     */
    SECURITY,

    /**
     * Redis 클러스터 설정 (LettuceConnectionFactory, RedisTemplate).
     *
     * 필요 설정:
     * - `spring.data.redis.cluster.nodes` — Redis 클러스터 노드 목록
     * - `spring.data.redis.password` — Redis 비밀번호 (선택)
     */
    REDIS,

    /**
     * WebClient 빌더 팩토리 (WebClientConfig, WebClientBuilderFactory).
     * 외부 API 호출이 필요한 서비스에서 사용.
     *
     * 별도 설정 불필요 — 기본 2MB 버퍼 제한의 WebClient.Builder 빈 제공.
     */
    WEB_CLIENT
}
