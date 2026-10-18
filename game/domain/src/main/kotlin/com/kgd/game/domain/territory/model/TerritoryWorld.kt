package com.kgd.game.domain.territory.model

import kotlin.math.*
import kotlin.random.Random
import java.util.BitSet

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
                player.x = x + .23; player.y = y + .23; player.botOriginX = player.x; player.botOriginY = player.y
                land.living.add(player.id)
                land.patch((-3..3).flatMap { dy -> (-3..3).map { dx -> cellId(x + dx, y + dy) } }, player.id)
                player.area = 49
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

    private fun planBot(player: TerritoryPlayer) {
        if (player.capturePending) return
        // Query every actual cell in a bounded 25×25 neighborhood; sparse probes miss thin trails.
        var target: Int? = null; var distance = Double.POSITIVE_INFINITY
        for (dy in -12..12) for (dx in -12..12) {
            val x = floor(player.x).toInt() + dx; val y = floor(player.y).toInt() + dy
            val owner = activeTrails[trails[cellId(x.coerceIn(0, size - 1), y.coerceIn(0, size - 1))]]
            if (owner != null && owner != player.id && dx * dx + dy * dy < distance) {
                target = cellId(x, y); distance = (dx * dx + dy * dy).toDouble()
            }
        }
        if (target != null) {
            player.angle = atan2(cellY(target) + .5 - player.y, cellX(target) + .5 - player.x)
            player.moving = true; player.status = "HUNTING"; return
        }
        val targets = arrayOf(
            TerritoryPoint(player.botOriginX + 12, player.botOriginY),
            TerritoryPoint(player.botOriginX + 12, player.botOriginY + 12),
            TerritoryPoint(player.botOriginX, player.botOriginY + 12),
            TerritoryPoint(player.botOriginX, player.botOriginY),
        )
        val point = targets[player.botLeg % 4]
        if (hypot(point.x - player.x, point.y - player.y) < 1) player.botLeg++
        player.angle = atan2(point.y.coerceIn(1.0, size - 1.0) - player.y, point.x.coerceIn(1.0, size - 1.0) - player.x)
        player.moving = true
    }

    fun advance() {
        tick++
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
                    if (job.valid) clearTrail(player)
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
