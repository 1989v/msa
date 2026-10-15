package com.kgd.place.infrastructure.persistence.market.adapter

import com.kgd.place.domain.market.model.*
import com.kgd.place.infrastructure.persistence.market.entity.*
import com.kgd.place.infrastructure.persistence.market.repository.*
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.assertions.throwables.shouldThrow
import io.mockk.*
import jakarta.persistence.EntityManager
import jakarta.persistence.Query
import org.springframework.test.util.ReflectionTestUtils
import java.util.Optional

class MarketGeometryRepositoryAdapterTest : BehaviorSpec({
    val boundaries = mockk<MarketBoundaryJpaRepository>()
    val paths = mockk<MarketPathJpaRepository>()
    val rules = mockk<MarketRoadRuleJpaRepository>()
    val adapter = MarketGeometryRepositoryAdapter(boundaries, paths, rules)
    given("geometry persistence") {
        then("maps latitude-longitude JSON and STRING enums without source conversion") {
            every { boundaries.findById(1) } returns Optional.of(MarketBoundaryJpaEntity(1,
                "[[37.0,127.0],[37.0,127.001],[37.001,127.0]]", MarketGeometrySource.MANUAL, null, null, null))
            every { paths.findAllByMarketIdOrderBySortAscIdAsc(1) } returns listOf(MarketPathJpaEntity(1, "골목", true,
                "[[37.0,127.0],[37.001,127.0]]", MarketGeometrySource.OSM, 42, 0, 3))
            every { rules.findAllByMarketIdOrderByIdAsc(1) } returns listOf(MarketRoadRuleJpaEntity(1, "오리로", null, null,
                MarketMembershipStatus.IN, "전체 도로", 4))
            adapter.findBoundary(1)!!.polygon.first() shouldBe MarketCoordinate(37.0, 127.0)
            adapter.findBoundary(1)!!.source shouldBe MarketGeometrySource.MANUAL
            adapter.findPaths(1).single().osmWayId shouldBe 42
            adapter.findRoadRules(1).single().matches("오리로", null) shouldBe true
        }
        then("updates exactly four derived columns with market and nonmanual guards") {
            val manager = mockk<EntityManager>(relaxed = true)
            val update = mockk<Query>()
            var statement = ""
            every { manager.createQuery(any<String>()) } answers { statement = firstArg(); update }
            every { update.setParameter(any<String>(), any()) } returns update
            every { update.executeUpdate() } returns 1
            ReflectionTestUtils.setField(adapter, "entityManager", manager)
            adapter.saveJudgment(1, 10, MarketStoreJudgment(MarketMembershipStatus.IN, MarketJudgedBy.BOUNDARY, 3, false))
            statement.substringAfter("set ").substringBefore("where").split(',').map { it.trim().substringBefore(" =") } shouldBe
                listOf("s.judgedMembership", "s.judgedBy", "s.pathId", "s.needsReview")
            statement.contains("s.marketId = :market and s.source <> :manual") shouldBe true
            verify { update.setParameter("manual", MarketStoreSource.MANUAL) }
            verify { update.setParameter("market", 1L) }
            every { update.executeUpdate() } returns 0
            shouldThrow<IllegalStateException> { adapter.saveJudgment(2, 10, MarketStoreJudgment(MarketMembershipStatus.IN, MarketJudgedBy.INGEST, null, false)) }
        }
        then("source market reingestion preserves center and radius overrides") {
            val markets = mockk<MarketJpaRepository>()
            val original = Market("1", "시장", MarketType.STREET, id = 1,
                centerOverrideLat = 37.1, centerOverrideLng = 127.1, radiusOverrideM = 240.0)
            every { markets.findByAttractionContentId("1") } returns MarketJpaEntity.fromDomain(original)
            every { markets.lockById(1) } returns MarketJpaEntity.fromDomain(original)
            every { markets.save(any()) } answers { firstArg() }
            val repository = MarketRepositoryAdapter(markets, mockk(), mockk(), mockk(), mockk(), mockk(), mockk())
            val saved = repository.saveMarket(original.copy(name = "새 원천명", centerOverrideLat = null,
                centerOverrideLng = null, radiusOverrideM = null))
            saved.name shouldBe "새 원천명"
            saved.centerOverrideLat shouldBe 37.1
            saved.centerOverrideLng shouldBe 127.1
            saved.radiusOverrideM shouldBe 240.0
        }
        then("roundtrips new fields and keeps them through a source reload") {
            val old = MarketStore(1, "가게", MarketStoreSource.ONNURI, sourceKey = "1", onnuriKey = "1", onnuriRaw = "{}", id = 1,
                judgedMembership = MarketMembershipStatus.IN, judgedBy = MarketJudgedBy.BOUNDARY, pathId = 3, needsReview = true)
            MarketStoreJpaEntity.fromDomain(old).toDomain() shouldBe old
            old.reloadSource(old.copy(judgedMembership = null, judgedBy = null, pathId = null, needsReview = false)).let {
                it.judgedMembership shouldBe old.judgedMembership; it.judgedBy shouldBe old.judgedBy
                it.pathId shouldBe old.pathId; it.needsReview shouldBe old.needsReview
            }
            val market = Market("1", "시장", MarketType.STREET, centerOverrideLat = 37.0, centerOverrideLng = 127.0, radiusOverrideM = 300.0)
            MarketJpaEntity.fromDomain(market).toDomain() shouldBe market
        }
    }
})
