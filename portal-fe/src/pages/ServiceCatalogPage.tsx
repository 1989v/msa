/**
 * ServiceCatalogPage — MSA 플랫폼의 서비스 진입점 카탈로그.
 *
 * FE: portal-fe (현재 페이지) / admin / quant / gifticon / agent-viewer
 * Backend: gateway 가 /api/v1/* 라우팅. 본 카탈로그는 FE 만 카드로 노출.
 */
type Service = {
  name: string;
  href: string;
  desc: string;
  status: 'live' | 'beta' | 'wip';
};

const SERVICES: Service[] = [
  {
    name: '코드 딕셔너리',
    href: '/dict',
    desc: 'IT 개념 사전 + 시각화. OpenSearch 검색 + Three.js force graph.',
    status: 'live',
  },
  {
    name: 'Quant 트레이딩',
    href: '/quant/',
    desc: '분할매매 / 시그널 / 융합 전략 + 차트 분석 + 입문자 학습 (Phase 3 실매매 코어 완료).',
    status: 'beta',
  },
  {
    name: 'Admin 백오피스',
    href: '/admin/',
    desc: '플랫폼 운영 관리 도구.',
    status: 'wip',
  },
  {
    name: 'Gifticon',
    href: '/gifticon/',
    desc: '기프티콘 관리 + 공유 그룹.',
    status: 'wip',
  },
  {
    name: 'Agent Viewer',
    href: '/agent-viewer/',
    desc: 'AI 에이전트 활동 / 산출물 viewer.',
    status: 'wip',
  },
];

const STATUS_LABEL: Record<Service['status'], { label: string; cls: string }> = {
  live: { label: 'LIVE', cls: 'bg-green-100 text-green-700' },
  beta: { label: 'BETA', cls: 'bg-blue-100 text-blue-700' },
  wip: { label: 'WIP', cls: 'bg-gray-100 text-gray-600' },
};

export default function ServiceCatalogPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 text-gray-900">서비스 카탈로그</h1>
        <p className="text-gray-600">
          이 MSA 플랫폼이 제공하는 사용자/관리자 사이드 진입점.
        </p>
      </header>

      <section className="grid md:grid-cols-2 gap-4">
        {SERVICES.map((svc) => (
          <a
            key={svc.name}
            href={svc.href}
            className="block p-5 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900">{svc.name}</h2>
              <span
                className={`text-xs px-2 py-0.5 rounded font-mono ${STATUS_LABEL[svc.status].cls}`}
              >
                {STATUS_LABEL[svc.status].label}
              </span>
            </div>
            <p className="text-sm text-gray-600">{svc.desc}</p>
            <p className="text-xs text-gray-400 font-mono mt-2">{svc.href}</p>
          </a>
        ))}
      </section>

      <p className="text-xs text-gray-400 mt-8">
        백엔드 API 는 <code className="font-mono">/api/v1/*</code> 로 gateway 경유.
      </p>
    </main>
  );
}
