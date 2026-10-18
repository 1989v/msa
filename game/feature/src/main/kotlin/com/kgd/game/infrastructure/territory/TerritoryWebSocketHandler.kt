package com.kgd.game.infrastructure.territory

import com.kgd.game.application.territory.usecase.*
import com.kgd.game.domain.territory.model.*
import jakarta.annotation.PostConstruct
import jakarta.annotation.PreDestroy
import org.springframework.stereotype.Component
import org.springframework.web.socket.*
import org.springframework.web.socket.handler.TextWebSocketHandler
import org.springframework.web.socket.adapter.standard.StandardWebSocketSession
import tools.jackson.databind.ObjectMapper
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicBoolean

@Component
class TerritoryWebSocketHandler(
    private val tickets: TerritoryTicketUseCase,
    private val world: TerritoryWorldUseCase,
    private val mapper: ObjectMapper,
) : TextWebSocketHandler() {
    private class Client(val session: WebSocketSession) {
        @Volatile var player: Int? = null
        val opened = System.nanoTime()
        var window = opened; var messages = 0
        val known = HashMap<Int, Long>()
        val owners = HashMap<Int, Map<String, Any?>>()
        var hasTop = false
        val output = ArrayBlockingQueue<String>(8)
        val sending = AtomicBoolean(false)
        @Volatile var sendingSince = 0L
    }
    private val clients = ConcurrentHashMap<String, Client>()
    private val clock = Executors.newSingleThreadScheduledExecutor { r -> Thread(r, "territory-clock").apply { isDaemon = true } }
    private val closers = ThreadPoolExecutor(2, 2, 0, TimeUnit.MILLISECONDS, ArrayBlockingQueue(4096),
        { r -> Thread(r, "territory-close").apply { isDaemon = true } }, ThreadPoolExecutor.DiscardPolicy())
    private var deadline = System.nanoTime()
    private var ticks = 0L
    private val timing = ArrayDeque<Double>()
    private var producedBytes = 0L
    fun metrics(): Map<String, Any> = synchronized(timing) {
        val sorted = timing.sorted()
        mapOf("samples" to sorted.size, "p95TickAndSnapshotMs" to (sorted.getOrNull((sorted.size * .95).toInt()) ?: 0.0),
            "p50TickAndSnapshotMs" to (sorted.getOrNull(sorted.size / 2) ?: 0.0),
            "maxTickAndSnapshotMs" to (sorted.lastOrNull() ?: 0.0), "producedBytes" to producedBytes,
            "heapBytes" to java.lang.management.ManagementFactory.getMemoryMXBean().heapMemoryUsage.used,
            "gcCount" to java.lang.management.ManagementFactory.getGarbageCollectorMXBeans().sumOf { it.collectionCount },
            "gcMillis" to java.lang.management.ManagementFactory.getGarbageCollectorMXBeans().sumOf { it.collectionTime })
    }

    @PostConstruct fun start() {
        clock.scheduleWithFixedDelay({
            runCatching {
                val now = System.nanoTime()
                var caught = 0
                while (now >= deadline && caught++ < 4) {
                    val before = System.nanoTime()
                    world.advance(); ticks++; deadline += 25_000_000
                    if (ticks % 4 == 0L) broadcast()
                    synchronized(timing) { timing.addLast((System.nanoTime() - before) / 1e6); if (timing.size > 8192) timing.removeFirst() }
                }
                if (now - deadline > 100_000_000) deadline = now + 25_000_000
                for (client in clients.values) if (client.player == null && now - client.opened > 5_000_000_000) close(client, "JOIN_TIMEOUT")
                for (client in clients.values) if (client.sending.get() && now - client.sendingSince > 1_500_000_000) close(client, "SLOW_CONSUMER")
            }
        }, 0, 5, TimeUnit.MILLISECONDS)
    }
    @PreDestroy fun stop() {
        clock.shutdownNow()
        for (client in clients.values) close(client, "SERVER_STOP")
        closers.shutdown()
    }

    override fun afterConnectionEstablished(session: WebSocketSession) {
        if (clients.size >= 4096) { session.close(CloseStatus.SERVICE_OVERLOAD); return }
        session.textMessageSizeLimit = 2048
        (session as? StandardWebSocketSession)?.nativeSession?.asyncRemote?.sendTimeout = 1000
        clients[session.id] = Client(session)
    }

    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
        val client = clients[session.id] ?: return
        try {
            require(message.payload.toByteArray(Charsets.UTF_8).size <= 2048) { "TOO_LARGE" }
            val now = System.nanoTime()
            synchronized(client) {
                require(clients[session.id] === client) { "DISCONNECTED" }
                if (now - client.window >= 1_000_000_000) { client.window = now; client.messages = 0 }
                require(++client.messages <= 60) { "RATE_LIMIT" }
                val node = mapper.readTree(message.payload)
                require(node.isObject) { "MALFORMED" }
                val type = node.path("t").asText("")
                if (client.player == null) {
                    require(type == "join" && node.path("version").asInt() == 1) { "JOIN_REQUIRED" }
                    val profile = tickets.redeem(node.path("ticket").asText("")) ?: error("TICKET_INVALID")
                    client.player = world.join(profile.playerId, profile.nickname)
                    send(client, mapper.writeValueAsString(mapOf("t" to "welcome", "version" to 1, "self" to client.player,
                        "size" to 4096, "cell" to 1, "chunkSize" to 64, "speed" to TERRITORY_SPEED, "turnRate" to TERRITORY_TURN, "tickHz" to 40, "snapshotHz" to 10)))
                    return
                }
                val id = requireNotNull(client.player)
                when (type) {
                    "input" -> {
                        require(node.path("seq").isIntegralNumber && node.path("moving").isBoolean) { "INPUT_FORMAT" }
                        val moving = node.path("moving").asBoolean()
                        require(!moving || node.path("angle").isNumber) { "INPUT_ANGLE" }
                        world.input(id, node.path("seq").asLong(), moving, node.path("angle").asDouble(0.0))
                    }
                    "respawn" -> { client.player = world.respawn(id); client.known.clear() }
                    "cosmetics" -> world.cosmetics(id, TerritoryAppearance(node.path("color").asInt(-1), node.path("pattern").asInt(-1), node.path("border").asText("")))
                    "placeSign" -> {
                        require(node.path("x").isIntegralNumber && node.path("y").isIntegralNumber && node.path("text").isTextual) { "SIGN_FORMAT" }
                        world.placeSign(id, node.path("x").asInt(), node.path("y").asInt(), node.path("text").asText(), node.path("logo").asText(""))
                    }
                    "removeSign" -> world.removeSign(id, node.path("id").asInt(-1))
                    "ping" -> send(client, mapper.writeValueAsString(mapOf("t" to "pong", "nonce" to node.path("nonce").asText("").take(32))))
                    else -> error("UNKNOWN_MESSAGE")
                }
            }
        } catch (e: Exception) {
            val code = e.message?.takeIf { it.matches(Regex("[A-Z_]+")) } ?: "MALFORMED"
            if (code in setOf("SIGN_ANCHOR", "SIGN_FORMAT", "STILL_ALIVE")) send(client, mapper.writeValueAsString(mapOf("t" to "error", "code" to code)))
            else close(client, code)
        }
    }

    private fun broadcast() {
        for (client in clients.values) synchronized(client) {
            val id = client.player ?: return@synchronized
            val frame = runCatching { world.snapshot(id, client.known, ticks % 40 == 0L) }.getOrNull() ?: return@synchronized
            fun encode(views: List<TerritoryChunkView>, danger: Boolean = false) = views.map { view ->
                val runs = ArrayList<List<Int>>()
                val cells = view.chunk.cells
                var offset = 0
                while (offset < cells.size) {
                    val owner = cells[offset]; var end = offset + 1
                    while (end < cells.size && cells[end] == owner) end++
                    if (if (danger) owner in frame.trailOwners else owner in frame.living) runs.add(listOf(offset, end - offset, owner))
                    offset = end
                }
                mapOf("id" to view.id, "x" to view.x, "y" to view.y, "revision" to view.chunk.revision, "runs" to runs)
            }
            @Suppress("UNCHECKED_CAST")
            val owners = frame.fields["owners"] as List<Map<String, Any?>>
            val ownerIds = owners.map { it.getValue("id") as Int }.toSet()
            val changedOwners = owners.filter { client.owners[it.getValue("id") as Int] != it }
            val fields = (frame.fields + mapOf("owners" to changedOwners, "ownerIds" to ownerIds,
                "chunks" to encode(frame.chunks), "dangerChunks" to encode(frame.dangerChunks, true), "trailOwners" to frame.trailOwners, "removedChunks" to frame.removed)).toMutableMap()
            if (client.hasTop && ticks % 40 != 0L) fields.remove("top10")
            val payload = mapper.writeValueAsString(fields)
            synchronized(timing) { producedBytes += payload.toByteArray(Charsets.UTF_8).size }
            if (payload.toByteArray(Charsets.UTF_8).size > 262144) { close(client, "SNAPSHOT_CAPACITY"); return@synchronized }
            if (send(client, payload)) {
                client.owners.keys.retainAll(ownerIds)
                for (owner in changedOwners) client.owners[owner.getValue("id") as Int] = owner
                client.hasTop = true
                for (chunk in frame.chunks) client.known[chunk.id] = chunk.chunk.revision
                for (chunk in frame.dangerChunks) client.known[chunk.id + 4096] = chunk.chunk.revision
                for (removed in frame.removed) client.known.remove(removed)
            }
        }
    }

    private fun send(client: Client, payload: String): Boolean {
        if (!client.output.offer(payload)) { close(client, "SLOW_CONSUMER"); return false }
        drain(client)
        return true
    }
    private fun drain(client: Client) {
        if (!client.sending.compareAndSet(false, true)) return
        val message = client.output.poll()
        if (message == null) { client.sending.set(false); return }
        client.sendingSince = System.nanoTime()
        val native = (client.session as? StandardWebSocketSession)?.nativeSession
        if (native == null) { client.sending.set(false); close(client, "TRANSPORT_UNSUPPORTED"); return }
        try {
            // Container async writes enforce a real deadline; no writer thread can be stranded by a blocked send.
            native.asyncRemote.sendText(message) { result ->
                client.sending.set(false)
                if (!result.isOK) close(client, "SLOW_CONSUMER")
                else if (client.output.isNotEmpty() && client.session.isOpen) drain(client)
            }
        } catch (_: Exception) {
            client.sending.set(false); close(client, "TRANSPORT_ERROR")
        }
    }
    private fun close(client: Client, reason: String) {
        val removed = synchronized(client) {
            if (!clients.remove(client.session.id, client)) return@synchronized false
            client.player?.let(world::leave)
            client.player = null
            client.output.clear()
            true
        }
        if (removed) closers.execute { runCatching { client.session.close(CloseStatus(1008, reason.take(100))) } }
    }
    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        clients[session.id]?.let { close(it, "DISCONNECTED") }
    }
    override fun handleTransportError(session: WebSocketSession, exception: Throwable) {
        clients[session.id]?.let { close(it, "TRANSPORT_ERROR") }
    }
}
