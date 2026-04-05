package com.kgd.common.security

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/**
 * common 모듈의 보안 기능(JWT, AES)을 활성화하는 Configuration.
 * @EnableCommonSecurity 어노테이션의 @Import로 등록된다.
 */
@Configuration
class SecurityConfiguration {

    @Bean
    fun jwtUtil(props: JwtProperties): JwtUtil = JwtUtil(props)

    @Bean
    fun aesUtil(@org.springframework.beans.factory.annotation.Value("\${encryption.aes-key}") aesKey: String): AesUtil = AesUtil(aesKey)
}
