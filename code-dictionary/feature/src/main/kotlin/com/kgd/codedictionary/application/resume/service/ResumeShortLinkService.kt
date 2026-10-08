package com.kgd.codedictionary.application.resume.service

import com.kgd.codedictionary.application.resume.port.ResumeShareLinkRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeShortLinkClickRepositoryPort
import com.kgd.codedictionary.application.resume.usecase.RecordResumeShortLinkClickUseCase
import com.kgd.codedictionary.application.resume.usecase.ResolveResumeShortLinkUseCase
import com.kgd.codedictionary.application.resume.usecase.ResolveResumeShortLinkUseCase.Outcome
import com.kgd.codedictionary.application.resume.usecase.ResolveResumeShortLinkUseCase.Resolution
import com.kgd.codedictionary.domain.resume.model.ResumeShareLink
import com.kgd.common.shortlink.ShortLinkPath
import com.kgd.common.shortlink.ShortLinkPrefix
import com.kgd.common.shortlink.ShortLinks
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

/**
 * 이력서 단축 주소 `/r/{code}` (ADR-0103).
 *
 * 열 수 있는지는 [ResumeShareLink.isUsable] 이 정한다 — 토큰 게이트와 같은 판정이다.
 * 목적지는 `resume.1989v.com/?k={token}` 이고, 공개 토글이 꺼져 있어도 토큰이 있으니 열린다.
 */
@Service
class ResumeShortLinkService(
    private val shareLinkRepository: ResumeShareLinkRepositoryPort,
    private val clickRepository: ResumeShortLinkClickRepositoryPort,
    private val shortLinks: ShortLinks,
) : ResolveResumeShortLinkUseCase, RecordResumeShortLinkClickUseCase {

    @Transactional(readOnly = true)
    override fun execute(path: String): Resolution {
        val code = when (val parsed = ShortLinkPath.parse(path)) {
            ShortLinkPath.Home -> return home(Outcome.HOME)
            ShortLinkPath.Invalid -> return home(Outcome.MALFORMED)
            is ShortLinkPath.Code -> parsed.value
        }
        if (!ResumeShareLink.isValidShortCode(code)) return home(Outcome.MALFORMED)
        val link = shareLinkRepository.findByShortCode(code) ?: return home(Outcome.NOT_FOUND)
        if (!link.isUsable()) return home(Outcome.REVOKED, link.id)
        val location = shortLinks.destination(ShortLinkPrefix.RESUME, query = mapOf(TOKEN_PARAM to link.token))
        return Resolution(Outcome.RESOLVED, link.id, location)
    }

    /**
     * 조회 트랜잭션과 분리해 실패가 302 로 번지지 않게 한다. 한정자를 명시하는 이유는 폴드 호스트에
     * 트랜잭션 관리자가 여럿일 때 기본값이 다른 도메인 것이 되면 쓰기가 조용히 사라지기 때문이다.
     */
    @Transactional(transactionManager = "transactionManager", propagation = Propagation.REQUIRES_NEW)
    override fun execute(shareLinkId: Long) {
        clickRepository.record(shareLinkId, LocalDateTime.now())
    }

    private fun home(outcome: Outcome, shareLinkId: Long? = null) =
        Resolution(outcome, shareLinkId, shortLinks.home(ShortLinkPrefix.RESUME))

    companion object {
        /** resume FE 가 토큰을 읽는 쿼리 이름 */
        private const val TOKEN_PARAM = "k"
    }
}
