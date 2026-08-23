package com.kgd.codedictionary.domain.techdomain

import com.kgd.codedictionary.domain.techdomain.model.TechDomain
import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe

class TechDomainTest : BehaviorSpec({

    fun domain(
        code: String = "order",
        label: String = "주문·결제",
        active: Boolean = true,
        conceptIds: List<String> = listOf("saga-pattern", "idempotency"),
    ) = TechDomain(
        id = null,
        code = code,
        label = label,
        tagline = "주문 상태 전이와 보상 트랜잭션",
        orderNo = 30,
        active = active,
        conceptIds = conceptIds,
    )

    given("기술 도메인을 만들 때") {

        `when`("코드가 소문자-하이픈 형식이 아니면") {
            then("거부한다") {
                shouldThrow<BusinessException> { domain(code = "Order") }
                shouldThrow<BusinessException> { domain(code = "order_1") }
                shouldThrow<BusinessException> { domain(code = "-order") }
            }
        }

        `when`("이름이 비어 있으면") {
            then("거부한다") {
                shouldThrow<BusinessException> { domain(label = "  ") }
            }
        }

        `when`("활성인데 개념이 하나도 없으면") {
            then("거부한다 — 눌러도 아무것도 펼쳐지지 않는 빈 루트가 된다") {
                shouldThrow<BusinessException> { domain(conceptIds = emptyList()) }
            }
        }

        `when`("비활성이라 개념이 비어 있으면") {
            then("허용한다 — 전시하지 않는 도메인은 채워둘 이유가 없다") {
                domain(active = false, conceptIds = emptyList()).active shouldBe false
            }
        }

        `when`("같은 개념이 한 도메인에 두 번 실리면") {
            then("거부한다 — 맵에서 같은 노드가 두 번 세어진다") {
                shouldThrow<BusinessException> { domain(conceptIds = listOf("idempotency", "idempotency")) }
            }
        }
    }

    given("업무 도메인은 개념의 기술 분류와 축이 다를 때") {
        then("한 개념이 여러 도메인에 실릴 수 있다") {
            val partner = domain(code = "partner", label = "파트너 연동", conceptIds = listOf("idempotency", "retry-pattern"))
            val ingest = domain(code = "ingest", label = "데이터 수집", conceptIds = listOf("idempotency", "rate-limiting"))
            partner.conceptIds shouldContainExactly listOf("idempotency", "retry-pattern")
            ingest.conceptIds shouldContainExactly listOf("idempotency", "rate-limiting")
        }
    }
})
