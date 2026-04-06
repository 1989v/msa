package com.kgd.gateway

import com.kgd.common.feature.CommonFeature
import com.kgd.common.feature.EnableCommonFeatures
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
@EnableCommonFeatures(CommonFeature.SECURITY)
class GatewayApplication

fun main(args: Array<String>) {
    runApplication<GatewayApplication>(*args)
}
