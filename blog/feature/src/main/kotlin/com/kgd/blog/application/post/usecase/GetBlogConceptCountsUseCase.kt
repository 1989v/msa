package com.kgd.blog.application.post.usecase

import com.kgd.blog.application.post.dto.BlogConceptCount

/** 개념별 발행글 수 — `/tech` 아틀라스·도메인 그래프가 노드에 글 수를 붙인다 */
interface GetBlogConceptCountsUseCase {
    fun execute(): List<BlogConceptCount>
}
