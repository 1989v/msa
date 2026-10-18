package com.kgd.game.application.territory.usecase

import com.kgd.game.domain.territory.model.TerritoryAppearance
import com.kgd.game.domain.territory.model.TerritoryChunk

data class TerritoryChunkView(val id: Int, val x: Int, val y: Int, val chunk: TerritoryChunk)
data class TerritoryFrame(val fields: Map<String, Any?>, val chunks: List<TerritoryChunkView>, val dangerChunks: List<TerritoryChunkView>, val removed: List<Int>, val living: Set<Int>, val trailOwners: Map<Int, Int> = emptyMap())

interface TerritoryWorldUseCase {
    fun join(identity: String, name: String): Int
    fun leave(id: Int)
    fun input(id: Int, sequence: Long, moving: Boolean, angle: Double)
    fun respawn(id: Int): Int
    fun cosmetics(id: Int, appearance: TerritoryAppearance)
    fun placeSign(id: Int, x: Int, y: Int, text: String, logo: String)
    fun removeSign(id: Int, sign: Int)
    fun advance()
    fun snapshot(id: Int, known: Map<Int, Long>, includeMap: Boolean): TerritoryFrame
}
