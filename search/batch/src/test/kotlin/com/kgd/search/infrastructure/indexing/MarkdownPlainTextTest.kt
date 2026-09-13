package com.kgd.search.infrastructure.indexing

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain

class MarkdownPlainTextTest : BehaviorSpec({

    given("코드 펜스 · mermaid · SVG · 링크가 섞인 블로그 본문") {
        val markdown = """
            ---
            title: 제목
            ---
            # 검색 인제스트

            원천에서 색인까지 **세 단계**다. [플랜](https://example.com/plan) 참고.

            ```mermaid
            %% caption: 흐름
            flowchart LR
              A --> B
            ```

            ```kotlin
            val x = QueryIntent.analyze("해수욕장")
            ```

            <svg viewBox="0 0 24 24"><path d="M12 4L20 12"/></svg>

            | 키워드 | 뜻 |
            |---|---|
            | 풀스캔 | 원천 전량을 다시 받는다 |

            - 증분 · 백필
            > 인용문
        """.trimIndent()

        `when`("평문으로 바꾸면") {
            val text = MarkdownPlainText.of(markdown)!!

            then("본문 글과 표 셀·목록 텍스트는 남는다") {
                text shouldContain "원천에서 색인까지 세 단계다. 플랜 참고."
                text shouldContain "풀스캔"
                text shouldContain "원천 전량을 다시 받는다"
                text shouldContain "증분 · 백필"
                text shouldContain "인용문"
            }
            then("코드·다이어그램·SVG·링크 주소·front matter 는 사라진다") {
                text shouldNotContain "QueryIntent"
                text shouldNotContain "flowchart"
                text shouldNotContain "M12 4L20 12"
                text shouldNotContain "example.com"
                text shouldNotContain "title: 제목"
                text shouldNotContain "#"
                text shouldNotContain "|"
            }
        }
    }

    given("빈 본문") {
        then("null 이다") {
            MarkdownPlainText.of(null) shouldBe null
            MarkdownPlainText.of("   ") shouldBe null
            MarkdownPlainText.of("```\nonly code\n```") shouldBe null
        }
    }
})
