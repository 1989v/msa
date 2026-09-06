package com.kgd.search.domain.queryvector.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

/**
 * 정규화 규칙 고정값 검사.
 *
 * **이 함수가 바뀌면 사전 `_id` 가 전부 어긋나 사전 전량 재적재다** (ADR-0090 §6). 그래서 규칙을
 * 고정값으로 못 박는다 — 무심코 바꾸면 여기가 먼저 빨간불이 난다.
 */
class QueryNormalizerTest : BehaviorSpec({

    given("사람이 친 질의를 정규화할 때") {
        `when`("앞뒤 공백과 연속 공백, 끝 물음표가 섞여 있으면") {
            then("공백을 하나로 줄이고 끝 부호를 떼야 한다") {
                QueryNormalizer.normalize(" 바다가  보이는 곳? ") shouldBe "바다가 보이는 곳"
            }
        }

        `when`("라틴 대문자가 섞여 있으면") {
            then("소문자로 접어야 한다 — 한글은 영향이 없다") {
                QueryNormalizer.normalize("Palace In Seoul") shouldBe "palace in seoul"
                QueryNormalizer.normalize("경복궁 Palace") shouldBe "경복궁 palace"
            }
        }

        `when`("전각 문자로 쳤으면") {
            then("NFKC 로 반각으로 펴야 한다 — 안 그러면 같은 말이 다른 키가 된다") {
                QueryNormalizer.normalize("Ｓｅｏｕｌ") shouldBe "seoul"
            }
        }

        `when`("끝에 부호가 여러 개 붙으면") {
            then("전부 떼야 한다") {
                QueryNormalizer.normalize("야경 명소!!!") shouldBe "야경 명소"
                QueryNormalizer.normalize("한옥마을...") shouldBe "한옥마을"
                QueryNormalizer.normalize("서울 근교 드라이브~") shouldBe "서울 근교 드라이브"
            }
        }

        `when`("가운데 부호는") {
            then("건드리지 않아야 한다 — 뜻이 바뀐다") {
                QueryNormalizer.normalize("아이와 갈만한 곳, 실내") shouldBe "아이와 갈만한 곳, 실내"
            }
        }

        `when`("부호나 공백만 쳤으면") {
            then("null 이어야 한다 — 사전에 빈 키를 만들지 않는다") {
                QueryNormalizer.normalize("???") shouldBe null
                QueryNormalizer.normalize("   ") shouldBe null
                QueryNormalizer.normalize("") shouldBe null
            }
        }

        `when`("100자를 넘으면") {
            then("잘라야 한다 — 문장 질의는 어차피 사전에 없다") {
                val long = "가".repeat(150)
                QueryNormalizer.normalize(long)!!.length shouldBe QueryNormalizer.MAX_LENGTH
            }
        }

        `when`("같은 말을 다르게 쳤으면") {
            then("같은 키로 모여야 한다 — 이것이 사전이 적중하는 이유다") {
                val forms = listOf("바다가 보이는 곳", " 바다가  보이는 곳 ", "바다가 보이는 곳?", "바다가 보이는 곳.")
                forms.map { QueryNormalizer.normalize(it) }.toSet().size shouldBe 1
            }
        }
    }
})
