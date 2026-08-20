package com.kgd.blog.infrastructure.persistence.entity

import com.kgd.blog.domain.model.BlogCategory
import com.kgd.blog.domain.model.CategoryStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "blog_category")
class BlogCategoryJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    parentId: Long? = null,
    slug: String = "",
    name: String = "",
    description: String? = null,
    depth: Int = 1,
    path: String = "",
    orderNo: Int = 0,
    status: CategoryStatus = CategoryStatus.OPEN,
) {
    @Column(name = "parent_id")
    var parentId: Long? = parentId
        private set

    @Column(nullable = false, length = 60)
    var slug: String = slug
        private set

    @Column(nullable = false, length = 60)
    var name: String = name
        private set

    @Column(length = 300)
    var description: String? = description
        private set

    @Column(nullable = false)
    var depth: Int = depth
        private set

    @Column(nullable = false, length = 200)
    var path: String = path
        private set

    @Column(name = "order_no", nullable = false)
    var orderNo: Int = orderNo
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var status: CategoryStatus = status
        private set

    @Column(name = "created_at", insertable = false, updatable = false)
    var createdAt: LocalDateTime? = null
        private set

    @Column(name = "updated_at", insertable = false, updatable = false)
    var updatedAt: LocalDateTime? = null
        private set

    /** 도메인이 조립한 값의 전체 동기화 — 경로·깊이는 도메인이 계산해 온다 */
    fun update(category: BlogCategory) {
        parentId = category.parentId
        slug = category.slug
        name = category.name
        description = category.description
        depth = category.depth
        path = category.path
        orderNo = category.orderNo
        status = category.status
    }

    /**
     * 부모가 바뀌어 하위 경로를 다시 쓸 때만 쓰는 부분 수정.
     * 이름·설명까지 함께 덮으면 재부모화가 조용히 다른 값을 되돌린다.
     */
    fun relocate(parentId: Long?, depth: Int, path: String) {
        this.parentId = parentId
        this.depth = depth
        this.path = path
    }

    fun toDomain() = BlogCategory(
        id = id,
        parentId = parentId,
        slug = slug,
        name = name,
        description = description,
        depth = depth,
        path = path,
        orderNo = orderNo,
        status = status,
    )
}
