package com.kgd.agentviewer

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class AgentViewerApplication

fun main(args: Array<String>) {
    runApplication<AgentViewerApplication>(*args)
}
