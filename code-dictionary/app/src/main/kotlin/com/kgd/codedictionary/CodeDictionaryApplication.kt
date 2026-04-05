package com.kgd.codedictionary

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication(scanBasePackages = ["com.kgd.codedictionary", "com.kgd.common"])
class CodeDictionaryApplication

fun main(args: Array<String>) {
    runApplication<CodeDictionaryApplication>(*args)
}
