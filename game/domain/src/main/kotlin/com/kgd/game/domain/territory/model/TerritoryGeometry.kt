package com.kgd.game.domain.territory.model

import kotlin.math.*
import java.util.BitSet

const val TERRITORY_SPEED = 16.0
const val TERRITORY_TURN = PI * 6
const val TERRITORY_STEP = 1.0 / 120
fun wrapped(angle: Double): Double = atan2(sin(angle), cos(angle))

/** Supercover raster traversal, including both side cells at exact grid corners. */
fun sweptCells(x0: Double, y0: Double, x1: Double, y1: Double): IntArray {
    var x = floor(x0).toInt(); var y = floor(y0).toInt()
    val ex = floor(x1).toInt(); val ey = floor(y1).toInt()
    val dx = x1 - x0; val dy = y1 - y0
    val sx = sign(dx).toInt(); val sy = sign(dy).toInt()
    var tx = if (dx == 0.0) Double.POSITIVE_INFINITY else ((if (sx > 0) x + 1 else x) - x0) / dx
    var ty = if (dy == 0.0) Double.POSITIVE_INFINITY else ((if (sy > 0) y + 1 else y) - y0) / dy
    val dtx = if (dx == 0.0) Double.POSITIVE_INFINITY else 1 / abs(dx)
    val dty = if (dy == 0.0) Double.POSITIVE_INFINITY else 1 / abs(dy)
    val cells = ArrayList<Int>(8)
    fun add(a: Int, b: Int) { cells.add((b shl 13) or (a and 8191)) }
    add(x, y)
    while (x != ex || y != ey) {
        if (x == ex) tx = Double.POSITIVE_INFINITY
        if (y == ey) ty = Double.POSITIVE_INFINITY
        if (abs(tx - ty) < 1e-10) {
            add(x + sx, y); add(x, y + sy); x += sx; y += sy; tx += dtx; ty += dty
        } else if (tx < ty) { x += sx; tx += dtx } else { y += sy; ty += dty }
        add(x, y)
    }
    return cells.toIntArray()
}

fun cellX(cell: Int) = cell and 8191
fun cellY(cell: Int) = cell ushr 13
fun cellId(x: Int, y: Int) = (y shl 13) or x

data class TerritoryAppearance(val color: Int = 0, val pattern: Int = 0, val border: String = "solid") {
    init { require(color in 0..5 && pattern in 0..2 && border in setOf("solid", "dashed")) }
}
data class TerritorySign(val id: Int, val x: Int, val y: Int, val text: String, val logo: String)
data class TerritoryPoint(val x: Double, val y: Double)

class TerritoryPlayer(val id: Int, val identity: String, val name: String, val bot: Boolean) {
    var x = 0.0; var y = 0.0; var heading = 0.0
    var alive = true; var moving = false; var angle = 0.0; var started = false
    var sequence = -1L; var lastInputTick = 0L; var area = 0
    var appearance = TerritoryAppearance()
    val signs = mutableListOf<TerritorySign>()
    var trail = LinkedHashMap<Int, Long>()
    var path = ArrayList<TerritoryPoint>()
    var trailHandle = 0
    var trailChunks = BitSet(4096)
    var capturePending = false
    var status = "READY"
    var botLeg = 0
    var botRoute: List<TerritoryPoint> = emptyList()
    var botOwnedTarget = true
    var botExpansion = 48
    val botAnchors = ArrayDeque<TerritoryPoint>()
}
