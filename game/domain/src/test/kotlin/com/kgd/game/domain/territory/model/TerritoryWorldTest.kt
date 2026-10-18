package com.kgd.game.domain.territory.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.should
import io.kotest.matchers.ints.shouldBeLessThanOrEqual
import java.lang.management.ManagementFactory
import kotlin.math.*
import kotlin.random.Random

class TerritoryWorldTest : BehaviorSpec({
    fun relocate(world: TerritoryWorld, player: TerritoryPlayer, x: Double, y: Double) {
        player.x = x; player.y = y; player.started = false
    }
    fun rectangle(x: Int, y: Int, width: Int, height: Int): Set<Int> = buildSet {
        for (dx in 0..width) { add(cellId(x + dx, y)); add(cellId(x + dx, y + height)) }
        for (dy in 0..height) { add(cellId(x, y + dy)); add(cellId(x + width, y + dy)) }
    }
    fun complete(job: TerritoryCapture, budget: Int = 8192) {
        var iterations = 0
        while (!job.advance(budget)) check(++iterations < 100000)
    }

    given("authoritative held curve movement") {
        then("equal speed, release and stale lease stop; exposed stationary and resumed heads survive their current cell") {
            val world = TerritoryWorld(botTarget = 0)
            val p = world.join("a", "alpha")
            relocate(world, p, 100.23, 100.23)
            world.input(p.id, 0, true, 0.0)
            repeat(10) { world.advance() }
            p.x shouldBe (104.23 plusOrMinus .00001)
            world.input(p.id, 1, false, 0.0)
            val x = p.x
            repeat(100) { world.advance() }
            p.x shouldBe x; p.alive shouldBe true; p.trail.isNotEmpty() shouldBe true
            world.input(p.id, 2, true, 0.0); world.advance(); p.alive shouldBe true
            repeat(30) { world.advance() }; val leased = p.x
            world.advance(); p.x shouldBe leased
        }
        then("exposed reverse stops but own-land reverse moves") {
            val world = TerritoryWorld(botTarget = 0); val p = world.join("a", "a")
            relocate(world, p, 100.23, 100.23); world.input(p.id, 0, true, 0.0); world.advance()
            val x = p.x; world.input(p.id, 1, true, PI); world.advance(); p.x shouldBe x
            world.land.patch(listOf(cellId(floor(p.x).toInt(), floor(p.y).toInt())), p.id)
            world.input(p.id, 2, true, PI); world.advance(); (p.x != x) shouldBe true
        }
        then("swept supercover includes diagonal side cells and negative endpoint terminates") {
            sweptCells(.2, .2, 1.2, 1.2).toSet() shouldBe setOf(cellId(0, 0), cellId(1, 0), cellId(0, 1), cellId(1, 1))
            sweptCells(2.0, 2.0, 1.0, 1.0).isNotEmpty() shouldBe true
        }
        then("head collisions eliminate both regardless of insertion order") {
            for (reverse in listOf(false, true)) {
                val world = TerritoryWorld(botTarget = 0)
                val players = if (reverse) listOf(world.join("b", "b"), world.join("a", "a")) else listOf(world.join("a", "a"), world.join("b", "b"))
                relocate(world, players[0], 100.0, 100.0); relocate(world, players[1], 100.8, 100.0)
                world.input(players[0].id, 0, true, 0.0); world.input(players[1].id, 0, true, PI)
                world.advance(); players.all { !it.alive } shouldBe true
            }
        }
        then("disconnect clears a life immediately, respawn gets a fresh generation") {
            val world = TerritoryWorld(botTarget = 0); val p = world.join("a", "a")
            val x = p.x.toInt(); val y = p.y.toInt()
            world.disconnect(p.id); world.land.owner(x, y) shouldBe 0
            val next = world.join("a", "a"); (next.id > p.id) shouldBe true
        }
        then("cuts a stopped enemy trail and removes signs whose anchor was stolen") {
            val world = TerritoryWorld(botTarget = 0); val a = world.join("a", "a"); val b = world.join("b", "b")
            val signX = a.x.toInt(); val signY = a.y.toInt()
            world.placeSign(a.id, signX, signY, "내 땅", "flag")
            world.land.patch(listOf(cellId(signX, signY)), b.id); world.advance(); a.signs.size shouldBe 0
            relocate(world, a, 100.23, 100.23); world.input(a.id, 0, true, 0.0)
            repeat(10) { world.advance() }; world.input(a.id, 1, false, 0.0)
            relocate(world, b, 102.23, 98.23); world.input(b.id, 0, true, PI / 2)
            repeat(8) { world.advance() }
            a.alive shouldBe false; a.status shouldBe "TRAIL_CUT"
        }
        then("older self crossings remain lethal and bots find a one-cell nearby exposed line") {
            val world = TerritoryWorld(botTarget = 0); val a = world.join("a", "a")
            relocate(world, a, 100.23, 100.23)
            var seq = 0L
            for (angle in listOf(0.0, PI / 2, PI, -PI / 2, 0.0)) repeat(20) { world.input(a.id, seq++, true, angle); world.advance() }
            a.alive shouldBe false
            val hunt = TerritoryWorld(); val human = hunt.join("human", "human")
            relocate(hunt, human, 100.23, 100.23)
            repeat(20) { hunt.input(human.id, it.toLong(), true, 0.0); hunt.advance() }
            hunt.input(human.id, 21, false, 0.0)
            val bot = hunt.players.values.first { it.bot }; relocate(hunt, bot, 103.23, 108.23)
            repeat(8) { hunt.advance() }
            bot.status shouldBe "HUNTING"
        }
        then("bots fill thirty, leave for humans, and replenish after disconnect") {
            val world = TerritoryWorld()
            val humans = (1..31).map { world.join("p$it", "p$it") }
            world.botCount shouldBe 0; world.humanCount shouldBe 31
            repeat(3) { world.disconnect(humans[it].id) }
            world.humanCount shouldBe 28; world.botCount shouldBe 2
        }
        then("spawn exhaustion returns a visible retry instead of overlapping") {
            val world = TerritoryWorld(16, botTarget = 0)
            val players = (1..20).map { world.join("p$it", "p$it") }
            players.any { !it.alive && it.status == "SPAWN_RETRY" } shouldBe true
        }
        then("trail capacity stops before motion instead of permitting untracked travel or killing the player") {
            val world = TerritoryWorld(botTarget = 0); val p = world.join("cap", "cap")
            relocate(world, p, 100.23, 100.23)
            repeat(65536) { p.trail[cellId(1000 + it % 256, 1000 + it / 256)] = 0 }
            world.input(p.id, 0, true, 0.0); world.advance()
            p.x shouldBe 100.23; p.alive shouldBe true; p.status shouldBe "TRAIL_CAPACITY"
        }
        then("capacity-blocked hypothetical motion cannot cut an unreached trail or collide with an unreached head") {
            for (trail in listOf(false, true)) {
                val world = TerritoryWorld(botTarget = 0); val p = world.join("cap", "cap"); val q = world.join("other", "other")
                relocate(world, p, 100.95, 100.23); relocate(world, q, if (trail) 500.23 else 101.7, 100.23)
                if (trail) world.recordTrail(q, cellId(101, 100), 0)
                repeat(65536) { p.trail[cellId(1000 + it % 256, 1000 + it / 256)] = 0 }
                world.input(p.id, 0, true, 0.0); world.advance()
                p.x shouldBe 100.95; p.alive shouldBe true; q.alive shouldBe true
            }
        }
    }

    given("budgeted immutable capture transactions") {
        then("steals an enclosed enemy area while disconnected surviving islands remain owned") {
            val land = TerritoryLand(64); land.living.addAll(listOf(1, 2))
            land.patch(listOf(cellId(15, 15), cellId(50, 50)), 2)
            val p = TerritoryPlayer(1, "a", "a", false)
            rectangle(10, 10, 10, 10).forEach { p.trail[it] = 0 }
            complete(TerritoryCapture(land, listOf(p), 0))
            land.owner(15, 15) shouldBe 1; land.owner(50, 50) shouldBe 2
            land.area(2) shouldBe 1; land.area(1) shouldBe 121
            land.lastPublishOperations.shouldBeLessThanOrEqual(land.root.size * 3 + 8)
        }
        then("same-tick overlapping claims are neutral independent of cohort order") {
            for (reverse in listOf(false, true)) {
                val land = TerritoryLand(64); land.living.addAll(listOf(1, 2))
                val a = TerritoryPlayer(1, "a", "a", false); val b = TerritoryPlayer(2, "b", "b", false)
                rectangle(10, 10, 10, 10).forEach { a.trail[it] = 0 }; rectangle(15, 15, 10, 10).forEach { b.trail[it] = 0 }
                complete(TerritoryCapture(land, if (reverse) listOf(b, a) else listOf(a, b), 0))
                land.owner(17, 17) shouldBe 0; land.owner(12, 12) shouldBe 1; land.owner(23, 23) shouldBe 2
            }
        }
        then("interior mutations and dead wall generations invalidate stale commits") {
            val land = TerritoryLand(256); land.living.addAll(listOf(1, 2))
            val p = TerritoryPlayer(1, "a", "a", false); rectangle(5, 5, 180, 180).forEach { p.trail[it] = 0 }
            val job = TerritoryCapture(land, listOf(p), 0)
            job.advance(8192); land.patch(listOf(cellId(100, 100)), 2)
            complete(job); job.valid shouldBe false; land.owner(100, 100) shouldBe 2
            val died = TerritoryCapture(land, listOf(p), 0); land.living.remove(1); complete(died); died.valid shouldBe false
        }
        then("expired compute deadlines preserve pending work without unbounded progress") {
            val land = TerritoryLand(64); land.living.add(1)
            val p = TerritoryPlayer(1, "a", "a", false); rectangle(2, 2, 40, 40).forEach { p.trail[it] = 0 }
            val job = TerritoryCapture(land, listOf(p), 0)
            job.advance(262144, 0) shouldBe false; job.work shouldBe 0L
            complete(job); job.valid shouldBe true
        }
        then("frontier exhaustion rejects the transaction without partial ownership writes") {
            val land = TerritoryLand(64); land.living.add(1)
            val p = TerritoryPlayer(1, "a", "a", false); rectangle(10, 10, 10, 10).forEach { p.trail[it] = 0 }
            val job = TerritoryCapture(land, listOf(p), 0, frontierCapacity = 1)
            job.advance(262144) shouldBe true; job.valid shouldBe false; job.failure shouldBe "CAPTURE_CAPACITY"
            land.area(1) shouldBe 0
        }
        then("a hundred-player completion invalidates204800 trail references with at most one physical chunk cleanup") {
            val world = TerritoryWorld(botTarget = 0)
            val actors = (1..100).map { world.join("clear$it", "clear$it") }
            val cells = (0 until 2048).map { cellId(128 + it % 32, 128 + it / 32) }
            for ((index, p) in actors.withIndex()) {
                p.x = 3000.23 + index % 10 * 8; p.y = 3000.23 + index / 10 * 8
                for (cell in cells) world.recordTrail(p, cell, 0)
                p.capturePending = true
                world.land.ownerBounds.remove(p.id)
            }
            val job = TerritoryCapture(world.land, actors, 0); complete(job, 262144)
            val field = TerritoryWorld::class.java.getDeclaredField("capture").apply { isAccessible = true }; field.set(world, job)
            val start = System.nanoTime(); world.advance(); val ms = (System.nanoTime() - start) / 1e6
            world.activeTrails.size shouldBe 0
            actors.all { it.trail.isEmpty() && !it.capturePending } shouldBe true
            world.lastTrailCleanupCells.shouldBeLessThanOrEqual(4096)
            println("TERRITORY_FINISH cohort=100 oldTrailReferences=204800 physicalCellCleanup=${world.lastTrailCleanupCells} finishTickMs=$ms")
        }
        then("forty randomized small worlds agree with an independent whole-grid exterior flood oracle") {
            val random = Random(411)
            repeat(40) {
                val size = 32; val land = TerritoryLand(size); land.living.addAll(listOf(1, 2))
                val walls = mutableSetOf<Int>()
                repeat(30) { walls.add(cellId(random.nextInt(size), random.nextInt(size))) }
                land.patch(walls, 1)
                val p = TerritoryPlayer(1, "a", "a", false)
                val border = rectangle(random.nextInt(0, 10), random.nextInt(0, 10), random.nextInt(4, 16), random.nextInt(4, 16)).toMutableSet()
                if (it % 2 == 0) border.remove(border.first())
                border.forEach { p.trail[it] = 0 }
                val blocked = walls + border
                val seen = HashSet<Pair<Int, Int>>(); val queue = ArrayDeque<Pair<Int, Int>>()
                queue.add(-1 to -1); seen.add(-1 to -1)
                while (queue.isNotEmpty()) {
                    val (x, y) = queue.removeFirst()
                    for ((dx, dy) in listOf(1 to 0, -1 to 0, 0 to 1, 0 to -1)) {
                        val point = x + dx to y + dy
                        if (point.first in -1..size && point.second in -1..size && !(point.first in 0 until size && point.second in 0 until size && cellId(point.first, point.second) in blocked) && seen.add(point)) queue.add(point)
                    }
                }
                complete(TerritoryCapture(land, listOf(p), 0))
                for (y in 0 until size) for (x in 0 until size) land.owner(x, y) shouldBe if (cellId(x, y) in blocked || (x to y) !in seen) 1 else 0
            }
        }
    }

    given("4096 CPU-only hundred-input simulation") {
        then("records large capture latency and bounded commit work at two candidate budgets") {
            for (extent in listOf(256, 1024, 4000)) for (budget in listOf(8192, 65536, 262144)) {
                val land = TerritoryLand(4096); land.living.add(1)
                val p = TerritoryPlayer(1, "a", "a", false)
                rectangle(4, 4, extent, extent).forEach { p.trail[it] = 0 }
                val job = TerritoryCapture(land, listOf(p), 0)
                var ticks = 0; val durations = ArrayList<Double>(); val start = System.nanoTime()
                while (true) {
                    val before = System.nanoTime(); val done = job.advance(budget); durations.add((System.nanoTime() - before) / 1e6); ticks++
                    if (done) break
                }
                val sorted = durations.sorted()
                println("TERRITORY_CAPTURE extent=$extent budget=$budget ticks=$ticks simulatedSeconds=${ticks/40.0} wallMs=${(System.nanoTime()-start)/1e6} p95Ms=${sorted[(sorted.size*.95).toInt().coerceAtMost(sorted.lastIndex)]} maxMs=${sorted.last()} commitOps=${land.lastPublishOperations} heap=${ManagementFactory.getMemoryMXBean().heapMemoryUsage.used}")
                job.valid shouldBe true; land.area(1) shouldBe (extent + 1) * (extent + 1)
                land.lastPublishOperations.shouldBeLessThanOrEqual(4096 * 3 + 4)
            }
        }
        then("records distributed and crowded timings without changing world size or player count") {
            val output = mutableListOf<Map<String, Any>>()
            for (crowded in listOf(false, true)) {
                val world = TerritoryWorld(botTarget = 0)
                val players = (1..100).map { world.join("h$it", "human$it") }
                players.forEachIndexed { i, p -> relocate(world, p, (if (crowded) 1024.23 else 128.23) + (i % 10) * (if (crowded) 8 else 256),
                    (if (crowded) 1024.23 else 128.23) + (i / 10) * (if (crowded) 8 else 256)) }
                for (p in players) world.land.patch((-3..3).flatMap { dy -> (-3..3).map { dx -> cellId(p.x.toInt() + dx, p.y.toInt() + dy) } }, p.id)
                val times = ArrayList<Double>()
                repeat(400) { frame ->
                    players.forEach { if (it.alive) world.input(it.id, frame.toLong(), true, frame * (16.0 / 1.5) * .025) }
                    val start = System.nanoTime(); world.advance(); times.add((System.nanoTime() - start) / 1e6)
                    world.players.values.count { it.alive && !it.bot && it.moving } shouldBe 100
                    world.lastTickCaptureCells.shouldBeLessThanOrEqual(262144)
                }
                val sorted = times.sorted()
                output.add(mapOf("scenario" to if (crowded) "crowded100" else "distributed100", "participants" to 100, "world" to 4096,
                    "p50Ms" to sorted[200], "p95Ms" to sorted[380], "maxMs" to sorted.last(), "minActiveHumans" to 100,
                    "heapBytes" to ManagementFactory.getMemoryMXBean().heapMemoryUsage.used))
            }
            println("TERRITORY_CPU_BENCHMARK ${output}")
            output.size shouldBe 2
        }
    }
})
