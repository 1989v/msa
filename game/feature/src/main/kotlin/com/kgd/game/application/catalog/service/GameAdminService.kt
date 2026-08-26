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
import com.kgd.game.domain.catalog.model.GameStats
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation
import com.kgd.game.application.catalog.usecase.ChangeGameStatusUseCase
import com.kgd.game.application.catalog.usecase.CreateGameCollectionUseCase
import com.kgd.game.application.catalog.usecase.CreateGameCommand
import com.kgd.game.application.catalog.usecase.CreateGameUseCase
import com.kgd.game.application.catalog.usecase.GameStatusAction
import com.kgd.game.application.catalog.usecase.ListGameCollectionsAdminUseCase
import com.kgd.game.application.catalog.usecase.UpdateGameCollectionUseCase
import com.kgd.game.application.catalog.usecase.UpdateGameContentUseCase
import com.kgd.game.application.catalog.usecase.UpdateGameMetadataUseCase
import com.kgd.game.application.catalog.usecase.UpdateGameTagsUseCase
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
@Transactional(transactionManager = "gameTransactionManager")
class GameAdminService(
    private val gameRepository: GameRepositoryPort,
    private val statsRepository: GameStatsRepositoryPort,
    private val collectionRepository: GameCollectionRepositoryPort,
) : CreateGameUseCase, UpdateGameMetadataUseCase, UpdateGameContentUseCase, UpdateGameTagsUseCase, ChangeGameStatusUseCase,
    ListGameCollectionsAdminUseCase, CreateGameCollectionUseCase, UpdateGameCollectionUseCase {

    override fun execute(command: CreateGameCommand): GameDetailDto {
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
                genre = command.genre,
                tags = command.tags,
            )
        )
        // 통계 row 를 생성 시점에 만들어 둔다 — 첫 플레이가 동시에 들어와도 insert 경합이 없다.
        val stats = game.id?.let { statsRepository.save(GameStats.init(it)) }
        return GameDetailDto.of(game, stats)
    }

    override fun execute(command: UpdateGameMetadataUseCase.Command): GameDetailDto {
        val (slug, title, description, titleEn, descriptionEn, thumbnailUrl, coverUrl, orientation, supportsMobile, developerName, genre) = command
        val game = findGame(slug)
        game.updateMetadata(
            title = title,
            description = description,
            titleEn = titleEn,
            descriptionEn = descriptionEn,
            thumbnailUrl = thumbnailUrl,
            coverUrl = coverUrl,
            orientation = orientation,
            supportsMobile = supportsMobile,
            developerName = developerName,
            genre = genre,
        )
        return saveAndToDto(game)
    }

    override fun execute(command: UpdateGameContentUseCase.Command): GameDetailDto {
        val game = findGame(command.slug)
        game.updateContent(entryUrl = command.entryUrl, sdkIntegrated = command.sdkIntegrated, now = Instant.now())
        return saveAndToDto(game)
    }

    override fun execute(command: UpdateGameTagsUseCase.Command): GameDetailDto {
        val game = findGame(command.slug)
        game.updateTags(command.tags)
        return saveAndToDto(game)
    }

    override fun execute(command: ChangeGameStatusUseCase.Command): GameDetailDto {
        val game = findGame(command.slug)
        when (command.action) {
            GameStatusAction.SUBMIT_REVIEW -> game.submitForReview()
            GameStatusAction.LAUNCH_BETA -> game.launchBeta()
            GameStatusAction.PUBLISH -> game.publish(Instant.now())
            GameStatusAction.SUSPEND -> game.suspend()
            GameStatusAction.RESUME -> game.resume()
        }
        return saveAndToDto(game)
    }

    override fun execute(): List<GameCollection> = collectionRepository.findAll()

    override fun execute(command: CreateGameCollectionUseCase.Command): GameCollection = collectionRepository.save(
        GameCollection.create(
            slug = command.slug,
            title = command.title,
            type = command.type,
            tagSlug = command.tagSlug,
            displayOrder = command.displayOrder,
            gameIds = command.gameIds,
        )
    )

    override fun execute(command: UpdateGameCollectionUseCase.Command): GameCollection {
        val (slug, title, displayOrder, active, gameIds) = command
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
