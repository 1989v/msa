package com.kgd.place.application.shortlink.service

import com.kgd.common.shortlink.ClickContext
import com.kgd.common.shortlink.ShortCode
import com.kgd.common.shortlink.ShortLinkPath
import com.kgd.common.shortlink.ShortLinkPrefix
import com.kgd.common.shortlink.ShortLinks
import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.application.shortlink.port.AttractionShortLinkClick
import com.kgd.place.application.shortlink.port.AttractionShortLinkClickRepositoryPort
import com.kgd.place.application.shortlink.usecase.PurgeAttractionShortLinkClicksUseCase
import com.kgd.place.application.shortlink.usecase.RecordAttractionShortLinkClickUseCase
import com.kgd.place.application.shortlink.usecase.ResolveAttractionShortLinkUseCase
import com.kgd.place.application.shortlink.usecase.ResolveAttractionShortLinkUseCase.Outcome
import com.kgd.place.application.shortlink.usecase.ResolveAttractionShortLinkUseCase.Resolution
import com.kgd.place.domain.attraction.model.isActive
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

/**
 * 관광지 단축 주소 `/p/{code}` (ADR-0106).
 *
 * 열 수 있는지는 `Attraction.isActive()` 가 정한다 — 공개 상세가 읽는 search 색인에 ACTIVE 행만 실린다.
 * 목적지는 `place.1989v.com/attractions/{id}`, 영문 행은 `/en/attractions/{id}` 다.
 *
 * 트랜잭션 관리자를 전부 명시한다. 지금은 place 가 content 호스트의 기본 TM 이지만,
 * 폴드 구성이 바뀌면 한정자 없는 쓰기는 남의 TM 에 붙어 조용히 사라진다.
 */
@Service
class AttractionShortLinkService(
    private val attractionRepository: AttractionRepositoryPort,
    private val clickRepository: AttractionShortLinkClickRepositoryPort,
    private val shortLinks: ShortLinks,
) : ResolveAttractionShortLinkUseCase, RecordAttractionShortLinkClickUseCase, PurgeAttractionShortLinkClicksUseCase {

    @Transactional(transactionManager = PLACE_TM, readOnly = true)
    override fun execute(path: String): Resolution {
        val code = when (val parsed = ShortLinkPath.parse(path)) {
            ShortLinkPath.Home -> return home(Outcome.HOME)
            ShortLinkPath.Invalid -> return home(Outcome.MALFORMED)
            is ShortLinkPath.Code -> parsed.value
        }
        val attractionId = ShortCode.decode(code) ?: return home(Outcome.MALFORMED)
        val attraction = attractionRepository.findById(attractionId)
            ?: return home(Outcome.NOT_FOUND, attractionId)
        if (!attraction.isActive()) return home(Outcome.NOT_PUBLIC, attractionId)
        val segments = if (attraction.lang == EN) {
            arrayOf(EN, ATTRACTIONS_PATH, attractionId.toString())
        } else {
            arrayOf(ATTRACTIONS_PATH, attractionId.toString())
        }
        return Resolution(Outcome.RESOLVED, attractionId, shortLinks.destination(ShortLinkPrefix.PLACE, *segments))
    }

    /** 조회 트랜잭션과 분리해 실패가 302 로 번지지 않게 한다. */
    @Transactional(transactionManager = PLACE_TM, propagation = Propagation.REQUIRES_NEW)
    override fun execute(command: RecordAttractionShortLinkClickUseCase.Command) {
        clickRepository.record(
            AttractionShortLinkClick(
                attractionId = command.attractionId,
                clickedAt = LocalDateTime.now(),
                referrerHost = ClickContext.referrerHost(command.referrer),
                uaFamily = ClickContext.uaFamily(command.userAgent),
            ),
        )
    }

    @Transactional(transactionManager = PLACE_TM)
    override fun olderThan(days: Long): Int = clickRepository.purgeOlderThan(LocalDateTime.now().minusDays(days))

    private fun home(outcome: Outcome, attractionId: Long? = null) =
        Resolution(outcome, attractionId, shortLinks.home(ShortLinkPrefix.PLACE))

    companion object {
        private const val PLACE_TM = "placeTransactionManager"

        /** place FE 의 관광지 상세 경로 첫 세그먼트 */
        private const val ATTRACTIONS_PATH = "attractions"

        /** 영문 행의 언어 값이자 place FE 의 영문 경로 접두사 */
        private const val EN = "en"
    }
}
