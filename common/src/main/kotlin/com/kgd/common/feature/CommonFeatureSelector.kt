package com.kgd.common.feature

import com.kgd.common.redis.RedisConfig
import com.kgd.common.security.SecurityConfiguration
import com.kgd.common.webclient.WebClientConfig
import com.kgd.common.webclient.WebClientBuilderFactory
import org.springframework.context.annotation.ImportSelector
import org.springframework.core.annotation.AnnotationAttributes
import org.springframework.core.type.AnnotationMetadata

/**
 * @EnableCommonFeatures 에 지정된 features 배열을 읽어
 * 해당 Configuration 클래스들만 Import하는 선택자.
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
