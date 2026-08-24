package com.kgd.game.infrastructure.persistence.converter

import com.kgd.game.domain.catalog.model.ScoreBoardDef
import tools.jackson.core.type.TypeReference
import tools.jackson.databind.ObjectMapper
import tools.jackson.module.kotlin.jacksonMapperBuilder
import jakarta.persistence.AttributeConverter
import jakarta.persistence.Converter

@Converter
class StringListJsonConverter : AttributeConverter<List<String>, String> {
    override fun convertToDatabaseColumn(attribute: List<String>?): String =
        MAPPER.writeValueAsString(attribute ?: emptyList<String>())

    override fun convertToEntityAttribute(dbData: String?): List<String> {
        if (dbData.isNullOrBlank()) return emptyList()
        return MAPPER.readValue(dbData, STRING_LIST)
    }

    companion object {
        private val MAPPER = ObjectMapper()
        private val STRING_LIST = object : TypeReference<List<String>>() {}
    }
}

@Converter
class LongListJsonConverter : AttributeConverter<List<Long>, String> {
    override fun convertToDatabaseColumn(attribute: List<Long>?): String =
        MAPPER.writeValueAsString(attribute ?: emptyList<Long>())

    override fun convertToEntityAttribute(dbData: String?): List<Long> {
        if (dbData.isNullOrBlank()) return emptyList()
        return MAPPER.readValue(dbData, LONG_LIST)
    }

    companion object {
        private val MAPPER = ObjectMapper()
        private val LONG_LIST = object : TypeReference<List<Long>>() {}
    }
}

/**
 * 게임이 나눈 랭킹 보드 목록 (V59). 조회 조건이 된 적이 없고 항상 게임 행과 함께 읽히므로
 * 별도 표가 아니라 JSON 컬럼이다 — tags 와 같은 판단.
 */
@Converter
class ScoreBoardDefListJsonConverter : AttributeConverter<List<ScoreBoardDef>, String> {
    override fun convertToDatabaseColumn(attribute: List<ScoreBoardDef>?): String =
        MAPPER.writeValueAsString(attribute ?: emptyList<ScoreBoardDef>())

    override fun convertToEntityAttribute(dbData: String?): List<ScoreBoardDef> {
        if (dbData.isNullOrBlank()) return emptyList()
        return MAPPER.readValue(dbData, BOARD_LIST)
    }

    companion object {
        /**
         * 코틀린 모듈이 필요하다 — `ScoreBoardDef` 는 no-arg 생성자가 없는 data class 라
         * 맨 ObjectMapper 로는 **읽기만** 실패한다(쓰기는 게터로 되니까 조용히 넘어간다).
         * 그 상태로 배포하면 게임 목록 조회 전체가 죽는다 — 컨버터는 게임 행마다 돈다.
         */
        private val MAPPER = jacksonMapperBuilder().build()
        private val BOARD_LIST = object : TypeReference<List<ScoreBoardDef>>() {}
    }
}
