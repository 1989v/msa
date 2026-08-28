package com.kgd.game.infrastructure.persistence.play.adapter

import com.kgd.game.infrastructure.persistence.play.SaveCipher
import com.kgd.game.infrastructure.persistence.play.entity.GameSaveDataJpaEntity
import com.kgd.game.infrastructure.persistence.play.repository.GameSaveDataJpaRepository
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify

/**
 * 게스트 세이브의 계정 승계.
 *
 * 지키는 불변식은 둘이다:
 * ① **게임당 계정 슬롯은 하나** — 계정에 이미 세이브가 있으면 그것이 이기고 게스트 행은 건드리지 않는다.
 * ② **코드는 게스트 세이브의 자격 증명이지 계정 세이브의 자격 증명이 아니다** — 주인 있는 행은
 *    코드를 제시해도 덮이지 않는다.
 */
class GameSaveRepositoryAdapterTest : BehaviorSpec({

    val gameId = 1L
    val memberId = 7L
    val code = "ABCD2345WXYZ"

    fun cipher() = SaveCipher("default-aes-key-exactly-32bytes!")

    fun guestRow(data: String) =
        GameSaveDataJpaEntity(gameId = gameId, memberId = null, saveCode = code, data = cipher().encrypt(data))

    fun memberRow(data: String) =
        GameSaveDataJpaEntity(gameId = gameId, memberId = memberId, saveCode = "MEMBERCODE12", data = cipher().encrypt(data))

    fun adapterWith(jpa: GameSaveDataJpaRepository) = GameSaveRepositoryAdapter(jpa, cipher())

    given("로그인 사용자가 게스트 코드를 들고 저장할 때") {
        `when`("계정 슬롯이 아직 비어 있으면") {
            then("그 게스트 행이 계정으로 승계되어야 한다") {
                val jpa = mockk<GameSaveDataJpaRepository>()
                val guest = guestRow("""{"floor":9}""")
                every { jpa.findByGameIdAndMemberId(gameId, memberId) } returns null
                every { jpa.findByGameIdAndSaveCode(gameId, code) } returns guest
                every { jpa.saveAndFlush(guest) } returns guest

                val saved = adapterWith(jpa).upsert(gameId, memberId, code, """{"floor":10}""", 0L)

                guest.memberId shouldBe memberId
                saved.code shouldBe code
            }
        }

        `when`("계정 슬롯에 이미 세이브가 있으면") {
            then("계정 행이 갱신되고 게스트 행은 승계되지 않아야 한다") {
                val jpa = mockk<GameSaveDataJpaRepository>()
                val mine = memberRow("""{"floor":2}""")
                every { jpa.findByGameIdAndMemberId(gameId, memberId) } returns mine
                every { jpa.saveAndFlush(mine) } returns mine

                val saved = adapterWith(jpa).upsert(gameId, memberId, code, """{"floor":3}""", 0L)

                saved.code shouldBe "MEMBERCODE12"
                verify(exactly = 0) { jpa.findByGameIdAndSaveCode(any(), any()) }
            }
        }
    }

    given("제시된 코드가 이미 다른 계정의 것이면") {
        `when`("그 코드로 저장을 시도해도") {
            then("그 계정의 세이브를 덮지 않고 새 행을 만들어야 한다") {
                val jpa = mockk<GameSaveDataJpaRepository>()
                val other = memberRow("""{"floor":42}""")           // 주인이 있는 행
                every { jpa.findByGameIdAndMemberId(gameId, 9L) } returns null
                every { jpa.findByGameIdAndSaveCode(gameId, code) } returns other
                every { jpa.existsBySaveCode(any()) } returns false
                val created = slot<GameSaveDataJpaEntity>()
                every { jpa.save(capture(created)) } answers { created.captured }

                adapterWith(jpa).upsert(gameId, memberId = 9L, code = code, data = """{"floor":1}""", expectedVersion = 0L)

                created.captured.memberId shouldBe 9L
                created.captured.saveCode shouldNotBe code
                cipher().decrypt(other.data) shouldBe """{"floor":42}"""
                verify(exactly = 0) { jpa.saveAndFlush(any()) }
            }
        }
    }
})
