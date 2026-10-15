package com.kgd.place.infrastructure.persistence.market.adapter

import com.kgd.place.domain.market.model.*
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import jakarta.persistence.EntityManager
import org.springframework.test.util.ReflectionTestUtils
import java.sql.Connection
import java.sql.PreparedStatement
import javax.sql.DataSource

class MarketGeometryEditRepositoryAdapterTest : BehaviorSpec({
    Given("geometry JDBC writes join the place datasource and retain restored identities") {
        Then("binds coordinates and enum names and clears the persistence context before reading derived state") {
            val dataSource=mockk<DataSource>(); val connection=mockk<Connection>(relaxed=true)
            val statement=mockk<PreparedStatement>(relaxed=true); val em=mockk<EntityManager>(relaxed=true)
            every { dataSource.connection } returns connection
            every { connection.prepareStatement(any<String>(),any<Int>()) } returns statement
            every { connection.prepareStatement(any<String>()) } returns statement
            every { statement.executeUpdate() } returns 1
            val adapter=MarketGeometryEditRepositoryAdapter(dataSource,mockk(),mockk())
            ReflectionTestUtils.setField(adapter,"em",em)
            val row=MarketPath(1,"alley",true,listOf(MarketCoordinate(37.0,127.0),MarketCoordinate(37.001,127.0)),MarketGeometrySource.MANUAL,42,id=9)
            adapter.path(1,9,row) shouldBe row
            verify { connection.prepareStatement(match { it.startsWith("INSERT INTO market_path (id, market_id") && it.contains("ON DUPLICATE KEY UPDATE") },any<Int>()) }
            verify { statement.setObject(1,9L) }
            verify { statement.setObject(5,"[[37.0,127.0],[37.001,127.0]]") }
            verify { statement.setObject(6,"MANUAL") }
            adapter.geo(1,null,null,null)
            verify { connection.prepareStatement(match { it.startsWith("UPDATE market SET center_override_lat=?") }) }
            verify(exactly=2) { em.flush() }; verify(exactly=2) { em.clear() }
        }
    }
})
