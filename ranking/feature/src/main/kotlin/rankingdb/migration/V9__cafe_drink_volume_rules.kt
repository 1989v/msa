package rankingdb.migration

import org.flywaydb.core.api.migration.BaseJavaMigration
import org.flywaydb.core.api.migration.Context

/** Recompute stored cup volumes after CupVolumes learned oz cup sizes and Twosome "ICE BLENDED" rows. */
class V9__cafe_drink_volume_rules : BaseJavaMigration() {
    override fun migrate(context: Context) = V8__cafe_drink_weight_volume().migrate(context)
}
