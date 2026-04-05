package com.kgd.codedictionary.application.index.service

import com.kgd.codedictionary.application.index.dto.CreateIndexCommand
import com.kgd.codedictionary.application.index.dto.IndexResultDto
import com.kgd.codedictionary.application.index.port.ConceptIndexRepositoryPort
import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.domain.concept.exception.ConceptNotFoundException
import com.kgd.codedictionary.domain.index.model.CodeLocation
import com.kgd.codedictionary.domain.index.model.ConceptIndex
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service

@Service
class IndexService(
    private val indexRepository: ConceptIndexRepositoryPort,
    private val conceptRepository: ConceptRepositoryPort
) {
    fun create(command: CreateIndexCommand): IndexResultDto {
        conceptRepository.findByConceptId(command.conceptId)
            ?: throw ConceptNotFoundException(command.conceptId)
        val index = ConceptIndex.create(
            conceptId = command.conceptId,
            location = CodeLocation(
                filePath = command.filePath,
                lineStart = command.lineStart,
                lineEnd = command.lineEnd,
                gitUrl = command.gitUrl
            ),
            codeSnippet = command.codeSnippet,
            description = command.description,
            gitCommitHash = command.gitCommitHash
        )
        val saved = indexRepository.save(index)
        return toResultDto(saved)
    }

    fun findByConceptId(conceptId: String, pageable: Pageable): Page<IndexResultDto> =
        indexRepository.findByConceptId(conceptId, pageable).map { toResultDto(it) }

    fun count(): Long = indexRepository.count()

    private fun toResultDto(index: ConceptIndex): IndexResultDto = IndexResultDto(
        id = requireNotNull(index.id),
        conceptId = index.conceptId,
        filePath = index.location.filePath,
        lineStart = index.location.lineStart,
        lineEnd = index.location.lineEnd,
        codeSnippet = index.codeSnippet,
        gitUrl = index.location.gitUrl,
        description = index.description,
        indexedAt = index.indexedAt.toString()
    )
}
