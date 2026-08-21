package com.kgd.codedictionary.infrastructure.persistence.resume.repository

import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeCategoryJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeCodeSnippetJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeCompanyJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeProjectJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeProjectSkillJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeSkillGroupJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeSkillJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface ResumeCategoryJpaRepository : JpaRepository<ResumeCategoryJpaEntity, Long> {
    fun findAllByOrderByOrderNoAsc(): List<ResumeCategoryJpaEntity>
    fun findByCode(code: String): ResumeCategoryJpaEntity?
}

interface ResumeCompanyJpaRepository : JpaRepository<ResumeCompanyJpaEntity, Long> {
    /** 경력 표는 최신순이 관례다 — 시작월이 순서를 결정한다 */
    fun findAllByOrderByStartMonthDesc(): List<ResumeCompanyJpaEntity>
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

interface ResumeSkillJpaRepository : JpaRepository<ResumeSkillJpaEntity, Long> {
    fun findAllByOrderByOrderNoAsc(): List<ResumeSkillJpaEntity>
    fun findByName(name: String): ResumeSkillJpaEntity?
}

interface ResumeCodeSnippetJpaRepository : JpaRepository<ResumeCodeSnippetJpaEntity, Long> {
    /** 프로젝트별 묶음이 목적이라 프로젝트 → order_no 순으로 한 번에 읽는다 */
    fun findAllByOrderByProjectIdAscOrderNoAsc(): List<ResumeCodeSnippetJpaEntity>
}

interface ResumeProjectSkillJpaRepository :
    JpaRepository<ResumeProjectSkillJpaEntity, com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeProjectSkillId> {
    fun findAllByIdProjectId(projectId: Long): List<ResumeProjectSkillJpaEntity>
    fun deleteAllByIdProjectId(projectId: Long)
}
