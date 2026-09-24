package com.kgd.ads.application.creative.usecase

import com.kgd.ads.application.creative.dto.CreativeAsset

/**
 * 심사 상태와 무관한 소재 이미지 미리보기 — 로그인한 광고주는 자기 소재만, 운영자는 전부.
 * 공개 에셋 경로는 승인된 소재 이미지만 내므로, 심사 전·반려 이미지는 이 경로로만 보인다.
 */
interface PreviewCreativeImageUseCase {
    fun ofAdvertiser(memberId: Long, creativeId: Long): CreativeAsset
    fun ofAnyCreative(creativeId: Long): CreativeAsset
}
