package com.kgd.game.infrastructure.persistence.converter

import tools.jackson.core.type.TypeReference
import tools.jackson.databind.ObjectMapper
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
