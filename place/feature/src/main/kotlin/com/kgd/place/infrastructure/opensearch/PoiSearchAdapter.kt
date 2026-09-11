package com.kgd.place.infrastructure.opensearch

import com.kgd.place.application.poi.port.PoiSearchPort
import com.kgd.place.domain.poi.model.PoiDocument
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.DistanceUnit
import org.opensearch.client.opensearch._types.FieldValue
import org.opensearch.client.opensearch._types.GeoLocation
import org.opensearch.client.opensearch._types.LatLonGeoLocation
import org.opensearch.client.opensearch._types.SortOrder
import org.opensearch.client.opensearch.core.SearchRequest
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component
class PoiSearchAdapter(
    private val client: OpenSearchClient,
    @Value("\${place.poi.index:poi}") private val indexName: String,
) : PoiSearchPort {

    override fun nearby(query: PoiSearchPort.NearbyQuery): List<PoiDocument> {
        val center = GeoLocation.of { g ->
            g.latlon(LatLonGeoLocation.Builder().lat(query.latitude).lon(query.longitude).build())
        }

        val request = SearchRequest.Builder()
            .index(indexName)
            .query { q ->
                q.bool { b ->
                    query.keyword?.takeIf { it.isNotBlank() }?.let { kw ->
                        b.must { m -> m.match { mt -> mt.field("name").query(FieldValue.of(kw)) } }
                    }
                    query.category?.takeIf { it.isNotBlank() }?.let { cat ->
                        b.filter { f -> f.term { t -> t.field("categoryMajor").value(FieldValue.of(cat)) } }
                    }
                    b.filter { f -> f.term { t -> t.field("status").value(FieldValue.of("ACTIVE")) } }
                    b.filter { f ->
                        f.geoDistance { gd ->
                            gd.field("location").distance("${query.radiusKm}km").location(center)
                        }
                    }
                    b
                }
            }
            .sort { s ->
                s.geoDistance { g ->
                    g.field("location").location(center).order(SortOrder.Asc).unit(DistanceUnit.Kilometers)
                }
            }
            .size(query.size)
            .build()

        return client.search(request, PoiIndexDocument::class.java)
            .hits().hits().mapNotNull { it.source()?.toDomain() }
    }
}
