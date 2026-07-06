package com.kgd.game.application.catalog.service

import com.kgd.game.application.catalog.dto.GameDetailDto
import com.kgd.game.application.catalog.port.GameCollectionRepositoryPort
import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.catalog.port.GameStatsRepositoryPort
import com.kgd.game.domain.catalog.exception.GameAlreadyExistsException
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.catalog.model.CollectionType
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.GameCollection
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

data class CreateGameCommand(
    val slug: String,
    val title: String,
    val description: String,
    val thumbnailUrl: String,
    val coverUrl: String?,
    val engineType: EngineType,
    val loadType: LoadType,
    val entryUrl: String,
    val orientation: Orientation,
    val supportsMobile: Boolean,
    val developerName: String,
    val sdkIntegrated: Boolean,
    val tags: List<String>,
)

enum class GameStatusAction { SUBMIT_REVIEW, LAUNCH_BETA, PUBLISH, SUSPEND, RESUME }

@Service
@Transactional(transactionManager = "gameTransactionManager")
class GameAdminService(
    private val gameRepository: GameRepositoryPort,
    private val statsRepository: GameStatsRepositoryPort,
    private val collectionRepository: GameCollectionRepositoryPort,
) {

    fun create(command: CreateGameCommand): GameDetailDto {
        if (gameRepository.existsBySlug(command.slug)) throw GameAlreadyExistsException(command.slug)
        val game = gameRepository.save(
            Game.create(
                slug = command.slug,
                title = command.title,
                description = command.description,
                thumbnailUrl = command.thumbnailUrl,
                coverUrl = command.coverUrl,
                engineType = command.engineType,
                loadType = command.loadType,
                entryUrl = command.entryUrl,
                orientation = command.orientation,
                supportsMobile = command.supportsMobile,
                developerName = command.developerName,
                sdkIntegrated = command.sdkIntegrated,
                tags = command.tags,
            )
        )
        return GameDetailDto.of(game, null)
    }

    fun updateMetadata(
        slug: String,
        title: String?,
        description: String?,
        thumbnailUrl: String?,
        coverUrl: String?,
        orientation: Orientation?,
        supportsMobile: Boolean?,
        developerName: String?,
    ): GameDetailDto {
        val game = findGame(slug)
        game.updateMetadata(
            title = title,
            description = description,
            thumbnailUrl = thumbnailUrl,
            coverUrl = coverUrl,
            orientation = orientation,
            supportsMobile = supportsMobile,
            developerName = developerName,
        )
        return saveAndToDto(game)
    }

    fun updateContent(slug: String, entryUrl: String, sdkIntegrated: Boolean): GameDetailDto {
        val game = findGame(slug)
        game.updateContent(entryUrl = entryUrl, sdkIntegrated = sdkIntegrated, now = Instant.now())
        return saveAndToDto(game)
    }

    fun updateTags(slug: String, tags: List<String>): GameDetailDto {
        val game = findGame(slug)
        game.updateTags(tags)
        return saveAndToDto(game)
    }

    fun changeStatus(slug: String, action: GameStatusAction): GameDetailDto {
        val game = findGame(slug)
        when (action) {
            GameStatusAction.SUBMIT_REVIEW -> game.submitForReview()
            GameStatusAction.LAUNCH_BETA -> game.launchBeta()
            GameStatusAction.PUBLISH -> game.publish(Instant.now())
            GameStatusAction.SUSPEND -> game.suspend()
            GameStatusAction.RESUME -> game.resume()
        }
        return saveAndToDto(game)
    }

    fun createCollection(
        slug: String,
        title: String,
        type: CollectionType,
        tagSlug: String?,
        displayOrder: Int,
        gameIds: List<Long>,
    ): GameCollection = collectionRepository.save(
        GameCollection.create(
            slug = slug,
            title = title,
            type = type,
            tagSlug = tagSlug,
            displayOrder = displayOrder,
            gameIds = gameIds,
        )
    )

    fun updateCollection(
        slug: String,
        title: String?,
        displayOrder: Int?,
        active: Boolean?,
        gameIds: List<Long>?,
    ): GameCollection {
        val collection = collectionRepository.findBySlug(slug) ?: throw GameNotFoundException(slug)
        collection.update(title = title, displayOrder = displayOrder, active = active)
        gameIds?.let { collection.replaceGames(it) }
        return collectionRepository.save(collection)
    }

    private fun findGame(slug: String): Game =
        gameRepository.findBySlug(slug) ?: throw GameNotFoundException(slug)

    private fun saveAndToDto(game: Game): GameDetailDto {
        val saved = gameRepository.save(game)
        val gameId = saved.id
        return GameDetailDto.of(saved, gameId?.let { statsRepository.findByGameId(it) })
    }
}
