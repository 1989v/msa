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
        // 같은 (lang, code) 가 두 번 오면 마지막이 이긴다 — 유일 제약이 있어 그대로 넣으면 배치가 통째로 죽는다.
        val codes = items
            .associateBy { it.lang to it.code }
            .values
            .map { AttractionCategoryCode.of(it.lang, it.code, it.depth, it.name, it.parentCode) }
        return SyncAttractionCategoryCodesUseCase.Applied(repository.upsertAll(codes))
    }

    override fun findAll(lang: String?): List<SyncAttractionCategoryCodesUseCase.View> =
        repository.findAll(lang).map {
            SyncAttractionCategoryCodesUseCase.View(
                lang = it.lang, code = it.code, depth = it.depth, parentCode = it.parentCode, name = it.name,
            )
        }
}
