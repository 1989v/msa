package com.kgd.search.domain.queryvector.model

import java.text.Normalizer

/**
 * 질의 정규화 — 사전 `_id` 의 절반을 만든다 (`_id = "{modelRef}|{normalized}"`, ADR-0090).
 *
 * **이 함수가 바뀌면 사전의 `_id` 가 전부 어긋난다 = 사전 전량 재적재.** 도구는 원문 `query` 를
 * 갖고 있으니 모델을 다시 돌릴 필요는 없지만, 그때까지 모든 질의가 미적중이 되어 벡터 레그가 통째로 꺼진다.
 * 그래서 규칙은 **여기 한 곳**에만 있고(도구는 원문을 보낸다) 고정값 테스트로 잠근다.
 *
 * 순서: NFKC → 공백 축약 → trim → 소문자 → 끝 문장부호 제거 → 100자 절단.
 * NFKC 를 먼저 하는 이유는 전각(`Ｓｅｏｕｌ`)을 반각으로 펴야 소문자·부호 판정이 통하기 때문이다.
 */
object QueryNormalizer {

    /** 사전 키의 상한. 이보다 긴 질의는 어차피 사전에 없다(문장 질의는 미스로 남아 로그가 센다). */
    const val MAX_LENGTH = 100

    private val WHITESPACE = Regex("""\s+""")

    /** 끝에 붙는 문장부호와 공백. 물음표 하나 때문에 사전이 미적중이 되면 안 된다. */
    private val TRAILING_PUNCTUATION = Regex("""[?!.,~\s]+$""")

    /** 정규화 결과가 비면 null — 부호만 친 질의는 사전에 넣지 않는다. */
    fun normalize(raw: String): String? {
        val folded = Normalizer.normalize(raw, Normalizer.Form.NFKC)
        val collapsed = WHITESPACE.replace(folded, " ").trim().lowercase()
        val stripped = TRAILING_PUNCTUATION.replace(collapsed, "")
        val truncated = if (stripped.length > MAX_LENGTH) stripped.take(MAX_LENGTH).trim() else stripped
        return truncated.ifBlank { null }
    }
}
