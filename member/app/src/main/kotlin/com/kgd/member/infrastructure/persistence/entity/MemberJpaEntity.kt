package com.kgd.member.infrastructure.persistence.entity

import com.kgd.member.domain.model.Member
import com.kgd.member.domain.model.MemberStatus
import com.kgd.member.domain.model.SsoProvider
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import java.time.LocalDateTime

@Entity
@Table(
    name = "members",
    uniqueConstraints = [
        UniqueConstraint(name = "uk_sso", columnNames = ["sso_provider", "sso_provider_id"])
    ]
)
class MemberJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(nullable = false, length = 255)
    val email: String,
    @Column(nullable = false, length = 100)
    var name: String,
    @Enumerated(EnumType.STRING)
    @Column(name = "sso_provider", nullable = false, length = 20)
    val ssoProvider: SsoProvider,
    @Column(name = "sso_provider_id", nullable = false, length = 255)
    val ssoProviderId: String,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: MemberStatus = MemberStatus.ACTIVE,
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    fun toDomain(): Member = Member.restore(
        id = id,
        email = email,
        name = name,
        ssoProvider = ssoProvider,
        ssoProviderId = ssoProviderId,
        status = status,
        createdAt = createdAt
    )

    companion object {
        fun fromDomain(member: Member) = MemberJpaEntity(
            id = member.id,
            email = member.email,
            name = member.name,
            ssoProvider = member.ssoProvider,
            ssoProviderId = member.ssoProviderId,
            status = member.status,
            createdAt = member.createdAt
        )
    }
}
