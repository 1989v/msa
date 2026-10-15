package com.kgd.place.domain.market.model

/** Shared field precedence for public projection and database search expressions.
 * An existing override with a null value clears the field; it is not a missing override.
 */
object MarketDisplayValuePolicy {
    fun <Value, Edit> editedValue(source: Value, primary: Edit?, partner: Edit? = null,
        applyEdit: (Edit, Value) -> Value): Value {
        val inherited = if (partner == null) source else applyEdit(partner, source)
        return if (primary == null) inherited else applyEdit(primary, inherited)
    }

    fun <Value> membership(judged: Value, ingested: Value, firstPresent: (Value, Value) -> Value): Value =
        firstPresent(judged, ingested)
}
