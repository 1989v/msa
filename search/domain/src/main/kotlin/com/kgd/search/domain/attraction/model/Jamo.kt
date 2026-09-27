package com.kgd.search.domain.attraction.model

/**
 * 한글 자모 분해 (ADR-0065 P2 후속).
 *
 * **왜 필요한가**: 자동완성은 "경복"까지 친 상태가 아니라 "경보"처럼 **조합 중간 상태**에서도
 * 맞아야 한다. 형태소 분석기(nori)는 완성된 음절만 다루므로 `경보` 로는 `경복궁` 을 못 찾는다.
 * 자모로 펴면 `ㄱㅕㅇㅂㅗ` 가 `ㄱㅕㅇㅂㅗㄱㄱㅜㅇ` 의 접두라 매칭된다.
 *
 * **왜 플러그인이 아니라 코드인가**: OpenSearch 기본 분석기에 한글 자모 분해가 없고,
 * 관리형 이미지에 커뮤니티 플러그인을 넣으면 그 플러그인이 배포의 제약이 된다.
 * 분해는 U+AC00 기준 산술이라 색인(batch)과 질의(app)가 같은 함수를 쓰면 충분하다.
 *
 * 색인과 질의가 **반드시 같은 규칙**을 써야 한다 — 한쪽만 바뀌면 조용히 아무것도 안 맞는다.
 */
object Jamo {
    private const val BASE = 0xAC00
    private const val LAST = 0xD7A3
    private const val JUNG_COUNT = 21
    private const val JONG_COUNT = 28

    private const val CHOSEONG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
    private const val JUNGSEONG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
    private const val JONGSEONG = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"

    /**
     * 완성 음절을 초성·중성·종성으로 편다. 한글이 아닌 문자는 소문자로 그대로 둔다 —
     * 영문 관광지명도 같은 필드에 들어가므로 버리면 영문 자동완성이 죽는다.
     */
    fun decompose(text: String): String {
        val out = StringBuilder(text.length * 3)
        for (ch in text) {
            val code = ch.code
            if (code in BASE..LAST) {
                val index = code - BASE
                out.append(CHOSEONG[index / (JUNG_COUNT * JONG_COUNT)])
                out.append(JUNGSEONG[(index % (JUNG_COUNT * JONG_COUNT)) / JONG_COUNT])
                JONGSEONG[index % JONG_COUNT].takeIf { it != ' ' }?.let { out.append(it) }
            } else {
                out.append(ch.lowercaseChar())
            }
        }
        return out.toString()
    }

    /**
     * [decompose] 의 역 — 오타 교정 제안(자모열)을 화면에 낼 음절로 되돌린다.
     * 자음 뒤에 모음이 오면 그 자음은 다음 음절의 초성이고, 아니면 앞 음절의 종성이다.
     * 음절을 이루지 못하는 자모와 한글이 아닌 문자는 그대로 둔다.
     */
    fun compose(jamo: String): String {
        val out = StringBuilder(jamo.length)
        var i = 0
        while (i < jamo.length) {
            val cho = CHOSEONG.indexOf(jamo[i])
            val jung = if (i + 1 < jamo.length) JUNGSEONG.indexOf(jamo[i + 1]) else -1
            if (cho < 0 || jung < 0) {
                out.append(jamo[i])
                i++
                continue
            }
            var next = i + 2
            var jong = 0
            if (next < jamo.length) {
                val candidate = JONGSEONG.indexOf(jamo[next])
                val startsNextSyllable = next + 1 < jamo.length && JUNGSEONG.indexOf(jamo[next + 1]) >= 0
                if (candidate > 0 && !startsNextSyllable) {
                    jong = candidate
                    next++
                }
            }
            out.append((BASE + (cho * JUNG_COUNT + jung) * JONG_COUNT + jong).toChar())
            i = next
        }
        return out.toString()
    }
}
