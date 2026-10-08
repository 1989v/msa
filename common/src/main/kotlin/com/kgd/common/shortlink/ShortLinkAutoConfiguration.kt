package com.kgd.common.shortlink

import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean

/** 단축 주소를 해석·노출하는 호스트(atlas·content·search)가 같은 `kgd.common.short-link.*` 를 읽는다. */
@AutoConfiguration
@EnableConfigurationProperties(ShortLinkProperties::class)
class ShortLinkAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    fun shortLinks(properties: ShortLinkProperties) = ShortLinks(properties)
}
