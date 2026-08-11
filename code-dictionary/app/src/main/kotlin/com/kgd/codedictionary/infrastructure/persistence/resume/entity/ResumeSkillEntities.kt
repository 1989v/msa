package com.kgd.codedictionary.infrastructure.persistence.resume.entity

import com.kgd.codedictionary.domain.resume.model.ResumeSkill
import jakarta.persistence.Column
import jakarta.persistence.Embeddable
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.io.Serializable

@Entity
@Table(name = "resume_skill")
class ResumeSkillJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 80, unique = true)
    val name: String = "",

    groupId: Long? = null,
    orderNo: Int = 0,
) {
    /** null 이면 미분류 */
    @Column(name = "group_id")
    var groupId: Long? = groupId
        private set

    @Column(name = "order_no", nullable = false)
    var orderNo: Int = orderNo
        private set

    fun update(skill: ResumeSkill) {
        groupId = skill.groupId
        orderNo = skill.orderNo
    }

    fun toDomain() = ResumeSkill(id = id, name = name, groupId = groupId, orderNo = orderNo)

    companion object {
        fun fromDomain(skill: ResumeSkill) = ResumeSkillJpaEntity(
            id = skill.id,
            name = skill.name,
            groupId = skill.groupId,
            orderNo = skill.orderNo,
        )
    }
}

/**
 * 프로젝트 ↔ 기술 연결.
 *
 * 양쪽 모두 독립적으로 조회되므로 JPA 연관관계 대신 조인 행을 직접 다룬다
 * (jpa-persistence.md — FK-as-ID 정책).
 */
@Embeddable
data class ResumeProjectSkillId(
    @Column(name = "project_id") val projectId: Long = 0,
    @Column(name = "skill_id") val skillId: Long = 0,
) : Serializable

@Entity
@Table(name = "resume_project_skill")
class ResumeProjectSkillJpaEntity(
    @EmbeddedId
    val id: ResumeProjectSkillId = ResumeProjectSkillId(),
)
