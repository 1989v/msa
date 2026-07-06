package com.kgd.game.domain.catalog.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.game.domain.catalog.model.GameStatus

class GameNotFoundException(slug: String) :
    BusinessException(ErrorCode.NOT_FOUND, "게임(slug=$slug)을 찾을 수 없습니다")

class GameAlreadyExistsException(slug: String) :
    BusinessException(ErrorCode.DUPLICATE_RESOURCE, "이미 존재하는 게임입니다: $slug")

class InvalidGameStatusException(slug: String, current: GameStatus, target: GameStatus) :
    BusinessException(ErrorCode.INVALID_GAME_STATUS, "게임(slug=$slug) 상태를 $current 에서 $target 로 전이할 수 없습니다")

class GameNotPlayableException(slug: String) :
    BusinessException(ErrorCode.INVALID_GAME_STATUS, "게임(slug=$slug)은 현재 플레이할 수 없는 상태입니다")
