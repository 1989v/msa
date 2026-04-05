package com.kgd.common.security

import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Import

/**
 * common 모듈의 보안 기능(JwtUtil, AesUtil, JwtProperties)을 활성화한다.
 *
 * 사용법:
 * ```
 * @SpringBootApplication
 * @EnableCommonSecurity
 * class MyApplication
 * ```
 *
 * 필요 설정:
 * - jwt.secret, jwt.access-expiry, jwt.refresh-expiry
 * - encryption.aes-key
 */
@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
@Import(SecurityConfiguration::class)
@EnableConfigurationProperties(JwtProperties::class)
annotation class EnableCommonSecurity
