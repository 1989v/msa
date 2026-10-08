package com.kgd.blog.application

import com.kgd.blog.application.category.port.BlogCategoryRepositoryPort
import com.kgd.blog.application.post.port.BlogPostRepositoryPort
import com.kgd.blog.application.post.service.BlogAssembler
import com.kgd.blog.application.post.service.BlogQueryService
import com.kgd.blog.application.post.usecase.GetBlogPostUseCase
import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.application.profile.port.BlogProfileRepositoryPort
import com.kgd.blog.domain.model.BlogPost
import com.kgd.blog.domain.model.PostStatus
import com.kgd.common.shortlink.ShortCode
import com.kgd.common.shortlink.ShortLinkProperties
import com.kgd.common.shortlink.ShortLinks
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith
import io.mockk.every
import io.mockk.mockk
import java.time.LocalDateTime

/** 공개 글 상세 응답의 `shortUrl` — 실제 상세 조회 서비스가 내놓은 값을 본다. */
class BlogShortLinkDetailTest : BehaviorSpec({

    val postId = 5150L
    val guest = BlogIdentity(memberId = null, isAdmin = false, visitorId = null)

    fun queryService(shortLinks: ShortLinks): BlogQueryService {
        val posts = mockk<BlogPostRepositoryPort>()
        val categories = mockk<BlogCategoryRepositoryPort>()
        val profiles = mockk<BlogProfileRepositoryPort>()
        every { posts.findBySlug("search-relevance-notes") } returns BlogPost(
            id = postId, authorProfileId = 1, categoryId = 1, slug = "search-relevance-notes",
            title = "제목", summary = null, body = "본문", coverImageUrl = null,
            status = PostStatus.PUBLISHED, publishedAt = LocalDateTime.now(),
        )
        every { profiles.findById(any()) } returns null
        every { categories.findById(any()) } returns null
        return BlogQueryService(
            posts, categories, profiles, mockk(), mockk(),
            BlogAssembler(profiles, categories), shortLinks,
        )
    }

    given("단축 주소 노출이 켜져 있으면") {
        val detail = queryService(ShortLinks(ShortLinkProperties(expose = true)))
            .execute(GetBlogPostUseCase.Query("search-relevance-notes", guest))

        then("shortUrl 이 apex /b/ 로 시작하고, 코드를 디코딩하면 그 글 id 다") {
            val shortUrl = requireNotNull(detail.shortUrl)
            shortUrl shouldStartWith "https://1989v.com/b/"
            ShortCode.decode(shortUrl.removePrefix("https://1989v.com/b/")) shouldBe postId
        }
    }

    given("단축 주소 노출이 꺼져 있으면") {
        val detail = queryService(ShortLinks(ShortLinkProperties()))
            .execute(GetBlogPostUseCase.Query("search-relevance-notes", guest))

        then("shortUrl 을 싣지 않는다") {
            detail.shortUrl.shouldBeNull()
        }
    }
})
