package com.kgd.game.domain.play.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/**
 * 랭킹 보드의 세 번째 축 — 게임이 스스로 나눈 모드 (V59).
 *
 * 트랙(BASE/MODDED)과 성격이 다르다. 트랙은 "무엇으로 잰 기록인가"라는 **플랫폼의** 물음이라
 * 값이 고정이지만, 보드는 "이 게임의 어느 모드인가"라서 값을 **게임이** 정한다. 그래서 enum 이
 * 아니라 열린 키다 — 플랫폼은 모드가 몇 개인지도, 무슨 뜻인지도 모른다.
 *
 * 왜 나누는가: 같은 게임 안에서도 재는 자가 아예 다른 모드가 있다. 「그어서 막기」의 물/돌/벌은
 * 같은 방어선을 그어도 점수가 세 배까지 갈리고, 「인피니티 타워」의 방어전과 타워 등반은
 * 한 판의 길이 자체가 다르다. 한 보드로 합치면 순위표가 실력이 아니라
 * **점수가 잘 나오는 모드를 고른 사람** 순위가 된다.
 *
 * 값이 없는 것이 기본이다. 모드가 하나뿐인 게임 60여 종은 보드를 보내지 않고, 그 기록은 전부
 * 빈 키 한 보드에 그대로 남는다 — V59 가 컬럼만 늘리고 기존 행을 옮기지 않는 이유다.
 */
@JvmInline
value class ScoreBoardKey private constructor(val value: String) {
    val isDefault: Boolean get() = value.isEmpty()

    companion object {
        /** 모드를 나누지 않는 게임의 보드 */
        val DEFAULT = ScoreBoardKey("")

        /** 소문자/숫자/하이픈. 표시용 낱말이 아니라 식별자다 — 이름은 카탈로그(ScoreBoardDef)가 갖는다 */
        private val FORMAT = Regex("^[a-z0-9][a-z0-9-]{0,23}$")

        /**
         * 못 읽는 키는 기본 보드로 흘려보내지 않고 거절한다.
         * 조용히 합치면 게임 쪽 오타 하나가 남의 보드에 섞여 들어가고, 그건 화면에서
         * "왜 내 기록이 저기 있지"로만 보인다 — 원인을 되짚을 단서가 남지 않는다.
         */
        fun from(raw: String?): ScoreBoardKey {
            val key = raw?.trim().orEmpty()
            if (key.isEmpty()) return DEFAULT
            if (!FORMAT.matches(key)) {
                throw BusinessException(ErrorCode.INVALID_INPUT, "보드 키는 소문자/숫자/하이픈 1~24자")
            }
            return ScoreBoardKey(key)
        }
    }
}
