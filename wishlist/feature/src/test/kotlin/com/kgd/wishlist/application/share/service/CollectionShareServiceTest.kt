package com.kgd.wishlist.application.share.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.shortlink.ShortLinkProperties
import com.kgd.wishlist.application.share.config.WishlistShareProperties
import com.kgd.wishlist.application.share.port.CollectionSharePort
import com.kgd.wishlist.domain.model.CollectionShare
import com.kgd.wishlist.domain.model.WishlistCollection
import com.kgd.wishlist.domain.model.WishlistItem
import com.kgd.wishlist.domain.model.WishlistTargetType
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.spyk
import io.mockk.verify
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneOffset

/**
 * 묶음 공유 (ADR-0107).
 *
 * 지키는 것: 묶음당 살아 있는 링크 하나 · 존재 은닉(없음·남의 것·만료·폐기·꺼짐이 같은 404) ·
 * 단축 주소 목적지 호스트가 설정에서만 온다는 것.
 */
class CollectionShareServiceTest : BehaviorSpec({

    val now = Instant.parse("2026-10-09T00:00:00Z")
    val clock = Clock.fixed(now, ZoneOffset.UTC)
    // 운영 기본값과 다른 호스트 — 서비스가 리터럴이 아니라 설정을 읽는지 가른다
    val shortLink = ShortLinkProperties(origin = "https://short.test")
    val owner = 1L
    val stranger = 2L
    val myCollection = 5L
    val othersCollection = 6L

    fun newPort() = spyk(
        InMemoryCollectionSharePort(
            mutableListOf(
                WishlistCollection.restore(myCollection, owner, "제주 여행", LocalDateTime.now()),
                WishlistCollection.restore(othersCollection, stranger, "부산 여행", LocalDateTime.now()),
            ),
        ),
    )

    fun service(port: CollectionSharePort, enabled: Boolean = true, at: Clock = clock) =
        CollectionShareService(port, WishlistShareProperties(enabled = enabled), shortLink, at)

    fun notFound(block: () -> Unit): BusinessException =
        shouldThrow<BusinessException>(block).also { it.errorCode shouldBe ErrorCode.NOT_FOUND }

    Given("링크를 두 번 연속 만들면") {
        val port = newPort()
        val svc = service(port)
        val first = svc.create(owner, myCollection, 30)
        val second = svc.create(owner, myCollection, 30)

        Then("살아 있는 행은 하나고 이전 행은 폐기 시각을 갖는다") {
            port.aliveCount(myCollection, now) shouldBe 1
            port.byToken(first.token)!!.revokedAt shouldBe now
            port.byToken(second.token)!!.revokedAt.shouldBeNull()
            first.token shouldNotBe second.token
        }
        Then("url 은 설정의 단축 주소 호스트 + /c/ + 토큰이다") {
            second.url shouldBe "https://short.test/c/${second.token}"
            second.expiresAt shouldBe now.plus(Duration.ofDays(30))
        }
        Then("조회는 살아 있는 링크를 같은 모양으로 돌려준다") {
            svc.get(owner, myCollection) shouldBe second
        }
    }

    Given("만료 일수가") {
        When("범위 밖(0·366)이면") {
            Then("INVALID_INPUT 이다") {
                listOf(0, 366).forEach { days ->
                    shouldThrow<BusinessException> { service(newPort()).create(owner, myCollection, days) }
                        .errorCode shouldBe ErrorCode.INVALID_INPUT
                }
            }
        }
        When("1·365·null 이면") {
            Then("만들어지고 null 은 만료 없음이다") {
                service(newPort()).create(owner, myCollection, 1).expiresAt shouldBe now.plus(Duration.ofDays(1))
                service(newPort()).create(owner, myCollection, 365).expiresAt shouldBe now.plus(Duration.ofDays(365))
                service(newPort()).create(owner, myCollection, null).expiresAt.shouldBeNull()
            }
        }
    }

    Given("없는 묶음과 남의 묶음은") {
        val svc = service(newPort())
        Then("만들기·조회·폐기 모두 코드·메시지가 같은 NOT_FOUND 다") {
            listOf<(Long) -> Unit>(
                { svc.create(owner, it, 30) },
                { svc.get(owner, it) },
                { svc.revoke(owner, it) },
            ).forEach { call ->
                val missing = notFound { call(999L) }
                val others = notFound { call(othersCollection) }
                missing.message shouldBe others.message
            }
        }
    }

    Given("링크를 폐기하면") {
        val port = newPort()
        val svc = service(port)
        svc.create(owner, myCollection, 30)
        svc.revoke(owner, myCollection)
        Then("살아 있는 링크가 없고, 다시 폐기해도 성공한다") {
            port.aliveCount(myCollection, now) shouldBe 0
            svc.get(owner, myCollection).shouldBeNull()
            svc.revoke(owner, myCollection)
        }
    }

    Given("공개 조회에서") {
        // 만료만 된 링크 — 만료 시각과 같은 순간부터 죽는다
        val expiringPort = newPort()
        val expiring = service(expiringPort).create(owner, myCollection, 1)
        val atExpiry = service(expiringPort, at = Clock.fixed(now.plus(Duration.ofDays(1)), ZoneOffset.UTC))
        // 폐기만 된 링크
        val revokedPort = newPort()
        val revoked = service(revokedPort).create(owner, myCollection, 30)
        service(revokedPort).revoke(owner, myCollection)

        Then("만료·폐기·없음은 같은 NOT_FOUND 다") {
            service(expiringPort).get(expiring.token).name shouldBe "제주 여행"
            val expired = notFound { atExpiry.get(expiring.token) }
            val revokedErr = notFound { service(revokedPort).get(revoked.token) }
            val missing = notFound { service(newPort()).get("ZZZZZZZZZZ") }
            expired.message shouldBe missing.message
            revokedErr.message shouldBe missing.message
        }
        Then("형식이 틀린 토큰은 포트를 부르지 않고 같은 NOT_FOUND 다") {
            val fresh = newPort()
            listOf("", "short", "abcdefghijk", "abc/defghi", "abcdefghi!").forEach { token ->
                notFound { service(fresh).get(token) }
            }
            verify(exactly = 0) { fresh.findByToken(any()) }
        }
    }

    Given("공개 조회 결과는") {
        val port = newPort()
        // 관광지 101건(1분 간격) + 다른 타입 섞임
        repeat(101) { i ->
            port.items += WishlistItem.restore(
                (i + 1).toLong(), owner, myCollection, WishlistTargetType.ATTRACTION, "a$i",
                LocalDateTime.of(2026, 1, 1, 0, 0).plusMinutes(i.toLong()),
            )
        }
        port.items += WishlistItem.restore(
            500L, owner, myCollection, WishlistTargetType.GAME, "g1", LocalDateTime.of(2027, 1, 1, 0, 0),
        )
        val link = service(port).create(owner, myCollection, 30)
        val shared = service(port).get(link.token)

        Then("관광지만, 최신순 100건이고 잘렸다고 알린다") {
            shared.name shouldBe "제주 여행"
            shared.items shouldHaveSize 100
            shared.items.all { it.targetType == WishlistTargetType.ATTRACTION } shouldBe true
            shared.items.first().targetKey shouldBe "a100"
            shared.items.last().targetKey shouldBe "a1"
            shared.truncated shouldBe true
        }
        Then("100건 이하면 잘리지 않는다") {
            port.items.removeIf { it.targetKey == "a0" }
            service(port).get(link.token).truncated shouldBe false
        }
    }

    Given("단축 주소 해석은") {
        val port = newPort()
        val svc = service(port)
        Then("영숫자 10자는 설정 호스트의 /shared/ 로 간다") {
            svc.resolve("Ab3dEf7hIj") shouldBe "https://short.test/shared/Ab3dEf7hIj"
        }
        Then("그 밖은 설정 호스트의 /shared/invalid 로 가고 포트를 부르지 않는다") {
            listOf("", "a/b", "%2F%2Fevil.com", "Ab3dEf7hI", "Ab3dEf7hIjK", "//evil.com/x").forEach {
                svc.resolve(it) shouldBe "https://short.test/shared/invalid"
            }
            verify(exactly = 0) { port.findByToken(any()) }
        }
    }

    Given("설정이 꺼져 있으면") {
        val port = newPort()
        val off = service(port, enabled = false)
        Then("세 유스케이스의 모든 메서드가 NOT_FOUND 이고, 범위 검사보다 먼저다") {
            notFound { off.create(owner, myCollection, 0) }
            notFound { off.create(owner, myCollection, 30) }
            notFound { off.get(owner, myCollection) }
            notFound { off.revoke(owner, myCollection) }
            val offMissing = notFound { off.get("Ab3dEf7hIj") }
            notFound { off.resolve("Ab3dEf7hIj") }
            // 꺼짐 404 와 없는 토큰 404 의 본문이 같다
            offMissing.message shouldBe notFound { service(newPort()).get("Ab3dEf7hIj") }.message
            port.shares.shouldBeEmpty()
            verify(exactly = 0) { port.lockOwnedCollection(any(), any()) }
            verify(exactly = 0) { port.findOwnedCollection(any(), any()) }
            verify(exactly = 0) { port.findByToken(any()) }
        }
    }
})

/** 살아 있는 행 수를 셀 수 있는 인메모리 포트. 묶음 소유 판정은 실제 어댑터와 같은 조건(id + memberId)이다 */
private class InMemoryCollectionSharePort(
    val collections: MutableList<WishlistCollection>,
) : CollectionSharePort {
    val shares = mutableListOf<CollectionShare>()
    val items = mutableListOf<WishlistItem>()
    private var seq = 0L

    fun aliveCount(collectionId: Long, now: Instant) =
        shares.count { it.collectionId == collectionId && it.isAlive(now) }

    fun byToken(token: String) = shares.firstOrNull { it.token == token }

    override fun lockOwnedCollection(collectionId: Long, memberId: Long) =
        findOwnedCollection(collectionId, memberId)

    override fun findOwnedCollection(collectionId: Long, memberId: Long) =
        collections.firstOrNull { it.id == collectionId && it.memberId == memberId }

    override fun findCollection(collectionId: Long) = collections.firstOrNull { it.id == collectionId }

    override fun findUnrevokedByCollection(collectionId: Long) =
        shares.filter { it.collectionId == collectionId && it.revokedAt == null }

    override fun save(share: CollectionShare): CollectionShare {
        if (share.id != null) {
            shares.replaceAll { if (it.id == share.id) share else it }
            return share
        }
        val saved = CollectionShare.restore(
            ++seq, share.collectionId, share.memberId, share.token, share.createdAt, share.expiresAt, share.revokedAt,
        )
        shares += saved
        return saved
    }

    override fun findByToken(token: String) = byToken(token)

    override fun findAttractionItems(collectionId: Long, limit: Int) = items
        .filter { it.collectionId == collectionId && it.targetType == WishlistTargetType.ATTRACTION }
        .sortedByDescending { it.createdAt }
        .take(limit)

    override fun deleteAllByMemberId(memberId: Long) {
        shares.removeIf { it.memberId == memberId }
    }
}
