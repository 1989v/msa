package rankingdb.migration

import com.kgd.ranking.domain.cafe.model.DrinkNames
import org.flywaydb.core.api.migration.BaseJavaMigration
import org.flywaydb.core.api.migration.Context

/** Recompute stored names after DrinkNames learned size suffixes such as (라지/점보) and (K). */
class V7__cafe_drink_name_size_suffix : BaseJavaMigration() {
    override fun migrate(context: Context) {
        renormalize(context, "SELECT id, menu_name FROM cafe_drink", "UPDATE cafe_drink SET drink_name = ? WHERE id = ?")
        renormalize(context, "SELECT id, COALESCE(display_name, menu_name) FROM cafe_drink_effective", "UPDATE cafe_drink_effective SET drink_name = ? WHERE id = ?")
    }

    private fun renormalize(context: Context, select: String, update: String) {
        val rows = context.connection.createStatement().use { statement ->
            statement.executeQuery(select).use { result ->
                buildList { while (result.next()) add(result.getLong(1) to DrinkNames.normalize(result.getString(2))) }
            }
        }
        context.connection.prepareStatement(update).use { statement ->
            rows.forEach { (id, name) -> statement.setString(1, name); statement.setLong(2, id); statement.addBatch() }
            statement.executeBatch()
        }
    }
}
