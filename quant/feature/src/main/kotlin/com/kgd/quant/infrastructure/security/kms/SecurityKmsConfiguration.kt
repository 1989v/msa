package com.kgd.quant.infrastructure.security.kms

import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Configuration

/**
 * TG-P2-03 — KMS 어댑터 설정 활성화.
 *
 * [LocalKmsProperties], [OciKmsProperties] 를 ConfigurationProperties bean 으로 등록한다.
 * 어댑터 자체의 활성화는 `@Profile` + `@ConditionalOnProperty` 조합으로 정확히 1개만 등록되도록 보장.
 */
@Configuration
@EnableConfigurationProperties(LocalKmsProperties::class, OciKmsProperties::class)
class SecurityKmsConfiguration
