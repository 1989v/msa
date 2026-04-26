package com.kgd.quant.application.port.security

/**
 * TG-P2-03 (ADR-0027) — KEK 보관 추상화 Port.
 *
 * Envelope encryption 패턴에서 **DEK(Data Encryption Key)** 의 wrap/unwrap 을 KEK(Key
 * Encryption Key) 로 처리한다. KEK 자체는 외부 KMS(OCI Vault 등) 에 위임하거나 로컬 dev
 * 환경에서는 환경변수/설정 파일에서 로드한다.
 *
 * ## 어댑터 분기
 * - `OciVaultKmsAdapter` — 운영 (`@Profile("oci")`, `quant.security.kms.provider=oci`)
 * - `LocalFileKmsAdapter` — 로컬 dev / k3s-lite (`@Profile("local","test")`,
 *   `quant.security.kms.provider=local`)
 * - `FakeKmsAdapter` — 단위 테스트 전용 (테스트 source set 에 위치)
 *
 * ## 계약
 * - [wrap] / [unwrap] 은 모두 suspend. 내부 IO 는 어댑터가 `Dispatchers.IO` 등으로 분리.
 * - [unwrap] 은 **과거 KEK 버전으로 wrap 된 DEK 도 복호화 가능해야 한다** (회전 후 lazy
 *   re-encryption 윈도우 동안 필요). 어댑터는 [WrappedDek.kekVersion] 을 보고 적절한 KEK 를 선택한다.
 * - 미존재/만료된 KEK 버전으로의 unwrap 시도는 [IllegalStateException] 또는 어댑터별 KMS 예외를 던진다.
 * - [currentKekVersion] 은 **현재 활성 KEK 식별자** 를 반환한다. wrap 시점에는 항상 이 버전이 사용된다.
 *
 * ## version prefix 규칙
 * - LocalFile: `local-vN` (예: `local-v1`, `local-v2`) — N 은 양의 정수
 * - OCI Vault: OCI key version OCID 그대로 (예: `ocid1.keyversion.oc1.iad...`)
 * - Fake: `fake-vN`
 *
 * ## 보안
 * - 평문 DEK 는 **어떤 로깅/메트릭/toString 에도 노출 금지** (ADR-0021 §보안).
 * - [WrappedDek.toString] 은 ciphertext 를 마스킹한다.
 */
interface KeyManagementService {
    /**
     * 평문 DEK 를 현재 활성 KEK 로 wrap. 결과는 영구 저장 가능 (DB 컬럼).
     *
     * @param plaintextDek 256-bit AES key (32 bytes). 다른 길이는 어댑터별 정책에 따라 거부될 수 있다.
     * @return [WrappedDek] (ciphertext + 사용된 KEK 버전 라벨)
     */
    suspend fun wrap(plaintextDek: ByteArray): WrappedDek

    /**
     * Wrap 된 DEK 를 [WrappedDek.kekVersion] 에 기록된 KEK 로 unwrap.
     *
     * - 회전 후에도 과거 버전 unwrap 가능해야 한다 (재암호화 마이그레이션 윈도우 지원).
     * - 알 수 없는 버전은 예외.
     */
    suspend fun unwrap(wrapped: WrappedDek): ByteArray

    /**
     * 현재 활성 KEK 버전 식별자.
     *
     * - LocalFile: `local-v1` 등
     * - OCI Vault: 활성 key version OCID
     */
    suspend fun currentKekVersion(): String
}

/**
 * KEK 로 wrap 된 DEK + 버전 라벨.
 *
 * `equals/hashCode` 는 [ciphertext] 가 ByteArray 임을 고려해 contentEquals 기반으로 재정의한다.
 * `toString` 은 ciphertext 를 마스킹한다 (평문/ciphertext 모두 운영 로그 노출 금지).
 */
data class WrappedDek(
    val ciphertext: ByteArray,
    val kekVersion: String
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is WrappedDek) return false
        return ciphertext.contentEquals(other.ciphertext) && kekVersion == other.kekVersion
    }

    override fun hashCode(): Int = 31 * ciphertext.contentHashCode() + kekVersion.hashCode()

    override fun toString(): String =
        "WrappedDek(kekVersion=$kekVersion, ciphertext=[REDACTED ${ciphertext.size}B])"
}
