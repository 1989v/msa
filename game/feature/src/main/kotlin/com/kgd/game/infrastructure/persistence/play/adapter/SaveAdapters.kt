package com.kgd.game.infrastructure.persistence.play.adapter

import com.kgd.game.application.play.port.GameRunRepositoryPort
import com.kgd.game.application.play.port.GameSaveRepositoryPort
import com.kgd.game.application.play.port.SaveLeasePort
import com.kgd.game.application.play.port.SaveSnapshot
import com.kgd.game.domain.play.exception.SaveVersionConflictException
import com.kgd.game.domain.play.model.GameRun
import com.kgd.game.infrastructure.persistence.play.entity.GameRunJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameSaveDataJpaEntity
import com.kgd.game.infrastructure.persistence.play.repository.GameRunJpaRepository
import com.kgd.game.infrastructure.persistence.play.repository.GameSaveDataJpaRepository
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import org.springframework.stereotype.Repository
import java.time.Duration

@Repository
class GameSaveRepositoryAdapter(
    private val jpaRepository: GameSaveDataJpaRepository,
) : GameSaveRepositoryPort {

    override fun find(gameId: Long, memberId: Long): SaveSnapshot? =
        jpaRepository.findByGameIdAndMemberId(gameId, memberId)
            ?.let { SaveSnapshot(data = it.data, version = it.version) }

    override fun upsert(gameId: Long, memberId: Long, data: String, expectedVersion: Long): SaveSnapshot {
        val existing = jpaRepository.findByGameIdAndMemberId(gameId, memberId)
        if (existing == null) {
            if (expectedVersion != 0L) throw SaveVersionConflictException(expected = expectedVersion, actual = 0L)
            val saved = jpaRepository.save(GameSaveDataJpaEntity(gameId = gameId, memberId = memberId, data = data))
            return SaveSnapshot(data = saved.data, version = saved.version)
        }
        if (existing.version != expectedVersion) {
            throw SaveVersionConflictException(expected = expectedVersion, actual = existing.version)
        }
        existing.updateData(data)
        val saved = jpaRepository.saveAndFlush(existing)
        return SaveSnapshot(data = saved.data, version = saved.version)
    }
}

@Repository
class GameRunRepositoryAdapter(
    private val jpaRepository: GameRunJpaRepository,
) : GameRunRepositoryPort {

    override fun save(run: GameRun): GameRun {
        val id = run.id
        val entity = if (id != null) {
            val existing = jpaRepository.findById(id).orElseThrow()
            existing.update(run)
            existing
        } else {
            jpaRepository.save(GameRunJpaEntity.fromDomain(run))
        }
        return entity.toDomain()
    }

    override fun findByRunKey(runKey: String): GameRun? = jpaRepository.findByRunKey(runKey)?.toDomain()
}

/** Redis SETNX 기반 디바이스 리스 — 동일 holder 는 TTL 연장, 타 holder 는 거절 */
@Component
class RedisSaveLeaseStore(
    private val redis: StringRedisTemplate,
) : SaveLeasePort {

    private fun key(gameId: Long, memberId: Long) = "game:save:lease:$gameId:$memberId"

    override fun tryAcquire(gameId: Long, memberId: Long, holder: String, ttl: Duration): Boolean {
        val k = key(gameId, memberId)
        if (redis.opsForValue().setIfAbsent(k, holder, ttl) == true) return true
        if (redis.opsForValue().get(k) == holder) {
            redis.expire(k, ttl)
            return true
        }
        return false
    }
}
