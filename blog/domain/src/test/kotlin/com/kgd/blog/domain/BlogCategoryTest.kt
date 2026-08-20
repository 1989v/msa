package com.kgd.blog.domain

import com.kgd.blog.domain.model.BlogCategory
import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class BlogCategoryTest : BehaviorSpec({

    val tech = BlogCategory.newRoot("tech", "기술").copy(id = 1L)
    val server = BlogCategory.newChild(tech, "server", "서버").copy(id = 2L)

    given("계층을 만들 때") {

        then("경로가 부모 경로에 슬러그를 이어 붙인 값이다") {
            tech.path shouldBe "/tech"
            server.path shouldBe "/tech/server"
            BlogCategory.newChild(server, "search", "검색").path shouldBe "/tech/server/search"
        }

        then("깊이가 함께 올라간다") {
            tech.depth shouldBe 1
            server.depth shouldBe 2
            BlogCategory.newChild(server, "search", "검색").depth shouldBe 3
        }

        `when`("3단을 넘어서면") {
            then("거부한다 — 상한이 없으면 URL·브레드크럼·사이트맵으로 새어 나간다") {
                val search = BlogCategory.newChild(server, "search", "검색").copy(id = 3L)
                shouldThrow<BusinessException> { BlogCategory.newChild(search, "ranking", "랭킹") }
            }
        }

        `when`("저장되지 않은 부모 밑에 만들면") {
            then("거부한다") {
                shouldThrow<BusinessException> {
                    BlogCategory.newChild(BlogCategory.newRoot("life", "일상"), "hobby", "취미")
                }
            }
        }
    }

    given("경로가 슬러그·깊이와 어긋나면") {
        then("거부한다 — 어긋난 경로는 서브트리 조회를 조용히 비게 만든다") {
            shouldThrow<BusinessException> { server.copy(path = "/tech/servers") }
            shouldThrow<BusinessException> { server.copy(path = "/server") }
        }
    }

    given("서브트리를 조회할 때") {
        then("prefix 하나로 하위 전체를 덮는다") {
            tech.subtreePrefix() shouldBe "/tech/"
            server.segments() shouldBe listOf("tech", "server")
        }
    }
})
