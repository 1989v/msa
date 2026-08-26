package com.kgd.game.application.ads.service

import com.kgd.game.application.ads.dto.AdPlacementDto
import com.kgd.game.application.ads.dto.RewardDto
import com.kgd.game.application.ads.port.AdFrequencyPort
import com.kgd.game.application.ads.port.AdPlacementRepositoryPort
import com.kgd.game.application.ads.port.AdPolicyRepositoryPort
import com.kgd.game.application.ads.port.RewardGrantRepositoryPort
import com.kgd.game.application.ads.usecase.CompleteAdRewardUseCase
import com.kgd.game.application.ads.usecase.GetServablePlacementUseCase
import com.kgd.game.application.ads.usecase.IssueAdRewardUseCase
import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.domain.ads.exception.AdNotAllowedException
import com.kgd.game.domain.ads.exception.PlacementNotFoundException
import com.kgd.game.domain.ads.exception.RewardNotFoundException
import com.kgd.game.domain.ads.model.AdType
import com.kgd.game.domain.ads.model.RewardGrant
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import java.time.Duration
import java.time.Instant
import java.util.UUID
import org.springframework.stereotype.Component
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.core.type.TypeReference
import tools.jackson.module.kotlin.jacksonObjectMapper

data class HouseCreativeDto(val title: String?, val body: String?, val href: String?, val emoji: String?)



/**
 * 광고 파사드 — frequency 판정(Redis, 외부 IO)은 트랜잭션 밖, 보상 원장만 트랜잭션 안.
 * 집행은 provider 위임 구조라 이 서비스는 슬롯/정책/보상만 안다 (설계 §4.3).
 */
@Service
class AdService(
    private val placementRepository: AdPlacementRepositoryPort,
    private val policyRepository: AdPolicyRepositoryPort,
    private val frequencyStore: AdFrequencyPort,
    private val gameRepository: GameRepositoryPort,
    private val rewardCommand: RewardCommand,
) : GetServablePlacementUseCase, IssueAdRewardUseCase, CompleteAdRewardUseCase {
    // Kotlin data class 역직렬화에는 KotlinModule 필수 — plain ObjectMapper 는 조용히 실패한다
    private val mapper = jacksonObjectMapper()
    private val creativesType = object : TypeReference<List<HouseCreativeDto>>() {}

    /** 노출 가능하면 슬롯+크리에이티브, frequency cap 에 걸리면 null (FE 는 슬롯 미노출) */
    override fun execute(query: GetServablePlacementUseCase.Query): AdPlacementDto? {
        val (placementKey, subject) = query
        val placement = placementRepository.findByKey(placementKey)
            ?: throw PlacementNotFoundException(placementKey)
        if (!placement.isServable()) return null

        val minInterval = policyRepository.findByType(placement.adType)
            ?.let { Duration.ofSeconds(it.minIntervalSec.toLong()) }
            ?: Duration.ZERO
        if (!frequencyStore.tryAcquire(placementKey, subject, minInterval)) return null

        return AdPlacementDto(
            placementKey = placement.placementKey,
            adType = placement.adType,
            provider = placement.provider.name,
            creatives = placement.creativesJson
                ?.let { runCatching { mapper.readValue(it, creativesType) }.getOrNull() }
                ?: emptyList(),
        )
    }

    /** rewarded 보상 발급 — PUBLISHED+SDK 게임만 (isMonetizable, ADR-0059 §3) */
    override fun execute(command: IssueAdRewardUseCase.Command): RewardDto {
        val (gameSlug, placementKey, sessionKey, memberId) = command
        val placement = placementRepository.findByKey(placementKey)
            ?: throw PlacementNotFoundException(placementKey)
        if (placement.adType != AdType.REWARDED && placement.adType != AdType.MIDGAME) {
            throw AdNotAllowedException("보상은 REWARDED/MIDGAME 슬롯에서만 발급됩니다")
        }
        val game = gameRepository.findBySlug(gameSlug) ?: throw GameNotFoundException(gameSlug)
        if (!game.isMonetizable()) throw AdNotAllowedException("수익화 대상 게임이 아닙니다 (PUBLISHED + SDK 통합 필요)")

        val grant = rewardCommand.issue(
            RewardGrant.issue(
                idempotencyKey = UUID.randomUUID().toString(),
                placementKey = placementKey,
                gameId = requireNotNull(game.id),
                sessionKey = sessionKey,
                memberId = memberId,
                now = Instant.now(),
            )
        )
        return RewardDto(rewardKey = grant.idempotencyKey, status = grant.status.name)
    }

    /** 시청 완료 콜백 — idempotencyKey 기준 멱등 (중복 콜백에도 1회 지급) */
    override fun execute(command: CompleteAdRewardUseCase.Command): RewardDto {
        val grant = rewardCommand.complete(command.rewardKey)
        return RewardDto(rewardKey = grant.idempotencyKey, status = grant.status.name)
    }
}

/** 보상 원장의 트랜잭션 경계 */
@Component
class RewardCommand(
    private val rewardRepository: RewardGrantRepositoryPort,
) {

    @Transactional(transactionManager = "gameTransactionManager")
    fun issue(grant: RewardGrant): RewardGrant = rewardRepository.save(grant)

    @Transactional(transactionManager = "gameTransactionManager")
    fun complete(rewardKey: String): RewardGrant {
        val grant = rewardRepository.findByIdempotencyKey(rewardKey) ?: throw RewardNotFoundException(rewardKey)
        grant.complete(Instant.now())
        return rewardRepository.save(grant)
    }
}
