package com.kgd.seller.domain.seller.model

/**
 * 판매자 상태. PENDING → ACTIVE | REJECTED · ACTIVE ↔ SUSPENDED. REJECTED 는 종착 —
 * 재신청은 이 행을 되살리지 않고 새 신청 행을 만든다(이력 보존).
 */
enum class SellerStatus {
    PENDING,
    ACTIVE,
    REJECTED,
    SUSPENDED,
    ;

    fun canTransitionTo(target: SellerStatus): Boolean = target in allowedNext()

    /**
     * 한 회원이 동시에 하나만 가질 수 있는 상태. 정지도 포함한다 — 빠지면 정지된 판매자가
     * 새로 신청해 정지를 피한다. DB 의 `open_member_id` 유니크 제약도 같은 집합을 쓴다.
     */
    val occupiesMember: Boolean get() = this != REJECTED

    private fun allowedNext(): Set<SellerStatus> = when (this) {
        PENDING -> setOf(ACTIVE, REJECTED)
        ACTIVE -> setOf(SUSPENDED)
        SUSPENDED -> setOf(ACTIVE)
        REJECTED -> emptySet()
    }
}
