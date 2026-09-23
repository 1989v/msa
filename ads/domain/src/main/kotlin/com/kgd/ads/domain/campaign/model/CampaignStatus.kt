package com.kgd.ads.domain.campaign.model

/**
 * 광고주가 정하는 상태. `ENDED` 는 되돌리지 않는다.
 * 「기간 밖」·「예산 소진」은 상태가 아니다 — [Campaign] 의 게재 자격 판정이 파생한다.
 */
enum class CampaignStatus { DRAFT, ACTIVE, PAUSED, ENDED }
