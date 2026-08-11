package com.kgd.codedictionary.infrastructure.persistence.resume.repository

import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeCategoryJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeCompanyJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeProjectJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeSkillGroupJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface ResumeCategoryJpaRepository : JpaRepository<ResumeCategoryJpaEntity, Long> {
    fun findAllByOrderByOrderNoAsc(): List<ResumeCategoryJpaEntity>
    fun findByCode(code: String): ResumeCategoryJpaEntity?
}

interface ResumeCompanyJpaRepository : JpaRepository<ResumeCompanyJpaEntity, Long> {
    fun findAllByOrderByOrderNoAsc(): List<ResumeCompanyJpaEntity>
}

interface ResumeProjectJpaRepository : JpaRepository<ResumeProjectJpaEntity, Long> {
    fun findAllByOrderByOrderNoAsc(): List<ResumeProjectJpaEntity>
    fun findAllByPublishedTrueOrderByOrderNoAsc(): List<ResumeProjectJpaEntity>
}

interface ResumeSkillGroupJpaRepository : JpaRepository<ResumeSkillGroupJpaEntity, Long> {
    fun findAllByOrderByOrderNoAsc(): List<ResumeSkillGroupJpaEntity>
}
