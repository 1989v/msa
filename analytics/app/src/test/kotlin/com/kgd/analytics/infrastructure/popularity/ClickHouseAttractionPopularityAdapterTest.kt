package com.kgd.analytics.infrastructure.popularity

import com.kgd.analytics.application.popularity.usecase.AggregateAttractionPopularityUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.mockk.every
import io.mockk.mockk
import java.sql.Connection
import java.sql.PreparedStatement
import java.time.LocalDate
import javax.sql.DataSource

/**
 * 어댑터가 ClickHouse 로 **보내는 SQL 과 인자**를 본다. 이 모듈엔 ClickHouse 컨테이너 테스트가 없어서
 * 합치기 의미(uniqMerge 가 여러 날의 같은 방문자를 1로 센다)는 배포 뒤 대조 질의가 확인한다.
 *
 * 기대값은 리터럴로 적는다 — 프로덕션 상수로 조립하면 상수가 비어도 초록불이 난다.
 */
class ClickHouseAttractionPopularityAdapterTest : BehaviorSpec({

    class Sent(val sql: String, val params: MutableMap<Int, String> = mutableMapOf())

    fun fakeDataSource(sent: MutableList<Sent>): DataSource {
        val dataSource = mockk<DataSource>()
        val conn = mockk<Connection>(relaxed = true)
        every { dataSource.connection } returns conn
        every { conn.prepareStatement(any()) } answers {
            val record = Sent(firstArg())
            sent += record
            mockk<PreparedStatement>(relaxed = true).also { ps ->
                every { ps.setString(any(), any()) } answers { record.params[firstArg()] = secondArg() }
                every { ps.executeUpdate() } returns 3
            }
        }
        return dataSource
    }

    fun oneLine(sql: String) = sql.replace(Regex("\\s+"), " ").trim()

    given("하루를 접을 때") {
        val sent = mutableListOf<Sent>()
        val rows = ClickHouseAttractionPopularityAdapter(fakeDataSource(sent)).aggregateInto(LocalDate.of(2026, 9, 30))

        then("그날을 지운 뒤 한 번만 넣는다 — 하루 한 행 불변식") {
            rows shouldBe 3
            sent.size shouldBe 2
            sent[0].sql shouldContain "DELETE WHERE day = toDate(?)"
            sent[0].params[1] shouldBe "2026-09-30"
            sent[1].sql shouldContain "INSERT INTO analytics.attraction_popularity_daily"
            sent[1].params.values.toSet() shouldBe setOf("2026-09-30")
        }

        then("고유 클릭 방문자 상태를 채운다 — 클릭만, 수집기가 익명에 붙이는 값은 뺀다") {
            val insert = oneLine(sent[1].sql)
            insert shouldContain "(day, attraction_id, impressions, clicks, unique_clickers)"
            // 수집기의 ANONYMOUS_VISITOR 와 같은 글자여야 한다 — 한쪽만 바뀌면 익명 전체가 한 사람으로 섞인다
            insert shouldContain
                "uniqStateIf(visitor_id, action = 'CLICK' AND section_id NOT IN ('MAP_LINK', 'FAVORITE', 'DIRECTIONS', 'SHARE') AND visitor_id != 'anonymous') AS unique_clickers"
            // 노출은 순위의 결과라 방문자 신호에 섞지 않는다
            insert shouldNotContain "uniqStateIf(visitor_id, action = 'IMPRESSION'"
        }

        then("날짜는 KST 로 자른다 — UTC 로 자르면 03:30 KST 에 접는 어제의 마지막 5시간 반이 빠진다") {
            oneLine(sent[1].sql) shouldContain "toDate(timestamp, 'Asia/Seoul') = toDate(?)"
        }

        then("노출·클릭 합계는 그대로 센다 — place-ingest 가 읽는 값이다") {
            val insert = oneLine(sent[1].sql)
            insert shouldContain "toUInt32(countIf(action = 'IMPRESSION')) AS impressions"
            insert shouldContain "toUInt32(countIf(action = 'CLICK' AND section_id NOT IN ('MAP_LINK', 'FAVORITE', 'DIRECTIONS', 'SHARE'))) AS clicks"
        }

        then("선택 뒤 후속 행동(지도 열기·찜)은 클릭 수와 고유 클릭자에서만 뺀다 — 노출 집계에는 제외가 없다") {
            val insert = oneLine(sent[1].sql)
            insert shouldContain "countIf(action = 'CLICK' AND section_id NOT IN ('MAP_LINK', 'FAVORITE', 'DIRECTIONS', 'SHARE'))"
            insert shouldContain
                "uniqStateIf(visitor_id, action = 'CLICK' AND section_id NOT IN ('MAP_LINK', 'FAVORITE', 'DIRECTIONS', 'SHARE') AND visitor_id != 'anonymous')"
            insert shouldNotContain "action = 'IMPRESSION' AND"
        }
    }

    given("제외 목록 상수") {
        then("선택 뒤 후속 행동 네 섹션이다 — FE events.ts 의 같은 이름 주석과 한 몸") {
            AggregateAttractionPopularityUseCase.POST_SELECTION_SECTIONS shouldBe setOf("MAP_LINK", "FAVORITE", "DIRECTIONS", "SHARE")
        }
    }
})
