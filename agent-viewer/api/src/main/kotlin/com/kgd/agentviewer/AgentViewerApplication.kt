package com.kgd.agentviewer

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@EnableScheduling
class AgentViewerApplication

fun main(args: Array<String>) {
    runApplication<AgentViewerApplication>(*args)
}
