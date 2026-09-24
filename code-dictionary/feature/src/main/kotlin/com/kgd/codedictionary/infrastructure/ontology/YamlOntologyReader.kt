package com.kgd.codedictionary.infrastructure.ontology

import com.kgd.codedictionary.application.ontology.dto.LoadedOntology
import com.kgd.codedictionary.application.ontology.port.OntologySourcePort
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind
import com.kgd.codedictionary.domain.concept.model.ConceptKind
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import com.kgd.codedictionary.domain.concept.ontology.ConceptOntology
import com.kgd.codedictionary.domain.concept.ontology.EvidenceKind
import com.kgd.codedictionary.domain.concept.ontology.OntologyConcept
import com.kgd.codedictionary.domain.concept.ontology.OntologyDomain
import com.kgd.codedictionary.domain.concept.ontology.OntologyEvidence
import com.kgd.codedictionary.domain.concept.ontology.OntologyManifest
import com.kgd.codedictionary.domain.concept.ontology.OntologyRelation
import org.springframework.beans.factory.annotation.Value
import org.springframework.core.io.support.PathMatchingResourcePatternResolver
import org.springframework.stereotype.Component
import org.yaml.snakeyaml.LoaderOptions
import org.yaml.snakeyaml.Yaml
import org.yaml.snakeyaml.constructor.SafeConstructor
import java.security.MessageDigest

/**
 * `ontology/` 아래 `manifest.yaml` 과 도메인 파일(`<domain>.yaml`)을 읽는다.
 *
 * `content_hash` 규칙(스펙 SR-4.1): 파일을 **이름순으로 정렬**해 각 이름·길이·바이트를 이어 SHA-256 으로 낸다.
 * 열거 순서와 무관하고, 주석·공백 변경도 해시를 바꾼다 — 같은 revision 의 다른 해시는 적용이 오류로 거부한다.
 *
 * 모르는 키·kind·category 는 파싱 오류로 멈춘다. 오타가 조용히 빠진 간선이 되지 않게.
 */
@Component
class YamlOntologyReader(
    @Value("\${ontology.location:classpath:ontology/}") private val location: String,
) : OntologySourcePort {

    override fun load(): LoadedOntology {
        val base = location.trimEnd('/') + "/"
        val files = PathMatchingResourcePatternResolver().getResources("$base*.yaml")
            .map { (it.filename ?: error("이름 없는 리소스: $it")) to it.inputStream.use { s -> s.readAllBytes() } }
            .sortedBy { it.first }
        require(files.isNotEmpty()) { "온톨로지 파일이 없다: $base" }

        val manifestBytes = files.firstOrNull { it.first == MANIFEST }?.second ?: error("$MANIFEST 가 없다: $base")
        val domains = files.filter { it.first != MANIFEST }.map { (name, bytes) -> parseDomain(name.removeSuffix(".yaml"), bytes) }
        return LoadedOntology(ConceptOntology(parseManifest(manifestBytes), domains), hash(files))
    }

    private fun hash(files: List<Pair<String, ByteArray>>): String {
        val md = MessageDigest.getInstance("SHA-256")
        for ((name, bytes) in files) {
            md.update(name.toByteArray(Charsets.UTF_8))
            md.update(0)
            md.update(bytes.size.toString().toByteArray(Charsets.UTF_8))
            md.update(0)
            md.update(bytes)
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }

    private fun yaml(bytes: ByteArray): Map<String, Any?> {
        @Suppress("UNCHECKED_CAST")
        return Yaml(SafeConstructor(LoaderOptions())).load<Any?>(bytes.toString(Charsets.UTF_8)) as? Map<String, Any?>
            ?: error("YAML 최상위가 맵이 아니다")
    }

    private fun parseManifest(bytes: ByteArray): OntologyManifest {
        val m = yaml(bytes)
        unknownKeys(MANIFEST, m.keys, setOf("revision", "domains"))
        return OntologyManifest(
            revision = (m["revision"] as? Int) ?: error("$MANIFEST 의 revision 은 정수여야 한다"),
            domains = strings(m["domains"], "$MANIFEST domains"),
        )
    }

    private fun parseDomain(fileDomain: String, bytes: ByteArray): OntologyDomain {
        val m = yaml(bytes)
        val where = "$fileDomain.yaml"
        unknownKeys(where, m.keys, setOf("domain", "root", "concepts"))
        val relations = mutableListOf<OntologyRelation>()
        val concepts = list(m["concepts"], "$where concepts").map { raw ->
            @Suppress("UNCHECKED_CAST")
            val c = raw as? Map<String, Any?> ?: error("$where 의 개념 항목이 맵이 아니다: $raw")
            val id = text(c["id"], "$where 개념 id")
            unknownKeys("$where $id", c.keys, CONCEPT_KEYS + RELATION_KEYS.keys)
            for ((key, kind) in RELATION_KEYS) {
                list(c[key], "$where $id.$key").forEachIndexed { i, v -> relations += relation(id, kind, i + 1, v, "$where $id.$key") }
            }
            OntologyConcept(
                id = id,
                kind = (c["kind"] as? String)?.let { enumOf<ConceptKind>(it, "$where $id.kind") },
                name = text(c["name"], "$where $id.name"),
                category = enumOf(text(c["category"], "$where $id.category"), "$where $id.category"),
                level = enumOf(text(c["level"], "$where $id.level"), "$where $id.level"),
                description = text(c["description"], "$where $id.description"),
                synonyms = strings(c["synonyms"], "$where $id.synonyms"),
                evidence = list(c["evidence"], "$where $id.evidence").map { e ->
                    @Suppress("UNCHECKED_CAST")
                    val em = e as? Map<String, Any?> ?: error("$where $id.evidence 항목이 맵이 아니다")
                    unknownKeys("$where $id.evidence", em.keys, setOf("kind", "ref", "note"))
                    OntologyEvidence(enumOf<EvidenceKind>(text(em["kind"], "evidence.kind"), "$where $id.evidence.kind"),
                        text(em["ref"], "$where $id.evidence.ref"), em["note"] as? String)
                },
                questions = strings(c["questions"], "$where $id.questions"),
            )
        }
        return OntologyDomain(
            fileDomain = fileDomain,
            domain = text(m["domain"], "$where domain"),
            root = text(m["root"], "$where root"),
            concepts = concepts,
            relations = relations,
        )
    }

    private fun relation(from: String, kind: ConceptEdgeKind, ordinal: Int, v: Any?, where: String): OntologyRelation = when (v) {
        is String -> OntologyRelation(from, v, kind, ordinal)
        is Map<*, *> -> {
            unknownKeys(where, v.keys.map { it.toString() }.toSet(), setOf("to", "reason", "evidence"))
            OntologyRelation(from, text(v["to"], "$where.to"), kind, ordinal, v["reason"] as? String, v["evidence"] as? String)
        }
        else -> error("$where 항목은 개념 id 또는 {to, reason, evidence} 여야 한다: $v")
    }

    private fun unknownKeys(where: String, keys: Set<String>, allowed: Set<String>) {
        val unknown = keys - allowed
        require(unknown.isEmpty()) { "$where 에 모르는 키가 있다: $unknown" }
    }

    private fun text(v: Any?, where: String): String =
        (v as? String)?.takeIf { it.isNotBlank() } ?: error("$where 는 비어 있지 않은 문자열이어야 한다")

    private fun list(v: Any?, where: String): List<Any?> = when (v) {
        null -> emptyList()
        is List<*> -> v
        else -> error("$where 는 목록이어야 한다")
    }

    private fun strings(v: Any?, where: String): List<String> = list(v, where).map { it as? String ?: error("$where 항목은 문자열이어야 한다: $it") }

    private inline fun <reified E : Enum<E>> enumOf(value: String, where: String): E =
        enumValues<E>().firstOrNull { it.name == value } ?: error("$where 의 값 '$value' 를 모른다 — ${enumValues<E>().joinToString { it.name }}")

    private companion object {
        const val MANIFEST = "manifest.yaml"
        val CONCEPT_KEYS = setOf("id", "kind", "name", "category", "level", "description", "synonyms", "evidence", "questions")
        val RELATION_KEYS: Map<String, ConceptEdgeKind> = ConceptEdgeKind.entries.associateBy { it.name.lowercase() }
    }
}
