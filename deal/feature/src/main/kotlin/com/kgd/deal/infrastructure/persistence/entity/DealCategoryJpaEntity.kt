package com.kgd.deal.infrastructure.persistence.entity

import com.kgd.deal.domain.model.DealCategory
import com.kgd.deal.domain.model.DisplayStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "deal_category")
class DealCategoryJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 40, unique = true)
    val code: String = "",

    label: String = "",
    tagline: String? = null,
    status: DisplayStatus = DisplayStatus.OPEN,
    orderNo: Int = 0,
) {
    @Column(nullable = false, length = 80)
    var label: String = label
        private set

    @Column(length = 200)
    var tagline: String? = tagline
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var status: DisplayStatus = status
        private set

    @Column(name = "order_no", nullable = false)
    var orderNo: Int = orderNo
        private set

    fun update(category: DealCategory) {
        label = category.label
        tagline = category.tagline
        status = category.status
        orderNo = category.orderNo
    }

    fun toDomain() = DealCategory(
        id = id,
        code = code,
        label = label,
        tagline = tagline,
        status = status,
        orderNo = orderNo,
    )

    companion object {
        fun fromDomain(category: DealCategory) = DealCategoryJpaEntity(
            id = category.id,
            code = category.code,
            label = category.label,
            tagline = category.tagline,
            status = category.status,
            orderNo = category.orderNo,
        )
    }
}
