package com.kgd.common.shortlink

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldMatch
import kotlin.random.Random

class ShortCodeTest : BehaviorSpec({

    val maxId = (1L shl 40) - 1

    // 이미 퍼진 단축 주소가 이 값들에 묶여 있다. 순열 상수를 바꾸면 여기서 실패해야 한다.
    // 값은 구현을 한 번 돌려 얻은 결과를 리터럴로 옮긴 것이다 — 테스트 안에서 다시 계산하지 않는다.
    val golden = listOf(
        0L to "5mZiq85",
        1L to "HGWKKUQ",
        23L to "QtPv4F",
        62L to "CQy78OF",
        maxId to "FOBkmEh",
    )

    given("고정 입출력 벡터") {
        `when`("인코딩하면") {
            then("리터럴 코드와 같다") {
                golden.forEach { (id, code) -> ShortCode.encode(id) shouldBe code }
            }
        }
        `when`("디코딩하면") {
            then("리터럴 id 와 같다") {
                golden.forEach { (id, code) -> ShortCode.decode(code) shouldBe id }
            }
        }
    }

    given("경계와 무작위 id") {
        val random = Random(20261008)
        val ids = listOf(0L, 1L, 2L, 61L, 62L, maxId - 1, maxId) + List(10_000) { random.nextLong(0, maxId + 1) }

        `when`("인코딩 후 디코딩하면") {
            then("원래 id 로 돌아오고 코드는 6~7자 base62 다") {
                ids.forEach { id ->
                    val code = ShortCode.encode(id)
                    code shouldMatch Regex("[0-9A-Za-z]{6,7}")
                    ShortCode.decode(code) shouldBe id
                }
            }
        }
    }

    given("연속한 10만 id") {
        `when`("인코딩하면") {
            then("코드가 모두 다르다") {
                (1L..100_000L).map(ShortCode::encode).toSet() shouldHaveSize 100_000
            }
        }
    }

    given("범위 밖 id") {
        `when`("2^40 이나 음수를 인코딩하면") {
            then("거절한다") {
                shouldThrow<IllegalArgumentException> { ShortCode.encode(1L shl 40) }
                shouldThrow<IllegalArgumentException> { ShortCode.encode(-1L) }
            }
        }
    }

    given("해석할 수 없는 코드") {
        val rejected = mapOf(
            "5자" to "abcde",
            "8자" to "abcdefgh",
            "빈 문자열" to "",
            "base62 밖 글자" to "abc-de",
            "한글" to "가나다라마바",
            "list 별칭" to "list",
            "디코드 값 2^40 이상인 7자" to "zzzzzzz",
            "앞에 0 을 붙인 비정규 표기(id 23 의 QtPv4F)" to "0QtPv4F",
        )
        rejected.forEach { (case, code) ->
            `when`("$case 「$code」 를 디코딩하면") {
                then("예외 없이 null 이다") {
                    ShortCode.decode(code) shouldBe null
                }
            }
        }
    }
})
