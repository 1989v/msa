package com.kgd.common.feature

import org.springframework.context.annotation.Import

/**
 * common 모듈의 선택적 기능을 활성화한다.
 * 필요한 기능만 [CommonFeature] enum으로 명시하면 해당 Configuration만 로드된다.
 *
 * exception/response는 항상 로드 (scanBasePackages에 포함).
 *
 * 사용 예시:
 * ```kotlin
 * // Security + WebClient 사용
 * @SpringBootApplication
 * @EnableCommonFeatures([CommonFeature.SECURITY, CommonFeature.WEB_CLIENT])
 * class GifticonApplication
 *
 * // 아무 기능도 불필요 (exception/response만)
 * @SpringBootApplication
 * class CodeDictionaryApplication
 *
 * // 전부 사용
 * @SpringBootApplication
 * @EnableCommonFeatures([CommonFeature.SECURITY, CommonFeature.REDIS, CommonFeature.WEB_CLIENT])
 * class FullFeaturedApplication
 * ```
 *
 * @see CommonFeature 각 기능별 필요 설정 참고
 */
@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
@Import(CommonFeatureSelector::class)
annotation class EnableCommonFeatures(
    vararg val value: CommonFeature
)
