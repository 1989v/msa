package com.kgd.seller.application.seller.usecase

/** 반려 후 30일이 지난 신청의 개인정보(사업자번호·대표자·계좌)를 지운다. 행과 상태는 이력으로 남는다. */
interface PurgeRejectedApplicationsUseCase {
    /** @return 이번 실행에서 지운 행 수 */
    fun execute(): Int
}
