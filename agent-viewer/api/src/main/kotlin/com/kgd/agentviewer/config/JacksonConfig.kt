package com.kgd.agentviewer.config

import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.cfg.DateTimeFeature
import tools.jackson.module.kotlin.jacksonMapperBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class JacksonConfig {

    /**
     * Jackson 3 는 매퍼가 불변이라 생성 후 설정할 수 없다 — 빌더로 완성해서 넘긴다 (ADR-0067).
     * java.time 지원은 databind 에 내장되어 JavaTimeModule 을 따로 등록하지 않는다.
     * 날짜 타임스탬프 설정도 SerializationFeature 에서 DateTimeFeature 로 옮겨졌다.
     */
    @Bean
    fun objectMapper(): ObjectMapper = jacksonMapperBuilder()
        .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
        .build()
}
