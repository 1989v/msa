package com.kgd.codedictionary.infrastructure.persistence.resume.adapter

import com.kgd.codedictionary.application.resume.port.ResumeCategoryRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeCompanyRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeProjectRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeSkillGroupRepositoryPort
import com.kgd.codedictionary.domain.resume.model.ResumeCategory
import com.kgd.codedictionary.domain.resume.model.ResumeCompany
import com.kgd.codedictionary.domain.resume.model.ResumeProject
import com.kgd.codedictionary.domain.resume.model.ResumeSkillGroup
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeCategoryJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeCompanyJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeProjectJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeSkillGroupJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.repository.ResumeCategoryJpaRepository
import com.kgd.codedictionary.infrastructure.persistence.resume.repository.ResumeCompanyJpaRepository
import com.kgd.codedictionary.infrastructure.persistence.resume.repository.ResumeProjectJpaRepository
import com.kgd.codedictionary.infrastructure.persistence.resume.repository.ResumeSkillGroupJpaRepository
import com.kgd.common.exception.NotFoundException
import org.springframework.stereotype.Component

@Component
class ResumeCategoryRepositoryAdapter(
    private val jpaRepository: ResumeCategoryJpaRepository,
) : ResumeCategoryRepositoryPort {

    override fun findAll(): List<ResumeCategory> =
        jpaRepository.findAllByOrderByOrderNoAsc().map(ResumeCategoryJpaEntity::toDomain)

    override fun save(category: ResumeCategory): ResumeCategory {
        val existing = category.id?.let { jpaRepository.findById(it).orElse(null) }
            ?: jpaRepository.findByCode(category.code)
        return if (existing == null) {
            jpaRepository.save(ResumeCategoryJpaEntity.fromDomain(category)).toDomain()
        } else {
            existing.update(category)
            existing.toDomain()
        }
    }

    override fun delete(id: Long) = jpaRepository.deleteById(id)
}

@Component
class ResumeCompanyRepositoryAdapter(
    private val jpaRepository: ResumeCompanyJpaRepository,
) : ResumeCompanyRepositoryPort {

    override fun findAll(): List<ResumeCompany> =
        jpaRepository.findAllByOrderByStartMonthDesc().map(ResumeCompanyJpaEntity::toDomain)

    override fun save(company: ResumeCompany): ResumeCompany {
        val existing = company.id?.let {
            jpaRepository.findById(it).orElseThrow { NotFoundException("ResumeCompany", it) }
        }
        return if (existing == null) {
            jpaRepository.save(ResumeCompanyJpaEntity.fromDomain(company)).toDomain()
        } else {
            existing.update(company)
            existing.toDomain()
        }
    }

    override fun delete(id: Long) = jpaRepository.deleteById(id)
}

@Component
class ResumeProjectRepositoryAdapter(
    private val jpaRepository: ResumeProjectJpaRepository,
) : ResumeProjectRepositoryPort {

    override fun findAll(): List<ResumeProject> =
        jpaRepository.findAllByOrderByOrderNoAsc().map(ResumeProjectJpaEntity::toDomain)

    override fun findAllPublished(): List<ResumeProject> =
        jpaRepository.findAllByPublishedTrueOrderByOrderNoAsc().map(ResumeProjectJpaEntity::toDomain)

    override fun findAllPublishedPersonal(): List<ResumeProject> =
        jpaRepository.findAllByPublishedTrueAndCompanyIdIsNullOrderByOrderNoAsc()
            .map(ResumeProjectJpaEntity::toDomain)

    override fun save(project: ResumeProject): ResumeProject {
        val existing = project.id?.let {
            jpaRepository.findById(it).orElseThrow { NotFoundException("ResumeProject", it) }
        }
        return if (existing == null) {
            jpaRepository.save(ResumeProjectJpaEntity.fromDomain(project)).toDomain()
        } else {
            existing.update(project)
            existing.toDomain()
        }
    }

    override fun delete(id: Long) = jpaRepository.deleteById(id)
}

@Component
class ResumeSkillGroupRepositoryAdapter(
    private val jpaRepository: ResumeSkillGroupJpaRepository,
) : ResumeSkillGroupRepositoryPort {

    override fun findAll(): List<ResumeSkillGroup> =
        jpaRepository.findAllByOrderByOrderNoAsc().map(ResumeSkillGroupJpaEntity::toDomain)

    override fun save(group: ResumeSkillGroup): ResumeSkillGroup {
        val existing = group.id?.let {
            jpaRepository.findById(it).orElseThrow { NotFoundException("ResumeSkillGroup", it) }
        }
        return if (existing == null) {
            jpaRepository.save(ResumeSkillGroupJpaEntity.fromDomain(group)).toDomain()
        } else {
            existing.update(group)
            existing.toDomain()
        }
    }

    override fun delete(id: Long) = jpaRepository.deleteById(id)
}

@Component
class ResumeSkillRepositoryAdapter(
    private val jpaRepository: com.kgd.codedictionary.infrastructure.persistence.resume.repository.ResumeSkillJpaRepository,
) : com.kgd.codedictionary.application.resume.port.ResumeSkillRepositoryPort {

    override fun findAll(): List<com.kgd.codedictionary.domain.resume.model.ResumeSkill> =
        jpaRepository.findAllByOrderByOrderNoAsc()
            .map(com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeSkillJpaEntity::toDomain)

    override fun save(
        skill: com.kgd.codedictionary.domain.resume.model.ResumeSkill,
    ): com.kgd.codedictionary.domain.resume.model.ResumeSkill {
        val existing = skill.id?.let {
            jpaRepository.findById(it).orElseThrow { NotFoundException("ResumeSkill", it) }
        }
        return if (existing == null) {
            jpaRepository.save(
                com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeSkillJpaEntity.fromDomain(skill),
            ).toDomain()
        } else {
            existing.update(skill)
            existing.toDomain()
        }
    }

    override fun delete(id: Long) = jpaRepository.deleteById(id)
}

@Component
class ResumeProjectSkillRepositoryAdapter(
    private val jpaRepository: com.kgd.codedictionary.infrastructure.persistence.resume.repository.ResumeProjectSkillJpaRepository,
) : com.kgd.codedictionary.application.resume.port.ResumeProjectSkillRepositoryPort {

    override fun skillIdsByProject(): Map<Long, List<Long>> =
        jpaRepository.findAll()
            .groupBy({ it.id.projectId }, { it.id.skillId })

    override fun replace(projectId: Long, skillIds: List<Long>) {
        jpaRepository.deleteAllByIdProjectId(projectId)
        if (skillIds.isEmpty()) return
        jpaRepository.saveAll(
            skillIds.distinct().map {
                com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeProjectSkillJpaEntity(
                    com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeProjectSkillId(projectId, it),
                )
            },
        )
    }
}
