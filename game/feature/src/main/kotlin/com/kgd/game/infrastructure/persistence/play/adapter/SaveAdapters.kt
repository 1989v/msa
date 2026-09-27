package com.kgd.game.infrastructure.persistence.play.adapter

import com.kgd.game.application.play.port.GameRunRepositoryPort
import com.kgd.game.application.play.port.GameSaveRepositoryPort
import com.kgd.game.application.play.port.SaveSnapshot
import com.kgd.game.domain.play.exception.SaveVersionConflictException
import com.kgd.game.domain.play.model.GameRun
import com.kgd.game.infrastructure.persistence.play.entity.GameRunJpaEntity
import com.kgd.game.infrastructure.persistence.play.SaveCipher
import com.kgd.game.infrastructure.persistence.play.entity.GameSaveDataJpaEntity
import com.kgd.game.infrastructure.persistence.play.repository.GameRunJpaRepository
import com.kgd.game.infrastructure.persistence.play.repository.GameSaveDataJpaRepository
import org.springframework.stereotype.Repository
import java.security.SecureRandom

@Repository
class GameSaveRepositoryAdapter(
    private val jpaRepository: GameSaveDataJpaRepository,
    private val cipher: SaveCipher,
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

    /**
     * 코드로 찾은 행은 **주인이 없을 때만** 쓴다.
     *
     * 코드를 아는 것은 게스트 세이브의 자격 증명이지만 계정 세이브의 자격 증명은 아니다.
     * 걸러내지 않으면 남의 코드를 제시한 요청이 그 계정의 진행도를 덮어쓴다.
     */
    override fun upsert(gameId: Long, memberId: Long?, code: String?, data: String, expectedVersion: Long): SaveSnapshot {
        val normalized = code?.normalizeCode()
        val existing = memberId?.let { jpaRepository.findByGameIdAndMemberId(gameId, it) }
            ?: normalized?.let { jpaRepository.findByGameIdAndSaveCode(gameId, it) }?.takeIf { it.memberId == null }

        if (existing == null) {
            if (expectedVersion != 0L) throw SaveVersionConflictException(expected = expectedVersion, actual = 0L)
            val saved = jpaRepository.save(
                GameSaveDataJpaEntity(
                    gameId = gameId, memberId = memberId, saveCode = issueCode(), data = cipher.encrypt(data),
                )
            )
            return saved.toSnapshot()
        }
        if (existing.version != expectedVersion) {
            throw SaveVersionConflictException(expected = expectedVersion, actual = existing.version)
        }
        // 계정 슬롯이 비어 있으면 게스트로 쌓은 이 행을 계정으로 승계한다 —
        // 계정에 이미 세이브가 있었다면 위에서 그 행이 잡혔으므로 여기 오지 않는다.
        if (memberId != null && existing.memberId == null) existing.claimBy(memberId)
        existing.updateData(cipher.encrypt(data))
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
        SaveSnapshot(data = cipher.decrypt(data), version = version, code = saveCode)
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
