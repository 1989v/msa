package com.kgd.ads.application.category.usecase

import com.kgd.ads.application.category.dto.ContextMappingView
import com.kgd.ads.application.category.dto.HostCategoryView

/**
 * 운영자의 문맥 매핑 관리 — FE 문맥 키(`blog:{slug}`·`game:{장르}`·`place:{광역 코드}`) → 카테고리,
 * 호스트 기본 카테고리. 변경은 다음 인덱스 갱신(1분 안)에 결정에 반영된다.
 */
interface ManageContextMappingUseCase {
    fun mappings(): List<ContextMappingView>
    fun putMapping(command: PutMapping): ContextMappingView
    fun deleteMapping(command: DeleteMapping)
    fun hostCategories(): List<HostCategoryView>
    fun putHostCategory(command: PutHostCategory): HostCategoryView

    data class PutMapping(val contextKey: String, val categoryCode: String, val actorMemberId: Long)
    data class DeleteMapping(val contextKey: String, val actorMemberId: Long)
    data class PutHostCategory(val host: String, val categoryCode: String, val actorMemberId: Long)
}
