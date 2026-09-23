package com.kgd.ads.domain.ledger.model

import com.kgd.ads.domain.ledger.policy.RevenueSplit
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import java.lang.reflect.Modifier
import java.time.LocalDateTime

class LedgerTransactionTest : BehaviorSpec({
    val at = LocalDateTime.of(2026, 9, 23, 11, 5)
    val wallet = 11L
    val source = 1L
    val publisher = 2L
    val network = 3L

    given("충전 거래") {
        `when`("충전 원천에서 지갑으로 옮기면") {
            then("두 분개의 합이 0 이다") {
                val tx = LedgerTransaction.topUp("TOPUP:abc", source, wallet, 5_000_000, actorMemberId = 7, at = at)
                tx.type shouldBe LedgerTransactionType.TOPUP
                tx.entries shouldContainExactlyInAnyOrder listOf(LedgerEntry(source, -5_000_000), LedgerEntry(wallet, 5_000_000))
                tx.entries.sumOf { it.amountMicros } shouldBe 0
            }
        }
        `when`("충전액이 0 이하면") {
            then("만들 수 없다") {
                shouldThrow<IllegalArgumentException> { LedgerTransaction.topUp("k", source, wallet, 0, 7, at) }
            }
        }
    }

    given("정산 거래") {
        `when`("청구액 1,000 을 68% 로 나누면") {
            then("지갑 −1,000 · 퍼블리셔 +680 · 수수료 +320, 멱등 키는 캠페인과 시각") {
                val tx = LedgerTransaction.settlement(
                    campaignId = 42, hourKst = LocalDateTime.of(2026, 9, 23, 10, 0),
                    walletAccountId = wallet, publisherAccountId = publisher, networkAccountId = network,
                    split = RevenueSplit.of(1_000), at = at,
                )
                tx.idempotencyKey shouldBe "SETTLE:42:2026-09-23T10"
                tx.entries shouldContainExactlyInAnyOrder listOf(
                    LedgerEntry(wallet, -1_000), LedgerEntry(publisher, 680), LedgerEntry(network, 320),
                )
            }
        }
        `when`("퍼블리셔 몫이 0 이 되는 청구액 1 이면") {
            then("0 원 분개 없이 두 줄로 균형을 맞춘다") {
                val tx = LedgerTransaction.settlement(42, LocalDateTime.of(2026, 9, 23, 10, 0), wallet, publisher, network, RevenueSplit.of(1), at)
                tx.entries shouldContainExactlyInAnyOrder listOf(LedgerEntry(wallet, -1), LedgerEntry(network, 1))
            }
        }
    }

    given("분개 합이 0 이 아닌 거래") {
        `when`("복원으로 만들려 하면") {
            then("거부한다") {
                shouldThrow<IllegalArgumentException> {
                    LedgerTransaction.restore(
                        id = 1, type = LedgerTransactionType.TOPUP, idempotencyKey = "k",
                        entries = listOf(LedgerEntry(source, -100), LedgerEntry(wallet, 99)),
                        reversedTransactionId = null, actorMemberId = null, createdAt = at,
                    )
                }
            }
        }
        `when`("생성자로 직접 만들려 하면") {
            then("공개 생성자가 없다") {
                // 컴패니언 접근용 합성 생성자는 소스에서 부를 수 없으므로 제외한다
                LedgerTransaction::class.java.declaredConstructors
                    .filterNot { it.isSynthetic }
                    .all { Modifier.isPrivate(it.modifiers) } shouldBe true
            }
        }
    }

    given("역분개") {
        val settlement = LedgerTransaction.restore(
            id = 10, type = LedgerTransactionType.SETTLEMENT, idempotencyKey = "SETTLE:42:2026-09-23T10",
            entries = listOf(LedgerEntry(wallet, -1_000), LedgerEntry(publisher, 680), LedgerEntry(network, 320)),
            reversedTransactionId = null, actorMemberId = null, createdAt = at,
        )
        `when`("정산 거래를 뒤집으면") {
            then("전액을 부호만 바꿔 원 거래를 참조한다") {
                val reversal = LedgerTransaction.reversalOf(settlement, actorMemberId = 1, at = at)
                reversal.type shouldBe LedgerTransactionType.REVERSAL
                reversal.reversedTransactionId shouldBe 10
                reversal.entries shouldContainExactlyInAnyOrder listOf(
                    LedgerEntry(wallet, 1_000), LedgerEntry(publisher, -680), LedgerEntry(network, -320),
                )
            }
        }
        `when`("충전 거래를 뒤집으려 하면") {
            then("거부한다") {
                val topUp = LedgerTransaction.restore(
                    11, LedgerTransactionType.TOPUP, "k", listOf(LedgerEntry(source, -5), LedgerEntry(wallet, 5)), null, 7, at,
                )
                shouldThrow<IllegalArgumentException> { LedgerTransaction.reversalOf(topUp, 1, at) }
            }
        }
    }
})
