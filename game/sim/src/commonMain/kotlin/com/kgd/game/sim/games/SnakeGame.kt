package com.kgd.game.sim.games

import com.kgd.game.sim.GameModule
import com.kgd.game.sim.InputCommand
import com.kgd.game.sim.Mulberry32

data class Cell(val x: Int, val y: Int)

data class SnakeState(
    val width: Int,
    val height: Int,
    val snake: List<Cell>, // head first
    val dir: InputCommand,
    val food: Cell,
    val dead: Boolean,
    val eaten: Int,
    val rngState: Int,
)

/**
 * 그리드 Snake — 정수/결정적. 먹이는 seed 파생 PRNG 로 배치되어 서버 리플레이가 그대로 재현한다.
 * 점수 = 먹은 먹이 수. 180° 역방향 입력은 무시.
 */
class SnakeGame(
    private val width: Int = 20,
    private val height: Int = 20,
) : GameModule<SnakeState> {

    override val gameId: String = ID

    override fun init(seed: Int): SnakeState {
        val start = Cell(width / 2, height / 2)
        val snake = listOf(start)
        val (food, rng) = spawnFood(seed, snake)
        return SnakeState(width, height, snake, InputCommand.RIGHT, food, dead = false, eaten = 0, rngState = rng)
    }

    override fun step(state: SnakeState, command: InputCommand): SnakeState {
        if (state.dead) return state
        val dir = nextDir(state.dir, command)
        val head = state.snake.first()
        val nh = when (dir) {
            InputCommand.UP -> Cell(head.x, head.y - 1)
            InputCommand.DOWN -> Cell(head.x, head.y + 1)
            InputCommand.LEFT -> Cell(head.x - 1, head.y)
            InputCommand.RIGHT -> Cell(head.x + 1, head.y)
            InputCommand.NONE -> head
        }
        // 벽 충돌
        if (nh.x < 0 || nh.y < 0 || nh.x >= state.width || nh.y >= state.height) {
            return state.copy(dir = dir, dead = true)
        }
        val ate = nh == state.food
        // 먹으면 꼬리 유지(길이 +1), 아니면 꼬리 한 칸 전진(꼬리 제거).
        val body = if (ate) state.snake else state.snake.subList(0, state.snake.size - 1)
        // 자기 몸 충돌 (이동 후 꼬리 위치 반영된 body 기준)
        if (body.contains(nh)) {
            return state.copy(dir = dir, dead = true)
        }
        val newSnake = ArrayList<Cell>(body.size + 1).apply {
            add(nh)
            addAll(body)
        }
        return if (ate) {
            val (food, rng) = spawnFood(state.rngState, newSnake)
            state.copy(snake = newSnake, dir = dir, food = food, eaten = state.eaten + 1, rngState = rng)
        } else {
            state.copy(snake = newSnake, dir = dir)
        }
    }

    override fun score(state: SnakeState): Int = state.eaten
    override fun isOver(state: SnakeState): Boolean = state.dead

    /** 빈 칸이 나올 때까지 결정적으로 재추첨해 먹이 배치. */
    private fun spawnFood(rngState: Int, snake: List<Cell>): Pair<Cell, Int> {
        var s = rngState
        while (true) {
            val (x, s1) = Mulberry32.nextInt(s, width)
            val (y, s2) = Mulberry32.nextInt(s1, height)
            s = s2
            val c = Cell(x, y)
            if (!snake.contains(c)) return c to s
        }
    }

    private fun nextDir(cur: InputCommand, cmd: InputCommand): InputCommand {
        if (cmd == InputCommand.NONE) return cur
        val opposite = when (cmd) {
            InputCommand.UP -> InputCommand.DOWN
            InputCommand.DOWN -> InputCommand.UP
            InputCommand.LEFT -> InputCommand.RIGHT
            InputCommand.RIGHT -> InputCommand.LEFT
            InputCommand.NONE -> InputCommand.NONE
        }
        return if (cur == opposite) cur else cmd
    }

    companion object {
        const val ID: String = "snake"
    }
}
