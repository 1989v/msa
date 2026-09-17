package com.kgd.quant.infrastructure.clickhouse

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainAll
import io.kotest.matchers.shouldBe
import org.testcontainers.DockerClientFactory
import org.testcontainers.clickhouse.ClickHouseContainer
import org.testcontainers.utility.DockerImageName
import java.sql.DriverManager

/**
 * ClickHouse Testcontainers 로 quant 스키마 부트스트랩 검증 — 전체 DDL 적용 + 두 번째 호출 무동작.
 *
 * Docker daemon 이 필요하다 (로컬 docker / colima / Docker Desktop 등).
 * CI/nightly 에서는 필수, 로컬 docker 미연결 환경에서는 spec 자체를 건너뛴다.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

class ClickHouseSchemaSmokeSpec : BehaviorSpec({
    // 24.x 이미지는 default 사용자 인증 정책이 강화되어 Testcontainers 기본 plain 접근이 거부됨.
    // 23.8 LTS 로 고정 (운영 사용은 24.x — 본 spec 은 schema bootstrap 검증 용도라 버전 무관).
    val image = DockerImageName.parse("clickhouse/clickhouse-server:23.8")
        .asCompatibleSubstituteFor("clickhouse/clickhouse-server")
    val container: ClickHouseContainer? = if (dockerAvailable) ClickHouseContainer(image) else null

    beforeSpec { container?.start() }
    afterSpec { container?.stop() }

    Given("ClickHouse Testcontainer 가 실행됨") {
        When("SchemaBootstrapper.applyTo(conn) 를 두 번 호출") {
            Then("첫 번째는 V001~V012 전부를 만들고 두 번째는 아무것도 다시 돌리지 않는다")
                .config(enabledIf = { dockerAvailable }) {
                    val c = container!!
                    // 운영과 같은 모양: 풀 URL 은 아직 없는 /quant 를 가리키고, 부트스트랩이 system 으로 우회한다
                    val poolUrl = QuantSchemaInitializer.bootstrapUrl(c.jdbcUrl).replace("/system", "/quant")
                    DriverManager.getConnection(QuantSchemaInitializer.bootstrapUrl(poolUrl), c.username, c.password).use { conn ->
                        val bootstrapper = SchemaBootstrapper()
                        val first = bootstrapper.applyTo(conn)
                        val second = bootstrapper.applyTo(conn)

                        first shouldBe bootstrapper.ddlResourcePaths().size
                        second shouldBe 0

                        val tables = mutableListOf<String>()
                        conn.createStatement().executeQuery(
                            "SELECT name FROM system.tables WHERE database = 'quant' ORDER BY name"
                        ).use { rs ->
                            while (rs.next()) tables.add(rs.getString(1))
                        }
                        tables shouldContainAll listOf(
                            "market_tick_bithumb", "backtest_run", "execution_result",
                            "ohlcv", "fx_proxy_tick", "signal_eval", "kimchi_premium_tick",
                            "investor_flows", "discover_daily_ranking", "dart_corp_codes",
                            "fundamentals", "schema_migrations",
                        )

                        // V012 의 ALTER 가 실제로 돌았는지 — 컬럼이 있어야 한다
                        val columns = mutableListOf<String>()
                        conn.createStatement().executeQuery(
                            "SELECT name FROM system.columns WHERE database = 'quant' AND table = 'fundamentals'"
                        ).use { rs -> while (rs.next()) columns.add(rs.getString(1)) }
                        columns shouldContainAll listOf("held_pct_institutions", "float_shares")
                    }
                }
        }
    }
})
