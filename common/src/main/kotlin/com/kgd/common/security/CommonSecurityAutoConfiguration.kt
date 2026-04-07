package com.kgd.common.security

import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean

@AutoConfiguration
@ConditionalOnProperty(prefix = "kgd.common.security", name = ["enabled"], havingValue = "true", matchIfMissing = false)
@EnableConfigurationProperties(JwtProperties::class)
class CommonSecurityAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    fun jwtUtil(props: JwtProperties): JwtUtil = JwtUtil(props)

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "kgd.common.security", name = ["aes-enabled"], havingValue = "true", matchIfMissing = true)
    fun aesUtil(
        @org.springframework.beans.factory.annotation.Value("\${encryption.aes-key}") aesKey: String
    ): AesUtil = AesUtil(aesKey)
}
