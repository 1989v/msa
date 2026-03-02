package com.kgd.common.security

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "jwt")
data class JwtProperties(
    val secret: String,
    val accessExpiry: Long = 1800L,   // 30분 (초)
    val refreshExpiry: Long = 604800L  // 7일 (초)
)
