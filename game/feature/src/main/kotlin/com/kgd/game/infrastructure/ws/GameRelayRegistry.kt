package com.kgd.game.infrastructure.ws

import com.kgd.game.application.party.port.PartyRoomView
import com.kgd.game.application.party.port.PartySeatQueryPort
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
) : PartySeatQueryPort {
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
    private class Room(
        val key: String,
        val gameSlug: String,
        val code: String,
        capacity: Int,
        val createdMs: Long,
        /**
         * 파티 방 (ADR-0092) — 로비 자동 마감과 시작 후 잠금을 면제받고, 판이 끝나면 다시 열린다.
         * **옵션이지 규칙이 아니다** — 릴레이는 여전히 게임을 모르고 좌석·메시지 종류·시각만 안다.
         */
        val manualStart: Boolean = false,
    ) {
        val seats = arrayOfNulls<Peer>(capacity)
        var seed: Int = 0

        /** start 이후 참. 대전 방은 편도이고, 파티 방은 판이 끝나면 false 로 돌아온다 */
        var started: Boolean = false

        /** 판 번호 — 방 코드와 함께 판을 가리킨다. 시드·멱등 키·마감이 여기 걸린다 */
        var roundNo: Int = 0

        /** 이번 판을 끝냈다고 알린 좌석. 릴레이는 **수만 센다** — 값은 채점 서버가 본다 */
        val doneSeats = mutableSetOf<Int>()

        /** 좌석 밖에서 보기만 하는 사람들. 좌석 배열에 넣으면 모든 경로에 필터가 붙는다 */
        val spectators = mutableListOf<Peer>()

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
        var spectator: Boolean = false
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

    /**
     * 좌석 조회 포트 구현 (ADR-0092). 릴레이가 아는 것만 돌려준다 — 별칭은 싣지 않는다.
     */
    override fun findRoom(code: String, gameSlug: String): PartyRoomView? {
        val room = rooms["$gameSlug:${code.uppercase()}"] ?: return null
        val seats = synchronized(room) {
            room.seats.mapIndexedNotNull { i, p -> i.takeIf { p != null } }
        }
        return PartyRoomView(
            code = room.code,
            roundNo = room.roundNo,
            roundOpen = room.started,
            occupiedSeats = seats,
            createdMs = room.createdMs,
        )
    }

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
            "start" -> startCommand(peer, node)
            "done" -> roundDone(peer)
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
        // 파티 방은 제외한다 — 방장이 링크를 붙여 넣는 데 30초가 넘으면 판이 저 혼자 시작되고,
        // 그 뒤 초대 링크가 전부 거절되며, 빈 좌석이 봇으로 채워져 내기 자리에 봇이 들어온다.
        val due = rooms.values.filter {
            !it.legacy && !it.manualStart && !it.started && nowMs - it.createdMs >= LOBBY_MAX_WAIT_MS
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

        // 파티 옵션 (ADR-0092). 배포된 게임은 이 셋을 안 보내므로 기존 동작 그대로다.
        val party = node.path("private").asBoolean(false)
        val manualStart = node.path("manualStart").asBoolean(false)
        val spectate = node.path("spectate").asBoolean(false)

        synchronized(matchLock) {
            if (peer.room != null) {
                send(peer, error("ALREADY_JOINED"))
                return
            }
            val room = when {
                // 파티 + 코드 → **입장만.** 알 수 없는 코드로 방이 만들어지면 방 상한(전역 200)이
                // 아무에게나 열려, 한 사람이 모든 릴레이 게임을 정지시킬 수 있다.
                party && requested != null -> rooms["${peer.gameSlug}:$requested"]
                    ?: run { send(peer, error("ROOM_NOT_FOUND")); return }
                // 파티 + 코드 없음 → 「방 만들기」. 대기열을 우회한다 — 대기열은 슬러그당 한 칸이라
                // 파티는 슬러그가 하나뿐이어서 두 번째 방장이 첫 방장 방에 앉는다.
                party -> newRoom(peer.gameSlug, seats, nowMs, manualStart)
                requested != null -> roomByCode(peer.gameSlug, requested, seats, nowMs)
                else -> autoMatchRoom(peer.gameSlug, seats, nowMs)
            }
            if (room == null) {
                send(peer, error("ROOM_LIMIT"))
                return
            }
            // 다인 방은 시작 후 잠긴다 — 판 중간 충원은 죽은 사람의 값을 없앤다 (ADR-0088).
            // 2석 방과 파티 방은 열어 둔다: 앞은 재대전, 뒤는 판 사이에 사람이 더 온다.
            if (room.started && !room.legacy && !room.manualStart) {
                send(peer, error("ROOM_STARTED"))
                return
            }
            if (spectate) {
                synchronized(room) { room.spectators += peer }
                peer.room = room
                peer.spectator = true
                send(peer, message("joined").put("room", room.code).put("seat", -1).put("seats", room.capacity))
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
            // 파티 방은 만석이 시작 조건이 아니다 — 방장의 명시적 명령만이 판을 연다
            if (!room.manualStart && occupants.size == room.capacity) startRoom(room, occupants)
        }
    }

    /**
     * 방장의 시작 명령 (ADR-0092) — **좌석 0 에서 온 것만** 받는다.
     *
     * 시드를 여기서 뽑아 **설정과 한 메시지로** 내보낸다. 쪼개면 방장이 시드를 먼저 보고
     * 코스·비율을 바꿔 가며 자기가 안 걸리는 조합을 고를 수 있다 — 시드만 서버로 옮기는
     * 것으로는 부족한 이유다. 설정(`cfg`)은 열어보지 않고 그대로 나른다.
     */
    private fun startCommand(peer: Peer, node: JsonNode) {
        val room = peer.room
        if (room == null || !room.manualStart) {
            send(peer, error("NOT_JOINED"))
            return
        }
        synchronized(matchLock) {
            val host = synchronized(room) { room.seats.filterNotNull().minByOrNull { it.seat } }
            if (host !== peer) {
                send(peer, error("NOT_HOST"))
                return
            }
            if (room.started) {
                send(peer, error("ROUND_RUNNING"))
                return
            }
            startRoom(room, synchronized(room) { room.seats.filterNotNull() }, node.get("cfg"))
        }
    }

    /**
     * 좌석이 이번 판을 끝냈다고 알린다. 릴레이는 **수만 센다** — 결과 값의 비교는 채점 서버 몫이다
     * (그것은 페이로드의 의미를 알아야 하므로 무권위가 깨진다).
     *
     * 전원이 알리면 방을 다시 연다. **방장이 판을 끊을 수 없다** — 판정 권한을 뗐는데 종료 권한으로
     * 돌아오면 자기가 걸리는 판을 도중에 무를 수 있다.
     */
    private fun roundDone(peer: Peer) {
        val room = peer.room ?: return
        if (!room.manualStart || peer.spectator || !room.started) return
        synchronized(matchLock) {
            val occupants = synchronized(room) {
                room.doneSeats += peer.seat
                room.seats.filterNotNull()
            }
            if (room.doneSeats.containsAll(occupants.map { it.seat })) {
                room.started = false
                room.doneSeats.clear()
                broadcast(room, occupants, message("roundEnded").put("round", room.roundNo))
            }
        }
    }

    /**
     * 좌석이 다 찼거나 로비가 마감됐다 — 공통 시드를 뽑아 전원에게 동시에 알린다.
     * `players` 는 좌석 수만큼의 배열이고 **빈 좌석은 빈 문자열** — 호스트가 봇으로 채운다.
     * [matchLock] 안에서만 호출한다.
     */
    private fun startRoom(room: Room, occupants: List<Peer>, cfg: JsonNode? = null) {
        room.seed = random.nextInt(Int.MAX_VALUE)
        room.started = true
        room.roundNo += 1
        room.doneSeats.clear()
        waiting.remove(room.gameSlug, room.key)

        val players = objectMapper.createArrayNode()
        synchronized(room) { room.seats.forEach { players.add(it?.nick ?: "") } }

        val start = message("start")
        start.put("seed", room.seed)
        start.set("players", players)
        // 파티 방에서만 붙는다 — 배포된 2인 클라이언트는 모르는 필드를 무시한다
        if (room.manualStart) {
            start.put("round", room.roundNo)
            if (cfg != null) start.set("cfg", cfg)
        }
        broadcast(room, occupants, start)
    }

    /** 좌석에 앉은 사람과 관전자 모두에게 — 관전자는 보기만 하지 못 보는 게 아니다 */
    private fun broadcast(room: Room, occupants: List<Peer>, node: ObjectNode) {
        val payload = objectMapper.writeValueAsString(node)
        occupants.forEach { it.conn.send(payload) }
        synchronized(room) { room.spectators.toList() }.forEach { it.conn.send(payload) }
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
        synchronized(room) { room.seats.filterNotNull().filter { it !== peer } + room.spectators }
            .forEach { it.conn.send(payload) }
    }

    /** [matchLock] 안에서만 호출한다. */
    private fun leaveRoom(peer: Peer) {
        val room = peer.room ?: return
        // 관전자는 좌석을 안 쥐었으므로 알릴 것도, 승계할 것도 없다
        if (peer.spectator) {
            val empty = synchronized(room) {
                room.spectators.remove(peer)
                room.seats.all { it == null } && room.spectators.isEmpty()
            }
            peer.room = null
            peer.spectator = false
            if (empty) {
                rooms.remove(room.key, room)
                waiting.remove(room.gameSlug, room.key)
            }
            return
        }
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
        synchronized(room) { room.spectators.toList() }.forEach { it.conn.send(payload) }

        // 나간 사람을 기다리다 판이 멈추지 않게 — 남은 좌석이 다 알렸으면 그 자리에서 닫는다
        if (room.manualStart && room.started && remaining.isNotEmpty() &&
            room.doneSeats.containsAll(remaining.map { it.seat })
        ) {
            room.started = false
            room.doneSeats.clear()
            broadcast(room, remaining, message("roundEnded").put("round", room.roundNo))
        }

        // 모두 나가면 즉시 파기 — 방을 재사용하지 않으므로 코드가 새어도 무해하다
        if (remaining.isEmpty()) {
            synchronized(room) { room.spectators.forEach { it.room = null; it.spectator = false } }
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

    private fun newRoom(gameSlug: String, seats: Int, nowMs: Long, manualStart: Boolean = false): Room? {
        if (rooms.size >= MAX_ROOMS) return null
        repeat(16) {
            val code = randomCode()
            val key = "$gameSlug:$code"
            val room = Room(key, gameSlug, code, seats, nowMs, manualStart)
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
