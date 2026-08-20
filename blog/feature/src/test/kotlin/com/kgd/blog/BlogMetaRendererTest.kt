package com.kgd.blog

import com.kgd.blog.application.dto.BlogAuthorSummary
import com.kgd.blog.application.dto.BlogCrumb
import com.kgd.blog.application.dto.BlogPostDetail
import com.kgd.blog.application.dto.BlogPostSummary
import com.kgd.blog.domain.model.PostStatus
import com.kgd.blog.infrastructure.render.BlogMetaRenderer
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import tools.jackson.databind.ObjectMapper
import java.time.LocalDateTime

class BlogMetaRendererTest : BehaviorSpec({

    val renderer = BlogMetaRenderer("https://blog.1989v.com", ObjectMapper())

    val shell = """
        <!doctype html>
        <html lang="ko">
          <head>
            <!--seo:start-->
            <title>기본</title>
            <!--seo:end-->
          </head>
          <body><div id="root"></div><script src="/assets/index-abc123.js"></script></body>
        </html>
    """.trimIndent()

    fun detail(body: String = "본문입니다", title: String = "검색 색인 이야기") = BlogPostDetail(
        post = BlogPostSummary(
            id = 1, slug = "search-index", title = title, summary = "요약입니다",
            coverImageUrl = "https://cdn.example.com/cover.png",
            categoryPath = "/tech/server/search", categoryName = "검색",
            author = BlogAuthorSummary("kgd", "권기덕", null, "백엔드"),
            status = PostStatus.PUBLISHED, publishedAt = LocalDateTime.of(2026, 8, 21, 9, 0),
            readingMinutes = 3, viewCount = 10, likeCount = 2, commentCount = 1,
            ratingAverage = 4.5, ratingCount = 4,
        ),
        body = body,
        breadcrumb = listOf(BlogCrumb("기술", "/tech"), BlogCrumb("서버", "/tech/server")),
        liked = false,
        myScore = null,
    )

    given("셸이 정상일 때") {
        val html = renderer.postPage(shell, detail())

        then("기본 메타 블록이 글의 메타로 갈린다") {
            html shouldContain "<title>검색 색인 이야기 | 1989v 블로그</title>"
            html shouldNotContain "<title>기본</title>"
            html shouldContain """<link rel="canonical" href="https://blog.1989v.com/posts/search-index" />"""
            html shouldContain """<meta property="og:image" content="https://cdn.example.com/cover.png" />"""
        }

        then("자산 스크립트가 그대로 남는다 — SPA 가 이 위에서 마운트된다") {
            html shouldContain "/assets/index-abc123.js"
        }

        then("크롤러용 본문이 #root 안에 들어간다") {
            html shouldContain "<div id=\"root\">"
            html shouldContain "본문입니다"
        }

        then("구조화 데이터가 붙는다") {
            html shouldContain "\"@type\":\"BlogPosting\""
            html shouldContain "\"@type\":\"BreadcrumbList\""
            html shouldContain "\"ratingValue\":\"4.5\""
        }
    }

    given("본문에 raw HTML 이 섞여 있을 때") {
        val html = renderer.postPage(shell, detail(body = "<script>alert(1)</script> 안녕"))

        then("이스케이프한다 — 크롤러용 사본에 실행 경로를 만들지 않는다") {
            html shouldContain "&lt;script&gt;alert(1)&lt;/script&gt;"
            html.contains("<script>alert(1)</script>") shouldBe false
        }
    }

    given("셸을 받지 못했을 때") {
        val html = renderer.postPage(null, detail())

        then("SPA 없이도 글이 읽히는 최소 HTML 을 낸다") {
            html shouldContain "<title>검색 색인 이야기 | 1989v 블로그</title>"
            html shouldContain "본문입니다"
        }
    }

    given("없는 글일 때") {
        val html = renderer.notFoundPage(shell)

        then("색인은 막되 크롤은 열어 둔다") {
            html shouldContain """<meta name="robots" content="noindex, follow" />"""
        }
    }
})
