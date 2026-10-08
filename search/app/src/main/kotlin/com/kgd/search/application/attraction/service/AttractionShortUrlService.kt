package com.kgd.search.application.attraction.service

import com.kgd.common.shortlink.ShortCode
import com.kgd.common.shortlink.ShortLinkPrefix
import com.kgd.common.shortlink.ShortLinks
import com.kgd.search.application.attraction.usecase.AttractionShortUrlUseCase
import org.springframework.stereotype.Service

@Service
class AttractionShortUrlService(
    private val shortLinks: ShortLinks,
) : AttractionShortUrlUseCase {

    override fun shortUrlOf(attractionId: String): String? =
        attractionId.toLongOrNull()
            ?.takeIf { it in 0..ShortCode.MAX_ID }
            ?.let { shortLinks.exposedShortUrl(ShortLinkPrefix.PLACE, ShortCode.encode(it)) }
}
