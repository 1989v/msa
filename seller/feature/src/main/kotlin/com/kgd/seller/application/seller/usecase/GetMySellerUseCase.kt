package com.kgd.seller.application.seller.usecase

/**
 * 판매자 포털의 "나" — 매 요청 회원 id 로 판매자 행을 찾아 ACTIVE 인지 본다.
 * JWT 의 ROLE_SELLER 만 믿지 않는다: 정지는 토큰 만료를 기다리지 않고 바로 막혀야 한다.
 */
interface GetMySellerUseCase {
    fun execute(memberId: String): SellerView
}
