package com.kgd.game.domain.catalog.model

/**
 * 게임 장르 — 게임당 1개의 대표 분류 (리스트 카테고리 내비게이션 축).
 * 다중 성격은 tags 가 담당하고, genre 는 항상 단일이다.
 */
enum class Genre {
    ARCADE,
    ACTION,
    PUZZLE,
    RPG,
    EDUCATION,
    STRATEGY,
    DEFENSE,
    VERSUS,
    CASUAL,

    /**
     * 순서 정하기 — 커피 사는 사람·역할·차례를 정할 때 쓰는 도구형 게임.
     * 이 장르의 게임은 **파티 인계 규약**(localStorage `kgd.party.v1`)을 읽어
     * 참가자 목록과 방식이 미리 정해진 채로 바로 시작할 수 있어야 한다 —
     * 허브의 '랜덤으로 돌리기' 가 이 장르 전체를 대상으로 하나를 뽑기 때문이다.
     * 또한 **출발 위치가 결과를 정하지 않아야** 한다(출발 위치 ↔ 도착 등수 |ρ| < 0.1).
     */
    DECIDER;

    companion object {
        fun parse(value: String?): Genre? =
            value?.let { raw -> entries.firstOrNull { it.name.equals(raw, ignoreCase = true) } }
    }
}
