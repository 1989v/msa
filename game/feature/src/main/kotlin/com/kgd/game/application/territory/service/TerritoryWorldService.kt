package com.kgd.game.application.territory.service

import com.kgd.game.application.territory.usecase.*
import com.kgd.game.domain.territory.model.*
import org.springframework.stereotype.Service
import kotlin.math.*

@Service
class TerritoryWorldService : TerritoryWorldUseCase {
    private val world = TerritoryWorld()
    override fun join(identity: String, name: String): Int = synchronized(world) { world.join(identity, name).id }
    override fun leave(id: Int) = synchronized(world) { world.disconnect(id) }
    override fun input(id: Int, sequence: Long, moving: Boolean, angle: Double) = synchronized(world) { world.input(id, sequence, moving, angle) }
    override fun respawn(id: Int): Int = synchronized(world) { world.respawn(id).id }
    override fun cosmetics(id: Int, appearance: TerritoryAppearance) = synchronized(world) { world.setAppearance(id, appearance) }
    override fun placeSign(id: Int, x: Int, y: Int, text: String, logo: String) = synchronized(world) { world.placeSign(id, x, y, text, logo) }
    override fun removeSign(id: Int, sign: Int) = synchronized(world) { world.removeSign(id, sign) }
    override fun advance() = synchronized(world) { world.advance() }

    override fun snapshot(id: Int, known: Map<Int, Long>, includeMap: Boolean): TerritoryFrame = synchronized(world) {
        val self = world.players[id] ?: error("NOT_JOINED")
        fun nearby(x: Double, y: Double) = abs(x - self.x) < 256 && abs(y - self.y) < 256
        fun segments(p: TerritoryPlayer): List<List<List<Double>>> {
            val result = ArrayList<List<List<Double>>>()
            for (i in 1 until p.path.size) {
                val a = p.path[i - 1]; val b = p.path[i]
                // Segment bounding intersection keeps crossing trails visible even with their head far away.
                if (max(a.x, b.x) < self.x - 256 || min(a.x, b.x) > self.x + 256 || max(a.y, b.y) < self.y - 256 || min(a.y, b.y) > self.y + 256) continue
                result.add(listOf(listOf((a.x * 100).roundToInt() / 100.0, (a.y * 100).roundToInt() / 100.0), listOf((b.x * 100).roundToInt() / 100.0, (b.y * 100).roundToInt() / 100.0)))
            }
            // Bound wire geometry while preserving each retained segment's real location (never draw chords across gaps).
            if (result.size <= 96) return result
            return (0 until 96).map { result[(it.toLong() * (result.size - 1) / 95).toInt()] }
        }
        fun player(p: TerritoryPlayer, path: Boolean): Map<String, Any?> = mapOf(
            "id" to p.id, "name" to p.name, "x" to if (!path || nearby(p.x, p.y)) p.x else null, "y" to if (!path || nearby(p.x, p.y)) p.y else null, "heading" to p.heading,
            "alive" to p.alive, "area" to p.area, "bot" to p.bot, "cosmetics" to p.appearance,
            "signs" to p.signs.toList(), "pending" to p.capturePending, "started" to p.started,
            "trailSegments" to if (path) segments(p) else emptyList<List<List<Double>>>(),
        )
        fun remote(p: TerritoryPlayer): Map<String, Any?> = mapOf(
            "id" to p.id, "x" to if (nearby(p.x, p.y)) (p.x * 100).roundToInt() / 100.0 else null,
            "y" to if (nearby(p.x, p.y)) (p.y * 100).roundToInt() / 100.0 else null,
            "trailSegments" to segments(p),
        )
        val cx = floor(self.x / 64).toInt(); val cy = floor(self.y / 64).toInt()
        val visible = LinkedHashSet<Int>()
        for (distance in 0..3) for (dy in -distance..distance) for (dx in -distance..distance) {
            if (max(abs(dx), abs(dy)) != distance) continue
            val x = cx + dx; val y = cy + dy
            if (x in 0 until world.land.side && y in 0 until world.land.side) visible.add(y * world.land.side + x)
        }
        val chunks = visible.asSequence().map { chunk ->
            val data = world.land.root[chunk] ?: TerritoryChunk(0, EMPTY_CHUNK)
            TerritoryChunkView(chunk, chunk % world.land.side * 64, chunk / world.land.side * 64, data)
        }.filter { known[it.id] != it.chunk.revision }.take(9).toList()
        val danger = visible.filter { known[it + 4096] != world.trailChunkRevision(it) }.map { chunk ->
            TerritoryChunkView(chunk, chunk % world.land.side * 64, chunk / world.land.side * 64,
                world.trailChunk(chunk) ?: TerritoryChunk(0, EMPTY_CHUNK))
        }
        val alive = world.land.living.toSet()
        val nearPlayers = world.players.values.filter { it.alive && (nearby(it.x, it.y) || segments(it).isNotEmpty()) }
        val referencedOwners = visible.flatMap { world.land.chunkCounts[it].orEmpty().keys }.filter { it in alive }.toSet() + world.trailOwners(visible) + nearPlayers.map { it.id }
        val ranked = world.players.values.filter { it.alive }.sortedWith(compareByDescending<TerritoryPlayer> { it.area }.thenBy { it.id })
        val fields = linkedMapOf<String, Any?>(
            "t" to "state", "tick" to world.tick, "ack" to self.sequence, "self" to player(self, false),
            "players" to nearPlayers.map { remote(it) },
            // Metadata doubles as a complete generation-liveness baseline; cached dead land becomes neutral immediately.
            "owners" to world.players.values.filter { it.id in referencedOwners || it.id == self.id }.map {
                mapOf("id" to it.id, "cosmetics" to it.appearance, "signs" to it.signs.filter { sign -> abs(sign.x - self.x) < 256 && abs(sign.y - self.y) < 256 })
            },
            "living" to alive,
            "rank" to (ranked.indexOfFirst { it.id == id } + 1),
            "top10" to ranked.take(10)
                .map { mapOf("id" to it.id, "name" to it.name, "area" to it.area, "x" to (it.x / 10).roundToInt() * 10, "y" to (it.y / 10).roundToInt() * 10) },
            "population" to mapOf("humans" to world.humanCount, "bots" to world.botCount), "status" to self.status,
        )
        if (includeMap) fields["map"] = world.land.chunkCounts.mapNotNull { (chunk, counts) ->
            val owner = counts.filterKeys { it in alive }.maxByOrNull { it.value }?.key ?: return@mapNotNull null
            listOf(chunk % world.land.side, chunk / world.land.side, owner, world.players[owner]?.appearance?.color ?: 0)
        }
        TerritoryFrame(fields, chunks, danger, known.keys.filter { (if (it >= 4096) it - 4096 else it) !in visible }, alive, world.activeTrails.toMap())
    }

    private companion object { val EMPTY_CHUNK = IntArray(4096) }
}
