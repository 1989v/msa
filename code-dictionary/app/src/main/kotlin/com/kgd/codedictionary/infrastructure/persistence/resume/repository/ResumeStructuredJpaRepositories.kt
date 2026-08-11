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

    /** 공개 타임라인용 — 회사 소속 프로젝트는 여기로 나오지 않는다 (ADR-0066) */
    fun findAllByPublishedTrueAndCompanyIdIsNullOrderByOrderNoAsc(): List<ResumeProjectJpaEntity>
}

interface ResumeSkillGroupJpaRepository : JpaRepository<ResumeSkillGroupJpaEntity, Long> {
    fun findAllByOrderByOrderNoAsc(): List<ResumeSkillGroupJpaEntity>
}
