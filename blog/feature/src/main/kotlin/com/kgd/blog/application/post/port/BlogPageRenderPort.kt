package com.kgd.blog.application.post.port

import com.kgd.blog.application.post.dto.BlogAuthorSpace
import com.kgd.blog.application.post.dto.BlogPostDetail

/**
 * 공유되는 주소의 HTML 을 만드는 두 조각 (ADR-0072 §6).
 *
 * 셸은 portal-fe 의 실제 index.html 을 받아오는 외부 IO 라 포트 뒤에 둔다 — 받지 못하면 null 이고,
 * 렌더러는 그때 최소 HTML 로 떨어진다(메타가 조용히 빠지는 것보다 낫다).
 */
interface BlogShellPort {
    fun shell(): String?
}

interface BlogPageRenderPort {
    fun postPage(shell: String?, detail: BlogPostDetail): String
    fun authorPage(shell: String?, space: BlogAuthorSpace): String
    fun notFoundPage(shell: String?): String
}
