package com.kgd.codedictionary.domain.concept.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class ConceptNotFoundException(conceptId: String) :
    BusinessException(ErrorCode.NOT_FOUND, "개념(conceptId=$conceptId)을 찾을 수 없습니다")

class ConceptAlreadyExistsException(conceptId: String) :
    BusinessException(ErrorCode.INVALID_INPUT, "이미 존재하는 개념입니다: $conceptId")

class ConceptIndexNotFoundException(id: Long) :
    BusinessException(ErrorCode.NOT_FOUND, "색인(id=$id)을 찾을 수 없습니다")
