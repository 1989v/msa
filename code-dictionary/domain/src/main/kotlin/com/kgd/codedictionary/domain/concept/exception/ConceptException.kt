package com.kgd.codedictionary.domain.concept.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class ConceptNotFoundException(conceptId: String) :
    BusinessException(ErrorCode.NOT_FOUND, "개념(conceptId=$conceptId)을 찾을 수 없습니다")

class ConceptAlreadyExistsException(conceptId: String) :
    BusinessException(ErrorCode.INVALID_INPUT, "이미 존재하는 개념입니다: $conceptId")

class ConceptIndexNotFoundException(id: Long) :
    BusinessException(ErrorCode.NOT_FOUND, "색인(id=$id)을 찾을 수 없습니다")

/**
 * 온톨로지 파일이 관리하는 개념을 어드민 API 로 고치거나 지우려 했다. 원본은 파일이고 다음 적용이
 * 덮어쓰므로 받지 않는다 — 파일을 고쳐 PR 로 올린다. HTTP 409 로 나간다.
 */
class ManagedConceptException(conceptId: String, managedBy: String) :
    BusinessException(ErrorCode.INVALID_INPUT, "온톨로지 파일($managedBy)이 관리하는 개념은 파일에서 고친다: $conceptId")
