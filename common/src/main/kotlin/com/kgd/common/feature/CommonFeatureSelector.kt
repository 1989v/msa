package com.kgd.common.feature

import com.kgd.common.redis.RedisConfig
import com.kgd.common.security.SecurityConfiguration
import com.kgd.common.webclient.WebClientConfig
import com.kgd.common.webclient.WebClientBuilderFactory
import org.springframework.context.annotation.ImportSelector
import org.springframework.core.annotation.AnnotationAttributes
import org.springframework.core.type.AnnotationMetadata

/**
 * [EnableCommonFeatures] 어노테이션에 지정된 [CommonFeature] 배열을 읽어
 * 해당하는 Configuration/Component 클래스들만 Spring 컨텍스트에 Import하는 선택자.
 *
 * 직접 사용하지 않음 — [EnableCommonFeatures]의 `@Import`를 통해 자동 호출된다.
 *
 * 매핑 규칙:
 * - [CommonFeature.SECURITY] -> [SecurityConfiguration] (JwtUtil, AesUtil, JwtProperties)
 * - [CommonFeature.REDIS] -> [RedisConfig] (LettuceConnectionFactory, RedisTemplate)
 * - [CommonFeature.WEB_CLIENT] -> [WebClientConfig], [WebClientBuilderFactory]
 *
 * @see EnableCommonFeatures
 * @see CommonFeature
 */
class CommonFeatureSelector : ImportSelector {

    override fun selectImports(metadata: AnnotationMetadata): Array<String> {
        val attributes = AnnotationAttributes.fromMap(
            metadata.getAnnotationAttributes(EnableCommonFeatures::class.java.name)
        ) ?: return emptyArray()

        val features = attributes.getStringArray("value")
            .map { CommonFeature.valueOf(it) }
            .toSet()

        return features.flatMap { feature ->
            when (feature) {
                CommonFeature.SECURITY -> listOf(SecurityConfiguration::class.java.name)
                CommonFeature.REDIS -> listOf(RedisConfig::class.java.name)
                CommonFeature.WEB_CLIENT -> listOf(
                    WebClientConfig::class.java.name,
                    WebClientBuilderFactory::class.java.name
                )
            }
        }.toTypedArray()
    }
}
