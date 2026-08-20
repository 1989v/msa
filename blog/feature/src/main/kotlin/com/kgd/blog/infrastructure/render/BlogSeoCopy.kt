package com.kgd.blog.infrastructure.render

import com.kgd.blog.application.dto.BlogAuthorSummary
import com.kgd.blog.application.dto.BlogPostSummary

/**
 * 블로그 SEO 카피의 서버 쪽 사본.
 *
 * 원본은 `portal-fe/src/seo/copy.mjs` 다 — 런타임 훅(useSeo)과 빌드타임 프리렌더가 그것을
 * 쓰고, 여기(서버 렌더)가 같은 문구를 만들어야 크롤러가 본 색인 결과와 SPA 전환 후 탭
 * 타이틀이 어긋나지 않는다. 문구를 고칠 때는 **두 곳을 함께** 고친다.
 */
object BlogSeoCopy {

    const val BRAND = "1989v 블로그"

    /** meta description 상한 — 검색결과 스니펫이 잘리는 지점 */
    const val DESC_MAX = 155

    fun clamp(text: String, max: Int = DESC_MAX): String {
        val flat = text.replace(Regex("\\s+"), " ").trim()
        if (flat.length <= max) return flat
        return flat.take(max - 1).trimEnd() + "…"
    }

    fun postTitle(post: BlogPostSummary): String = "${post.title} | $BRAND"

    fun postDescription(post: BlogPostSummary): String = clamp(post.summary)

    fun authorTitle(author: BlogAuthorSummary): String = "${author.displayName}의 글 | $BRAND"

    fun authorDescription(author: BlogAuthorSummary, postCount: Long): String =
        clamp(author.bio?.takeIf { it.isNotBlank() } ?: "${author.displayName}이(가) 쓴 글 ${postCount}편")

    fun postUrl(origin: String, slug: String): String = "$origin/posts/$slug"

    fun authorUrl(origin: String, handle: String): String = "$origin/authors/$handle"

    fun categoryUrl(origin: String, path: String): String = "$origin/c${path}"
}
