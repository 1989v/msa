package com.kgd.ads.application.creative.usecase

import com.kgd.ads.application.creative.dto.CreativeView
import com.kgd.ads.application.creative.dto.PaidCreativeDraft

/**
 * 광고주의 유료 소재 — 조회·올리기·고치기·보관. 올리거나 고치면 심사 대기(`PENDING`)가 되고 그동안 게재되지 않는다.
 * 남의 캠페인·소재 id 는 없는 것(404)으로 본다.
 */
interface ManageCreativeUseCase {
    fun list(memberId: Long, campaignId: Long): List<CreativeView>
    fun get(memberId: Long, creativeId: Long): CreativeView
    fun create(memberId: Long, campaignId: Long, draft: PaidCreativeDraft): CreativeView
    fun revise(memberId: Long, creativeId: Long, draft: PaidCreativeDraft): CreativeView
    fun archive(memberId: Long, creativeId: Long): CreativeView
}
