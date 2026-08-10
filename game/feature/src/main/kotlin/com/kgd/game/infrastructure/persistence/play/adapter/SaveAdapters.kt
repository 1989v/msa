package com.kgd.game.infrastructure.persistence.play.adapter

import com.kgd.game.domain.play.model.ScoreTrack
import com.kgd.game.application.play.port.GameRunRepositoryPort
import com.kgd.game.application.play.port.GameSaveRepositoryPort
import com.kgd.game.application.play.port.SaveLeasePort
import com.kgd.game.application.play.port.GameScoreRepositoryPort
import com.kgd.game.application.play.port.SaveSnapshot
import com.kgd.game.application.play.port.ScoreEntry
import com.kgd.game.domain.play.exception.SaveVersionConflictException
import com.kgd.game.domain.play.model.GameRun
import com.kgd.game.infrastructure.persistence.play.entity.GameRunJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameSaveDataJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameScoreJpaEntity
import com.kgd.game.infrastructure.persistence.play.repository.GameRunJpaRepository
import com.kgd.game.infrastructure.persistence.play.repository.GameSaveDataJpaRepository
import com.kgd.game.infrastructure.persistence.play.repository.GameScoreJpaRepository
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import org.springframework.stereotype.Repository
import java.security.SecureRandom
import java.time.Duration

@Repository
class GameSaveRepositoryAdapter(
    private val jpaRepository: GameSaveDataJpaRepository,
) : GameSaveRepositoryPort {

    private companion object {
        /** 사람이 옮겨 적기 쉽도록 모양이 헷갈리는 글자(0/O, 1/I/L)를 뺀 알파벳 */
        const val CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
        const val CODE_LENGTH = 12
        const val CODE_ATTEMPTS = 8
    }

    override fun find(gameId: Long, memberId: Long): SaveSnapshot? =
        jpaRepository.findByGameIdAndMemberId(gameId, memberId)?.toSnapshot()

    override fun findByCode(gameId: Long, code: String): SaveSnapshot? =
        jpaRepository.findByGameIdAndSaveCode(gameId, code.normalizeCode())?.toSnapshot()

    override fun upsert(gameId: Long, memberId: Long?, code: String?, data: String, expectedVersion: Long): SaveSnapshot {
        val normalized = code?.normalizeCode()
        val existing = memberId?.let { jpaRepository.findByGameIdAndMemberId(gameId, it) }
            ?: normalized?.let { jpaRepository.findByGameIdAndSaveCode(gameId, it) }

        if (existing == null) {
            if (expectedVersion != 0L) throw SaveVersionConflictException(expected = expectedVersion, actual = 0L)
            val saved = jpaRepository.save(
                GameSaveDataJpaEntity(gameId = gameId, memberId = memberId, saveCode = issueCode(), data = data)
            )
            return saved.toSnapshot()
        }
        if (existing.version != expectedVersion) {
            throw SaveVersionConflictException(expected = expectedVersion, actual = existing.version)
        }
        existing.updateData(data)
        return jpaRepository.saveAndFlush(existing).toSnapshot()
    }

    /** 충돌하면 다시 뽑는다 — 12자리 31진이라 실제 충돌은 사실상 없다 */
    private fun issueCode(): String {
        repeat(CODE_ATTEMPTS) {
            val candidate = (1..CODE_LENGTH)
                .map { CODE_ALPHABET[SecureRandom().nextInt(CODE_ALPHABET.length)] }
                .joinToString("")
            if (!jpaRepository.existsBySaveCode(candidate)) return candidate
        }
        error("이어하기 코드 발급에 실패했습니다")
    }

    private fun GameSaveDataJpaEntity.toSnapshot() =
        SaveSnapshot(data = data, version = version, code = saveCode)
}

/** 입력 코드 정규화 — 대소문자와 구분용 하이픈/공백을 무시한다 */
fun String.normalizeCode(): String = uppercase().filter { it.isLetterOrDigit() }

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

    private fun key(gameId: Long, subject: String) = "game:save:lease:$gameId:$subject"

    override fun tryAcquire(gameId: Long, subject: String, holder: String, ttl: Duration, takeover: Boolean): Boolean {
        val k = key(gameId, subject)
        if (redis.opsForValue().setIfAbsent(k, holder, ttl) == true) return true
        if (takeover || redis.opsForValue().get(k) == holder) {
            redis.opsForValue().set(k, holder, ttl)
            return true
        }
        return false
    }
}

@Repository
class GameScoreRepositoryAdapter(
    private val jpaRepository: GameScoreJpaRepository,
) : GameScoreRepositoryPort {

    override fun submit(
        gameId: Long,
        track: ScoreTrack,
        nickname: String,
        score: Long,
        detail: String?,
    ): Pair<Boolean, Int> {
        val existing = jpaRepository.findByGameIdAndTrackAndNickname(gameId, track, nickname)
        val applied = if (existing == null) {
            jpaRepository.save(
                GameScoreJpaEntity(gameId = gameId, track = track, nickname = nickname, score = score, detail = detail),
            )
            true
        } else {
            existing.updateIfHigher(score, detail).also { if (it) jpaRepository.saveAndFlush(existing) }
        }
        val best = if (applied) score else existing!!.score
        val rank = jpaRepository.countByGameIdAndTrackAndScoreGreaterThan(gameId, track, best).toInt() + 1
        return applied to rank
    }

    override fun top(gameId: Long, track: ScoreTrack, limit: Int): List<ScoreEntry> =
        jpaRepository.findTop50ByGameIdAndTrackOrderByScoreDescUpdatedAtAsc(gameId, track)
            .take(limit)
            .mapIndexed { i, e -> ScoreEntry(rank = i + 1, nickname = e.nickname, score = e.score, detail = e.detail) }
}
