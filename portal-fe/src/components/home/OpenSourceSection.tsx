import type { OpenSourceItem } from '../../api/displayApi';
import { useReveal } from '../../hooks/useReveal';
import './Home.css';

interface OpenSourceSectionProps {
  items: OpenSourceItem[];
}

/**
 * 공개 오픈소스 저장소 전시. 서비스 타일과 같은 판 문법이지만
 * 목적지가 플랫폼 밖(GitHub)이라 카드 전체가 외부 링크다.
 */
export default function OpenSourceSection({ items }: OpenSourceSectionProps) {
  const reveal = useReveal();
  if (items.length === 0) return null;

  return (
    <section id="opensource" className="home-section" ref={reveal}>
      <div className="home-inner">
        <div className="kh-section-head kh-rule-draw">
          <span className="kh-mono kh-index">03_</span>
          <h2 className="home-section-title">오픈소스</h2>
        </div>
        <p className="kh-seep home-section-desc">
          플랫폼 밖에서도 쓰라고 만든 것들입니다. 전부 GitHub 에 공개되어 있습니다.
        </p>

        <ul className="oss-grid kh-stagger">
          {items.map((item) => (
            <li key={item.slug} className="kh-seep">
              <a
                className="oss-card kh-slab kh-grain"
                href={item.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="oss-card-head">
                  <span className="oss-name">{item.name}</span>
                  <span className="oss-language">{item.language}</span>
                </span>
                <span className="oss-tagline">{item.tagline}</span>
                <span className="oss-repo kh-mono">
                  {item.repoUrl.replace('https://github.com/', '')} ↗
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
