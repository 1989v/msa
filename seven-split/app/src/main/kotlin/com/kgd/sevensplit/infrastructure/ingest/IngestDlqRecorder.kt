package com.kgd.sevensplit.infrastructure.ingest

import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardOpenOption
import java.time.Instant

/**
 * TG-07.2: 수집 실패 슬라이스를 파일 DLQ 로 기록.
 *
 * 파일 위치: `{dlqDir}/{symbol}-{interval}.dlq.log`
 * 라인 포맷(tab 구분):
 * ```
 * {at}\t{symbol}\t{interval}\tcheckpoint={ts}\treason={msg}
 * ```
 *
 * 운영자는 이 파일을 보고 재수집 범위를 선택해 `--force-reingest` 로 재실행한다.
 * 민감 정보(API key 등)는 Phase 1 public endpoint 특성상 기록 대상이 아님.
 */
class IngestDlqRecorder(
    private val dlqDir: Path,
) {
    init {
        Files.createDirectories(dlqDir)
    }

    fun record(
        symbol: String,
        interval: String,
        checkpoint: Instant?,
        at: Instant,
        reason: String,
    ) {
        val file = dlqDir.resolve("$symbol-$interval.dlq.log")
        val sanitizedReason = reason.replace('\t', ' ').replace('\n', ' ')
        val line = "$at\t$symbol\t$interval\tcheckpoint=$checkpoint\treason=$sanitizedReason\n"
        Files.writeString(file, line, StandardOpenOption.CREATE, StandardOpenOption.APPEND)
    }
}
