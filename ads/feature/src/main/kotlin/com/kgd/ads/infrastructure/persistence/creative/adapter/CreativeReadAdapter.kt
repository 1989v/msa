package com.kgd.ads.infrastructure.persistence.creative.adapter

import com.kgd.ads.application.creative.dto.CreativeAsset
import com.kgd.ads.application.creative.dto.CreativeLanding
import com.kgd.ads.application.creative.port.CreativeReadPort
import com.kgd.ads.domain.creative.model.LandingUrl
import com.kgd.ads.infrastructure.persistence.creative.repository.CreativeAssetContentJpaRepository
import com.kgd.ads.infrastructure.persistence.creative.repository.CreativeJpaRepository
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
class CreativeReadAdapter(
    private val creativeRepository: CreativeJpaRepository,
    private val assetContentRepository: CreativeAssetContentJpaRepository,
) : CreativeReadPort {

    /**
     * 저장된 링크가 랜딩 규칙(https·userinfo 없음)을 어기면 랜딩 없음 — 손으로 고친 행이나 앱 안 경로인 HOUSE 링크가
     * 리다이렉터를 통해 나가지 않게.
     */
    @Transactional("adsTransactionManager", readOnly = true)
    override fun findLanding(creativeId: Long): CreativeLanding? {
        val creative = creativeRepository.findByIdOrNull(creativeId) ?: return null
        return CreativeLanding(creative.status, runCatching { LandingUrl.of(creative.linkUrl) }.getOrNull())
    }

    @Transactional("adsTransactionManager", readOnly = true)
    override fun findAsset(hash: String): CreativeAsset? =
        assetContentRepository.findByIdOrNull(hash)?.let { CreativeAsset(it.contentType, it.bytes) }
}
