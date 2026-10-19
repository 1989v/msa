package com.kgd.game.domain.territory.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.ints.shouldBeLessThanOrEqual
import java.lang.management.ManagementFactory
import kotlin.math.hypot

class TerritoryBotTest : BehaviorSpec({
    given("thirty autonomous bots without any human or viewer") {
        then("keep expanding after their first capture instead of repeating the spawn square") {
            val world = TerritoryWorld(seed = 1)
            val cpu = ManagementFactory.getThreadMXBean()
            val cpuStart = cpu.currentThreadCpuTime
            val start = System.nanoTime()
            val tickNanos = LongArray(40 * 180)
            var maxCaptureCells = 0
            var maxPlanningCells = 0
            var maxRouteCells = 0
            var maxHeadChecks = 0
            val samples = mutableListOf<String>()
            val first = mutableMapOf<Int, Int>()
            var previousMax = 0
            repeat(40 * 180) { frame ->
                val before = System.nanoTime()
                world.advance()
                tickNanos[frame] = System.nanoTime() - before
                maxCaptureCells = maxOf(maxCaptureCells, world.lastTickCaptureCells)
                maxPlanningCells = maxOf(maxPlanningCells, world.lastTickBotPlanningCells)
                maxRouteCells = maxOf(maxRouteCells, world.lastTickBotRouteCells)
                maxHeadChecks = maxOf(maxHeadChecks, world.lastTickBotHeadChecks)
                world.lastTickBotRouteCells.shouldBeLessThanOrEqual(30 * 768)
                world.lastTickBotHeadChecks.shouldBeLessThanOrEqual(30 * 30)
                world.lastTickBotPlanningCells.shouldBeLessThanOrEqual(30 * 625)
                world.lastTickCaptureCells.shouldBeLessThanOrEqual(262144)
                if ((frame + 1) % (40 * 30) == 0) {
                    val bots = world.players.values.filter { it.bot && it.alive }
                    val maximum = bots.maxOf { it.area }
                    (maximum > previousMax) shouldBe true
                    previousMax = maximum
                    if (first.isEmpty()) first.putAll(bots.associate { it.id to it.area })
                    samples += "seconds=${(frame + 1) / 40},humans=${world.humanCount},bots=${bots.size},maxArea=${bots.maxOf { it.area }},plateau264=${bots.count { it.area == 264 }},moving=${bots.count { it.moving }},pending=${bots.count { it.capturePending }},grownBeyondFirst=${bots.count { it.area > (first[it.id] ?: Int.MAX_VALUE) }}"
                }
            }
            tickNanos.sort()
            println("TERRITORY_BOT_AUTONOMY ${samples.joinToString(" | ")} wallMs=${(System.nanoTime() - start) / 1e6} cpuMs=${(cpu.currentThreadCpuTime - cpuStart) / 1e6} tickP95Ms=${tickNanos[(tickNanos.size * .95).toInt()] / 1e6} tickMaxMs=${tickNanos.last() / 1e6} maxCaptureCells=$maxCaptureCells maxPlanningCells=$maxPlanningCells maxRouteCells=$maxRouteCells maxHeadChecks=$maxHeadChecks")
            world.humanCount shouldBe 0
            world.botCount shouldBe 30
            (world.players.values.count { it.bot && it.alive && it.area > 264 && it.area > (first[it.id] ?: Int.MAX_VALUE) } >= 20) shouldBe true
        }
    }
    given("the previously self-crossing 48-unit rectangle geometry") {
        then("closes inside owned land and keeps growing past the repeated outgoing trail") {
            val world = TerritoryWorld(seed = 1, botTarget = 1)
            repeat(40) { world.advance() }
            val bot = world.players.values.single()
            repeat(40 * 120) {
                bot.botExpansion = 48
                world.advance()
            }
            bot.alive shouldBe true
            (bot.area > 16000) shouldBe true
            println("TERRITORY_BOT_INSET area=${bot.area}")
        }
    }
    given("a bot that has earned a large route") {
        then("temporarily plans short near a head and recovers its large plan when the threat leaves") {
            val world = TerritoryWorld(seed = 1, botTarget = 2)
            val enemy = world.join("enemy", "enemy")
            val bot = world.players.values.single { it.bot }
            bot.botExpansion = 192
            enemy.x = bot.x + 20; enemy.y = bot.y
            world.advance()
            val short = bot.botRoute
            (hypot(short[1].x - short[0].x, short[1].y - short[0].y) <= 48) shouldBe true
            enemy.x += 1000; enemy.y += 1000
            bot.botRoute = emptyList()
            repeat(8) { world.advance() }
            val large = bot.botRoute
            (hypot(large[1].x - large[0].x, large[1].y - large[0].y) > 96) shouldBe true
            bot.botExpansion shouldBe 192
        }
    }
    given("a bot deep inside owned land") {
        then("walks to a frontier and grows beyond the large initial patch") {
            val world = TerritoryWorld(seed = 1, botTarget = 1)
            repeat(40) { world.advance() }
            val bot = world.players.values.single()
            patch(world, bot, bot.x.toInt(), bot.y.toInt(), 40)
            val initial = bot.area
            repeat(40 * 60) { world.advance() }
            bot.alive shouldBe true
            (bot.area > initial) shouldBe true
            println("TERRITORY_BOT_INTERIOR initial=$initial final=${bot.area} status=${bot.status}")
        }
    }
    given("a frontier near the world corner") {
        then("chooses an in-bounds expansion rather than repeating a clipped loop") {
            val world = TerritoryWorld(size = 128, seed = 1, botTarget = 1)
            repeat(40) { world.advance() }
            val bot = world.players.values.single()
            bot.x = 4.23; bot.y = 4.23
            bot.botAnchors.clear(); bot.botRoute = emptyList()
            patch(world, bot, 4, 4, 3)
            val initial = bot.area
            val trace = ArrayDeque<String>()
            repeat(40 * 30) {
                if (bot.alive) {
                    world.advance()
                    if (world.tick % 8 == 1L || !bot.alive) {
                        trace.add("tick=${world.tick} xy=${bot.x},${bot.y} heading=${bot.heading} leg=${bot.botLeg} route=${bot.botRoute} status=${bot.status} area=${bot.area}")
                        if (trace.size > 10) trace.removeFirst()
                    }
                }
            }
            if (!bot.alive) println("TERRITORY_BOT_EDGE_TRACE ${trace.joinToString(" | ")}")
            bot.alive shouldBe true
            (bot.area > initial + 264) shouldBe true
            println("TERRITORY_BOT_EDGE initial=$initial final=${bot.area} status=${bot.status}")
        }
    }
    given("a bot whose closure anchor was stolen") {
        then("invalidates that route and returns to surviving nearby land") {
            val world = TerritoryWorld(seed = 1, botTarget = 1)
            repeat(41) { world.advance() }
            val bot = world.players.values.single()
            val old = TerritoryPoint(bot.x, bot.y)
            bot.x += 10
            patch(world, bot, bot.x.toInt(), bot.y.toInt(), 3)
            bot.x += 8
            world.land.living.add(999)
            world.land.patch((-3..3).flatMap { dy -> (-3..3).map { dx -> cellId(old.x.toInt() + dx, old.y.toInt() + dy) } }, 999)
            bot.botRoute = listOf(old, old)
            bot.botAnchors.clear(); bot.botAnchors.add(old)
            val initial = world.land.area(bot.id)
            repeat(40 * 30) { world.advance() }
            bot.alive shouldBe true
            (bot.area > initial) shouldBe true
            (bot.botRoute.lastOrNull() != old) shouldBe true
            println("TERRITORY_BOT_STOLEN initial=$initial final=${bot.area} status=${bot.status}")
        }
    }
    given("a selected one-point return destination stolen during travel") {
        then("abandons it and chooses a different surviving anchor") {
            val world = TerritoryWorld(seed = 1, botTarget = 1)
            repeat(41) { world.advance() }
            val bot = world.players.values.single()
            val stolen = TerritoryPoint(bot.x, bot.y)
            val valid = TerritoryPoint(bot.x + 30, bot.y)
            patch(world, bot, valid.x.toInt(), valid.y.toInt(), 3)
            bot.x += 60
            bot.botRoute = listOf(stolen); bot.botOwnedTarget = true
            bot.botAnchors.clear(); bot.botAnchors.add(stolen); bot.botAnchors.add(valid)
            world.land.living.add(999)
            world.land.patch((-3..3).flatMap { dy -> (-3..3).map { dx -> cellId(stolen.x.toInt() + dx, stolen.y.toInt() + dy) } }, 999)
            repeat(8) { world.advance() }
            bot.botRoute.single() shouldBe valid
        }
    }
    given("no nearby land or surviving remembered anchor") {
        then("continues past successive exposed recovery waypoints instead of orbiting the first") {
            val world = TerritoryWorld(seed = 1, botTarget = 1)
            repeat(41) { world.advance() }
            val bot = world.players.values.single()
            bot.x += 100; bot.started = false; bot.heading = 0.0; bot.angle = 0.0
            bot.botAnchors.clear(); bot.botRoute = emptyList()
            val start = bot.x
            repeat(40 * 2) { world.advance() }
            bot.alive shouldBe true
            println("TERRITORY_BOT_RECOVERY distance=${bot.x - start} status=${bot.status} trail=${bot.trail.size}")
            (bot.x > start + 24) shouldBe true
            (bot.trail.size > 24) shouldBe true
            bot.botOwnedTarget shouldBe false
        }
    }
    given("a nearby exposed opponent") {
        then("still hunts first and resumes expansion when the target disappears") {
            val world = TerritoryWorld(seed = 1, botTarget = 2)
            val enemy = world.join("enemy", "enemy")
            val bot = world.players.values.single { it.bot }
            repeat(2) { world.advance() }
            val target = cellId(bot.x.toInt() + 5, bot.y.toInt())
            world.recordTrail(enemy, target, world.tick * 3)
            repeat(8) { world.advance() }
            bot.status shouldBe "HUNTING"
            bot.botRoute.size shouldBe 0
            world.activeTrails.remove(enemy.trailHandle)
            val initial = bot.area
            repeat(40 * 30) { world.advance() }
            bot.alive shouldBe true
            (bot.area > initial) shouldBe true
            println("TERRITORY_BOT_HUNT_RETURN initial=$initial final=${bot.area} status=${bot.status}")
        }
    }
})

private fun patch(world: TerritoryWorld, bot: TerritoryPlayer, cx: Int, cy: Int, radius: Int) {
    world.land.patch((-radius..radius).flatMap { dy -> (-radius..radius).map { dx -> cellId(cx + dx, cy + dy) } }, bot.id)
    bot.area = world.land.area(bot.id)
}
