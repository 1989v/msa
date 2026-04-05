package com.kgd.codedictionary.application.concept.service

import com.kgd.codedictionary.application.concept.dto.ConceptResultDto
import com.kgd.codedictionary.application.concept.dto.CreateConceptCommand
import com.kgd.codedictionary.application.concept.dto.UpdateConceptCommand
import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.domain.concept.exception.ConceptAlreadyExistsException
import com.kgd.codedictionary.domain.concept.exception.ConceptNotFoundException
import com.kgd.codedictionary.domain.concept.model.Concept
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service

@Service
class ConceptService(
    private val conceptRepository: ConceptRepositoryPort
) {
    fun create(command: CreateConceptCommand): ConceptResultDto {
        if (conceptRepository.existsByConceptId(command.conceptId)) {
            throw ConceptAlreadyExistsException(command.conceptId)
        }
        val concept = Concept.create(
            conceptId = command.conceptId,
            name = command.name,
            category = command.category,
            level = command.level,
            description = command.description,
            synonyms = command.synonyms
        )
        val saved = conceptRepository.save(concept)
        return toResultDto(saved)
    }

    fun findById(id: Long): ConceptResultDto {
        val concept = conceptRepository.findById(id)
            ?: throw ConceptNotFoundException(id.toString())
        return toResultDto(concept)
    }

    fun findAll(category: ConceptCategory?, level: ConceptLevel?, pageable: Pageable): Page<ConceptResultDto> {
        val page = when {
            category != null -> conceptRepository.findByCategory(category, pageable)
            level != null -> conceptRepository.findByLevel(level, pageable)
            else -> conceptRepository.findAll(pageable)
        }
        return page.map { toResultDto(it) }
    }

    fun update(id: Long, command: UpdateConceptCommand): ConceptResultDto {
        val concept = conceptRepository.findById(id)
            ?: throw ConceptNotFoundException(id.toString())
        concept.update(
            name = command.name,
            category = command.category,
            level = command.level,
            description = command.description
        )
        command.synonyms?.let { concept.updateSynonyms(it) }
        val saved = conceptRepository.save(concept)
        return toResultDto(saved)
    }

    fun delete(id: Long) {
        conceptRepository.findById(id) ?: throw ConceptNotFoundException(id.toString())
        conceptRepository.delete(id)
    }

    private fun toResultDto(concept: Concept): ConceptResultDto = ConceptResultDto(
        id = requireNotNull(concept.id),
        conceptId = concept.conceptId,
        name = concept.name,
        category = concept.category.name,
        level = concept.level.name,
        description = concept.description,
        synonyms = concept.synonyms
    )
}
