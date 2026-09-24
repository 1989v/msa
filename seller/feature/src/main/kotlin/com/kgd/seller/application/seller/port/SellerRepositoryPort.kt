package com.kgd.seller.application.seller.port

import com.kgd.seller.domain.seller.model.Seller
import com.kgd.seller.domain.seller.model.SellerStatus
import java.time.Instant

interface SellerRepositoryPort {
    /**
     * 새 신청 저장. 같은 회원의 열린 행(ACTIVE·PENDING·SUSPENDED)이 동시에 생기면 DB 유니크 제약이
     * 막고 [com.kgd.seller.domain.seller.exception.SellerAlreadyExistsException] 으로 바뀐다.
     */
    fun create(seller: Seller): Seller

    /** 기존 행의 상태·필드 갱신 */
    fun save(seller: Seller): Seller

    fun findById(id: Long): Seller?

    /** 그 회원의 모든 판매자 행(반려 이력 포함) */
    fun findAllByMemberId(memberId: String): List<Seller>

    fun findPage(status: SellerStatus?, page: Int, size: Int): SellerPage

    /** 반려 시각이 [cutoff] 이전이고 아직 개인정보를 지우지 않은 행 */
    fun findRejectedUnpurgedBefore(cutoff: Instant, limit: Int): List<Seller>
}

data class SellerPage(val items: List<Seller>, val totalElements: Long)
