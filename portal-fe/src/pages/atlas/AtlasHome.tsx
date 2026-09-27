import { Link } from 'react-router-dom';
import type { AtlasDomain, ConceptAtlas } from './atlasGraph';
import { ConceptSearch, SectionHead } from './AtlasParts';

// 첫 화면 분류 — 온톨로지가 아니라 보여 주는 방식이라 화면 쪽에 둔다.
// 서비스 도메인은 이 레포가 실제로 만든 서비스, 나머지는 그 서비스가 기대는 기반 기술이다.
const SERVICES = ['search', 'recommendation', 'commerce-catalog', 'ads', 'commerce-order'];
const TECH = [
  { name: '기초', description: '어느 서비스를 짜든 바닥에 깔리는 것', keys: ['cs-fundamentals', 'language', 'runtime', 'concurrency'] },
  { name: '설계 · 프레임워크', description: '코드를 어떻게 나누고 묶고 확인하나', keys: ['architecture', 'spring', 'testing'] },
  { name: '데이터 · 분산', description: '저장하고, 나눠 두고, 흘려보내기', keys: ['data', 'distributed', 'messaging'] },
  { name: '인프라 · 운영', description: '띄우고, 잇고, 지키고, 지켜보기', keys: ['network', 'cloud', 'infrastructure', 'observability', 'security'] },
];

export default function AtlasHome({ atlas }: { atlas: ConceptAtlas }) {
  const byKey = new Map(atlas.domains.map((d) => [d.domain, d]));
  const services = SERVICES.flatMap((k) => byKey.get(k) ?? []);
  const listed = new Set([...SERVICES, ...TECH.flatMap((g) => g.keys)]);
  // 분류표에 아직 없는 도메인은 빠뜨리지 않고 마지막 묶음으로 보인다
  const rest = atlas.domains.filter((d) => !listed.has(d.domain)).map((d) => d.domain);
  const groups = [...TECH, ...(rest.length ? [{ name: '그 밖', description: '아직 묶음을 정하지 않은 도메인', keys: rest }] : [])]
    .map((g) => ({ ...g, domains: g.keys.flatMap((k) => byKey.get(k) ?? []) }))
    .filter((g) => g.domains.length > 0);
  const serviceKeys = new Set(SERVICES);
  const techLinks = (d: AtlasDomain) =>
    atlas.links
      .filter((l) => (l.from === d.domain && !serviceKeys.has(l.to)) || (l.to === d.domain && !serviceKeys.has(l.from)))
      .reduce((n, l) => n + l.count, 0);
  const total = atlas.domains.reduce((n, d) => n + d.conceptCount, 0);
  const code = atlas.domains.reduce((n, d) => n + d.codeRefCount, 0);

  return (
    <main className="atlas-home">
      <section className="atlas-home__intro kh-seep">
        <div className="kh-mono atlas-eyebrow atlas-latin">CONCEPT ATLAS</div>
        <h1 className="atlas-home__title">개념 아틀라스</h1>
        <p className="atlas-home__lead">
          서비스 도메인에서 시작해, 그 서비스가 기대는 기반 기술로 내려간다. 개념마다 이 레포의 코드와 그것을 다룬 글이 붙어 있다.
        </p>
        <div className="kh-mono atlas-stats">
          <span>도메인 {atlas.domains.length}</span>
          <span>개념 {total}</span>
          <span>코드 {code}</span>
        </div>
        <ConceptSearch />
      </section>

      <section className="atlas-home__sec" aria-label="서비스 도메인">
        <SectionHead index={1} title="서비스 도메인" meta="실제로 만든 서비스" />
        <ol className="atlas-services">
          {services.map((d, i) => (
            <li key={d.domain}>
              <Link to={`/tech/d/${d.domain}`} className="atlas-service">
                <span className="kh-mono atlas-service__top">
                  <span>{String(i + 1).padStart(2, '0')}_</span>
                  <span>개념 {d.conceptCount}</span>
                </span>
                <span className="atlas-service__name">{d.name}</span>
                {d.description && <span className="atlas-service__desc">{d.description}</span>}
                <span className="kh-mono atlas-service__foot">
                  <span>코드 {d.codeRefCount}</span>
                  <span>기반 기술과 {techLinks(d)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="atlas-home__sec" aria-label="기반 기술">
        <SectionHead index={2} title="기반 기술" meta={`묶음 ${groups.length} · 도메인 ${groups.reduce((n, g) => n + g.domains.length, 0)}`} />
        <div className="atlas-tech">
          {groups.map((g) => (
            <section key={g.name} className="atlas-tech__group">
              <h3>
                {g.name} <span className="kh-mono atlas-muted">{g.domains.reduce((n, d) => n + d.conceptCount, 0)}</span>
              </h3>
              <p>{g.description}</p>
              <ul>
                {g.domains.map((d) => (
                  <li key={d.domain}>
                    <Link to={`/tech/d/${d.domain}`} className="atlas-tech__row">
                      <span>{d.name}</span>
                      <span className="kh-mono atlas-muted">{d.conceptCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
