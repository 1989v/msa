package com.kgd.blog.application.shortlink.service

import com.kgd.blog.application.post.port.BlogPostRepositoryPort
import com.kgd.blog.application.shortlink.port.BlogShortLinkClick
import com.kgd.blog.application.shortlink.port.BlogShortLinkClickRepositoryPort
import com.kgd.blog.application.shortlink.usecase.PurgeBlogShortLinkClicksUseCase
import com.kgd.blog.application.shortlink.usecase.RecordBlogShortLinkClickUseCase
import com.kgd.blog.application.shortlink.usecase.ResolveBlogShortLinkUseCase
import com.kgd.blog.application.shortlink.usecase.ResolveBlogShortLinkUseCase.Outcome
import com.kgd.blog.application.shortlink.usecase.ResolveBlogShortLinkUseCase.Resolution
import com.kgd.blog.domain.model.PostStatus
import com.kgd.common.shortlink.ClickContext
import com.kgd.common.shortlink.ShortCode
import com.kgd.common.shortlink.ShortLinkPath
import com.kgd.common.shortlink.ShortLinkPrefix
import com.kgd.common.shortlink.ShortLinks
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

/**
 * 블로그 글 단축 주소 `/b/{code}` (ADR-0106).
 *
 * 열 수 있는지는 [PostStatus.publiclyVisible] 이 정한다. 목적지는 `blog.1989v.com/posts/{slug}` 이고,
 * 코드는 글 id 에서 나오므로 슬러그와 무관하다.
 *
 * 트랜잭션 관리자를 전부 명시한다 — content 호스트의 기본 TM 은 place 것이라, 빠지면 blog 쓰기가 조용히 사라진다.
 */
@Service
class BlogShortLinkService(
    private val postRepository: BlogPostRepositoryPort,
    private val clickRepository: BlogShortLinkClickRepositoryPort,
    private val shortLinks: ShortLinks,
) : ResolveBlogShortLinkUseCase, RecordBlogShortLinkClickUseCase, PurgeBlogShortLinkClicksUseCase {

    @Transactional(transactionManager = "blogTransactionManager", readOnly = true)
    override fun execute(path: String): Resolution {
        val code = when (val parsed = ShortLinkPath.parse(path)) {
            ShortLinkPath.Home -> return home(Outcome.HOME)
            ShortLinkPath.Invalid -> return home(Outcome.MALFORMED)
            is ShortLinkPath.Code -> parsed.value
        }
        val postId = ShortCode.decode(code) ?: return home(Outcome.MALFORMED)
        val post = postRepository.findById(postId) ?: return home(Outcome.NOT_FOUND, postId)
        if (!post.status.publiclyVisible) return home(Outcome.NOT_PUBLIC, postId)
        return Resolution(Outcome.RESOLVED, postId, shortLinks.destination(ShortLinkPrefix.BLOG, POSTS_PATH, post.slug))
    }

    /** 조회 트랜잭션과 분리해 실패가 302 로 번지지 않게 한다. */
    @Transactional(transactionManager = "blogTransactionManager", propagation = Propagation.REQUIRES_NEW)
    override fun execute(command: RecordBlogShortLinkClickUseCase.Command) {
        clickRepository.record(
            BlogShortLinkClick(
                postId = command.postId,
                clickedAt = LocalDateTime.now(),
                referrerHost = ClickContext.referrerHost(command.referrer),
                uaFamily = ClickContext.uaFamily(command.userAgent),
            ),
        )
    }

    @Transactional(transactionManager = "blogTransactionManager")
    override fun olderThan(days: Long): Int = clickRepository.purgeOlderThan(LocalDateTime.now().minusDays(days))

    private fun home(outcome: Outcome, postId: Long? = null) =
        Resolution(outcome, postId, shortLinks.home(ShortLinkPrefix.BLOG))

    companion object {
        /** blog FE 의 글 상세 경로 첫 세그먼트 */
        private const val POSTS_PATH = "posts"
    }
}
