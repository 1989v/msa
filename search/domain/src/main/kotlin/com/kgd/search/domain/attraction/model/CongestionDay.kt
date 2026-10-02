package com.kgd.search.domain.attraction.model

import java.time.LocalDate

/**
 * 관광지 집중률 예측 하루 — 한국관광공사 빅데이터 `TatsCnctrRateService`(오늘부터 앞 30일). [rate] 는 원천 값 그대로(0~100).
 *
 * 원천에 contentId 가 없어 place 가 이름 + 시군구로 국문 관광지에 이은 곳만 온다(정확 · 정규화 매칭). 국문 문서만 있다.
 * 색인은 하루 한 번 바뀌어 자정을 넘기면 어제 날짜가 남는다 — 오늘 이전 날을 거르는 것은 화면이다.
 */
data class CongestionDay(val date: LocalDate, val rate: Double)
