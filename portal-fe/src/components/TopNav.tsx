import { Link, NavLink } from 'react-router-dom';

/**
 * TopNav — portal-fe 의 글로벌 상단 네비게이션.
 *
 * 메뉴: 홈 (랜딩) / 코드 딕셔너리 / 어바웃 / 서비스 카탈로그.
 * MSA 의 다른 FE (admin/quant/gifticon/agent-viewer) 진입은 ServiceCatalogPage 에서 카드로 노출.
 */
export default function TopNav() {
  const linkBase = 'px-3 py-2 text-sm font-medium transition-colors';
  const linkActive = 'text-blue-600 border-b-2 border-blue-600';
  const linkInactive = 'text-gray-700 hover:text-gray-900';

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-14">
        <Link to="/" className="text-lg font-bold text-gray-900 mr-8">
          kgd.dev
        </Link>
        <div className="flex items-center gap-1">
          <NavLink to="/" end className={({ isActive }) =>
            `${linkBase} ${isActive ? linkActive : linkInactive}`}>홈</NavLink>
          <NavLink to="/dict" className={({ isActive }) =>
            `${linkBase} ${isActive ? linkActive : linkInactive}`}>코드 딕셔너리</NavLink>
          <NavLink to="/about" className={({ isActive }) =>
            `${linkBase} ${isActive ? linkActive : linkInactive}`}>어바웃</NavLink>
          <NavLink to="/services" className={({ isActive }) =>
            `${linkBase} ${isActive ? linkActive : linkInactive}`}>서비스</NavLink>
        </div>
      </div>
    </nav>
  );
}
