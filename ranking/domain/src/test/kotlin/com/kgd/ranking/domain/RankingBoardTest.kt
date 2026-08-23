package com.kgd.ranking.domain

import com.kgd.common.exception.BusinessException
import com.kgd.ranking.domain.model.BoardStatus
import com.kgd.ranking.domain.model.RankingBoard
import com.kgd.ranking.domain.model.RankingDomain
import com.kgd.ranking.domain.model.RankingMetric
import com.kgd.ranking.domain.model.SortDirection
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class RankingBoardTest : BehaviorSpec({

    fun board(
        slug: String = "gas-11680-b027",
        scopeKey: String = "11680",
        title: String = "강남구 휘발유 최저가",
        unit: String = "원/L",
        sourceLabel: String = "한국석유공사 오피넷",
        status: BoardStatus = BoardStatus.OPEN,
    ) = RankingBoard(
        id = null,
        slug = slug,
        domain = RankingDomain.GAS_STATION,
        metric = RankingMetric.FUEL_PRICE,
        direction = SortDirection.ASC,
        scopeKey = scopeKey,
        scopeName = "강남구",
        title = title,
        subtitle = null,
        unit = unit,
        sourceLabel = sourceLabel,
        status = status,
    )

    Given("보드를 만들 때") {
        Then("slug 는 소문자·숫자·하이픈만 허용한다") {
            shouldThrow<BusinessException> { board(slug = "Gas_11680") }
            shouldThrow<BusinessException> { board(slug = "gas--11680") }
        }

        Then("출처 표기가 비어 있으면 만들 수 없다 — 공공누리·KOGL 은 출처 표시가 의무다") {
            shouldThrow<BusinessException> { board(sourceLabel = " ") }
        }

        Then("스코프·제목·단위가 비어 있으면 만들 수 없다") {
            shouldThrow<BusinessException> { board(scopeKey = "") }
            shouldThrow<BusinessException> { board(title = "") }
            shouldThrow<BusinessException> { board(unit = "") }
        }
    }

    Given("보드 상태가 HOLD 일 때") {
        Then("전시되지 않는다") {
            board(status = BoardStatus.HOLD).status.displayed shouldBe false
            board(status = BoardStatus.OPEN).status.displayed shouldBe true
        }
    }
})
