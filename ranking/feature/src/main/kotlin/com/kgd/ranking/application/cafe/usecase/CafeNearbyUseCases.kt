package com.kgd.ranking.application.cafe.usecase

import com.kgd.ranking.application.cafe.dto.*

interface GetCafeNearbyUseCase {
    fun capability(): CafeNearbyCapability
    fun areas(parent: String?): List<CafeArea>
    fun search(request: CafeNearbyRequest): CafeNearbyResult
}
interface SyncCafeStoresUseCase { fun sync(snapshot: CafeStoreSnapshot): Int }

class CafeNearbyUnavailable : RuntimeException("Nearby data unavailable")
class CafeNearbyInvalid : RuntimeException("Invalid nearby request")
class CafeNearbyNotFound : RuntimeException("Selected resource unavailable")


class CafeNearbyBusy : RuntimeException("Nearby capacity exceeded")
