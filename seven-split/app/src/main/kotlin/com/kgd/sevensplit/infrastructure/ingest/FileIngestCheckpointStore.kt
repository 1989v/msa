package com.kgd.sevensplit.infrastructure.ingest

import java.nio.file.Files
import java.nio.file.Path
import java.time.Instant

/**
 * TG-07.2/07.3: 파일 기반 checkpoint 저장소.
 *
 * 파일 위치: `{baseDir}/{symbol}-{interval}.checkpoint`
 * 포맷    : ISO-8601 Instant 문자열 (예: `2026-04-24T10:00:00Z`)
 *
 * 프로세스 재시작 후에도 이어받을 수 있도록 baseDir 는 영속 스토리지(호스트 볼륨/PVC)에 매핑해야 한다.
 * Phase 1 은 단일 인스턴스 배치 실행을 가정하므로 파일 락은 생략.
 */
class FileIngestCheckpointStore(
    private val baseDir: Path,
) : IngestCheckpointStore {

    init {
        Files.createDirectories(baseDir)
    }

    override fun loadLastTs(symbol: String, interval: String): Instant? {
        val file = fileOf(symbol, interval)
        if (!Files.exists(file)) return null
        val raw = Files.readString(file).trim()
        if (raw.isEmpty()) return null
        return Instant.parse(raw)
    }

    override fun saveLastTs(symbol: String, interval: String, ts: Instant) {
        val file = fileOf(symbol, interval)
        Files.writeString(file, ts.toString())
    }

    private fun fileOf(symbol: String, interval: String): Path =
        baseDir.resolve("$symbol-$interval.checkpoint")
}
