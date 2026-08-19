package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.application.attraction.usecase.GetAttractionLinksUseCase
import com.kgd.place.domain.attraction.exception.AttractionNotFoundException
import com.kgd.place.domain.attraction.model.AttractionDeepLinks
import org.springframework.stereotype.Service

@Service
class AttractionLinkService(
    private val attractionRepository: AttractionRepositoryPort,
) : GetAttractionLinksUseCase {

    override fun findByAttractionId(id: Long): GetAttractionLinksUseCase.Links {
        val attraction = attractionRepository.findById(id) ?: throw AttractionNotFoundException(id)
        return GetAttractionLinksUseCase.Links(deepLinks = AttractionDeepLinks.of(attraction.title))
    }
}
