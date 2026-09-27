package com.kgd.ads.domain.placement.model

/**
 * 광고 형태 — 광고주가 캠페인을 만들 때 하나 고르고 바꿀 수 없다. 지면은 형태마다 규격([FormatSpec])을 갖는다.
 * HOUSE 에는 의미가 없다(HOUSE 캠페인 행은 기본값 카드를 가질 뿐 어떤 검사에도 쓰지 않는다).
 * 「형식」은 이미지 파일 형식(PNG·JPEG)에만 쓴다.
 *
 * @param label 광고주에게 보이는 이름 — 거절 문구에 쓴다
 */
enum class PlacementFormat(val label: String) {
    /** 카드 — 1.91:1 이미지 + 제목 + 설명 */
    CARD("카드"),

    /** 띠배너 — 6.4:1 이미지 한 장. 문구는 이미지 안에 있고 대체 텍스트만 따로 받는다 */
    BANNER("띠배너"),
}
