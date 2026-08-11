package com.kgd.codedictionary.application.resume.port

import com.kgd.codedictionary.domain.resume.model.ResumeCategory
import com.kgd.codedictionary.domain.resume.model.ResumeCompany
import com.kgd.codedictionary.domain.resume.model.ResumeProject
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
    fun save(project: ResumeProject): ResumeProject
    fun delete(id: Long)
}

interface ResumeSkillGroupRepositoryPort {
    fun findAll(): List<ResumeSkillGroup>
    fun save(group: ResumeSkillGroup): ResumeSkillGroup
    fun delete(id: Long)
}
