package com.kgd.wishlist.application.wishlist.usecase

import com.kgd.wishlist.domain.model.WishlistTargetType
import java.time.LocalDateTime

/**
 * 찜 묶음 관리 (ADR-0080).
 *
 * 회원 소유 검증은 전부 여기서 한다 — 묶음 id 는 URL 로 들어오므로 남의 묶음 id 를 넣어
 * 이름을 바꾸거나 거기에 자기 찜을 밀어넣을 수 있어야 하면 안 된다. 조회·수정·삭제
 * 모두 `memberId` 와 함께 찾는다.
 */
interface ManageCollectionUseCase {
    fun create(memberId: Long, name: String): Collection
    fun rename(memberId: Long, collectionId: Long, name: String): Collection
    fun delete(memberId: Long, collectionId: Long)
    fun list(memberId: Long): List<Collection>

    /**
     * 찜을 묶음으로 옮긴다. [collectionId] 가 null 이면 미분류로 뺀다 — 찜 자체는 남는다.
     * 한 항목은 한 묶음에만 속하므로 '추가' 가 아니라 '이동' 이다.
     */
    fun move(memberId: Long, targetType: WishlistTargetType, targetKey: String, collectionId: Long?)

    data class Collection(
        val id: Long,
        val name: String,
        /** 그 묶음에 담긴 찜 수 — 목록이 '제주 여행 · 8곳' 을 그리는 데 쓴다 */
        val itemCount: Long,
        val createdAt: LocalDateTime,
    )
}
