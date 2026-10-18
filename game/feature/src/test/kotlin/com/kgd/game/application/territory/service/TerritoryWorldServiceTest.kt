package com.kgd.game.application.territory.service

import com.kgd.game.domain.territory.model.*
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class TerritoryWorldServiceTest : BehaviorSpec({
    given("a trail whose owner has moved outside the nearby head view") {
        then("exact danger chunks still contain every nearby collidable cell, with owner appearance") {
            val service = TerritoryWorldService()
            val field = TerritoryWorldService::class.java.getDeclaredField("world").apply { isAccessible = true }
            val world = field.get(service) as TerritoryWorld
            val viewer = service.join("viewer", "viewer"); val enemy = service.join("enemy", "enemy")
            synchronized(world) {
                world.players.getValue(viewer).apply { x = 100.23; y = 104.23 }
                world.players.getValue(enemy).apply { x = 100.23; y = 100.23; started = false }
                repeat(10) { world.input(enemy, it.toLong(), true, 0.0); world.advance() }
                world.players.getValue(enemy).apply { x = 1000.0; y = 1000.0; moving = false }
            }
            val snapshot = service.snapshot(viewer, emptyMap(), true)
            snapshot.dangerChunks.any { it.chunk.cells.any { handle -> snapshot.trailOwners[handle] == enemy } } shouldBe true
            @Suppress("UNCHECKED_CAST")
            (snapshot.fields["owners"] as List<Map<String, Any?>>).any { it["id"] == enemy } shouldBe true
            val known = snapshot.dangerChunks.associate { it.id + 4096 to it.chunk.revision }
            service.snapshot(viewer, known, false).dangerChunks.size shouldBe 0
            service.leave(enemy)
            val cleared = service.snapshot(viewer, known, false)
            (enemy in cleared.living) shouldBe false
            cleared.dangerChunks.any { it.chunk.cells.any { handle -> cleared.trailOwners[handle] == enemy } } shouldBe false
        }
    }
})
