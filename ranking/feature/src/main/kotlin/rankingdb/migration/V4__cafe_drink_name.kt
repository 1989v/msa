package rankingdb.migration

import com.kgd.ranking.domain.cafe.model.DrinkNames
import org.flywaydb.core.api.migration.BaseJavaMigration
import org.flywaydb.core.api.migration.Context

/** Backfill with the same domain rule used by every bulk synchronization. */
class V4__cafe_drink_name : BaseJavaMigration() {
    override fun migrate(context: Context) {
        context.connection.createStatement().use { it.execute("ALTER TABLE cafe_drink ADD COLUMN drink_name VARCHAR(255) NOT NULL DEFAULT ''") }
        val rows = context.connection.createStatement().use { statement ->
            statement.executeQuery("SELECT id, menu_name FROM cafe_drink").use { result ->
                buildList { while (result.next()) add(result.getLong(1) to DrinkNames.normalize(result.getString(2))) }
            }
        }
        context.connection.prepareStatement("UPDATE cafe_drink SET drink_name = ? WHERE id = ?").use { update ->
            rows.forEach { (id, name) -> update.setString(1, name); update.setLong(2, id); update.addBatch() }
            update.executeBatch()
        }
        context.connection.createStatement().use { it.execute("CREATE INDEX idx_cafe_drink_name ON cafe_drink (drink_name)") }
    }
}
