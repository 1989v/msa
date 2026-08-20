package com.kgd.blog.domain.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/**
 * 계층 카테고리 (예: `기술 > 서버 > 검색`).
 *
 * 인접 리스트(`parentId`)에 물질화 경로(`path`)를 더한다. 서브트리 조회는 `path` prefix
 * 하나로 끝나고, 부모가 바뀌면 하위의 `path` 를 다시 쓴다 — 읽기가 쓰기보다 압도적으로
 * 잦은 구조라 쓰기 쪽에 비용을 몰아 둔다.
 */
data class BlogCategory(
    val id: Long?,
    val parentId: Long?,
    val slug: String,
    val name: String,
    val description: String?,
    val depth: Int,
    val path: String,
    val orderNo: Int,
    val status: CategoryStatus,
) {
    init {
        if (!SLUG_PATTERN.matches(slug)) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "카테고리 슬러그 형식이 올바르지 않습니다: $slug")
        }
        if (name.isBlank() || name.length > MAX_NAME) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "카테고리 이름은 1~$MAX_NAME 자여야 합니다")
        }
        if (depth !in 1..MAX_DEPTH) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "카테고리는 최대 ${MAX_DEPTH}단까지입니다")
        }
        if (depth == 1 && parentId != null) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "1단 카테고리는 부모를 가질 수 없습니다")
        }
        if (depth > 1 && parentId == null) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "${depth}단 카테고리는 부모가 필요합니다")
        }
        val segments = path.trim('/').split('/')
        if (!path.startsWith("/") || segments.size != depth || segments.last() != slug) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "카테고리 경로가 슬러그·깊이와 어긋납니다: $path")
        }
    }

    /** 이 카테고리와 모든 하위를 포함하는 prefix — 목록 조회가 이 한 값으로 서브트리를 긁는다 */
    fun subtreePrefix(): String = "$path/"

    /** `/tech/server/search` → `["tech", "server", "search"]` (브레드크럼 조립용) */
    fun segments(): List<String> = path.trim('/').split('/')

    companion object {
        /**
         * 요구가 3단(`기술 > 서버 > 검색`)이다. 상한이 없으면 어드민에서 실수로 만든 5단이
         * URL·브레드크럼·사이트맵에 그대로 새어 나간다.
         */
        const val MAX_DEPTH = 3
        const val MAX_NAME = 60
        private val SLUG_PATTERN = Regex("^[a-z0-9][a-z0-9-]{0,59}$")

        /** 스키마 시드와 같은 규칙이어야 한다 — 어긋나면 시드 데이터가 검증에서 튕긴다 */
        fun pathOf(parentPath: String?, slug: String): String =
            if (parentPath.isNullOrBlank()) "/$slug" else "$parentPath/$slug"

        fun newRoot(slug: String, name: String, description: String? = null, orderNo: Int = 0) =
            BlogCategory(
                id = null,
                parentId = null,
                slug = slug,
                name = name,
                description = description,
                depth = 1,
                path = pathOf(null, slug),
                orderNo = orderNo,
                status = CategoryStatus.OPEN,
            )

        fun newChild(
            parent: BlogCategory,
            slug: String,
            name: String,
            description: String? = null,
            orderNo: Int = 0,
        ): BlogCategory {
            val parentId = parent.id
                ?: throw BusinessException(ErrorCode.INVALID_INPUT, "저장되지 않은 카테고리의 하위를 만들 수 없습니다")
            return BlogCategory(
                id = null,
                parentId = parentId,
                slug = slug,
                name = name,
                description = description,
                depth = parent.depth + 1,
                path = pathOf(parent.path, slug),
                orderNo = orderNo,
                status = CategoryStatus.OPEN,
            )
        }
    }
}
