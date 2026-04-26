package com.kgd.sevensplit.infrastructure.clickhouse

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Configuration

/**
 * TG-06.5: seven-split 전용 ClickHouse 접속 설정.
 *
 * analytics DB 를 직접 참조하지 않고 별도 DB `seven_split` 을 사용한다 (ADR-0024 §12).
 * application.yml 의 `seven-split.clickhouse.*` 프로퍼티와 바인딩된다.
 */
@Configuration
@ConfigurationProperties(prefix = "seven-split.clickhouse")
class ClickHouseConfig {
    /** JDBC URL. 예: jdbc:clickhouse://localhost:8123/seven_split */
    lateinit var url: String
    lateinit var username: String
    lateinit var password: String

    /** DB 이름은 seven_split 로 고정. 다른 DB 로 덮어쓰면 ADR-0024 §12 위반. */
    var database: String = "seven_split"
}
