import { Link } from 'react-router-dom';

/**
 * HomePage — portal-fe 진입 랜딩.
 * 본인 브랜드 + 주요 메뉴 (코드딕셔너리 / 어바웃 / 서비스 카탈로그) 카드.
 */
export default function HomePage() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <section className="mb-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
          kgd.dev — 풀스택 백엔드 엔지니어 포털
        </h1>
        <p className="text-lg text-gray-600">
          코드 딕셔너리 · 포트폴리오 · MSA 서비스 카탈로그
        </p>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <HomeCard
          to="/dict"
          title="코드 딕셔너리"
          desc="IT 개념 사전 + 시각화. OpenSearch 기반 검색."
        />
        <HomeCard
          to="/about"
          title="어바웃"
          desc="저(kgd) 의 경력, 기술 스택, 프로젝트 소개."
        />
        <HomeCard
          to="/services"
          title="서비스 카탈로그"
          desc="이 MSA 플랫폼의 서비스 목록과 진입점."
        />
      </section>
    </main>
  );
}

function HomeCard({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="block p-6 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition"
    >
      <h2 className="text-xl font-semibold mb-2 text-gray-900">{title}</h2>
      <p className="text-sm text-gray-600">{desc}</p>
    </Link>
  );
}
