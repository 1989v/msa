package com.kgd.game.presentation.admin.controller

import com.kgd.common.response.ApiResponse
import com.kgd.game.application.catalog.dto.AdminGameSummaryDto
import com.kgd.game.application.catalog.dto.GameDetailDto
import com.kgd.game.application.catalog.dto.GameSort
import com.kgd.game.application.catalog.usecase.ChangeGameStatusUseCase
import com.kgd.game.application.catalog.usecase.CreateGameCollectionUseCase
import com.kgd.game.application.catalog.usecase.CreateGameCommand
import com.kgd.game.application.catalog.usecase.CreateGameUseCase
import com.kgd.game.application.catalog.usecase.GameStatusAction
import com.kgd.game.application.catalog.usecase.GetGameDetailAdminUseCase
import com.kgd.game.application.catalog.usecase.ListGameCollectionsAdminUseCase
import com.kgd.game.application.catalog.usecase.ListGamesAdminUseCase
import com.kgd.game.application.catalog.usecase.UpdateGameCollectionUseCase
import com.kgd.game.application.catalog.usecase.UpdateGameContentUseCase
import com.kgd.game.application.catalog.usecase.UpdateGameMetadataUseCase
import com.kgd.game.application.catalog.usecase.UpdateGameTagsUseCase
import com.kgd.game.domain.catalog.model.CollectionType
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.GameCollection
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import org.springframework.data.domain.Page
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

data class CreateGameRequest(
    @field:NotBlank val slug: String,
    @field:NotBlank val title: String,
    val description: String = "",
    @field:NotBlank val thumbnailUrl: String,
    val coverUrl: String? = null,
    val engineType: EngineType,
    val loadType: LoadType,
    @field:NotBlank val entryUrl: String,
    val orientation: Orientation = Orientation.BOTH,
    val supportsMobile: Boolean = true,
    @field:NotBlank val developerName: String,
    val sdkIntegrated: Boolean = false,
    val genre: Genre = Genre.CASUAL,
    val tags: List<String> = emptyList(),
)

/** null = 미변경. `titleEn`/`descriptionEn` 은 공백을 보내면 비워진다 (SEO 메타 입력). */
data class UpdateGameMetadataRequest(
    val title: String? = null,
    val description: String? = null,
    val titleEn: String? = null,
    val descriptionEn: String? = null,
    val thumbnailUrl: String? = null,
    val coverUrl: String? = null,
    val orientation: Orientation? = null,
    val supportsMobile: Boolean? = null,
    val developerName: String? = null,
    val genre: Genre? = null,
)

data class UpdateGameContentRequest(
    @field:NotBlank val entryUrl: String,
    val sdkIntegrated: Boolean = false,
)

data class UpdateGameTagsRequest(val tags: List<String>)

data class ChangeGameStatusRequest(val action: GameStatusAction)

data class CreateCollectionRequest(
    @field:NotBlank val slug: String,
    @field:NotBlank val title: String,
    val type: CollectionType,
    val tagSlug: String? = null,
    val displayOrder: Int = 0,
    val gameIds: List<Long> = emptyList(),
)

data class UpdateCollectionRequest(
    val title: String? = null,
    val displayOrder: Int? = null,
    val active: Boolean? = null,
    val gameIds: List<Long>? = null,
)

data class CollectionResponse(
    val slug: String,
    val title: String,
    val type: CollectionType,
    val tagSlug: String?,
    val displayOrder: Int,
    val active: Boolean,
    val gameIds: List<Long>,
)

/** 어드민 CRUD — gateway 에서 ROLE_ADMIN 게이트 (portal-fe `/admin` 백오피스에서 호출) */
@RestController
@RequestMapping("/api/v1/admin/games")
class GameAdminController(
    private val listGames: ListGamesAdminUseCase,
    private val getDetail: GetGameDetailAdminUseCase,
    private val createGame: CreateGameUseCase,
    private val updateMetadata: UpdateGameMetadataUseCase,
    private val updateContent: UpdateGameContentUseCase,
    private val updateTags: UpdateGameTagsUseCase,
    private val changeStatus: ChangeGameStatusUseCase,
    private val listCollections: ListGameCollectionsAdminUseCase,
    private val createCollection: CreateGameCollectionUseCase,
    private val updateCollection: UpdateGameCollectionUseCase,
) {

    /** 상태 무관 전체 목록 — 공개 리스트(PUBLISHED 전용)로는 볼 수 없는 게임을 운영자가 다룬다 */
    @GetMapping
    fun list(
        @RequestParam(required = false) q: String?,
        @RequestParam(required = false) status: String?,
        @RequestParam(required = false) genre: String?,
        @RequestParam(required = false) tag: String?,
        @RequestParam(required = false) sort: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): ApiResponse<Page<AdminGameSummaryDto>> =
        ApiResponse.success(
            listGames.execute(
                ListGamesAdminUseCase.Query(
                    q = q,
                    status = GameStatus.parse(status),
                    genre = Genre.parse(genre),
                    tag = tag,
                    sort = GameSort.parseAdmin(sort),
                    page = page,
                    size = size.coerceAtMost(100),
                )
            )
        )

    @GetMapping("/{slug}")
    fun detail(@PathVariable slug: String): ApiResponse<GameDetailDto> =
        ApiResponse.success(getDetail.execute(GetGameDetailAdminUseCase.Query(slug)))

    @PostMapping
    fun create(@Valid @RequestBody request: CreateGameRequest): ApiResponse<GameDetailDto> =
        ApiResponse.success(
            createGame.execute(
                CreateGameCommand(
                    slug = request.slug,
                    title = request.title,
                    description = request.description,
                    thumbnailUrl = request.thumbnailUrl,
                    coverUrl = request.coverUrl,
                    engineType = request.engineType,
                    loadType = request.loadType,
                    entryUrl = request.entryUrl,
                    orientation = request.orientation,
                    supportsMobile = request.supportsMobile,
                    developerName = request.developerName,
                    sdkIntegrated = request.sdkIntegrated,
                    genre = request.genre,
                    tags = request.tags,
                )
            )
        )

    @PutMapping("/{slug}")
    fun updateMetadata(
        @PathVariable slug: String,
        @RequestBody request: UpdateGameMetadataRequest,
    ): ApiResponse<GameDetailDto> =
        ApiResponse.success(
            updateMetadata.execute(
                UpdateGameMetadataUseCase.Command(
                    slug = slug,
                    title = request.title,
                    description = request.description,
                    titleEn = request.titleEn,
                    descriptionEn = request.descriptionEn,
                    thumbnailUrl = request.thumbnailUrl,
                    coverUrl = request.coverUrl,
                    orientation = request.orientation,
                    supportsMobile = request.supportsMobile,
                    developerName = request.developerName,
                    genre = request.genre,
                )
            )
        )

    @PutMapping("/{slug}/content")
    fun updateContent(
        @PathVariable slug: String,
        @Valid @RequestBody request: UpdateGameContentRequest,
    ): ApiResponse<GameDetailDto> =
        ApiResponse.success(updateContent.execute(UpdateGameContentUseCase.Command(slug, request.entryUrl, request.sdkIntegrated)))

    @PutMapping("/{slug}/tags")
    fun updateTags(
        @PathVariable slug: String,
        @RequestBody request: UpdateGameTagsRequest,
    ): ApiResponse<GameDetailDto> =
        ApiResponse.success(updateTags.execute(UpdateGameTagsUseCase.Command(slug, request.tags)))

    @PostMapping("/{slug}/status")
    fun changeStatus(
        @PathVariable slug: String,
        @RequestBody request: ChangeGameStatusRequest,
    ): ApiResponse<GameDetailDto> =
        ApiResponse.success(changeStatus.execute(ChangeGameStatusUseCase.Command(slug, request.action)))

    @GetMapping("/collections")
    fun listCollections(): ApiResponse<List<CollectionResponse>> =
        ApiResponse.success(listCollections.execute().map { it.toResponse() })

    @PostMapping("/collections")
    fun createCollection(@Valid @RequestBody request: CreateCollectionRequest): ApiResponse<CollectionResponse> {
        val collection = createCollection.execute(
            CreateGameCollectionUseCase.Command(
                slug = request.slug,
                title = request.title,
                type = request.type,
                tagSlug = request.tagSlug,
                displayOrder = request.displayOrder,
                gameIds = request.gameIds,
            )
        )
        return ApiResponse.success(collection.toResponse())
    }

    @PutMapping("/collections/{slug}")
    fun updateCollection(
        @PathVariable slug: String,
        @RequestBody request: UpdateCollectionRequest,
    ): ApiResponse<CollectionResponse> {
        val collection = updateCollection.execute(
            UpdateGameCollectionUseCase.Command(
                slug = slug,
                title = request.title,
                displayOrder = request.displayOrder,
                active = request.active,
                gameIds = request.gameIds,
            )
        )
        return ApiResponse.success(collection.toResponse())
    }

    private fun GameCollection.toResponse() = CollectionResponse(
        slug = slug,
        title = title,
        type = type,
        tagSlug = tagSlug,
        displayOrder = displayOrder,
        active = active,
        gameIds = gameIds,
    )
}
