package com.kgd.search.infrastructure.indexing

/**
 * 블로그 본문(마크다운)을 색인용 평문으로. 코드 펜스·mermaid 펜스·HTML/SVG·링크 주소·기호를 벗긴다.
 *
 * 왜 벗기나: 코드와 SVG 좌표는 형태소 분석기에 잡음이고(`M12 4L20 12` 가 토큰이 된다),
 * 링크 주소는 글이 아니라 주소다. 표는 셀 텍스트만 남긴다.
 */
object MarkdownPlainText {

    private val FENCE = Regex("""```[\s\S]*?```""")
    private val HTML_BLOCK = Regex("""<(svg|style|script)\b[\s\S]*?</\1\s*>""", RegexOption.IGNORE_CASE)
    private val HTML_TAG = Regex("""<[^>]+>""")
    private val IMAGE = Regex("""!\[([^\]]*)]\([^)]*\)""")
    private val LINK = Regex("""\[([^\]]+)]\([^)]*\)""")
    private val FRONT_MATTER = Regex("""\A---\n[\s\S]*?\n---\n""")
    private val HEADING_OR_QUOTE = Regex("""^\s{0,3}(#{1,6}\s+|>\s?)""", RegexOption.MULTILINE)
    private val LIST_MARK = Regex("""^\s*(?:[-*+]|\d+\.)\s+""", RegexOption.MULTILINE)
    private val TABLE_RULE = Regex("""^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$""", RegexOption.MULTILINE)
    private val EMPHASIS = Regex("""[*_`~]{1,3}""")
    private val WHITESPACE = Regex("""[ \t]+""")
    private val BLANK_LINES = Regex("""\n{2,}""")

    fun of(markdown: String?): String? {
        if (markdown.isNullOrBlank()) return null
        val text = markdown
            .replace(FRONT_MATTER, "")
            .replace(FENCE, " ")
            .replace(HTML_BLOCK, " ")
            .replace(IMAGE, "$1")
            .replace(LINK, "$1")
            .replace(HTML_TAG, " ")
            .replace(TABLE_RULE, "")
            .replace(HEADING_OR_QUOTE, "")
            .replace(LIST_MARK, "")
            .replace("|", " ")
            .replace(EMPHASIS, "")
            .replace(WHITESPACE, " ")
            .replace(BLANK_LINES, "\n")
            .trim()
        return text.ifBlank { null }
    }
}
