package com.kgd.codedictionary.application.resume.usecase

/**
 * 단축 주소 클릭 1건 적재 — 원장 1행 + 링크별 누적 수 1 증가.
 *
 * 링크 id 만 받는다. 이력서 열람에서는 리퍼러·UA 를 모으지 않는다(ADR-0064).
 * 호출부는 실패를 삼킨다 — 302 가 본질이고 통계는 부수다.
 */
interface RecordResumeShortLinkClickUseCase {
    fun execute(shareLinkId: Long)
}
