package com.kgd.seller.application.seller.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.exception.NotFoundException
import com.kgd.seller.application.seller.port.AccountCipherPort
import com.kgd.seller.application.seller.port.SellerEventPort
import com.kgd.seller.application.seller.port.SellerEventType
import com.kgd.seller.application.seller.port.SellerRepositoryPort
import com.kgd.seller.application.seller.usecase.ApplySellerUseCase
import com.kgd.seller.application.seller.usecase.GetMySellerUseCase
import com.kgd.seller.application.seller.usecase.QuerySellersUseCase
import com.kgd.seller.application.seller.usecase.RevealPayoutAccountUseCase
import com.kgd.seller.application.seller.usecase.SellerView
import com.kgd.seller.domain.seller.exception.SellerNotActiveException
import com.kgd.seller.domain.seller.model.AccountNumber
import com.kgd.seller.domain.seller.model.Seller
import com.kgd.seller.domain.seller.model.SellerStatus
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant

@Service
class SellerService(
    private val sellers: SellerRepositoryPort,
    private val events: SellerEventPort,
    private val cipher: AccountCipherPort,
    @Qualifier("sellerClock") private val clock: Clock,
) : ApplySellerUseCase, GetMySellerUseCase, QuerySellersUseCase, RevealPayoutAccountUseCase {

    @Transactional("sellerTransactionManager")
    override fun execute(command: ApplySellerUseCase.Command): SellerView {
        Seller.ensureMemberCanApply(sellers.findAllByMemberId(command.memberId))
        val account = AccountNumber.of(command.accountNumber)
        val seller = Seller.apply(
            memberId = command.memberId,
            businessName = command.businessName,
            businessRegistrationNo = command.businessRegistrationNo,
            representativeName = command.representativeName,
            bankName = command.bankName,
            accountNumber = account,
            encryptedAccount = cipher.encrypt(account),
            shippingFee = command.shippingFee,
            settlementCycle = command.settlementCycle,
            now = Instant.now(clock),
        )
        val saved = sellers.create(seller)
        events.publish(SellerEventType.APPLIED, saved)
        return SellerView.from(saved)
    }

    @Transactional("sellerTransactionManager", readOnly = true)
    override fun execute(memberId: String): SellerView {
        val current = sellers.findAllByMemberId(memberId).firstOrNull { it.status.occupiesMember }
            ?: throw SellerNotActiveException(null)
        current.ensureActive()
        return SellerView.from(current)
    }

    @Transactional("sellerTransactionManager", readOnly = true)
    override fun list(query: QuerySellersUseCase.Query): QuerySellersUseCase.Page {
        val page = sellers.findPage(query.status, query.page, query.size)
        return QuerySellersUseCase.Page(page.items.map(SellerView::from), page.totalElements, query.page, query.size)
    }

    @Transactional("sellerTransactionManager", readOnly = true)
    override fun get(sellerId: Long): SellerView =
        SellerView.from(sellers.findById(sellerId) ?: throw NotFoundException("Seller", sellerId))

    /** 지급은 정지된 판매자에게도 계속된다 — 진행 중 주문은 끝까지 정산한다 */
    @Transactional("sellerTransactionManager", readOnly = true)
    override fun execute(sellerId: Long): RevealPayoutAccountUseCase.PayoutAccount {
        val seller = sellers.findById(sellerId) ?: throw NotFoundException("Seller", sellerId)
        if (seller.status != SellerStatus.ACTIVE && seller.status != SellerStatus.SUSPENDED) {
            throw SellerNotActiveException(seller.status)
        }
        val encrypted = seller.encryptedAccount
        val bank = seller.bankName
        if (encrypted == null || bank == null) {
            throw BusinessException(ErrorCode.INVALID_SELLER_STATUS, "정산 계좌가 없는 판매자입니다 (id=$sellerId)")
        }
        return RevealPayoutAccountUseCase.PayoutAccount(sellerId, bank, cipher.decrypt(encrypted).value)
    }
}
