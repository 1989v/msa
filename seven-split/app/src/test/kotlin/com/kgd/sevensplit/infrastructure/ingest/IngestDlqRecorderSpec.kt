package com.kgd.sevensplit.infrastructure.ingest

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.string.shouldContain
import java.nio.file.Files
import java.time.Instant

/**
 * TG-07.2: DLQ 파일 append 동작 검증.
 */
class IngestDlqRecorderSpec : BehaviorSpec({
    Given("빈 임시 DLQ 디렉토리") {
        val base = Files.createTempDirectory("dlq-spec-")
        val recorder = IngestDlqRecorder(base)

        When("record(BTC_KRW, 1m, checkpoint=null, reason='timeout')") {
            val at = Instant.parse("2026-04-24T10:00:00Z")
            recorder.record("BTC_KRW", "1m", null, at, "timeout")

            Then("BTC_KRW-1m.dlq.log 파일 생성 + 내용 포함") {
                val file = base.resolve("BTC_KRW-1m.dlq.log")
                Files.exists(file).shouldBeTrue()
                val content = Files.readString(file)
                content shouldContain "2026-04-24T10:00:00Z"
                content shouldContain "BTC_KRW"
                content shouldContain "1m"
                content shouldContain "checkpoint=null"
                content shouldContain "reason=timeout"
            }
        }

        When("동일 키로 두 번째 record (reason 에 tab / newline 포함)") {
            val at = Instant.parse("2026-04-24T10:05:00Z")
            recorder.record("BTC_KRW", "1m", Instant.parse("2026-04-24T10:00:00Z"), at, "error\twith\ttabs\nand newline")

            Then("append 되어 두 줄 이상, tab/newline 은 공백으로 치환") {
                val file = base.resolve("BTC_KRW-1m.dlq.log")
                val lines = Files.readAllLines(file)
                (lines.size >= 2).shouldBeTrue()
                val secondLine = lines.last()
                secondLine shouldContain "checkpoint=2026-04-24T10:00:00Z"
                // tab/newline 이 공백으로 치환되었는지 (원본 \t\n 이 그대로 남아있지 않아야 한다)
                secondLine shouldContain "error with tabs and newline"
            }
        }
    }
})
