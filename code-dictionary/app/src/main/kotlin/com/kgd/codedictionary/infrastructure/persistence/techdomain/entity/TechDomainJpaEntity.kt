package com.kgd.codedictionary.infrastructure.persistence.techdomain.entity

import com.kgd.codedictionary.domain.techdomain.model.TechDomain
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.OneToMany
import jakarta.persistence.OrderBy
import jakarta.persistence.Table

@Entity
@Table(name = "tech_domain")
class TechDomainJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 40, unique = true)
    val code: String = "",

    label: String = "",
    tagline: String? = null,
    orderNo: Int = 0,
    active: Boolean = true,

    // 도메인 애그리거트 내부 컴포지션이라 객체로 맺는다. LAZY 는 컨벤션이고,
    // N+1 은 리포지토리의 @EntityGraph 가 한 번에 걷어온다.
    @OneToMany(mappedBy = "domain", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("orderNo ASC")
    val concepts: MutableList<TechDomainConceptJpaEntity> = mutableListOf(),
) {
    @Column(nullable = false, length = 80)
    var label: String = label
        private set

    @Column(length = 200)
    var tagline: String? = tagline
        private set

    @Column(name = "order_no", nullable = false)
    var orderNo: Int = orderNo
        private set

    @Column(nullable = false)
    var active: Boolean = active
        private set

    fun toDomain() = TechDomain(
        id = id,
        code = code,
        label = label,
        tagline = tagline,
        orderNo = orderNo,
        active = active,
        conceptIds = concepts.map { it.conceptId },
    )
}
