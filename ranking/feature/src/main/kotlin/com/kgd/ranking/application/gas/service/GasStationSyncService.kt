package com.kgd.ranking.application.gas.service

import com.kgd.ranking.application.gas.dto.GasStationBulkResult
import com.kgd.ranking.application.gas.port.GasStationRepositoryPort
import com.kgd.ranking.application.gas.usecase.SyncGasStationsUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

private val logger = KotlinLogging.logger {}

/**
 * 수집기가 보낸 주유소를 적재한다 (ADR-0081 §3).
 *
 * **전체 동기화다.** 요청에 없는 필드는 지워지고, 요청에 없는 유종의 가격 행도 지워진다 —
 * 주유소가 경유 취급을 그만두면 어제 가격이 남아 있으면 안 되기 때문이다. 그래서 수집기는
 * 유종별로 나눠 보내지 않고 **주유소 단위로 유종을 모아** 한 번에 보낸다.
 */
@Service
class GasStationSyncService(
    private val stationRepository: GasStationRepositoryPort,
) : SyncGasStationsUseCase {

    @Transactional
    override fun execute(command: SyncGasStationsUseCase.Command): GasStationBulkResult {
        val items = command.stations
        if (items.isEmpty()) return GasStationBulkResult(0, 0, 0)

        val now = Instant.now()
        val existingKeys = stationRepository.findByOpinetIdIn(items.map { it.opinetId })
            .map { it.opinetId }
            .toSet()

        stationRepository.saveAll(items.map { it.toDomain(now) })

        val created = items.count { it.opinetId !in existingKeys }
        val updated = items.size - created
        logger.info { "[GAS] 주유소 적재 ${items.size}건 (신규 $created · 갱신 $updated)" }
        return GasStationBulkResult(received = items.size, created = created, updated = updated)
    }
}
