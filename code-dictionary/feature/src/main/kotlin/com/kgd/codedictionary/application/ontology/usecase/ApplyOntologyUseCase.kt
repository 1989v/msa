package com.kgd.codedictionary.application.ontology.usecase

import com.kgd.codedictionary.application.ontology.dto.ApplyReport

/** 레포의 온톨로지 파일 묶음을 검증해 DB 에 적용한다 */
interface ApplyOntologyUseCase {
    fun applyFromSource(): ApplyReport
}
