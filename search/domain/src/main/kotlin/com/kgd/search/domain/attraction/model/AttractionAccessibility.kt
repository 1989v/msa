package com.kgd.search.domain.attraction.model

/**
 * 무장애 여행 정보 — 한국관광공사 `KorWithService2` 상세(관광지당 29키 자유 문장)에서 온다. 국문 문서만 있다.
 *
 * [flags] 는 수집기(place-ingest `barrier_free.py`)가 원문에서 파생한 **긍정 코드만**이다 — 「없음」과 「모름」은
 * 코드가 없어 구별되지 않으므로 필터·아이콘은 긍정만 다룬다. [detail] 은 값이 있는 원천 키 → 원문 문장이다.
 */
data class BarrierFreeInfo(
    val flags: List<String>,
    val detail: Map<String, String>,
) {
    /** 원천 키 하나 — 화면·서버 렌더가 같은 순서·같은 이름으로 그린다(portal-fe `placeAttributes.ts` 와 같은 표). */
    data class Key(val key: String, val code: String, val ko: String, val en: String)

    companion object {
        /** 원천 응답 순서. 원천 키 이름의 오타(`braile`)는 원천 그대로다. */
        val KEYS: List<Key> = listOf(
            Key("parking", "PARKING", "주차", "Parking"),
            Key("publictransport", "PUBLIC_TRANSPORT", "대중교통", "Public transport"),
            Key("route", "ROUTE", "접근로", "Access route"),
            Key("ticketoffice", "TICKET_OFFICE", "매표소", "Ticket office"),
            Key("promotion", "PROMOTION", "홍보물", "Brochures"),
            Key("wheelchair", "WHEELCHAIR", "휠체어", "Wheelchairs"),
            Key("exit", "EXIT", "출입통로", "Entrance"),
            Key("elevator", "ELEVATOR", "엘리베이터", "Elevator"),
            Key("restroom", "RESTROOM", "화장실", "Restrooms"),
            Key("auditorium", "AUDITORIUM", "관람석", "Seating"),
            Key("room", "ROOM", "객실", "Rooms"),
            Key("handicapetc", "HANDICAP_ETC", "지체장애 기타", "Mobility, other"),
            Key("braileblock", "BRAILLE_BLOCK", "점자블록", "Tactile paving"),
            Key("helpdog", "HELP_DOG", "보조견 동반", "Assistance dogs"),
            Key("guidehuman", "GUIDE_HUMAN", "안내요원", "Guide staff"),
            Key("audioguide", "AUDIO_GUIDE", "오디오가이드", "Audio guide"),
            Key("bigprint", "BIG_PRINT", "큰활자 홍보물", "Large print"),
            Key("brailepromotion", "BRAILLE_PROMOTION", "점자 홍보물", "Braille materials"),
            Key("guidesystem", "GUIDE_SYSTEM", "유도안내설비", "Guidance system"),
            Key("blindhandicapetc", "BLIND_ETC", "시각장애 기타", "Vision, other"),
            Key("signguide", "SIGN_GUIDE", "수어 안내", "Sign language"),
            Key("videoguide", "VIDEO_GUIDE", "자막 영상 안내", "Captioned video"),
            Key("hearingroom", "HEARING_ROOM", "청각장애 객실", "Rooms for hearing impaired"),
            Key("hearinghandicapetc", "HEARING_ETC", "청각장애 기타", "Hearing, other"),
            Key("stroller", "STROLLER", "유모차", "Strollers"),
            Key("lactationroom", "LACTATION_ROOM", "수유실", "Nursing room"),
            Key("babysparechair", "BABY_CHAIR", "유아용 의자", "Baby chairs"),
            Key("infantsfamilyetc", "INFANT_ETC", "영유아 가족 기타", "Families with infants, other"),
        )

        /** 상세 위쪽 아이콘 줄 — 긍정 코드만, 이 순서. */
        val ICONS: List<Pair<String, Pair<String, String>>> = listOf(
            "WHEELCHAIR" to ("휠체어" to "Wheelchairs"),
            "ELEVATOR" to ("엘리베이터" to "Elevator"),
            "RESTROOM" to ("장애인 화장실" to "Accessible restroom"),
            "PARKING" to ("장애인 주차" to "Accessible parking"),
            "STROLLER" to ("유모차" to "Strollers"),
            "LACTATION_ROOM" to ("수유실" to "Nursing room"),
        )

        /**
         * 목록 필터로 여는 코드. 라벨 정밀도(운영 표본 100건 손 확인)가 95% 이상인 키만 둔다 —
         * implementation/phase2-barrierfree-labels.md. 여기 없는 코드는 검색 파라미터로 와도 버린다.
         */
        val FILTER_CODES: List<String> = listOf("WHEELCHAIR", "ELEVATOR", "RESTROOM")

        /** 상세 원문 키·값 → [detail]. 모르는 키(원천이 새로 낸 키)와 빈 값은 뺀다. */
        fun detailOf(raw: Map<String, String?>): Map<String, String> =
            KEYS.mapNotNull { k -> raw[k.key]?.trim()?.takeIf { it.isNotEmpty() }?.let { k.key to it } }.toMap()
    }
}

/**
 * 웰니스관광 테마 — 한국관광공사 `WellnessTursmService`. [code] 는 신분류 소분류(`EX05xxxx`)와 같은 체계라
 * [name] 은 place 분류 코드표 이름이다(재색인이 회차당 한 번 받는 표). 이름을 못 받았으면 null.
 */
data class WellnessTheme(val code: String, val name: String?)
