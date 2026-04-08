package com.kgd.codedictionary.application.search.service

import com.kgd.codedictionary.application.search.dto.SearchCommand
import com.kgd.codedictionary.application.search.dto.SearchHitDto
import com.kgd.codedictionary.application.search.dto.SearchResultDto
import com.kgd.codedictionary.application.search.dto.SuggestCommand
import com.kgd.codedictionary.application.search.dto.SuggestItemDto
import com.kgd.codedictionary.application.search.port.ConceptSearchPort
import org.springframework.stereotype.Service

@Service
class SearchService(
    private val searchPort: ConceptSearchPort
) {
    fun search(command: SearchCommand): SearchResultDto {
        val response = searchPort.search(
            query = command.query,
            category = command.category,
            level = command.level,
            from = command.page * command.size,
            size = command.size
        )
        return SearchResultDto(
            hits = response.hits.map { hit ->
                SearchHitDto(
                    conceptId = hit.conceptId,
                    conceptName = hit.conceptName,
                    category = hit.category,
                    level = hit.level,
                    filePath = hit.filePath,
                    lineStart = hit.lineStart,
                    lineEnd = hit.lineEnd,
                    codeSnippet = hit.codeSnippet,
                    gitUrl = hit.gitUrl,
                    description = hit.description,
                    score = hit.score
                )
            },
            totalHits = response.totalHits,
            maxScore = response.maxScore
        )
    }

    fun suggest(command: SuggestCommand): List<SuggestItemDto> {
        return searchPort.suggest(command.query, command.size).map { hit ->
            SuggestItemDto(
                conceptId = hit.conceptId,
                name = hit.conceptName,
                category = hit.category,
                level = hit.level,
                description = hit.description ?: ""
            )
        }
    }
}
