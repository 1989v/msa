package com.kgd.sevensplit.infrastructure.ingest

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import java.nio.file.Files
import java.time.Instant

/**
 * TG-07.2: 파일 기반 checkpoint 의 read-back / 최초 read / 덮어쓰기 동작 검증.
 */
class FileIngestCheckpointStoreSpec : BehaviorSpec({
    Given("빈 임시 디렉토리") {
        val base = Files.createTempDirectory("checkpoint-spec-")
        val store = FileIngestCheckpointStore(base)

        When("존재하지 않는 심볼을 load") {
            Then("null 반환") {
                store.loadLastTs("BTC_KRW", "1m").shouldBeNull()
            }
        }

        When("save 후 load") {
            val ts = Instant.parse("2023-01-15T00:01:00Z")
            store.saveLastTs("BTC_KRW", "1m", ts)

            Then("동일 instant 반환") {
                store.loadLastTs("BTC_KRW", "1m") shouldBe ts
            }
        }

        When("동일 키로 다시 save") {
            val ts2 = Instant.parse("2023-02-01T12:00:00Z")
            store.saveLastTs("BTC_KRW", "1m", ts2)

            Then("최신 값으로 덮어씀") {
                store.loadLastTs("BTC_KRW", "1m") shouldBe ts2
            }
        }

        When("서로 다른 interval 은 분리") {
            val ts = Instant.parse("2024-06-01T00:00:00Z")
            store.saveLastTs("BTC_KRW", "5m", ts)

            Then("다른 interval 에 영향 없음") {
                store.loadLastTs("BTC_KRW", "5m") shouldBe ts
                store.loadLastTs("BTC_KRW", "1m") shouldBe Instant.parse("2023-02-01T12:00:00Z")
            }
        }
    }
})
