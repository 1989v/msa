package com.kgd.game.domain.territory.model

/** Fixed-size descriptor root, sparse immutable payloads. Payload arrays are never changed after publication. */
data class TerritoryChunk(val revision: Long, val cells: IntArray)

class TerritoryLand(val size: Int) {
    val side = (size + 63) / 64
    var root: Array<TerritoryChunk?> = arrayOfNulls(side * side)
        private set
    var revision = 0L
        private set
    val living = HashSet<Int>()
    private val areas = HashMap<Int, Int>()
    val ownerBounds = HashMap<Int, IntArray>()
    val chunkCounts = HashMap<Int, Map<Int, Int>>()
    private var reclaimCursor = 0
    var lastPublishOperations = 0
        private set

    fun chunkId(x: Int, y: Int) = (y / 64) * side + x / 64
    fun owner(x: Int, y: Int): Int {
        if (x !in 0 until size || y !in 0 until size) return 0
        val id = root[chunkId(x, y)]?.cells?.get((y and 63) * 64 + (x and 63)) ?: 0
        return if (id in living) id else 0
    }
    fun area(owner: Int) = if (owner in living) areas[owner] ?: 0 else 0

    fun publish(changes: Map<Int, IntArray>, counts: Map<Int, Map<Int, Int>>, preparedDelta: Map<Int, Int>? = null, preparedBounds: Map<Int, IntArray>? = null) {
        if (changes.isEmpty()) return
        val next = root.copyOf()
        revision++
        val delta = preparedDelta ?: HashMap<Int, Int>().also { result ->
            for (id in changes.keys) {
                for ((owner, count) in chunkCounts[id].orEmpty()) result[owner] = (result[owner] ?: 0) - count
                for ((owner, count) in counts[id].orEmpty()) result[owner] = (result[owner] ?: 0) + count
            }
        }
        val bounds = preparedBounds ?: HashMap<Int, IntArray>().also { result ->
            for ((id, owners) in counts) for (owner in owners.keys) extendBounds(result, owner, id)
        }
        lastPublishOperations = root.size + changes.size * 2 + delta.size + bounds.size
        for ((owner, change) in delta) areas[owner] = (areas[owner] ?: 0) + change
        for ((owner, bound) in bounds) {
            val old = ownerBounds[owner]
            ownerBounds[owner] = if (old == null) bound else intArrayOf(minOf(old[0], bound[0]), minOf(old[1], bound[1]), maxOf(old[2], bound[2]), maxOf(old[3], bound[3]))
        }
        for ((id, cells) in changes) {
            val nextCounts = counts[id].orEmpty()
            chunkCounts[id] = nextCounts
            next[id] = if (nextCounts.isEmpty()) null else TerritoryChunk(revision, cells)
        }
        root = next
    }

    fun extendBounds(result: MutableMap<Int, IntArray>, owner: Int, chunk: Int) {
        val x = chunk % side * 64; val y = chunk / side * 64
        val old = result[owner]
        result[owner] = if (old == null) intArrayOf(x, y, x + 63, y + 63)
        else intArrayOf(minOf(old[0], x), minOf(old[1], y), maxOf(old[2], x + 63), maxOf(old[3], y + 63))
    }

    fun patch(cells: Iterable<Int>, owner: Int) {
        val changes = HashMap<Int, IntArray>()
        for (cell in cells) {
            val x = cellX(cell); val y = cellY(cell)
            val chunk = chunkId(x, y)
            val data = changes.getOrPut(chunk) { root[chunk]?.cells?.copyOf() ?: IntArray(4096) }
            data[(y and 63) * 64 + (x and 63)] = owner
        }
        publish(changes, changes.mapValues { (_, data) -> counts(data) })
    }

    fun counts(cells: IntArray): Map<Int, Int> {
        val result = HashMap<Int, Int>()
        for (owner in cells) if (owner != 0 && owner in living) result[owner] = (result[owner] ?: 0) + 1
        return result
    }

    /** Dead generations become neutral immediately, then at most one obsolete chunk is reclaimed per tick. */
    fun reclaim() {
        val id = reclaimCursor++ % root.size
        if (chunkCounts[id].orEmpty().keys.none { it !in living }) return
        val data = root[id]?.cells?.copyOf() ?: IntArray(4096)
        for (i in data.indices) if (data[i] !in living) data[i] = 0
        publish(mapOf(id to data), mapOf(id to counts(data)))
        val expired = areas.keys.filter { it !in living && areas[it] == 0 }
        for (owner in expired) { areas.remove(owner); ownerBounds.remove(owner) }
    }
}
