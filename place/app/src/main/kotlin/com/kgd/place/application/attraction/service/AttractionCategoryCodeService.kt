package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionCategoryCodeRepositoryPort
import com.kgd.place.application.attraction.usecase.SyncAttractionCategoryCodesUseCase
import com.kgd.place.domain.attraction.model.AttractionCategoryCode
import org.springframework.stereotype.Service

@Service
class AttractionCategoryCodeService(
    private val repository: AttractionCategoryCodeRepositoryPort,
) : SyncAttractionCategoryCodesUseCase {

    override fun upsert(items: List<SyncAttractionCategoryCodesUseCase.Item>): SyncAttractionCategoryCodesUseCase.Applied {
        val codes = items.map { AttractionCategoryCode.of(it.lang, it.code, it.name, it.parentCode) }
        return SyncAttractionCategoryCodesUseCase.Applied(repository.upsertAll(codes))
    }

    override fun findAll(lang: String?): List<SyncAttractionCategoryCodesUseCase.View> =
        repository.findAll(lang).map {
            SyncAttractionCategoryCodesUseCase.View(
                lang = it.lang, code = it.code, depth = it.depth, parentCode = it.parentCode, name = it.name,
            )
        }
}
