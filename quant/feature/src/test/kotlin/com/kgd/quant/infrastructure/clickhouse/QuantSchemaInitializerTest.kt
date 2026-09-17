package com.kgd.quant.infrastructure.clickhouse

import io.kotest.assertions.throwables.shouldNotThrowAny
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.every
import io.mockk.mockk
import org.springframework.jdbc.core.JdbcTemplate
import java.sql.SQLException
import javax.sql.DataSource

class QuantSchemaInitializerTest : BehaviorSpec({
    given("ClickHouse 에 연결할 수 없는 상태") {
        val dataSource = mockk<DataSource>()
        every { dataSource.connection } throws SQLException("Connection refused")
        val jdbc = JdbcTemplate(dataSource)

        `when`("기동 이벤트로 apply() 가 불리면") {
            then("예외를 밖으로 내지 않는다 — 같은 JVM 의 chatbot·gifticon 이 함께 죽으면 안 된다") {
                shouldNotThrowAny { QuantSchemaInitializer(jdbc).apply() }
            }
        }
    }
})
