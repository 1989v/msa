package com.kgd.seller.application.seller.port

import com.kgd.seller.domain.seller.model.Seller

/**
 * 판매자 이벤트 발행 — 아웃박스 행으로 남고 릴레이가 `seller.seller.*` 로 보낸다(키 = sellerId).
 * 호출은 상태 변경과 같은 트랜잭션 안에서 한다. 계좌·사업자번호 같은 개인정보는 싣지 않는다.
 */
interface SellerEventPort {
    fun publish(type: SellerEventType, seller: Seller)
}

enum class SellerEventType { APPLIED, APPROVED, SUSPENDED, REACTIVATED, UPDATED }
