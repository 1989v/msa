package com.kgd.analytics.infrastructure.popularity

import com.kgd.analytics.application.event.usecase.CollectEventsUseCase
import com.kgd.analytics.application.popularity.port.AttractionPopularityPort
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import java.time.LocalDate
import javax.sql.DataSource

/**
 * 원장을 하루치로 접어 전용 표에 넣는다 (ADR-0095).
 *
 * **ClickHouse 안에서 끝낸다** — 읽어서 앱으로 올렸다 다시 넣으면 하루치 원장 전체가
 * JVM 힙을 지나간다. 무료 단일 노드에서 그럴 이유가 없다.
 */
@Component
class ClickHouseAttractionPopularityAdapter(
    @Qualifier("clickHouseDataSource") private val dataSource: DataSource,
) : AttractionPopularityPort {

    override fun aggregateInto(day: LocalDate): Int {
        dataSource.connection.use { conn ->
            // 같은 날을 다시 접어도 값이 두 배가 되면 안 된다 — 넣기 전에 그날을 지운다.
            // SummingMergeTree 는 같은 키를 더하므로 재실행이 그대로 중복이 된다.
            conn.prepareStatement(DELETE_DAY).use { ps ->
                ps.setString(1, day.toString())
                ps.execute()
            }
            conn.prepareStatement(INSERT_DAY).use { ps ->
                ps.setString(1, day.toString())
                ps.setString(2, day.toString())
                return ps.executeUpdate()
            }
        }
    }

    companion object {
        private const val DELETE_DAY =
            "ALTER TABLE analytics.attraction_popularity_daily DELETE WHERE day = toDate(?)"

        /**
         * 노출·클릭·고유 클릭 방문자를 한 번에 센다. `countIf`·`uniqStateIf` 라 원장을 한 번만 훑는다.
         * 대상 축을 걸러야 한다 — 상품·블로그 노출이 섞이면 관광지 인기가 아니게 된다.
         *
         * 고유 클릭 방문자는 집계 **상태**로 넣는다(V007). 날짜를 합칠 때 `uniqMerge` 로 합쳐야
         * 여러 날 누른 한 사람이 1로 남는다. 익명은 헤더 없는 요청이 한 값으로 모인 것이라 뺀다.
         *
         * 날짜는 KST 로 자른다. 컬럼에 시간대가 없어 그냥 두면 서버 시간대(UTC)로 잘린다 — UTC 날짜는
         * KST 09시에 바뀌므로, 03:30 KST 에 접는 「어제」는 마지막 5시간 반이 아직 쌓이지 않은 채로 접힌다.
         */
        private const val INSERT_DAY = """
            INSERT INTO analytics.attraction_popularity_daily (day, attraction_id, impressions, clicks, unique_clickers)
            SELECT toDate(?) AS day,
                   entity_id AS attraction_id,
                   toUInt32(countIf(action = 'IMPRESSION')) AS impressions,
                   toUInt32(countIf(action = 'CLICK')) AS clicks,
                   uniqStateIf(visitor_id, action = 'CLICK' AND visitor_id != '${CollectEventsUseCase.ANONYMOUS_VISITOR}') AS unique_clickers
            FROM analytics.events
            WHERE entity_type = 'ATTRACTION'
              AND toDate(timestamp, 'Asia/Seoul') = toDate(?)
            GROUP BY entity_id
        """
    }
}
