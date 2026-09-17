package com.kgd.quant.infrastructure.clickhouse

import io.kotest.assertions.throwables.shouldNotThrowAny
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.sql.SQLException

class QuantSchemaInitializerTest : BehaviorSpec({
    given("ClickHouse 에 연결할 수 없는 상태") {
        `when`("기동 이벤트로 apply() 가 불리면") {
            then("예외를 밖으로 내지 않는다 — 같은 JVM 의 chatbot·gifticon 이 함께 죽으면 안 된다") {
                val initializer = QuantSchemaInitializer { throw SQLException("Connection refused") }
                shouldNotThrowAny { initializer.apply() }
            }
        }
    }

    // quant DB 가 없을 때 /quant 세션으로는 접속 자체가 거부된다 — 부트스트랩은 system 으로 들어간다
    given("풀 URL") {
        `when`("bootstrapUrl 로 바꾸면") {
            then("세션 DB 만 system 으로 바뀌고 호스트·포트·쿼리는 그대로다") {
                QuantSchemaInitializer.bootstrapUrl("jdbc:clickhouse://clickhouse:8123/quant") shouldBe
                    "jdbc:clickhouse://clickhouse:8123/system"
                QuantSchemaInitializer.bootstrapUrl("jdbc:clickhouse://localhost:8123/quant?compress=0") shouldBe
                    "jdbc:clickhouse://localhost:8123/system?compress=0"
                QuantSchemaInitializer.bootstrapUrl("jdbc:clickhouse://localhost:8123") shouldBe
                    "jdbc:clickhouse://localhost:8123/system"
            }
        }
    }
})
