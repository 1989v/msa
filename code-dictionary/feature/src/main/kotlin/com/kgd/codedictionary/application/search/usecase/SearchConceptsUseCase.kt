package com.kgd.codedictionary.application.search.usecase

import com.kgd.codedictionary.application.search.dto.SearchCommand
import com.kgd.codedictionary.application.search.dto.SearchResultDto
import com.kgd.codedictionary.application.search.dto.SuggestCommand
import com.kgd.codedictionary.application.search.dto.SuggestItemDto

/** 개념 검색·자동완성. */
interface SearchConceptsUseCase {
    fun search(command: SearchCommand): SearchResultDto
    fun suggest(command: SuggestCommand): List<SuggestItemDto>
}
