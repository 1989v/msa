package com.kgd.codedictionary.domain.concept.ontology

import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind
import com.kgd.codedictionary.domain.concept.model.ConceptKind
import com.kgd.codedictionary.domain.concept.model.ConceptLevel

/** 온톨로지 전체의 단일 revision 과 도메인 목록. 적용·건너뛰기·관리 해제의 단위다 */
data class OntologyManifest(val revision: Int, val domains: List<String>)

data class OntologyConcept(
    val id: String,
    /** 파일에 빠져 있으면 null — 규칙 ② 가 잡는다 */
    val kind: ConceptKind?,
    val name: String,
    val category: ConceptCategory,
    val level: ConceptLevel,
    val description: String,
    val synonyms: List<String> = emptyList(),
    val evidence: List<OntologyEvidence> = emptyList(),
    val questions: List<String> = emptyList(),
    val code: List<OntologyCodeRef> = emptyList(),
)

/**
 * 이 개념을 구현한 레포 코드 — 줄 번호가 아니라 심볼로 가리킨다(코드가 움직여도 썩지 않게).
 * 화면은 원본 파일에서 [symbol] 이 처음 나오는 줄부터 보여 준다.
 */
data class OntologyCodeRef(val path: String, val symbol: String, val note: String? = null)

enum class EvidenceKind { ADR, POST, RECORD, MEASUREMENT }

data class OntologyEvidence(val kind: EvidenceKind, val ref: String, val note: String? = null)

data class OntologyRelation(
    val from: String,
    val to: String,
    val kind: ConceptEdgeKind,
    val ordinal: Int = 0,
    val reason: String? = null,
    val evidenceRef: String? = null,
)

/** 도메인 파일 하나 = 루트 하나. 간선은 from 개념이 사는 파일에만 적힌다 */
data class OntologyDomain(
    /** 파일 이름에서 온 도메인 — 파일 안의 `domain` 값과 같아야 한다 */
    val fileDomain: String,
    val domain: String,
    val root: String,
    val concepts: List<OntologyConcept>,
    val relations: List<OntologyRelation>,
)

data class OntologyViolation(val rule: Int, val subject: String, val message: String) {
    override fun toString(): String = "[$rule] $subject $message"
}

class OntologyValidationException(val violations: List<OntologyViolation>) :
    IllegalStateException("온톨로지 공리 위반 ${violations.size}건:\n" + violations.joinToString("\n"))

/**
 * manifest 의 파일 전부를 합집합으로 들고 공리를 검사한다. 위반은 첫 하나에서 멈추지 않고 전부 모은다.
 * 규칙 번호는 스펙 SR-3 과 같다.
 */
class ConceptOntology(
    val manifest: OntologyManifest,
    val domains: List<OntologyDomain>,
) {
    val concepts: List<OntologyConcept> get() = domains.flatMap { it.concepts }
    val relations: List<OntologyRelation> get() = domains.flatMap { it.relations }

    fun validateOrThrow() {
        val violations = validate()
        if (violations.isNotEmpty()) throw OntologyValidationException(violations)
    }

    fun validate(): List<OntologyViolation> {
        val out = mutableListOf<OntologyViolation>()
        fun v(rule: Int, subject: String, message: String) {
            out += OntologyViolation(rule, subject, message)
        }

        // ① 유일성 · 간선 양 끝 존재 · manifest 목록 = 파일 집합
        val byId = linkedMapOf<String, OntologyConcept>()
        val ownerOf = mutableMapOf<String, String>()
        for (d in domains) for (c in d.concepts) {
            val prev = ownerOf.putIfAbsent(c.id, d.domain)
            if (prev != null) v(1, c.id, "개념 id 가 중복된다 ($prev · ${d.domain})") else byId[c.id] = c
        }
        val fileDomains = domains.map { it.fileDomain }.toSet()
        val listed = manifest.domains.toSet()
        (listed - fileDomains).forEach { v(1, it, "manifest 에 있는데 파일이 없다") }
        (fileDomains - listed).forEach { v(1, it, "파일이 있는데 manifest 에 없다") }
        if (manifest.domains.size != listed.size) v(1, "manifest", "도메인 목록에 중복이 있다")
        domains.filter { it.domain != it.fileDomain }
            .forEach { v(1, it.fileDomain, "파일 이름과 domain 값(${it.domain})이 다르다") }
        for (r in relations) {
            if (r.from !in byId) v(1, r.from, "간선 ${r.kind} → ${r.to} 의 출발 개념이 없다")
            if (r.to !in byId) v(1, r.to, "간선 ${r.from} —${r.kind}→ 의 도착 개념이 없다")
        }

        // ② kind 필수
        byId.values.filter { it.kind == null }.forEach { v(2, it.id, "kind 가 없다") }

        // ③ 허용 범위
        for (r in relations) {
            val from = byId[r.from]?.kind ?: continue
            val to = byId[r.to]?.kind ?: continue
            if (!r.kind.allows(from, to)) v(3, r.from, "${r.kind} 는 $from → $to 를 허용하지 않는다 (→ ${r.to})")
        }

        val contains = relations.filter { it.kind == ConceptEdgeKind.CONTAINS && it.from in byId && it.to in byId }
        val parentsOf = contains.groupBy({ it.to }, { it.from })
        val childrenOf = contains.groupBy({ it.from }, { it.to })

        // ④ CONTAINS 비순환
        findCycle(byId.keys, childrenOf)?.let { v(4, it.first(), "CONTAINS 순환: ${it.joinToString(" → ")}") }

        // ⑤ 파일당 루트 하나, 나머지는 부모 ≥ 1, TERM 은 정확히 1
        for (d in domains) {
            val root = byId[d.root]
            when {
                root == null || ownerOf[d.root] != d.domain -> v(5, d.root, "루트가 ${d.domain} 파일에 없다")
                root.kind != null && root.kind != ConceptKind.DOMAIN -> v(5, d.root, "루트의 kind 가 DOMAIN 이 아니다 (${root.kind})")
                !parentsOf[d.root].isNullOrEmpty() -> v(5, d.root, "루트에 CONTAINS 부모가 있다")
            }
            for (c in d.concepts) {
                if (c.id == d.root || ownerOf[c.id] != d.domain) continue
                val parents = parentsOf[c.id].orEmpty()
                if (parents.isEmpty()) v(5, c.id, "CONTAINS 부모가 없다 — 트리에서 사라진다")
                if (c.kind == ConceptKind.TERM && parents.size > 1) {
                    v(5, c.id, "TERM 의 CONTAINS 부모는 하나여야 한다 (${parents.joinToString()}) — 쓰는 쪽은 USES 로")
                }
            }
        }

        // ⑥ FLOWS_TO 는 CONTAINS 부모를 공유하는 형제 사이
        for (r in relations.filter { it.kind == ConceptEdgeKind.FLOWS_TO && it.from in byId && it.to in byId }) {
            val shared = parentsOf[r.from].orEmpty().toSet() intersect parentsOf[r.to].orEmpty().toSet()
            if (shared.isEmpty()) v(6, r.from, "FLOWS_TO → ${r.to} 의 양 끝이 CONTAINS 부모를 공유하지 않는다")
        }

        // ⑦ 대칭 관계는 한 방향만 · 자기 간선 금지 · 같은 간선 중복 금지
        val seen = mutableSetOf<Triple<String, String, ConceptEdgeKind>>()
        for (r in relations) {
            if (r.from == r.to) v(7, r.from, "${r.kind} 가 자기 자신을 가리킨다")
            if (!seen.add(Triple(r.from, r.to, r.kind))) v(7, r.from, "${r.kind} → ${r.to} 가 두 번 적혔다")
            if (r.kind.symmetric && Triple(r.to, r.from, r.kind) in seen && r.from != r.to) {
                v(7, r.from, "${r.kind} 는 대칭이라 한 방향만 적는다 (${r.to} 쪽에도 있다)")
            }
        }

        // ⑧ 같은 (from, to) 에 CONTAINS 와 USES 를 함께 걸지 않는다
        val containsPairs = contains.map { it.from to it.to }.toSet()
        relations.filter { it.kind == ConceptEdgeKind.USES && (it.from to it.to) in containsPairs }
            .forEach { v(8, it.from, "→ ${it.to} 에 CONTAINS 와 USES 가 함께 있다") }

        return out
    }

    private fun findCycle(ids: Collection<String>, childrenOf: Map<String, List<String>>): List<String>? {
        val state = mutableMapOf<String, Int>() // 1 = 방문 중, 2 = 끝
        val stack = ArrayDeque<String>()
        fun dfs(n: String): List<String>? {
            state[n] = 1
            stack.addLast(n)
            for (c in childrenOf[n].orEmpty()) {
                when (state[c]) {
                    1 -> return stack.dropWhile { it != c } + c
                    null -> dfs(c)?.let { return it }
                }
            }
            stack.removeLast()
            state[n] = 2
            return null
        }
        for (id in ids) if (state[id] == null) dfs(id)?.let { return it }
        return null
    }
}
