package com.kgd.quant.infrastructure.clickhouse

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Configuration

/**
 * TG-06.5: quant 전용 ClickHouse 접속 설정.
 *
 * analytics DB 를 직접 참조하지 않고 별도 DB `quant` 을 사용한다 (ADR-0024 §12).
 * application.yml 의 `quant.clickhouse.*` 프로퍼티와 바인딩된다.
 */
@Configuration
@ConfigurationProperties(prefix = "quant.clickhouse")
class ClickHouseConfig {
    /** JDBC URL. 예: jdbc:clickhouse://localhost:8123/quant */
    lateinit var url: String
    lateinit var username: String
    lateinit var password: String

    /** DB 이름은 quant 로 고정. 다른 DB 로 덮어쓰면 ADR-0024 §12 위반. */
    var database: String = "quant"
}
