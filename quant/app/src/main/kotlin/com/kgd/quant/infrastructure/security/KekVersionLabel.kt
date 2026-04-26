package com.kgd.quant.infrastructure.security

/**
 * TG-P2-04 — KEK 버전 라벨 ↔ DB 컬럼 INT 변환 유틸.
 *
 * Storage 컬럼 `kek_version` 은 INT 이지만, [com.kgd.quant.application.port.security.KeyManagementService]
 * 가 반환하는 라벨은 문자열 (예: `local-v3`, OCI key version OCID).
 *
 * ## 변환 규칙
 *  - **LocalFile / Fake**: `local-vN` / `fake-vN` 형식 → 마지막 숫자를 추출해 INT 로 매핑.
 *  - **OCI Vault**: OCID 는 임의 문자열이므로 별도 매핑 테이블이 필요하다. 본 유틸은 단순화로
 *    OCID 의 hashCode 절댓값을 사용한다 — 단조 증가는 보장되지 않으나 "버전 차이 감지" 목적으로는
 *    충분하다 (Phase 2 단순화). Phase 3 에서 OCID → Int 매핑 테이블 신설 ADR 후속 처리.
 *
 * ## 사용처
 *  - [LazyReencryptionJob] — `current` 버전을 INT 로 변환해 stale row scan 쿼리에 전달.
 *  - Adapter — entity 의 `kekVersion: Int` ↔ [com.kgd.quant.application.port.security.WrappedDek.kekVersion] 라벨 변환.
 *
 * ## 단순화 한계 (문서화)
 *  - OCI 환경에서 라벨 → Int 의 단조 증가가 깨질 수 있다 → lazy reencryption 의 "stale 판정" 이
 *    부정확할 수 있음. SOP 문서에 이 제약을 명시한다 (`quant/docs/key-rotation-sop.md`).
 */
object KekVersionLabel {

    private val NUMERIC_SUFFIX = Regex("(\\d+)$")
    private const val LOCAL_PREFIX = "local-v"
    private const val FAKE_PREFIX = "fake-v"

    /**
     * 라벨을 storage INT 로 변환.
     *
     * @return 양의 정수 (1 이상). 변환 실패 시 `1` (V002 default).
     */
    fun toInt(label: String): Int {
        if (label.isBlank()) return DEFAULT_VERSION
        // 1) local-vN / fake-vN 우선 매칭 — 가장 흔한 케이스이고 단조 증가가 명확.
        val n = when {
            label.startsWith(LOCAL_PREFIX) -> label.removePrefix(LOCAL_PREFIX).toIntOrNull()
            label.startsWith(FAKE_PREFIX) -> label.removePrefix(FAKE_PREFIX).toIntOrNull()
            else -> NUMERIC_SUFFIX.find(label)?.groupValues?.get(1)?.toIntOrNull()
        }
        if (n != null && n > 0) return n
        // 2) OCI OCID 등 숫자 suffix 가 없는 라벨 — hashCode 절댓값 (단조성 X, 차이 감지 목적).
        val hash = label.hashCode()
        return if (hash == Int.MIN_VALUE) Int.MAX_VALUE else Math.abs(hash).coerceAtLeast(1)
    }

    /**
     * INT version 을 LocalFile/Fake 라벨로 역변환 (테스트/로깅 용).
     *
     * OCI 환경에는 적합하지 않다 (역변환 불가능).
     */
    fun toLocalLabel(version: Int): String = "$LOCAL_PREFIX$version"

    const val DEFAULT_VERSION = 1
}
