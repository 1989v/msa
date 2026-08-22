package com.kgd.member.domain.model

import kotlin.random.Random

/**
 * 표시 이름을 **우리가 만든다** (ADR-0078).
 *
 * 소셜 계정의 실명·닉네임을 받지 않으므로 가입 시점에 이름이 없다. 빈 값으로 두면 화면마다
 * "이름 없음" 분기가 생기고, 회원 번호를 그대로 보여주면 사람이 부를 수 없는 이름이 된다.
 *
 * 실명과 섞이지 않는 어휘를 쓴다 — 사람 이름처럼 보이는 조합은 그 자체로 실명으로 오해받고,
 * 오해받는 순간 다른 사람이 그것을 개인정보로 다루기 시작한다.
 *
 * 뒤의 숫자는 충돌 회피가 아니라 **구별**을 위한 것이다. 유일성은 회원 id 가 갖고 있고,
 * 닉네임은 중복될 수 있다(같은 이름의 사람이 둘 있는 것과 같다).
 */
object Nickname {

    private val ADJECTIVES = listOf(
        "푸른", "고요한", "깊은", "맑은", "너른", "이른", "잔잔한", "환한",
        "서늘한", "따스한", "가벼운", "느긋한", "또렷한", "무던한",
    )

    private val NOUNS = listOf(
        "소나무", "물결", "돌담", "안개", "바람", "구름", "여울", "기와",
        "모래", "이슬", "노을", "골짜기", "들녘", "샘물",
    )

    /** `푸른소나무-4821` */
    fun generate(random: Random = Random.Default): String =
        "${ADJECTIVES.random(random)}${NOUNS.random(random)}-${random.nextInt(1000, 10000)}"
}
