package com.kgd.blog.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table
import java.io.Serializable

data class BlogPostConceptKey(val postId: Long = 0, val conceptId: String = "") : Serializable

@Entity
@Table(name = "blog_post_concept")
@IdClass(BlogPostConceptKey::class)
class BlogPostConceptJpaEntity(
    @Id
    @Column(name = "post_id", nullable = false)
    val postId: Long = 0,

    @Id
    @Column(name = "concept_id", nullable = false, length = 100)
    val conceptId: String = "",

    @Column(name = "ordinal", nullable = false)
    val ordinal: Int = 0,
)
