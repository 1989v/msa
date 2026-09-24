package com.kgd.seller.application.seller.service

import com.kgd.seller.application.seller.port.SellerRepositoryPort
import com.kgd.seller.application.seller.usecase.PurgeRejectedApplicationsUseCase
import com.kgd.seller.domain.seller.model.Seller
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant

@Service
class SellerPrivacyService(
    private val sellers: SellerRepositoryPort,
    @Qualifier("sellerClock") private val clock: Clock,
) : PurgeRejectedApplicationsUseCase {

    private val log = KotlinLogging.logger {}

    @Transactional("sellerTransactionManager")
    override fun execute(): Int {
        val now = Instant.now(clock)
        val purged = sellers.findRejectedUnpurgedBefore(now.minus(Seller.REJECTED_PII_RETENTION), BATCH_SIZE)
            .filter { it.purgePersonalData(now) }
            .onEach { sellers.save(it) }
            .size
        if (purged > 0) log.info { "Purged personal data of rejected seller applications: count=$purged" }
        return purged
    }

    private companion object {
        const val BATCH_SIZE = 100
    }
}
