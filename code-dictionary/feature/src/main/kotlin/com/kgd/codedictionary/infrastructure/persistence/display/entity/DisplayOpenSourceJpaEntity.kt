package com.kgd.codedictionary.infrastructure.persistence.display.entity

import com.kgd.codedictionary.domain.display.model.DisplayOpenSource
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "display_open_source")
class DisplayOpenSourceJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 60, unique = true)
    val slug: String = "",

    name: String = "",
    tagline: String = "",
    description: String? = null,
    repoUrl: String = "",
    language: String = "",
    orderNo: Int = 0,
    active: Boolean = true,
) {
    @Column(nullable = false, length = 100)
    var name: String = name
        private set

    @Column(nullable = false, length = 200)
    var tagline: String = tagline
        private set

    @Column(length = 500)
    var description: String? = description
        private set

    @Column(name = "repo_url", nullable = false, length = 300)
    var repoUrl: String = repoUrl
        private set

    @Column(nullable = false, length = 40)
    var language: String = language
        private set

    @Column(name = "order_no", nullable = false)
    var orderNo: Int = orderNo
        private set

    @Column(nullable = false)
    var active: Boolean = active
        private set

    fun toDomain() = DisplayOpenSource(
        id = id,
        slug = slug,
        name = name,
        tagline = tagline,
        description = description,
        repoUrl = repoUrl,
        language = language,
        orderNo = orderNo,
        active = active,
    )
}
