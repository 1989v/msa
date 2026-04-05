package com.kgd.common.redis

import org.springframework.context.annotation.Import

/**
 * common 모듈의 Redis 클러스터 설정을 활성화한다.
 *
 * 사용법:
 * ```
 * @SpringBootApplication
 * @EnableCommonRedis
 * class MyApplication
 * ```
 *
 * 필요 설정:
 * - spring.data.redis.cluster.nodes
 */
@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
@Import(RedisConfig::class)
annotation class EnableCommonRedis
