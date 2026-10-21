package com.kgd.ranking.domain.cafe.model

import java.math.BigDecimal
import java.net.URI
import java.time.LocalDate

/** Pure effective projection: source objects and all raw fields are immutable. */
object CafeCorrectionProjection {
    val numericFields = setOf("kcal", "sugarG", "caffeineMg", "sodiumMg", "carbsG", "fatG", "satFatG", "proteinG", "volumeMl")
    val fields = numericFields + setOf("displayName", "drinkGroup", "adminNote", "sourceUrl", "checkedAt")
    val groups = listOf("스무디·프라페", "고구마라떼", "말차·녹차라떼", "밀크티", "바닐라라떼", "카페모카", "카라멜마끼아또", "콜드브루", "아메리카노", "에스프레소", "카푸치노", "초코", "에이드", "탄산음료", "라떼", "주스", "티", "우유·요거트", "기타")
    fun https(value: String) { val uri = runCatching { URI(value) }.getOrElse { throw IllegalArgumentException("Invalid URL") }; require(value.length <= 2048 && uri.scheme == "https" && !uri.host.isNullOrBlank() && uri.userInfo == null) { "HTTPS URL required" } }
    fun validate(source: CafeDrink, field: String, action: String, value: String?) {
        require(field in fields && action in setOf("SET", "SET_UNKNOWN", "RESET")) { "Unknown correction field/action" }
        if (action == "RESET") { require(value == null); return }
        if (action == "SET_UNKNOWN") { require((field in numericFields || field == "adminNote") && value == null)
            if (field == "caffeineMg") require(source.caffeineStatus !in setOf(CaffeineStatus.ZERO, CaffeineStatus.UNDISCLOSED)) { "Caffeine state forbids unknown correction" }
            return }
        require(!value.isNullOrBlank()) { "SET requires value" }
        when {
            field in numericFields -> {
                val n = value.toBigDecimal()
                require(n.signum() >= 0 && n.scale() <= 4 && n.precision() - n.scale() <= 10) { "DECIMAL(14,4), nonnegative required" }
                if (field == "volumeMl") require(n.signum() > 0)
                if (field == "caffeineMg") {
                    require(source.caffeineStatus != CaffeineStatus.UNDISCLOSED) { "Undisclosed caffeine cannot be estimated" }
                    if (source.caffeineStatus == CaffeineStatus.ZERO) require(n.signum() == 0) { "ZERO caffeine only permits zero" }
                }
            }
            field == "drinkGroup" -> require(value in groups)
            field == "sourceUrl" -> https(value)
            field == "checkedAt" -> require(!LocalDate.parse(value).isAfter(LocalDate.now(java.time.Clock.systemUTC())))
            else -> require(value.length <= if (field == "adminNote") 4000 else 255)
        }
    }
    fun dependencies(source: CafeDrink, field: String): Map<String, String?> = when (field) {
        "drinkGroup" -> linkedMapOf("menuName" to source.menuName, "sourceCategory" to source.sourceCategory, "classificationRuleVersion" to "classification-v1")
        "volumeMl" -> linkedMapOf("volumeMl" to source.volumeMl?.stripTrailingZeros()?.toPlainString(), "servingBasis" to source.servingBasis, "temperature" to source.temperature.orEmpty(), "sizeLabel" to source.sizeLabel.orEmpty(), "volumeRuleVersion" to "volume-v1")
        else -> linkedMapOf("sourceValue" to value(source, field)?.let { if (field in numericFields) it.toBigDecimal().stripTrailingZeros().toPlainString() else it }, "servingBasis" to if (field in numericFields) source.servingBasis else null)
    }
    fun validateSource(source: CafeDrink) {
        require(source.brandSlug.isNotBlank() && source.brandSlug.length <= 40 && source.menuName.isNotBlank() && source.menuName.length <= 255)
        require(source.temperature.orEmpty().length <= 20 && source.sizeLabel.orEmpty().length <= 60)
        numericFields.forEach { field -> value(source, field)?.toBigDecimal()?.let { n ->
            require(n.signum() >= 0 && n.scale() <= 4 && n.precision() - n.scale() <= 10) { "Invalid source DECIMAL(14,4): $field" }
            if (field == "volumeMl") require(n.signum() > 0)
        } }
        if (source.caffeineStatus == CaffeineStatus.ZERO) require(source.caffeineMg?.signum() == 0) { "ZERO source requires caffeineMg=0" }
    }
    fun baseline(source: CafeDrink, field: String): String = when (field) {
        "drinkGroup" -> listOf(source.menuName, source.sourceCategory, "classification-v1").toString()
        "volumeMl" -> listOf(source.volumeMl?.stripTrailingZeros()?.toPlainString(), source.servingBasis, source.temperature.orEmpty(), source.sizeLabel.orEmpty(), "volume-v1").toString()
        else -> listOf(value(source, field)?.let { if (field in numericFields) it.toBigDecimal().stripTrailingZeros().toPlainString() else it }, if (field in numericFields) source.servingBasis else null).toString()
    }
    fun value(source: CafeDrink, field: String): String? = when (field) {
        "kcal" -> source.kcal?.toPlainString(); "sugarG" -> source.sugarG?.toPlainString(); "caffeineMg" -> source.caffeineMg?.toPlainString()
        "sodiumMg" -> source.sodiumMg?.toPlainString(); "carbsG" -> source.carbsG?.toPlainString(); "fatG" -> source.fatG?.toPlainString()
        "satFatG" -> source.satFatG?.toPlainString(); "proteinG" -> source.proteinG?.toPlainString(); "volumeMl" -> source.volumeMl?.toPlainString()
        "drinkGroup" -> source.drinkGroup; "displayName" -> source.menuName; "sourceUrl" -> source.sourceUrl; "checkedAt" -> source.checkedAt.toString(); else -> null
    }
    fun apply(source: CafeDrink, values: Map<String, Pair<String, String?>>): CafeDrink {
        fun number(field: String, original: BigDecimal?) = if (values.containsKey(field)) values.getValue(field).second?.toBigDecimal() else original
        val volume = values["volumeMl"]
        return source.copy(kcal = number("kcal", source.kcal), sugarG = number("sugarG", source.sugarG), caffeineMg = number("caffeineMg", source.caffeineMg),
            sodiumMg = number("sodiumMg", source.sodiumMg), carbsG = number("carbsG", source.carbsG), fatG = number("fatG", source.fatG), satFatG = number("satFatG", source.satFatG), proteinG = number("proteinG", source.proteinG),
            sourceUrl = values["sourceUrl"]?.second ?: source.sourceUrl, checkedAt = values["checkedAt"]?.second?.let(LocalDate::parse) ?: source.checkedAt,
            displayName = values["displayName"]?.second, adminNote = values["adminNote"]?.second,
            effectiveGroup = values["drinkGroup"]?.second, volumeOverridden = volume != null,
            effectiveVolume = volume?.second?.toBigDecimal())
    }
}
