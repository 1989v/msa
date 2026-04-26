package com.kgd.sevensplit.infrastructure.clickhouse

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainAll
import org.testcontainers.DockerClientFactory
import org.testcontainers.clickhouse.ClickHouseContainer
import org.testcontainers.utility.DockerImageName
import java.sql.DriverManager

/**
 * TG-06.6: ClickHouse Testcontainers 로 seven_split 스키마 create 검증.
 *
 * Docker daemon 이 필요하다 (로컬 docker / colima / Docker Desktop 등).
 * CI/nightly 에서는 필수, 로컬 docker 미연결 환경에서는 spec 자체를 건너뛴다.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

class ClickHouseSchemaSmokeSpec : BehaviorSpec({
    val image = DockerImageName.parse("clickhouse/clickhouse-server:24.3")
        .asCompatibleSubstituteFor("clickhouse/clickhouse-server")
    val container: ClickHouseContainer? = if (dockerAvailable) ClickHouseContainer(image) else null

    beforeSpec { container?.start() }
    afterSpec { container?.stop() }

    Given("ClickHouse Testcontainer 가 실행됨") {
        When("SchemaBootstrapper.applyTo(conn) 호출") {
            Then("seven_split DB 와 3개 테이블이 생성된다")
                .config(enabledIf = { dockerAvailable }) {
                    val c = container!!
                    DriverManager.getConnection(c.jdbcUrl, c.username, c.password).use { conn ->
                        SchemaBootstrapper().applyTo(conn)

                        val tables = mutableListOf<String>()
                        conn.createStatement().executeQuery(
                            "SELECT name FROM system.tables WHERE database = 'seven_split' ORDER BY name"
                        ).use { rs ->
                            while (rs.next()) tables.add(rs.getString(1))
                        }

                        tables shouldContainAll listOf("backtest_run", "execution_result", "market_tick_bithumb")
                    }
                }
        }
    }
})
