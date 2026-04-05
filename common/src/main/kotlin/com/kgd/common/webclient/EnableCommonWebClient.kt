package com.kgd.common.webclient

import org.springframework.context.annotation.Import

/**
 * common 모듈의 WebClient 설정(WebClientConfig, WebClientBuilderFactory)을 활성화한다.
 *
 * 사용법:
 * ```
 * @SpringBootApplication
 * @EnableCommonWebClient
 * class MyApplication
 * ```
 */
@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
@Import(WebClientConfig::class, WebClientBuilderFactory::class)
annotation class EnableCommonWebClient
