import { useEffect, useState } from 'react';
import { ListRow } from '@kgd/design-system';
import { CATEGORY_COLORS } from '../types/index';
import { fetchServices, type ServiceItem } from '../api/searchApi';
import './ServiceCatalog.css';

function abbr(name: string): string {
  // "Code Dictionary" → "CD", "Product" → "P"
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const CONCEPT_COLORS: Record<string, string> = {
  'aggregate': CATEGORY_COLORS.ARCHITECTURE,
  'event-driven-architecture': CATEGORY_COLORS.DISTRIBUTED_SYSTEM,
  'saga-pattern': CATEGORY_COLORS.DISTRIBUTED_SYSTEM,
  'idempotency': CATEGORY_COLORS.DISTRIBUTED_SYSTEM,
  'circuit-breaker': CATEGORY_COLORS.INFRASTRUCTURE,
  'inverse-index': CATEGORY_COLORS.DATA,
  'bulk-indexing': CATEGORY_COLORS.DATA,
  'alias-swap': CATEGORY_COLORS.DATA,
  'jwt': CATEGORY_COLORS.SECURITY,
  'oauth': CATEGORY_COLORS.SECURITY,
  'coroutine': CATEGORY_COLORS.CONCURRENCY,
  'api-gateway': CATEGORY_COLORS.INFRASTRUCTURE,
  'rate-limiting': CATEGORY_COLORS.INFRASTRUCTURE,
  'sealed-class': CATEGORY_COLORS.LANGUAGE_FEATURE,
  'cqrs': CATEGORY_COLORS.ARCHITECTURE,
  'port-adapter': CATEGORY_COLORS.ARCHITECTURE,
  'service-discovery': CATEGORY_COLORS.INFRASTRUCTURE,
  'health-check': CATEGORY_COLORS.INFRASTRUCTURE,
};

interface ServiceCatalogProps {
  onConceptClick: (conceptId: string) => void;
}

// 정적 엔트리 — 커머스 쇼핑 플로우 데모 (포털 SPA 내 /shop 라우트, LIVE).
// API(/api/v1/services) 응답과 동일한 ServiceItem 구조를 따른다.
const SHOP_DEMO_SERVICE: ServiceItem = {
  code: 'shop-demo',
  name: '커머스 쇼핑 (데모)',
  description: '상품 검색 → 주문 → 주문내역 — order/inventory/fulfillment Saga 데모',
  port: null,
  isPrivate: false,
  concepts: ['saga-pattern', 'event-driven-architecture', 'idempotency'],
};

export default function ServiceCatalog({ onConceptClick }: ServiceCatalogProps) {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchServices()
      .then((data) => {
        if (!cancelled) setServices(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '서비스 목록을 불러오지 못했습니다');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConceptClick = (conceptId: string) => {
    const techSection = document.getElementById('tech');
    if (techSection) {
      techSection.scrollIntoView({ behavior: 'smooth' });
    }
    setTimeout(() => onConceptClick(conceptId), 300);
  };

  return (
    <section id="services" className="service-catalog-section">
      <div className="service-catalog-inner">
        <div className="service-catalog-header">
          <h2 className="service-catalog-title">서비스 카탈로그</h2>
          <p className="service-catalog-subtitle">MSA 커머스 플랫폼을 구성하는 서비스들</p>
        </div>
        {loading && <div className="service-catalog-status">불러오는 중...</div>}
        {error && <div className="service-catalog-status">{error}</div>}
        {!loading && !error && (
          <div className="service-catalog-grid">
            <div key={SHOP_DEMO_SERVICE.code} className="service-card">
              <ListRow
                avatar={<span>{abbr(SHOP_DEMO_SERVICE.name)}</span>}
                primary={SHOP_DEMO_SERVICE.name}
                secondary={SHOP_DEMO_SERVICE.description}
                value="LIVE"
                href="/shop"
              />
              <div className="service-concepts">
                {SHOP_DEMO_SERVICE.concepts.map((concept) => {
                  const color = CONCEPT_COLORS[concept] ?? '#6c63ff';
                  return (
                    <button
                      key={concept}
                      className="service-concept-chip"
                      style={{ background: `${color}20`, color, borderColor: `${color}44` }}
                      onClick={() => handleConceptClick(concept)}
                    >
                      {concept}
                    </button>
                  );
                })}
              </div>
            </div>
            {services.map((service) => (
              <div key={service.code} className="service-card">
                <ListRow
                  avatar={<span>{abbr(service.name)}</span>}
                  primary={service.name}
                  secondary={service.description}
                  value={service.port != null ? `:${service.port}` : undefined}
                />
                <div className="service-concepts">
                  {service.concepts.map((concept) => {
                    const color = CONCEPT_COLORS[concept] ?? '#6c63ff';
                    return (
                      <button
                        key={concept}
                        className="service-concept-chip"
                        style={{ background: `${color}20`, color, borderColor: `${color}44` }}
                        onClick={() => handleConceptClick(concept)}
                      >
                        {concept}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
