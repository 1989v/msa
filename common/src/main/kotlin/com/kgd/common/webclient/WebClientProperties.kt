package com.kgd.common.webclient

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

@ConfigurationProperties(prefix = "webclient")
data class WebClientProperties(
    val connectTimeout: Duration = Duration.ofSeconds(3),
    val readTimeout: Duration = Duration.ofSeconds(5),
    val writeTimeout: Duration = Duration.ofSeconds(5)
)
