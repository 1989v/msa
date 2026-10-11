package com.kgd.search.domain.attraction.model

/**
 * 찜 신호 — 이 사이트 회원이 관광지(언어 문서 id 단위)를 찜한 수. 색인 `savedCount` 로 싣는다.
 *
 * 하한은 표시 정책이다 — 적은 수는 신호가 아니라서 둔다(개인정보 통제가 아니다: 공개 찜 수 API 가 정확한 수를 이미 낸다).
 * 화면(`portal-fe/src/pages/place/visitSignals.ts` 의 `SAVED_MIN`)이 같은 값을 쓰고, 화면 테스트가 이 파일을 읽어 대조한다.
 */
object AttractionSaveSignal {

    /** 찜한 회원이 이보다 적으면 색인에 싣지 않고 「많이 찜한 곳」·근거 줄도 없다. */
    const val SAVED_MIN = 3

    fun meetsMin(savedCount: Int?): Boolean = savedCount != null && savedCount >= SAVED_MIN
}
