package com.kgd.deal.application.offer.usecase

import com.kgd.deal.application.offer.dto.DealAttentionResponse
import java.time.LocalDateTime

/** 만료 임박 · 오래 미수정 · 링크 깨짐 — 방치를 막는 유일한 장치 */
interface GetDealAttentionUseCase {
    fun execute(now: LocalDateTime = LocalDateTime.now()): DealAttentionResponse
}
