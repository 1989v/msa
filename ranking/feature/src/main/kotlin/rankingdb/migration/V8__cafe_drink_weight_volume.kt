package rankingdb.migration

import com.kgd.ranking.domain.cafe.model.CafeDrink
import com.kgd.ranking.domain.cafe.model.CaffeineStatus
import java.time.LocalDate
import org.flywaydb.core.api.migration.BaseJavaMigration
import org.flywaydb.core.api.migration.Context

/** Recompute stored cup volumes and per-100ml values after CupVolumes learned gram-only rows and Twosome frappes. */
class V8__cafe_drink_weight_volume : BaseJavaMigration() {
    override fun migrate(context: Context) {
        recompute(context, "cafe_drink", "")
        // Admin-verified volumes are corrections, not derived values.
        recompute(context, "cafe_drink_effective", " WHERE volume_source <> 'ADMIN_VERIFIED'")
    }

    private fun recompute(context: Context, table: String, where: String) {
        val rows = context.connection.createStatement().use { statement ->
            statement.executeQuery(
                "SELECT id, brand_slug, menu_name, source_category, temperature, size_label, volume_ml, serving_basis, kcal, sugar_g, caffeine_mg FROM $table$where",
            ).use { result ->
                buildList {
                    while (result.next()) add(result.getLong(1) to CafeDrink(
                        brandSlug = result.getString(2), brandName = "", menuName = result.getString(3),
                        sourceCategory = result.getString(4), temperature = result.getString(5)?.ifEmpty { null },
                        sizeLabel = result.getString(6)?.ifEmpty { null }, volumeMl = result.getBigDecimal(7),
                        servingBasis = result.getString(8), kcal = result.getBigDecimal(9), sugarG = result.getBigDecimal(10),
                        caffeineMg = result.getBigDecimal(11), caffeineStatus = CaffeineStatus.DISCLOSED,
                        rawNutrition = emptyMap(), sourceUrl = "", checkedAt = LocalDate.EPOCH,
                    ))
                }
            }
        }
        context.connection.prepareStatement(
            "UPDATE $table SET cup_volume_ml = ?, volume_source = ?, sugar_per_100ml = ?, caffeine_per_100ml = ?, kcal_per_100ml = ? WHERE id = ?",
        ).use { statement ->
            rows.forEach { (id, drink) ->
                statement.setBigDecimal(1, drink.cupVolumeMl)
                statement.setString(2, drink.volumeSource.name)
                statement.setBigDecimal(3, drink.sugarPer100ml)
                statement.setBigDecimal(4, drink.caffeinePer100ml)
                statement.setBigDecimal(5, drink.kcalPer100ml)
                statement.setLong(6, id)
                statement.addBatch()
            }
            statement.executeBatch()
        }
    }
}
