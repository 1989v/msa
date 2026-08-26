package com.kgd.deal.application.offer.usecase

import com.kgd.deal.application.offer.dto.DealCategorySection
import java.time.LocalDateTime

/** 허브 한 화면분 — 카테고리별 오퍼를 왕복 한 번으로 */
interface GetDealSectionsUseCase {
    fun execute(now: LocalDateTime = LocalDateTime.now()): List<DealCategorySection>
}
