package com.kgd.search.domain.attraction.model

/**
 * portal-fe `src/seo/copy.mjs` 의 텍스트 규칙을 옮긴 것 — `sourceText`·`clampDescription`·`escapeHtml`.
 *
 * 서버 렌더가 심은 메타·JSON-LD 를 하이드레이션이 같은 규칙으로 다시 만들어 갈아끼우므로
 * 한 글자라도 다르면 렌더 전후로 값이 바뀐다. JSON-LD 는 `AttractionJsonLdParityTest` 가
 * copy.mjs 의 실제 출력과 비교한다. copy.mjs 를 고치면 여기도 고친다.
 *
 * JS 와 뜻이 같아야 하는 곳: `\s`·`trim()` 은 JS 에서 유니코드 공백을 포함한다 — [JS_SPACE] 로 맞춘다.
 *
 * 서버 렌더 말고 목록 응답의 overview 요약도 [sourceText] 로 평문화한다. 값 하나에 정규화는 한 번만 —
 * 태그 제거 → 엔티티 디코드 순서라 두 번 걸면 `&lt;PARASITE&gt;` 가 `<PARASITE>` 를 거쳐 지워진다.
 */
object AttractionSeoText {

    /** JS 정규식 `\s` · `String.prototype.trim` 이 공백으로 보는 문자 */
    private const val JS_SPACE = "\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF"

    private val CRLF = Regex("\r\n?")
    private val BR = Regex("<br[$JS_SPACE]*/?>", RegexOption.IGNORE_CASE)
    private val BLOCK_END = Regex("</(p|div|li)>", RegexOption.IGNORE_CASE)
    private val TAG = Regex("<[^>]*>")
    private val NAMED_ENTITY = Regex("&[a-zA-Z]+;")
    private val NUMERIC_ENTITY = Regex("&#(\\d{1,6});")
    private val TRAILING_BLANK = Regex("[ \t]+\n")
    private val EXTRA_NEWLINES = Regex("\n{3,}")
    private val SPACES = Regex("[$JS_SPACE]+")
    private val EDGE_SPACES = Regex("^[$JS_SPACE]+|[$JS_SPACE]+$")

    /** 관측된 엔티티만 푼다 — copy.mjs `ENTITIES` 와 같은 표. 모르는 엔티티는 그대로 둔다. */
    private val ENTITIES = mapOf(
        "&nbsp;" to " ", "&amp;" to "&", "&lt;" to "<", "&gt;" to ">", "&quot;" to "\"", "&apos;" to "'",
        "&lsquo;" to "‘", "&rsquo;" to "’", "&ldquo;" to "“", "&rdquo;" to "”",
        "&ndash;" to "–", "&mdash;" to "—", "&hellip;" to "…", "&middot;" to "·",
        "&deg;" to "°", "&eacute;" to "é", "&times;" to "×",
    )

    /** copy.mjs `DESC_MAX` */
    const val DESC_MAX = 155

    /**
     * 원천(TourAPI) 텍스트 → 평문. **태그 제거 → 엔티티 디코드** 순서다. 출력 직전에 [escapeHtml] 을
     * 거쳐야 한다 — 디코드된 `<script>` 는 이 단계에서 글자일 뿐이다.
     */
    fun sourceText(raw: String?): String {
        if (raw.isNullOrEmpty()) return ""
        var text = raw.replace(CRLF, "\n")
        text = text.replace(BR, "\n")
        text = text.replace(BLOCK_END, "\n")
        text = text.replace(TAG, "")
        text = NAMED_ENTITY.replace(text) { ENTITIES[it.value.lowercase()] ?: it.value }
        text = NUMERIC_ENTITY.replace(text) {
            val code = it.groupValues[1].toInt()
            // 제어문자는 되돌리지 않는다 — 보이지 않으면서 줄만 어그러뜨린다
            if (code in 32..0x10FFFF) String(Character.toChars(code)) else ""
        }
        text = text.replace(TRAILING_BLANK, "\n").replace(EXTRA_NEWLINES, "\n\n")
        return jsTrim(text)
    }

    fun clampDescription(text: String?, max: Int = DESC_MAX): String {
        val flat = jsTrim((text ?: "").replace(SPACES, " "))
        if (flat.length <= max) return flat
        val cut = flat.substring(0, max - 1)
        val lastSpace = cut.lastIndexOf(' ')
        return (if (lastSpace > max * 0.6) cut.substring(0, lastSpace) else cut).let(::jsTrim) + "…"
    }

    /**
     * 큰따옴표 속성값·요소 본문 전용. `'` 는 이스케이프하지 않으므로 작은따옴표 속성값이나
     * 스크립트 문자열 안에 넣으면 안전하지 않다.
     */
    fun escapeHtml(value: String?): String = (value ?: "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")

    fun jsTrim(value: String): String = value.replace(EDGE_SPACES, "")
}
