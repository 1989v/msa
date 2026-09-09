package com.kgd.game.domain.roster.model

/**
 * 파티에서 게임이 무엇을 할 수 있는지 (ADR-0092) — **신호가 셋이다.**
 *
 * 하나로 뭉치지 않는 이유: 「릴레이에 붙는가」만으로는 `[랜덤]`(비참여형만)과 입력 중계
 * 대상의 목록을 만들 수 없다. 입력형 비참여형(카드 뽑기)과 참여형이 그 축에서 똑같이 참이다.
 *
 * 장르가 아니라 **태그**인 이유: 장르는 게임당 하나라, 참여형을 장르로 만들면 결정자 장르와
 * 배타가 되어 `[게임 픽]` 의 합집합이 깨진다. 이름에 `party` 를 안 쓰는 이유는 그것이 이미
 * 다른 뜻의 카테고리 태그이기 때문이다.
 */
enum class PartyCapability(val tag: String) {
    /** 명부 규약을 읽는다 — 참가자·방식·인원 수·비율을 인계받아 바로 시작한다 */
    ROSTER_READY("roster-ready"),

    /** 릴레이에 붙는다 — 파티 방의 시작 신호를 받는다 */
    RELAY_READY("relay-ready"),

    /** 사람 입력이 결과를 바꾼다 — 시드만으로는 기기마다 다른 판이 되어 입력 중계가 필요하다 */
    INPUT_DECIDES("input-decides");

    companion object {
        /**
         * 참여형 표시 — 각자 조작해 겨루고 서버가 채점하는 게임.
         * 아직 카탈로그에 없어 상수만 둔다(참여형 두 종이 붙을 때 시드가 채운다).
         */
        const val INTERACTIVE_TAG = "interactive-party"

        fun of(tags: List<String>): Set<PartyCapability> = entries.filter { it.tag in tags }.toSet()

        /**
         * `[게임 픽]` 에 나올 자격 — 명부를 읽는 게임만이다.
         * 나머지 카탈로그를 섞으면 고른 게임이 명부를 무시하고 사용자는 이유를 모른다.
         */
        fun pickable(tags: List<String>): Boolean = ROSTER_READY.tag in tags

        /**
         * `[랜덤]` 의 대상 — **비참여형만**이다. 참여형은 따로 고르는 갈래가 있고,
         * 섞이면 「지켜보는 판」을 기대한 사람이 갑자기 조작을 요구받는다.
         */
        fun randomPool(tags: List<String>): Boolean = pickable(tags) && INTERACTIVE_TAG !in tags

        /** 참여형 목록의 대상 */
        fun interactive(tags: List<String>): Boolean = pickable(tags) && INTERACTIVE_TAG in tags

        /** 입력을 중계해야 하는가 — 판이 갈리지 않으려면 입력을 함께 날라야 한다 */
        fun needsInputRelay(tags: List<String>): Boolean = INPUT_DECIDES.tag in tags
    }
}
