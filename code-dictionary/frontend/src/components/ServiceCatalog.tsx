import { CATEGORY_COLORS } from '../types/index';
import './ServiceCatalog.css';

interface ServiceInfo {
  name: string;
  description: string;
  port?: number;
  concepts: string[];
}

const SERVICES: ServiceInfo[] = [
  { name: 'Product', description: '상품 관리 서비스 (SSOT)', port: 8081, concepts: ['aggregate', 'event-driven-architecture', 'saga-pattern'] },
  { name: 'Order', description: '주문/결제 서비스', port: 8082, concepts: ['saga-pattern', 'idempotency', 'circuit-breaker'] },
  { name: 'Search', description: 'Elasticsearch 기반 검색', port: 8083, concepts: ['inverse-index', 'bulk-indexing', 'alias-swap'] },
  { name: 'Auth', description: '인증/인가 서비스', port: 8087, concepts: ['jwt', 'oauth', 'coroutine'] },
  { name: 'Gateway', description: 'API Gateway + Rate Limiting', port: 8080, concepts: ['api-gateway', 'rate-limiting', 'jwt'] },
  { name: 'Gifticon', description: '기프티콘 관리 서비스', port: 8086, concepts: ['aggregate', 'sealed-class', 'cqrs'] },
  { name: 'Code Dictionary', description: 'IT 개념 사전 + 시각화', port: 8089, concepts: ['bulk-indexing', 'inverse-index', 'port-adapter'] },
  { name: 'Common', description: '공유 라이브러리', concepts: ['circuit-breaker', 'jwt', 'event-driven-architecture'] },
  { name: 'Discovery', description: 'Eureka Service Discovery', port: 8761, concepts: ['service-discovery', 'health-check'] },
];

// Map concept IDs to display colors (fallback to accent)
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

export default function ServiceCatalog({ onConceptClick }: ServiceCatalogProps) {
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
        <div className="service-catalog-grid">
          {SERVICES.map((service) => (
            <div key={service.name} className="service-card">
              <div className="service-card-top">
                <span className="service-name">{service.name}</span>
                {service.port && (
                  <span className="service-port">:{service.port}</span>
                )}
              </div>
              <p className="service-description">{service.description}</p>
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
      </div>
    </section>
  );
}
