package com.kgd.codedictionary.domain.index.model

data class CodeLocation(
    val filePath: String,
    val lineStart: Int,
    val lineEnd: Int,
    val gitUrl: String? = null
) {
    init {
        require(filePath.isNotBlank()) { "filePath는 비어있을 수 없습니다" }
        require(lineStart > 0) { "lineStart는 0보다 커야 합니다" }
        require(lineEnd >= lineStart) { "lineEnd는 lineStart 이상이어야 합니다" }
    }
}
