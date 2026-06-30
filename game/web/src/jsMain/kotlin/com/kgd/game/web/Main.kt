package com.kgd.game.web

import com.kgd.game.sim.InputCommand
import com.kgd.game.sim.InputEvent
import com.kgd.game.sim.games.SnakeGame
import com.kgd.game.sim.games.SnakeState
import kotlinx.browser.document
import kotlinx.browser.window
import org.w3c.dom.CanvasRenderingContext2D
import org.w3c.dom.HTMLCanvasElement
import org.w3c.dom.HTMLElement
import org.w3c.dom.events.KeyboardEvent
import kotlin.math.round

private const val API = "/api/v1/game"
private const val GAME_ID = "snake"
private const val GRID = 20
private const val CELL = 18
private const val TICK_MS = 110

// --- 현재 판 상태 ---
private val game = SnakeGame(GRID, GRID)
private var state: SnakeState? = null
private var tick = 0
private val inputs = ArrayList<InputEvent>()
private var pending: InputCommand? = null
private var timer = 0
private var startedAtMs = 0.0
private var session: dynamic = null

private val ctx: CanvasRenderingContext2D by lazy {
    (document.getElementById("board") as HTMLCanvasElement).getContext("2d") as CanvasRenderingContext2D
}

fun main() {
    window.onload = {
        wireControls()
        window.addEventListener("keydown", { e -> onKey(e as KeyboardEvent) })
        loadLeaderboard()
        status("아무 게임이나 시작하세요. 방향키/​WASD 로 조작.")
        null
    }
}

private fun wireControls() {
    (document.getElementById("startFree") as HTMLElement).onclick = { startSession(daily = false); null }
    (document.getElementById("startDaily") as HTMLElement).onclick = { startSession(daily = true); null }
}

private fun startSession(daily: Boolean) {
    if (timer != 0) return // 이미 플레이 중
    val body = js("({})")
    body.gameId = GAME_ID
    body.daily = daily
    httpPost("$API/sessions", JSON.stringify(body)).then { r -> r.json() }.then { res ->
        if (res.success != true) { status("세션 시작 실패"); return@then null }
        session = res.data
        beginPlay(res.data.seed as Int, if (daily) "데일리 챌린지" else "자유 플레이")
        null
    }
}

private fun beginPlay(seed: Int, mode: String) {
    state = game.init(seed)
    tick = 0
    inputs.clear()
    pending = null
    startedAtMs = window.asDynamic().performance.now() as Double
    status("$mode 시작! (seed=$seed)")
    draw(state!!)
    // setInterval/clearInterval 은 외부 시그니처 편차 회피로 dynamic 호출.
    timer = window.asDynamic().setInterval({ onTick() }, TICK_MS) as Int
}

private fun onTick() {
    val s = state ?: return
    tick += 1
    val cmd = pending ?: InputCommand.NONE
    if (pending != null) inputs.add(InputEvent(tick, cmd)) // 입력 있는 tick 만 기록(서버 리플레이와 동일 의미)
    pending = null
    val next = game.step(s, cmd)
    state = next
    draw(next)
    if (game.isOver(next)) endPlay()
}

private fun endPlay() {
    window.asDynamic().clearInterval(timer)
    timer = 0
    val s = state ?: return
    val score = game.score(s)
    status("게임 오버 — 점수 $score. 제출 중…")
    submit(score)
}

private fun submit(score: Int) {
    val sess = session ?: return
    val replay = js("({})")
    replay.gameId = GAME_ID
    replay.seed = sess.seed
    replay.totalTicks = tick
    val arr = js("([])")
    inputs.forEach { ie ->
        val o = js("({})"); o.tick = ie.tick; o.command = ie.command.name; arr.push(o)
    }
    replay.inputs = arr

    val req = js("({})")
    req.sessionId = sess.sessionId
    req.token = sess.token
    req.claimedScore = score
    req.replay = replay
    // Kotlin Long 은 JS 에서 number 가 아니므로(JSON 깨짐) Double 을 반올림해 JS number 로 전송.
    req.clientDurationMs = round(window.asDynamic().performance.now() as Double - startedAtMs)
    req.nickname = nickname()

    httpPost("$API/scores", JSON.stringify(req)).then { r -> r.json() }.then { res ->
        val d = res.data
        if (res.success == true && d.accepted == true) {
            status("제출됨 — 점수 ${d.score}, 검증 ${d.verification}, 전체순위 ${d.allTimeRank}")
        } else {
            status("거부됨 — ${d?.reason ?: res.error?.message ?: "unknown"}")
        }
        loadLeaderboard()
        null
    }
}

private fun loadLeaderboard() {
    httpGet("$API/leaderboard?gameId=$GAME_ID&period=ALL_TIME").then { r -> r.json() }.then { res ->
        val box = document.getElementById("leaderboard") as HTMLElement
        val rows = res.data
        if (rows == null || rows.length == 0) { box.innerHTML = "<em>아직 기록이 없습니다.</em>"; return@then null }
        val sb = StringBuilder("<table><tr><th>#</th><th>닉네임</th><th>점수</th><th>상태</th></tr>")
        for (i in 0 until (rows.length as Int)) {
            val r = rows[i]
            sb.append("<tr><td>${r.rank}</td><td>${escape(r.nickname as String)}</td><td>${r.score}</td><td>${r.status}</td></tr>")
        }
        sb.append("</table>")
        box.innerHTML = sb.toString()
        null
    }
}

// --- 입력 ---
private fun onKey(e: KeyboardEvent) {
    val cmd = when (e.key) {
        "ArrowUp", "w", "W" -> InputCommand.UP
        "ArrowDown", "s", "S" -> InputCommand.DOWN
        "ArrowLeft", "a", "A" -> InputCommand.LEFT
        "ArrowRight", "d", "D" -> InputCommand.RIGHT
        else -> null
    }
    if (cmd != null) { pending = cmd; e.preventDefault() }
}

// --- 렌더 ---
private fun draw(s: SnakeState) {
    val px = GRID * CELL
    ctx.fillStyle = "#0f1420"
    ctx.fillRect(0.0, 0.0, px.toDouble(), px.toDouble())
    // 먹이
    ctx.fillStyle = "#ef5350"
    cell(s.food.x, s.food.y)
    // 뱀
    s.snake.forEachIndexed { i, c ->
        ctx.fillStyle = if (i == 0) "#66bb6a" else "#43a047"
        cell(c.x, c.y)
    }
    // 점수
    ctx.fillStyle = "#e8eaf0"
    ctx.font = "14px monospace"
    ctx.fillText("score ${s.eaten}", 8.0, 18.0)
    if (s.dead) {
        ctx.fillStyle = "rgba(0,0,0,0.55)"
        ctx.fillRect(0.0, 0.0, px.toDouble(), px.toDouble())
        ctx.fillStyle = "#e8eaf0"
        ctx.font = "20px monospace"
        ctx.fillText("GAME OVER", (px / 2 - 56).toDouble(), (px / 2).toDouble())
    }
}

private fun cell(x: Int, y: Int) {
    ctx.fillRect((x * CELL + 1).toDouble(), (y * CELL + 1).toDouble(), (CELL - 2).toDouble(), (CELL - 2).toDouble())
}

// --- 유틸 ---
private fun nickname(): String {
    val input = document.getElementById("nick") as? org.w3c.dom.HTMLInputElement
    val v = input?.value?.trim().orEmpty()
    return if (v.isNotEmpty()) v else "anon"
}

private fun status(msg: String) {
    (document.getElementById("status") as HTMLElement).textContent = msg
}

private fun escape(s: String) = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

private fun httpPost(url: String, bodyJson: String): dynamic {
    val init = js("({})")
    init.method = "POST"
    init.headers = js("({ 'Content-Type': 'application/json' })")
    init.body = bodyJson
    return window.asDynamic().fetch(url, init)
}

private fun httpGet(url: String): dynamic = window.asDynamic().fetch(url)
