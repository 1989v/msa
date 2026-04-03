package com.kgd.gateway

import com.kgd.common.security.JwtProperties
import com.kgd.common.security.JwtUtil
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication
import org.springframework.context.annotation.Import

@SpringBootApplication
@EnableConfigurationProperties(JwtProperties::class)
@Import(JwtUtil::class)
class GatewayApplication

fun main(args: Array<String>) {
    runApplication<GatewayApplication>(*args)
}
