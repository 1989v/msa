package com.kgd.game.domain.territory.model

import kotlin.math.*
import kotlin.random.Random
import java.util.BitSet

private val BOT_DIRECTIONS = listOf(1 to 0, 0 to 1, -1 to 0, 0 to -1)

class TerritoryWorld(val size: Int = 4096, seed: Int = 1, val botTarget: Int = 30) {
    init { require(size in 16..4096) }
    val land = TerritoryLand(size)
    val players = LinkedHashMap<Int, TerritoryPlayer>()
    private val identities = HashMap<String, Int>()
    private val random = Random(seed)
    private var nextId = 1
    private var nextSign = 1
    private val trails = HashMap<Int, Int>()
    val activeTrails = HashMap<Int, Int>()
    private var nextTrailHandle = 1
    private val trailCleanup = BitSet(4096)
    var lastTrailCleanupCells = 0
        private set
    internal fun recordTrail(player: TerritoryPlayer, cell: Int, whenVisited: Long) {
        if (player.trail.putIfAbsent(cell, whenVisited) != null) return
        if (player.trailHandle == 0) { player.trailHandle = nextTrailHandle++; activeTrails[player.trailHandle] = player.id }
        trails[cell] = player.trailHandle; trailCell(cell, player.trailHandle)
        player.trailChunks.set(land.chunkId(cellX(cell), cellY(cell)))
    }
    private val trailChunks = HashMap<Int, IntArray>()
    private val trailRevisions = HashMap<Int, Long>()
    private val trailCounts = HashMap<Int, MutableMap<Int, Int>>()
    private var trailRevision = 0L
    fun trailChunk(id: Int): TerritoryChunk? = trailChunks[id]?.let { TerritoryChunk(trailRevisions[id] ?: 0L, it.copyOf()) }
    fun trailChunkRevision(id: Int): Long = trailRevisions[id] ?: 0
    fun trailOwners(chunks: Set<Int>): Set<Int> = chunks.flatMap { trailCounts[it].orEmpty().keys }.mapNotNull { activeTrails[it] }.toSet()
    private fun trailCell(cell: Int, owner: Int) {
        val x = cellX(cell); val y = cellY(cell); val id = land.chunkId(x, y)
        val data = trailChunks.getOrPut(id) { IntArray(4096) }; val offset = (y and 63) * 64 + (x and 63)
        val before = data[offset]; val counts = trailCounts.getOrPut(id) { HashMap() }
        if (before != 0) { val n = (counts[before] ?: 1) - 1; if (n == 0) counts.remove(before) else counts[before] = n }
        if (owner != 0) counts[owner] = (counts[owner] ?: 0) + 1
        data[offset] = owner
        trailRevisions[id] = ++trailRevision
    }
    private var capture: TerritoryCapture? = null
    private val captureQueue = ArrayDeque<List<TerritoryPlayer>>()
    var tick = 0L
        private set
    var lastCaptureWork = 0L
        private set
    var lastCaptureLatency = 0L
        private set
    var lastTickCaptureCells = 0
        private set
    var lastTickBotPlanningCells = 0
        private set
    var lastTickBotRouteCells = 0
        private set
    var lastTickBotHeadChecks = 0
        private set
    val humanCount get() = identities.size
    val botCount get() = players.values.count { it.bot && it.alive }

    fun join(identity: String, name: String, bot: Boolean = false): TerritoryPlayer {
        require(bot || identity !in identities) { "ALREADY_CONNECTED" }
        val player = TerritoryPlayer(nextId++, identity, name, bot)
        players[player.id] = player
        if (!bot) identities[identity] = player.id
        if (!spawn(player)) { player.alive = false; player.status = "SPAWN_RETRY" }
        rebalanceBots()
        return player
    }

    private fun spawn(player: TerritoryPlayer): Boolean {
        repeat(256) {
            val x = random.nextInt(4, size - 4); val y = random.nextInt(4, size - 4)
            val clear = (-3..3).all { dy -> (-3..3).all { dx -> land.owner(x + dx, y + dy) == 0 && trails[cellId(x + dx, y + dy)] !in activeTrails } }
            if (clear && players.values.none { it !== player && it.alive && hypot(it.x - x, it.y - y) < 6 }) {
                player.x = x + .23; player.y = y + .23
                land.living.add(player.id)
                land.patch((-3..3).flatMap { dy -> (-3..3).map { dx -> cellId(x + dx, y + dy) } }, player.id)
                player.area = 49
                if (player.bot) rememberBotAnchor(player, TerritoryPoint(player.x, player.y))
                return true
            }
        }
        return false
    }

    fun disconnect(id: Int) {
        val player = players[id] ?: return
        kill(player, "DISCONNECTED")
        identities.remove(player.identity)
        players.remove(id)
        rebalanceBots()
    }

    fun respawn(id: Int): TerritoryPlayer {
        val old = players[id] ?: error("NOT_JOINED")
        require(!old.alive) { "STILL_ALIVE" }
        players.remove(id); identities.remove(old.identity)
        return join(old.identity, old.name).also { it.appearance = old.appearance }
    }

    fun input(id: Int, sequence: Long, moving: Boolean, angle: Double) {
        val player = players[id] ?: return
        require(sequence >= 0 && sequence <= 9_007_199_254_740_991L && sequence > player.sequence) { "INPUT_SEQUENCE" }
        require(angle.isFinite()) { "INPUT_ANGLE" }
        player.sequence = sequence; player.lastInputTick = tick
        player.moving = moving && player.alive && !player.capturePending; player.angle = wrapped(angle)
    }

    fun setAppearance(id: Int, appearance: TerritoryAppearance) { players[id]?.appearance = appearance }
    fun placeSign(id: Int, x: Int, y: Int, text: String, logo: String) {
        val player = players[id] ?: error("NOT_JOINED")
        require(player.alive && land.owner(x, y) == id && player.signs.size < 3) { "SIGN_ANCHOR" }
        require(text.codePointCount(0, text.length) <= 24 && text.codePoints().noneMatch { Character.isISOControl(it) } && logo in setOf("flag", "star", "leaf")) { "SIGN_FORMAT" }
        player.signs.add(TerritorySign(nextSign++, x, y, text, logo))
    }
    fun removeSign(id: Int, sign: Int) { players[id]?.signs?.removeIf { it.id == sign } }

    private fun kill(player: TerritoryPlayer, reason: String) {
        if (!player.alive) return
        player.alive = false; player.moving = false; player.capturePending = false
        player.status = reason; player.area = 0; player.signs.clear(); land.living.remove(player.id)
        clearTrail(player)
    }
    private fun clearTrail(player: TerritoryPlayer) {
        activeTrails.remove(player.trailHandle)
        trailCleanup.or(player.trailChunks) // Exactly64 machine words max; duplicate chunks coalesce, queue never exceeds4096 IDs.
        player.trailHandle = 0; player.trail = LinkedHashMap(); player.path = ArrayList(); player.trailChunks = BitSet(4096)
    }
    private fun reclaimTrail() {
        lastTrailCleanupCells = 0
        val id = trailCleanup.nextSetBit(0)
        if (id < 0) return
        trailCleanup.clear(id)
        val data = trailChunks[id] ?: return
        for (offset in data.indices) {
            lastTrailCleanupCells++
            val handle = data[offset]
            if (handle != 0 && handle !in activeTrails) {
                val x = id % land.side * 64 + offset % 64; val y = id / land.side * 64 + offset / 64
                val cell = cellId(x, y)
                if (trails[cell] == handle) trails.remove(cell)
                trailCell(cell, 0)
            }
        }
    }

    private fun rebalanceBots() {
        val target = max(0, botTarget - humanCount)
        val bots = players.values.filter { it.bot }.toList()
        for (bot in bots) if (!bot.alive || botCount > target) { kill(bot, "BOT_REPLACED"); players.remove(bot.id) }
        var missing = target - botCount
        while (missing-- > 0) {
            val bot = TerritoryPlayer(nextId++, "bot-$nextId", "유랑 ${nextId % 1000}", true)
            bot.appearance = TerritoryAppearance((bot.id - 1) % 6, bot.id % 3)
            players[bot.id] = bot
            if (!spawn(bot)) { players.remove(bot.id); break }
        }
    }

    private fun rememberBotAnchor(player: TerritoryPlayer, point: TerritoryPoint) {
        if (player.botAnchors.lastOrNull()?.let { hypot(it.x - point.x, it.y - point.y) < 2 } == true) return
        player.botAnchors.addLast(point)
        while (player.botAnchors.size > 8) player.botAnchors.removeFirst()
    }

    private fun steerBot(player: TerritoryPlayer, point: TerritoryPoint) {
        val desired = atan2(point.y - player.y, point.x - player.x)
        val turn = wrapped(desired - player.heading)
        // Exposed instant reverse is forbidden for everyone. Bots request an
        // intermediate curve heading instead of repeatedly asking for a stopped reverse.
        player.angle = if (player.started && land.owner(player.x.toInt(), player.y.toInt()) != player.id && abs(turn) > PI * .9)
            wrapped(player.heading + sign(turn) * PI * .75) else desired
        player.moving = true
    }

    private fun botWalk(player: TerritoryPlayer, ownedOnly: Boolean): TerritoryPoint {
        val direction = ((player.heading / (PI / 2)).roundToInt() % 4 + 4) % 4
        for (offset in 0..3) {
            val angle = (direction + offset) * PI / 2
            val dx = cos(angle).roundToInt(); val dy = sin(angle).roundToInt()
            val x = player.x + dx * 8; val y = player.y + dy * 8
            if (x !in 4.0..(size - 5.0) || y !in 4.0..(size - 5.0)) continue
            if (!ownedOnly || (1..8).all { land.owner((player.x + dx * it).toInt(), (player.y + dy * it).toInt()) == player.id })
                return TerritoryPoint(x, y)
        }
        return TerritoryPoint(player.x, player.y)
    }

    private fun botRectangle(player: TerritoryPlayer, x: Int, y: Int, nx: Int, ny: Int, side: Int): List<TerritoryPoint>? {
        // Start/close inside owned land. Closing at the frontier itself can hit
        // the curved outgoing trail before reaching land (especially at 48/96).
        val inset = if (x - nx * 4 in 4 until size - 4 && y - ny * 4 in 4 until size - 4) 4 else 3
        if ((1..inset).any { land.owner(x - nx * it, y - ny * it) != player.id }) return null
        val ax = x + .5 - nx * inset; val ay = y + .5 - ny * inset
        if (ax !in 4.5..(size - 4.5) || ay !in 4.5..(size - 4.5)) return null
        val outward = minOf(side.toDouble(), if (nx > 0) size - 4.5 - ax else if (nx < 0) ax - 4.5 else if (ny > 0) size - 4.5 - ay else ay - 4.5)
        if (outward < 8) return null
        for (sign in 1 downTo -1 step 2) {
            val tx = -ny * sign; val ty = nx * sign
            val across = minOf(side.toDouble(), if (tx > 0) size - 4.5 - ax else if (tx < 0) ax - 4.5 else if (ty > 0) size - 4.5 - ay else ay - 4.5)
            if (across < 8) continue
            return listOf(TerritoryPoint(ax, ay), TerritoryPoint(ax + nx * outward, ay + ny * outward),
                TerritoryPoint(ax + nx * outward + tx * across, ay + ny * outward + ty * across),
                TerritoryPoint(ax + tx * across, ay + ty * across), TerritoryPoint(ax, ay))
        }
        return null
    }

    private fun botRouteClear(player: TerritoryPlayer, route: List<TerritoryPoint>, remaining: IntArray): Boolean {
        for (index in 1..route.lastIndex) {
            val a = route[index - 1]; val b = route[index]
            val steps = ceil(hypot(b.x - a.x, b.y - a.y)).toInt()
            for (step in 0 until steps) {
                if (remaining[0]-- <= 0) return false
                lastTickBotRouteCells++
                val x = (a.x + (b.x - a.x) * step / steps).toInt()
                val y = (a.y + (b.y - a.y) * step / steps).toInt()
                if (activeTrails[trails[cellId(x, y)]] == player.id) return false
            }
        }
        return true
    }

    private fun planBot(player: TerritoryPlayer) {
        if (player.capturePending) return
        var target: Int? = null; var distance = Double.POSITIVE_INFINITY
        var frontier: List<TerritoryPoint>? = null; var frontierDistance = Double.POSITIVE_INFINITY
        var nearbyOwned: TerritoryPoint? = null; var ownedDistance = Double.POSITIVE_INFINITY
        // A previously owned closure point may have been captured by another player.
        if (player.botOwnedTarget && player.botRoute.isNotEmpty() && player.botRoute.last().let { land.owner(it.x.toInt(), it.y.toInt()) != player.id }) {
            player.botRoute = emptyList(); player.botLeg = 0
        }
        val needsRoute = player.botRoute.isEmpty()
        // With bots present the fill target bounds this population check to 30.
        // Only new plans use it; human/bot motion and combat rules are identical.
        val threatened = needsRoute && players.values.any {
            lastTickBotHeadChecks++
            it !== player && it.alive && hypot(it.x - player.x, it.y - player.y) < 48
        }
        val side = if (threatened) 48 else player.botExpansion
        var frontierX = 0; var frontierY = 0; var frontierNX = 0; var frontierNY = 0
        // Attack and frontier discovery share the existing bounded 25×25 scan.
        // There is no viewer proximity gate, larger-radius retry or whole-map search.
        for (dy in -12..12) for (dx in -12..12) {
            val x = floor(player.x).toInt() + dx; val y = floor(player.y).toInt() + dy
            if (x !in 0 until size || y !in 0 until size) continue
            lastTickBotPlanningCells++
            val d = (dx * dx + dy * dy).toDouble()
            val owner = activeTrails[trails[cellId(x, y)]]
            if (owner != null && owner != player.id && d < distance) { target = cellId(x, y); distance = d }
            if (!needsRoute || land.owner(x, y) != player.id) continue
            if (d < ownedDistance) { nearbyOwned = TerritoryPoint(x + .5, y + .5); ownedDistance = d }
            // At 5 Hz a turn can overshoot a waypoint by up to one planning step.
            // Keep the whole expansion rectangle clear of the lethal world edge.
            if (d >= frontierDistance || x !in 4 until size - 4 || y !in 4 until size - 4) continue
            for ((nx, ny) in BOT_DIRECTIONS) {
                if (x + nx !in 0 until size || y + ny !in 0 until size || land.owner(x + nx, y + ny) == player.id) continue
                val candidate = botRectangle(player, x, y, nx, ny, side) ?: continue
                frontier = candidate; frontierDistance = d
                frontierX = x; frontierY = y; frontierNX = nx; frontierNY = ny
                if (frontierDistance == d) break
            }
        }
        if (target != null) {
            player.botRoute = emptyList(); player.botLeg = 0
            steerBot(player, TerritoryPoint(cellX(target) + .5, cellY(target) + .5))
            player.status = "HUNTING"; return
        }
        if (needsRoute) {
            // At most 768 perimeter probes across all size retries, only when
            // choosing a new route. Enemy trails remain attack opportunities.
            val remaining = intArrayOf(768)
            var candidateSide = side
            while (frontier != null && !botRouteClear(player, frontier, remaining)) {
                candidateSide /= 2
                frontier = if (candidateSide >= 48) botRectangle(player, frontierX, frontierY, frontierNX, frontierNY, candidateSide) else null
            }
            val onOwn = land.owner(player.x.toInt(), player.y.toInt()) == player.id
            val remembered = player.botAnchors.filter { land.owner(it.x.toInt(), it.y.toInt()) == player.id }
                .minByOrNull { hypot(it.x - player.x, it.y - player.y) }
            player.botOwnedTarget = onOwn || nearbyOwned != null || remembered != null
            player.botRoute = (if (onOwn) frontier else null) ?: listOf(when {
                onOwn -> botWalk(player, true) // Walk through owned interior until a local frontier is visible.
                nearbyOwned != null -> nearbyOwned
                remembered != null -> remembered // The last anchor may have been stolen; validate every remembered anchor.
                else -> botWalk(player, false) // No known surviving anchor: bounded physical recovery, never idle at a stolen point.
            })
            player.botLeg = 0
            player.status = if (onOwn && frontier != null) "EXPANDING" else if (onOwn) "SEEKING_FRONTIER" else "RETURNING"
        }
        while (player.botLeg < player.botRoute.lastIndex && hypot(player.botRoute[player.botLeg].x - player.x, player.botRoute[player.botLeg].y - player.y) < 2)
            player.botLeg++
        val point = player.botRoute[player.botLeg]
        if (hypot(point.x - player.x, point.y - player.y) < 2 && player.botLeg == player.botRoute.lastIndex && (player.botRoute.size == 1 || player.trail.isEmpty())) {
            player.botRoute = emptyList() // Interior travel and completed loops must also re-plan instead of orbiting forever.
        }
        steerBot(player, point)
    }

    fun advance() {
        tick++
        lastTickBotPlanningCells = 0
        lastTickBotRouteCells = 0
        lastTickBotHeadChecks = 0
        if (tick % 8 == 1L) for (player in players.values) if (player.bot && player.alive) planBot(player)
        val closures = LinkedHashSet<TerritoryPlayer>()
        repeat(3) { substep(closures, it) }
        if (closures.isNotEmpty()) {
            if (captureQueue.size < 4) captureQueue.addLast(closures.toList())
            else for (player in closures) { player.capturePending = false; player.status = "CAPTURE_BUSY" }
        }
        if (capture == null && captureQueue.isNotEmpty()) {
            val cohort = captureQueue.removeFirst().filter { it.alive }
            if (cohort.isNotEmpty()) capture = TerritoryCapture(land, cohort, tick)
        }
        lastTickCaptureCells = 0
        val job = capture
        if (job != null) {
            val before = job.work
            val finished = job.advance(262144, System.nanoTime() + 4_000_000)
            lastTickCaptureCells = (job.work - before).toInt()
            if (finished) {
                lastCaptureWork = job.work; lastCaptureLatency = tick - job.startedAt
                for (player in job.players) if (player.alive) {
                    player.capturePending = false; player.status = if (job.valid) "CAPTURED" else job.failure ?: "CAPTURE_CHANGED_RETRY"
                    if (player.bot && !job.valid) {
                        player.botExpansion = max(48, player.botExpansion / 2)
                        player.botRoute = emptyList(); player.botLeg = 0
                    }
                    if (job.valid) {
                        if (player.bot) {
                            if (land.area(player.id) > player.area) player.botExpansion = min(192, player.botExpansion * 2)
                            for (point in player.botRoute + TerritoryPoint(player.x, player.y))
                                if (land.owner(point.x.toInt(), point.y.toInt()) == player.id) rememberBotAnchor(player, point)
                            player.botRoute = emptyList(); player.botLeg = 0
                        }
                        clearTrail(player)
                    }
                }
                capture = null
            }
        }
        for (player in players.values) {
            player.area = land.area(player.id)
            player.signs.removeIf { land.owner(it.x, it.y) != player.id }
        }
        // Reclamation mutates land revisions, so defer while a snapshot transaction is reading.
        if (capture == null) land.reclaim()
        reclaimTrail()
        if (tick % 40 == 0L) rebalanceBots()
    }

    private data class Motion(val player: TerritoryPlayer, val x: Double, val y: Double, val cells: IntArray, val moved: Boolean)
    private fun substep(closures: MutableSet<TerritoryPlayer>, sub: Int) {
        val motions = ArrayList<Motion>()
        val deaths = LinkedHashMap<TerritoryPlayer, String>()
        for (player in players.values) {
            if (!player.alive) continue
            if (!player.bot && tick - player.lastInputTick > 14) player.moving = false
            var moving = player.moving && !player.capturePending
            val own = land.owner(floor(player.x).toInt(), floor(player.y).toInt()) == player.id
            if (moving && player.started && !own && abs(wrapped(player.angle - player.heading)) > PI * .9) moving = false
            if (moving) {
                if (!player.started) { player.heading = player.angle; player.started = true }
                player.heading = wrapped(player.heading + wrapped(player.angle - player.heading).coerceIn(-TERRITORY_TURN * TERRITORY_STEP, TERRITORY_TURN * TERRITORY_STEP))
            }
            var x = player.x + if (moving) cos(player.heading) * TERRITORY_SPEED * TERRITORY_STEP else 0.0
            var y = player.y + if (moving) sin(player.heading) * TERRITORY_SPEED * TERRITORY_STEP else 0.0
            var cells = if (moving) sweptCells(player.x, player.y, x, y) else intArrayOf(cellId(floor(x).toInt(), floor(y).toInt()))
            if (moving && (player.trail.size >= 65536 || trails.size >= 262144) && cells.any {
                land.owner(cellX(it), cellY(it)) != player.id && it !in player.trail
            }) {
                moving = false; player.moving = false; player.status = "TRAIL_CAPACITY"
                x = player.x; y = player.y; cells = intArrayOf(cellId(floor(x).toInt(), floor(y).toInt()))
            }
            if (x < 0 || y < 0 || x >= size || y >= size) deaths[player] = "WORLD_EDGE"
            for (cell in cells) {
                val owner = activeTrails[trails[cell]] ?: continue
                if (owner != player.id) players[owner]?.let { deaths[it] = "TRAIL_CUT" }
                else if (moving && cell != cellId(floor(player.x).toInt(), floor(player.y).toInt()) &&
                    tick * 3 + sub - (player.trail[cell] ?: Long.MAX_VALUE) > 12) deaths[player] = "SELF_CROSS"
            }
            motions.add(Motion(player, x, y, cells, moving))
        }
        val buckets = HashMap<Long, MutableList<Motion>>()
        for (motion in motions) {
            val bx = floor(motion.player.x / 4).toInt(); val by = floor(motion.player.y / 4).toInt()
            for (dy in -1..1) for (dx in -1..1) {
                val key = ((by + dy).toLong() shl 32) xor ((bx + dx).toLong() and 0xffffffffL)
                for (other in buckets[key].orEmpty()) {
                    val ax = motion.player.x - other.player.x; val ay = motion.player.y - other.player.y
                    val vx = (motion.x - motion.player.x) - (other.x - other.player.x)
                    val vy = (motion.y - motion.player.y) - (other.y - other.player.y)
                    val denominator = vx * vx + vy * vy
                    val t = if (denominator == 0.0) 0.0 else (-(ax * vx + ay * vy) / denominator).coerceIn(0.0, 1.0)
                    if ((ax + vx * t).pow(2) + (ay + vy * t).pow(2) < .49) {
                        deaths[motion.player] = "HEAD_COLLISION"; deaths[other.player] = "HEAD_COLLISION"
                    }
                }
            }
            val key = (by.toLong() shl 32) xor (bx.toLong() and 0xffffffffL)
            buckets.getOrPut(key) { ArrayList() }.add(motion)
        }
        for ((player, reason) in deaths) kill(player, reason)
        for (motion in motions) {
            val player = motion.player
            if (!player.alive || !motion.moved) continue
            player.x = motion.x; player.y = motion.y
            for (cell in motion.cells) {
                if (land.owner(cellX(cell), cellY(cell)) != player.id) {
                    recordTrail(player, cell, tick * 3 + sub)
                } else if (player.trail.isNotEmpty()) {
                    player.capturePending = true; player.moving = false; player.status = "CAPTURE_PENDING"; closures.add(player)
                }
            }
            if (player.trail.isNotEmpty()) {
                val last = player.path.lastOrNull()
                if (last == null || hypot(player.x - last.x, player.y - last.y) >= .5) player.path.add(TerritoryPoint(player.x, player.y))
                // Visual path is not collision authority. Decimate instead of killing long-lived exposed players.
                if (player.path.size > 4096) {
                    val reduced = player.path.filterIndexed { index, _ -> index % 2 == 0 || index == player.path.lastIndex }
                    player.path.clear(); player.path.addAll(reduced)
                }
            }
        }
    }
}
