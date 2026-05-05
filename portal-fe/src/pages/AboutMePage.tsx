/**
 * AboutMePage — 본인 소개 / 경력 / 기술 스택 placeholder.
 *
 * 추후 docs/portfolio/ 의 마크다운 콘텐츠를 기반으로 정통화 (마크다운 렌더 + 섹션 분리).
 */
export default function AboutMePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 text-gray-900">About me</h1>
        <p className="text-gray-600">백엔드 엔지니어 · MSA · Kotlin/Spring · K8s</p>
      </header>

      <section className="prose prose-slate max-w-none">
        <h2>요약</h2>
        <p>
          서버 사이드 시스템 설계 / 운영을 깊게 보는 엔지니어. Clean Architecture 와 도메인 주도
          설계를 일관 적용하고, 분산 시스템(Kafka / 분산락 / 동시성) 의 정합성에 강합니다.
        </p>

        <h2>주요 스킬</h2>
        <ul>
          <li>언어/런타임: Kotlin 2.x, Java 21+, Python (sidecar)</li>
          <li>프레임워크: Spring Boot 4 (MVC + virtual thread), JPA + QueryDSL</li>
          <li>인프라: K8s (k3d / managed), Kustomize, Jib, Resilience4j</li>
          <li>데이터: MySQL 8, ClickHouse, OpenSearch, Redis Cluster</li>
          <li>보안: Envelope encryption, SHA-256 audit chain, TOTP RFC 6238</li>
        </ul>

        <h2>대표 프로젝트</h2>
        <ul>
          <li>
            <strong>MSA Commerce Platform</strong> — Phase 3 (실매매) 까지 전 영역. 4-layer 게이트 +
            3-레벨 kill-switch + audit chain. (이 사이트가 그 플랫폼의 진입 포털)
          </li>
          <li>
            <strong>Quant 통합 트레이딩</strong> — 분할매매 / 시그널 / 융합 전략 + 차트 분석 +
            입문자 학습 CMS (ADR-0033/0036/0037).
          </li>
          <li>
            <strong>Code Dictionary</strong> — IT 개념 사전 + 시각화 (Three.js force graph).
          </li>
        </ul>
      </section>
    </main>
  );
}
