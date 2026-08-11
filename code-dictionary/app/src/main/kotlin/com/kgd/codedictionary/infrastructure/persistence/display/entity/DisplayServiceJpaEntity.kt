package com.kgd.codedictionary.infrastructure.persistence.display.entity

import com.kgd.codedictionary.domain.display.model.DisplayService
import com.kgd.codedictionary.domain.display.model.DisplayStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "display_service")
class DisplayServiceJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 40, unique = true)
    val code: String = "",

    label: String = "",
    tagline: String? = null,
    href: String? = null,
    status: DisplayStatus = DisplayStatus.PREOPEN,
    orderNo: Int = 0,
) {
    @Column(nullable = false, length = 80)
    var label: String = label
        private set

    @Column(length = 200)
    var tagline: String? = tagline
        private set

    @Column(length = 300)
    var href: String? = href
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var status: DisplayStatus = status
        private set

    @Column(name = "order_no", nullable = false)
    var orderNo: Int = orderNo
        private set

    fun update(service: DisplayService) {
        label = service.label
        tagline = service.tagline
        href = service.href
        status = service.status
        orderNo = service.orderNo
    }

    fun toDomain() = DisplayService(
        id = id,
        code = code,
        label = label,
        tagline = tagline,
        href = href,
        status = status,
        orderNo = orderNo,
    )

    companion object {
        fun fromDomain(service: DisplayService) = DisplayServiceJpaEntity(
            id = service.id,
            code = service.code,
            label = service.label,
            tagline = service.tagline,
            href = service.href,
            status = service.status,
            orderNo = service.orderNo,
        )
    }
}
