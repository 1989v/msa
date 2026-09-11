package com.kgd.codedictionary.application.resume.port

import com.kgd.codedictionary.domain.resume.model.ResumeCategory
import com.kgd.codedictionary.domain.resume.model.ResumeCodeSnippet
import com.kgd.codedictionary.domain.resume.model.ResumeCompany
import com.kgd.codedictionary.domain.resume.model.ResumeProject
import com.kgd.codedictionary.domain.resume.model.ResumeSkill
import com.kgd.codedictionary.domain.resume.model.ResumeSkillGroup

interface ResumeCategoryRepositoryPort {
    fun findAll(): List<ResumeCategory>
    fun save(category: ResumeCategory): ResumeCategory
    fun delete(id: Long)
}

interface ResumeCompanyRepositoryPort {
    fun findAll(): List<ResumeCompany>
    fun save(company: ResumeCompany): ResumeCompany
    fun delete(id: Long)
}

interface ResumeProjectRepositoryPort {
    fun findAll(): List<ResumeProject>
    fun findAllPublished(): List<ResumeProject>

    /**
     * 개인 프로젝트(회사 소속이 아닌 것)만 (ADR-0066).
     *
     * 회사 소속 프로젝트는 게이트 뒤에 남아야 하므로 `company_id IS NULL` 을 쿼리에 못박는다.
     * 호출부가 넘기는 조건으로 두면 한 곳만 빠뜨려도 경력 서술이 공개된다.
     */
    fun findAllPublishedPersonal(): List<ResumeProject>

    fun save(project: ResumeProject): ResumeProject
    fun delete(id: Long)
}

interface ResumeSkillGroupRepositoryPort {
    fun findAll(): List<ResumeSkillGroup>
    fun save(group: ResumeSkillGroup): ResumeSkillGroup
    fun delete(id: Long)
}

interface ResumeSkillRepositoryPort {
    fun findAll(): List<ResumeSkill>
    fun save(skill: ResumeSkill): ResumeSkill
    fun delete(id: Long)
}

/** 프로젝트 ↔ 기술 연결. 프로젝트 단위로 통째 교체한다 — 부분 갱신은 순서 유지가 애매하다. */
interface ResumeProjectSkillRepositoryPort {
    fun skillIdsByProject(): Map<Long, List<Long>>
    fun replace(projectId: Long, skillIds: List<Long>)
}

interface ResumeCodeSnippetRepositoryPort {
    /** 조립부가 프로젝트 목록에 붙이기 좋은 형태 — 프로젝트별 order_no 순 */
    fun snippetsByProject(): Map<Long, List<ResumeCodeSnippet>>
    fun save(snippet: ResumeCodeSnippet): ResumeCodeSnippet
    fun delete(id: Long)
}
