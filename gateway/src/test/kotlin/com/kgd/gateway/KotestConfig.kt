package com.kgd.gateway

import io.kotest.core.config.AbstractProjectConfig
import io.kotest.extensions.spring.SpringExtension

object KotestConfig : AbstractProjectConfig() {
    override fun extensions() = listOf(SpringExtension)
}
