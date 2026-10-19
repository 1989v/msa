package com.kgd.game.application.territory.service

import com.kgd.game.domain.territory.model.*
import com.kgd.game.application.territory.usecase.TerritoryFrame
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
    given("a distant autonomous bot outside a viewer's area of interest") {
        then("keeps growing before it becomes visible and is revealed without restarting its simulation") {
            val service = TerritoryWorldService()
            val field = TerritoryWorldService::class.java.getDeclaredField("world").apply { isAccessible = true }
            val world = field.get(service) as TerritoryWorld
            val viewer = service.join("viewer", "viewer")
            repeat(40 * 30) { service.advance() }
            val self = world.players.getValue(viewer)
            val bot = world.players.values.filter { it.bot && it.alive && kotlin.math.hypot(it.x - self.x, it.y - self.y) > 1000 }
                .maxBy { it.area }
            val before = bot.area
            @Suppress("UNCHECKED_CAST")
            fun rows(frame: TerritoryFrame, name: String) = frame.fields[name] as List<Map<String, Any?>>
            val distant = service.snapshot(viewer, emptyMap(), false)
            rows(distant, "players").none { it["id"] == bot.id } shouldBe true
            rows(distant, "top10").any { it["id"] == bot.id } shouldBe true
            repeat(40 * 30) { service.advance() }
            bot.alive shouldBe true
            (bot.area > before) shouldBe true
            self.x = bot.x + 20; self.y = bot.y + 20
            val near = service.snapshot(viewer, emptyMap(), false)
            rows(near, "players").any { it["id"] == bot.id } shouldBe true
            near.fields["tick"] shouldBe world.tick
            println("TERRITORY_BOT_AOI before=$before after=${bot.area} tick=${world.tick}")
        }
    }
})
