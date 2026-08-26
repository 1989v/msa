package com.kgd.deal.application.category.port

import com.kgd.deal.domain.model.DealCategory
import com.kgd.deal.domain.model.DisplayStatus

interface DealCategoryRepositoryPort {
    /** orderNo 오름차순 */
    fun findAll(): List<DealCategory>
    /** orderNo 오름차순 */
    fun findAllByStatus(status: DisplayStatus): List<DealCategory>
    fun findById(id: Long): DealCategory?
    fun findByCode(code: String): DealCategory?
    fun existsByCode(code: String): Boolean
    /** id 가 있으면 갱신, 없으면 생성 */
    fun save(category: DealCategory): DealCategory
    fun deleteById(id: Long)
}
