package com.kgd.game.domain.territory.model

import java.util.BitSet
import kotlin.math.max
import kotlin.math.min

/** One same-tick cohort reads one immutable root. Cell work and staged payload storage are globally bounded. */
internal class TerritoryCapture(
    private val land: TerritoryLand,
    val players: List<TerritoryPlayer>,
    val startedAt: Long,
    private val frontierCapacity: Int = 262144,
) {
    private val baseline = land.root.copyOf()
    private val living = land.living.toSet()
    private val reads = BitSet(baseline.size)
    private val claims = HashMap<Int, IntArray>()
    private val staged = HashMap<Int, IntArray>()
    private val counts = HashMap<Int, Map<Int, Int>>()
    private val areaDelta = HashMap<Int, Int>()
    private val boundsDelta = HashMap<Int, IntArray>()
    private var playerIndex = 0
    private var fill: Fill? = null
    private var stageIds: Iterator<Int>? = null
    var work = 0L
        private set
    var done = false
        private set
    var valid = true
        private set
    var failure: String? = null
        private set

    private fun unchanged(): Boolean {
        if (players.any { !it.alive || it.id !in land.living }) return false
        var id = reads.nextSetBit(0)
        while (id >= 0) {
            if (land.root[id] !== baseline[id]) return false
            id = reads.nextSetBit(id + 1)
        }
        return true
    }

    fun advance(budget: Int, deadlineNanos: Long = Long.MAX_VALUE): Boolean {
        if (done) return true
        if (players.any { !it.alive || it.id !in land.living }) { valid = false; done = true; return true }
        var remaining = budget
        while (remaining > 0 && playerIndex < players.size) {
            if (System.nanoTime() >= deadlineNanos) return false
            val current = fill ?: Fill(players[playerIndex]).also { fill = it }
            val used = try { current.advance(min(remaining, 1024)) } catch (e: IllegalStateException) {
                if (e.message != "CAPTURE_QUEUE_CAPACITY") throw e
                valid = false; done = true; failure = "CAPTURE_CAPACITY"; return true
            }
            remaining -= used; work += used
            if (current.done) { playerIndex++; fill = null }
        }
        if (playerIndex != players.size) return false
        if (!unchanged()) { valid = false; done = true; return true }
        val iterator = stageIds ?: claims.keys.iterator().also { stageIds = it }
        // Each payload copy/count is exactly 4096 cells; no large unbudgeted commit loop.
        while (remaining >= 4096 && iterator.hasNext()) {
            if (System.nanoTime() >= deadlineNanos) return false
            val id = iterator.next()
            val data = baseline[id]?.cells?.copyOf() ?: IntArray(4096)
            val claim = claims.getValue(id)
            for (i in data.indices) if (claim[i] != 0) data[i] = if (claim[i] < 0) 0 else claim[i]
            val nextCounts = land.counts(data)
            staged[id] = data; counts[id] = nextCounts
            for ((owner, count) in land.chunkCounts[id].orEmpty()) areaDelta[owner] = (areaDelta[owner] ?: 0) - count
            for ((owner, count) in nextCounts) {
                areaDelta[owner] = (areaDelta[owner] ?: 0) + count
                land.extendBounds(boundsDelta, owner, id)
            }
            remaining -= 4096; work += 4096
        }
        if (iterator.hasNext()) return false
        valid = unchanged()
        if (valid) land.publish(staged, counts, areaDelta, boundsDelta)
        done = true
        return true
    }

    private fun claim(cell: Int, owner: Int) {
        val x = cellX(cell); val y = cellY(cell); val id = land.chunkId(x, y)
        reads.set(id)
        val data = claims.getOrPut(id) { IntArray(4096) }
        val offset = (y and 63) * 64 + (x and 63)
        val before = data[offset]
        data[offset] = if (before == 0 || before == owner) owner else -1
    }

    private inner class Fill(private val player: TerritoryPlayer) {
        private val trail = HashSet<Int>()
        private val sourceTrail = player.trail.keys.iterator()
        private val seen = HashMap<Int, BitSet>()
        private val queue = IntArray(frontierCapacity)
        private var read = 0; private var write = 0; private var queued = 0
        private var minX = land.size; private var minY = land.size; private var maxX = 0; private var maxY = 0
        private var seed = 0; private var scan = 0; private var phase = -1
        private var trailIterator: Iterator<Int>? = null
        var done = false
        private var width = 0
        private var height = 0

        init {
            land.ownerBounds[player.id]?.let { bounds ->
                minX = bounds[0]; minY = bounds[1]; maxX = bounds[2]; maxY = bounds[3]
            }
        }

        private fun marked(x: Int, y: Int): Boolean {
            // Exterior virtual cells have their own non-colliding linear IDs.
            val key = ((y + 1) / 64) * 66 + (x + 1) / 64
            val offset = ((y + 1) and 63) * 64 + ((x + 1) and 63)
            return seen[key]?.get(offset) == true
        }
        private fun add(x: Int, y: Int) {
            if (x !in minX..maxX || y !in minY..maxY || marked(x, y)) return
            if (x in 0 until land.size && y in 0 until land.size) {
                val id = land.chunkId(x, y); reads.set(id)
                val owner = baseline[id]?.cells?.get((y and 63) * 64 + (x and 63)) ?: 0
                if ((owner == player.id && owner in living) || cellId(x, y) in trail) return
            }
            val key = ((y + 1) / 64) * 66 + (x + 1) / 64
            seen.getOrPut(key) { BitSet(4096) }.set(((y + 1) and 63) * 64 + ((x + 1) and 63))
            check(queued < queue.size) { "CAPTURE_QUEUE_CAPACITY" }
            // Virtual coordinates use +1, maximum4097 fits13 bits.
            queue[write] = cellId(x + 1, y + 1); write = (write + 1) % queue.size; queued++
        }

        fun advance(budget: Int): Int {
            var used = 0
            while (used < budget && !done) {
                when (phase) {
                    -1 -> {
                        if (sourceTrail.hasNext()) {
                            val cell = sourceTrail.next(); trail.add(cell)
                            minX = min(minX, cellX(cell)); minY = min(minY, cellY(cell))
                            maxX = max(maxX, cellX(cell)); maxY = max(maxY, cellY(cell))
                        } else {
                            minX = max(-1, minX - 1); minY = max(-1, minY - 1)
                            maxX = min(land.size, maxX + 1); maxY = min(land.size, maxY + 1)
                            width = maxX - minX + 1; height = maxY - minY + 1
                            trailIterator = trail.iterator(); phase = 0; continue
                        }
                    }
                    0 -> {
                        if (seed < width * 2) {
                            add(minX + seed % width, if (seed < width) minY else maxY)
                        } else if (seed < width * 2 + height * 2) {
                            val offset = seed - width * 2
                            add(if (offset < height) minX else maxX, minY + offset % height)
                        } else { phase = 1; continue }
                        seed++
                    }
                    1 -> {
                        if (queued == 0) { phase = 2; continue }
                        val cell = queue[read]; read = (read + 1) % queue.size; queued--
                        val x = cellX(cell) - 1; val y = cellY(cell) - 1
                        add(x - 1, y); add(x + 1, y); add(x, y - 1); add(x, y + 1)
                    }
                    2 -> {
                        if (scan >= width * height) { phase = 3; continue }
                        val x = minX + scan % width; val y = minY + scan / width; scan++
                        if (x in 0 until land.size && y in 0 until land.size && !marked(x, y)) claim(cellId(x, y), player.id)
                    }
                    else -> {
                        val iterator = requireNotNull(trailIterator)
                        if (!iterator.hasNext()) { done = true; continue }
                        claim(iterator.next(), player.id)
                    }
                }
                used++
            }
            return used
        }
    }
}
