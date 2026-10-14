package com.kgd.place.infrastructure.persistence.market.adapter

import com.kgd.place.domain.market.model.*
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.*
import java.sql.Connection
import java.sql.PreparedStatement
import javax.sql.DataSource

class MarketRowRestorerTest : BehaviorSpec({
    Given("deleted-row restoration through the place datasource") {
        Then("inserts original IDs, enum strings and nullable fields with bound parameters") {
            val source = mockk<DataSource>(); val connection = mockk<Connection>(relaxed = true)
            val statement = mockk<PreparedStatement>(relaxed = true)
            every { source.connection } returns connection
            every { connection.prepareStatement(any<String>()) } returns statement
            every { statement.executeUpdate() } returns 1
            val restore = MarketRowRestorer(source)
            restore.store(MarketStore(1, "가게", MarketStoreSource.MANUAL, id = 20,
                actorKind = MarketActorKind.ADMIN, createdByMemberId = 7, latitude = 37.0, longitude = 127.0))
            verify { connection.prepareStatement(match { it.startsWith("INSERT INTO market_store (id, market_id") && it.contains("VALUES (?, ?,") }) }
            verify { statement.setObject(1, 20L) }
            verify { statement.setString(4, "MANUAL") }
            clearMocks(connection, statement, answers = false)
            restore.zone(MarketZone(1, MarketZoneKind.BUILDING, "본관", MarketZoneSource.MANUAL, id = 30))
            verify { connection.prepareStatement(match { it.startsWith("INSERT INTO market_zone (id, market_id") }) }
            verify { statement.setObject(1, 30L) }
            verify { statement.setString(3, "BUILDING") }
            clearMocks(connection, statement, answers = false)
            restore.override(MarketStoreOverride(20, MarketStoreField.NAME, "수정", "근거", 7, MarketActorKind.ADMIN, id = 100))
            verify { connection.prepareStatement(match { it.startsWith("INSERT INTO market_store_override (id, store_id") }) }
            verify { statement.setObject(1, 100L) }
            verify { statement.setString(3, "NAME") }
        }
    }
})
