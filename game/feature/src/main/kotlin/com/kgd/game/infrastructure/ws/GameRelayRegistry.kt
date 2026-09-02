package com.kgd.game.infrastructure.ws

import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.node.ObjectNode
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap

/**
 * 웹게임 온라인 대전 릴레이 — 방 생성·매칭·중계·정리를 모두 담당한다.
 *
 * ## 권위 없는 릴레이
 * 릴레이는 게임 규칙을 모른다. `move` 의 `d` 는 열어보지 않고 상대에게 그대로 전달한다.
 * 덕분에 새 게임을 온라인화할 때 서버 코드를 건드릴 필요가 없다. 규칙 검증(안티치트)이
 * 필요한 종목이 생기면 그 종목 전용 권위 레이어를 릴레이 위에 따로 얹는다.
 * 대신 규칙을 모르는 만큼 남용 방어는 형식만으로 한다 — 메시지 크기·초당 메시지 수·방 수 상한.
 *
 * ## N석 (ADR-0088)
 * 방의 좌석 수는 방을 만드는 join 의 `seats`(2~20, 생략 시 2)가 정한다. 3석 이상 방은
 * 로비 30초 마감(인원 무관 시작, 빈 좌석은 호스트 클라이언트가 봇으로 채운다) · 시작 후
 * 잠금 · `left`(좌석 번호) · `move` 의 `to`(좌석 지정 전달)가 붙고, 2석 방은 기존
 * 프로토콜 그대로다 — 배포된 2인 게임 클라이언트를 건드리지 않는다.
 *
 * ## 왜 in-memory 인가
 * 현재 배포는 단일 노드이고 호스트(code-dictionary)는 1 레플리카다(ADR-0059 폴드).
 * 방 상태를 Redis pub/sub 으로 팬아웃해도 구독자가 자기 자신뿐이라 홉과 실패 지점만 늘어난다.
 * 레플리카를 2 이상으로 늘리는 시점에 (a) 방 코드 기준 sticky routing 으로 방을 노드에 고정하거나
 * (b) Redis pub/sub 브로커를 끼우면 된다. 그전까지는 ConcurrentHashMap 이 가장 단순한 정답이다.
 *
 * ## 스레드 안전
 * - 방 배정(join/leave)은 경쟁이 있어 [matchLock] 한 개로 직렬화한다. 초당 수십 건 수준이라 충분하다.
 * - 좌석 배열 읽기/쓰기는 방 객체로 동기화한다. 락 순서는 항상 matchLock → room (역순 없음).
 * - 실제 전송 직렬화는 [RelayPeer] 구현체 몫이다 (WebSocketSession 은 동시 전송 불가).
 */
@Component
class GameRelayRegistry(
    private val objectMapper: ObjectMapper,
) {
    private val log = KotlinLogging.logger {}

    private companion object {
        const val MAX_ROOMS = 200
        const val MAX_MESSAGE_CHARS = 4096

        /** 의도 20Hz + 이모트·핑 여유. 스냅샷 10Hz 는 그 안에 든다 (ADR-0088) */
        const val MAX_MESSAGES_PER_SECOND = 40
        const val RATE_WINDOW_MS = 1_000L

        /** 다인 방(3석 이상)의 로비 마감 — 이 시간이 지나면 인원 무관 강제 시작 */
        const val LOBBY_MAX_WAIT_MS = 30_000L

        const val MIN_SEATS = 2
        const val MAX_SEATS = 20

        /** 무메시지 60초 → ping 요구, 90초 → 종료 */
        const val IDLE_PING_MS = 60_000L
        const val IDLE_CLOSE_MS = 90_000L

        const val ROOM_CODE_LENGTH = 6
        const val MAX_NICK_LENGTH = 16

        /** 눈으로 옮겨 적는 코드라 혼동 문자(0/O, 1/I)를 뺀다 */
        const val CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

        val SLUG_PATTERN = Regex("^[a-z0-9][a-z0-9-]{0,63}$")
        val CODE_PATTERN = Regex("^[A-Z0-9]{4,8}$")
    }

    /**
     * 좌석 수는 **방을 만드는 join 이 정한다** (2~20, 생략 시 2 — ADR-0088).
     * 기존 2인 게임은 `seats` 를 보내지 않으므로 그대로 2석이다.
     */
    private class Room(val key: String, val gameSlug: String, val code: String, capacity: Int, val createdMs: Long) {
        val seats = arrayOfNulls<Peer>(capacity)
        var seed: Int = 0

        /** start 이후 참. 판 중간 충원은 없다 — 죽은 사람의 값을 지킨다 (PRD §3) */
        var started: Boolean = false

        val capacity: Int get() = seats.size

        /** 2석 방은 기존 프로토콜(`opponentLeft`, 만석 시작)을 그대로 쓴다 */
        val legacy: Boolean get() = capacity == MIN_SEATS
    }

    private class Peer(
        val conn: RelayPeer,
        val gameSlug: String,
        var lastSeenMs: Long,
        var windowStartMs: Long,
    ) {
        var nick: String = ""
        var room: Room? = null
        var seat: Int = -1
        var pingRequested: Boolean = false
        var windowCount: Int = 0
    }

    private val peers = ConcurrentHashMap<String, Peer>()
    private val rooms = ConcurrentHashMap<String, Room>()

    /** gameSlug → 자동 매칭 대기 중인 방 key (좌석 하나가 빈 상태) */
    private val waiting = ConcurrentHashMap<String, String>()

    private val random = SecureRandom()
    private val matchLock = Any()

    fun roomCount(): Int = rooms.size

    fun peerCount(): Int = peers.size

    // ── 수명주기 ────────────────────────────────────────────────────────────

    fun onOpen(conn: RelayPeer, gameSlug: String, nowMs: Long = System.currentTimeMillis()) {
        peers[conn.id] = Peer(conn, gameSlug, lastSeenMs = nowMs, windowStartMs = nowMs)
    }

    fun onClose(peerId: String) {
        val peer = peers.remove(peerId) ?: return
        synchronized(matchLock) { leaveRoom(peer) }
    }

    fun onMessage(peerId: String, raw: String, nowMs: Long = System.currentTimeMillis()) {
        val peer = peers[peerId] ?: return

        if (raw.length > MAX_MESSAGE_CHARS) {
            disconnect(peer, "TOO_LARGE", RelayCloseReason.TOO_LARGE)
            return
        }
        if (!withinRate(peer, nowMs)) {
            disconnect(peer, "RATE_LIMIT", RelayCloseReason.RATE_LIMIT)
            return
        }
        peer.lastSeenMs = nowMs
        peer.pingRequested = false

        val node = try {
            objectMapper.readTree(raw)
        } catch (e: Exception) {
            log.debug { "게임 릴레이 파싱 실패 ${peer.conn.id}: ${e.message}" }
            send(peer, error("BAD_MESSAGE"))
            return
        }

        when (node.path("t").asText()) {
            "join" -> join(peer, node, nowMs)
            "move" -> move(peer, node)
            "leave" -> synchronized(matchLock) { leaveRoom(peer) }
            "ping" -> send(peer, message("pong"))
            else -> send(peer, error("BAD_MESSAGE"))
        }
    }

    /**
     * 유휴 세션 정리 + 방 수 관측. 프록시(ingress/CF)가 조용히 끊은 좀비 세션을 걷어내
     * 방 슬롯이 새는 것을 막는다.
     */
    @Scheduled(fixedDelay = 15_000L)
    fun sweep() = sweepIdle(System.currentTimeMillis())

    /** 다인 방 로비 마감 — 30초가 지나면 인원 무관 시작한다. 빈 좌석은 호스트가 봇으로 채운다. */
    @Scheduled(fixedDelay = 1_000L)
    fun tickLobbies() = startDueLobbies(System.currentTimeMillis())

    fun startDueLobbies(nowMs: Long) {
        val due = rooms.values.filter {
            !it.legacy && !it.started && nowMs - it.createdMs >= LOBBY_MAX_WAIT_MS
        }
        if (due.isEmpty()) return
        synchronized(matchLock) {
            due.forEach { room ->
                if (room.started) return@forEach
                val occupants = synchronized(room) { room.seats.filterNotNull() }
                if (occupants.isEmpty()) {
                    rooms.remove(room.key, room)
                    waiting.remove(room.gameSlug, room.key)
                } else {
                    startRoom(room, occupants)
                }
            }
        }
    }

    fun sweepIdle(nowMs: Long) {
        peers.values.forEach { peer ->
            val idle = nowMs - peer.lastSeenMs
            when {
                idle >= IDLE_CLOSE_MS -> {
                    peer.conn.close(RelayCloseReason.IDLE)
                    peers.remove(peer.conn.id)
                    synchronized(matchLock) { leaveRoom(peer) }
                }
                idle >= IDLE_PING_MS && !peer.pingRequested -> {
                    peer.pingRequested = true
                    send(peer, message("ping"))
                }
            }
        }
        if (rooms.isNotEmpty()) {
            log.info { "게임 릴레이 상태 — 방 ${rooms.size}개 / 접속 ${peers.size}명" }
        }
    }

    // ── 명령 처리 ───────────────────────────────────────────────────────────

    private fun join(peer: Peer, node: JsonNode, nowMs: Long) {
        val roomNode = node.path("room")
        val requested = if (roomNode.isTextual) normalizeCode(roomNode.asText()) else null
        if (roomNode.isTextual && requested == null) {
            send(peer, error("BAD_ROOM"))
            return
        }
        peer.nick = sanitizeNick(node.path("nick").asText(""))
        // 방을 새로 만들 때만 반영된다 — 이미 있는 방의 좌석 수는 안 바뀐다
        val seats = node.path("seats").asInt(MIN_SEATS).coerceIn(MIN_SEATS, MAX_SEATS)

        synchronized(matchLock) {
            if (peer.room != null) {
                send(peer, error("ALREADY_JOINED"))
                return
            }
            val room = if (requested != null) roomByCode(peer.gameSlug, requested, seats, nowMs)
                       else autoMatchRoom(peer.gameSlug, seats, nowMs)
            if (room == null) {
                send(peer, error("ROOM_LIMIT"))
                return
            }
            // 다인 방은 시작 후 잠긴다 — 판 중간 충원은 죽은 사람의 값을 없앤다 (ADR-0088).
            // 2석 방은 기존대로 열어 둔다: 코드로 다시 들어와 재대전하는 흐름이 있다.
            if (room.started && !room.legacy) {
                send(peer, error("ROOM_STARTED"))
                return
            }
            val seat = synchronized(room) {
                val free = room.seats.indexOfFirst { it == null }
                if (free >= 0) {
                    room.seats[free] = peer
                    peer.room = room
                    peer.seat = free
                }
                free
            }
            if (seat < 0) {
                send(peer, error("ROOM_FULL"))
                return
            }
            val joined = message("joined")
            joined.put("room", room.code)
            joined.put("seat", seat)
            joined.put("seats", room.capacity)
            send(peer, joined)

            val occupants = synchronized(room) { room.seats.filterNotNull() }
            // 다인 방 로비 — 먼저 온 사람들이 「몇이 모였나」를 보게 알린다
            if (!room.legacy) {
                val seated = message("seat").put("seat", seat).put("nick", peer.nick)
                val payload = objectMapper.writeValueAsString(seated)
                occupants.filter { it !== peer }.forEach { it.conn.send(payload) }
            }
            if (occupants.size == room.capacity) startRoom(room, occupants)
        }
    }

    /**
     * 좌석이 다 찼거나 로비가 마감됐다 — 공통 시드를 뽑아 전원에게 동시에 알린다.
     * `players` 는 좌석 수만큼의 배열이고 **빈 좌석은 빈 문자열** — 호스트가 봇으로 채운다.
     * [matchLock] 안에서만 호출한다.
     */
    private fun startRoom(room: Room, occupants: List<Peer>) {
        room.seed = random.nextInt(Int.MAX_VALUE)
        room.started = true
        waiting.remove(room.gameSlug, room.key)

        val players = objectMapper.createArrayNode()
        synchronized(room) { room.seats.forEach { players.add(it?.nick ?: "") } }

        val start = message("start")
        start.put("seed", room.seed)
        start.set("players", players)
        val payload = objectMapper.writeValueAsString(start)
        occupants.forEach { it.conn.send(payload) }
    }

    private fun move(peer: Peer, node: JsonNode) {
        val room = peer.room
        if (room == null) {
            send(peer, error("NOT_JOINED"))
            return
        }
        val opaque = node.get("d")
        if (opaque == null) {
            send(peer, error("BAD_MESSAGE"))
            return
        }
        val out = message("move")
        out.put("seat", peer.seat)
        out.set("d", opaque)
        val payload = objectMapper.writeValueAsString(out)

        // `to` 가 있으면 그 좌석에게만 — 게스트 의도는 호스트에게만 가면 된다 (ADR-0088 ①).
        // 방 전체에 뿌리면 최악 판의 아웃바운드가 3배가 된다.
        val toNode = node.path("to")
        if (toNode.isIntegralNumber) {
            val target = synchronized(room) { room.seats.getOrNull(toNode.asInt()) }
            if (target != null && target !== peer) target.conn.send(payload)
            return
        }
        synchronized(room) { room.seats.filterNotNull().filter { it !== peer } }
            .forEach { it.conn.send(payload) }
    }

    /** [matchLock] 안에서만 호출한다. */
    private fun leaveRoom(peer: Peer) {
        val room = peer.room ?: return
        val seat = peer.seat
        val remaining = synchronized(room) {
            if (peer.seat in room.seats.indices && room.seats[peer.seat] === peer) {
                room.seats[peer.seat] = null
            }
            room.seats.filterNotNull()
        }
        peer.room = null
        peer.seat = -1

        // 2석 방은 기존 이름을 유지한다 — 배포된 클라이언트가 그 이름을 듣는다.
        // 다인 방은 좌석 번호가 있어야 남은 쪽이 호스트 승계를 판정한다 (ADR-0088 ②).
        val payload = objectMapper.writeValueAsString(
            if (room.legacy) message("opponentLeft") else message("left").put("seat", seat),
        )
        remaining.forEach { it.conn.send(payload) }

        // 모두 나가면 즉시 파기 — 방을 재사용하지 않으므로 코드가 새어도 무해하다
        if (remaining.isEmpty()) {
            rooms.remove(room.key, room)
            waiting.remove(room.gameSlug, room.key)
        }
    }

    // ── 방 배정 ─────────────────────────────────────────────────────────────

    /** 친구 초대 — 지정 코드의 방을 찾고, 없으면 그 코드로 만든다 */
    private fun roomByCode(gameSlug: String, code: String, seats: Int, nowMs: Long): Room? {
        val key = "$gameSlug:$code"
        rooms[key]?.let { return it }
        if (rooms.size >= MAX_ROOMS) return null
        val created = Room(key, gameSlug, code, seats, nowMs)
        return rooms.putIfAbsent(key, created) ?: created
    }

    /** 빠른 매칭 — 같은 게임의 대기 방이 있으면 합류, 없으면 새 방을 열고 대기열에 올린다 */
    private fun autoMatchRoom(gameSlug: String, seats: Int, nowMs: Long): Room? {
        val open = waiting[gameSlug]?.let { rooms[it] }
        if (open != null && !open.started && synchronized(open) { open.seats.any { it == null } }) return open

        val room = newRoom(gameSlug, seats, nowMs) ?: return null
        waiting[gameSlug] = room.key
        return room
    }

    private fun newRoom(gameSlug: String, seats: Int, nowMs: Long): Room? {
        if (rooms.size >= MAX_ROOMS) return null
        repeat(16) {
            val code = randomCode()
            val key = "$gameSlug:$code"
            val room = Room(key, gameSlug, code, seats, nowMs)
            if (rooms.putIfAbsent(key, room) == null) return room
        }
        return null
    }

    private fun randomCode(): String =
        buildString(ROOM_CODE_LENGTH) {
            repeat(ROOM_CODE_LENGTH) { append(CODE_ALPHABET[random.nextInt(CODE_ALPHABET.length)]) }
        }

    // ── 방어 ────────────────────────────────────────────────────────────────

    private fun withinRate(peer: Peer, nowMs: Long): Boolean {
        if (nowMs - peer.windowStartMs >= RATE_WINDOW_MS) {
            peer.windowStartMs = nowMs
            peer.windowCount = 0
        }
        peer.windowCount++
        return peer.windowCount <= MAX_MESSAGES_PER_SECOND
    }

    private fun disconnect(peer: Peer, code: String, reason: RelayCloseReason) {
        send(peer, error(code))
        peer.conn.close(reason)
        peers.remove(peer.conn.id)
        synchronized(matchLock) { leaveRoom(peer) }
    }

    // ── 입력 정규화 ─────────────────────────────────────────────────────────

    /** 게임 슬러그 검증 — URL 경로에서 뽑은 값이라 형식을 좁혀둔다 */
    fun isValidSlug(slug: String): Boolean = SLUG_PATTERN.matches(slug)

    private fun normalizeCode(raw: String): String? =
        raw.uppercase().filter { it.isLetterOrDigit() }.takeIf { CODE_PATTERN.matches(it) }

    private fun sanitizeNick(raw: String): String =
        raw.filter { !it.isISOControl() }.trim().take(MAX_NICK_LENGTH).ifBlank { "Player" }

    // ── 메시지 ──────────────────────────────────────────────────────────────

    private fun message(type: String): ObjectNode = objectMapper.createObjectNode().put("t", type)

    private fun error(code: String): ObjectNode = message("error").put("code", code)

    private fun send(peer: Peer, node: ObjectNode) = peer.conn.send(objectMapper.writeValueAsString(node))
}
