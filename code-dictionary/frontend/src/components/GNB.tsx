import './GNB.css';

interface GNBProps {
  onSearchFocus?: () => void;
}

export default function GNB({ onSearchFocus }: GNBProps) {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="gnb">
      <div className="gnb-inner">
        <div className="gnb-logo">Code Dictionary</div>
        <ul className="gnb-menu">
          <li>
            <button className="gnb-menu-item" onClick={() => scrollToSection('tech')}>
              테크
            </button>
          </li>
          <li>
            <button className="gnb-menu-item" onClick={() => scrollToSection('services')}>
              서비스 카탈로그
            </button>
          </li>
          <li>
            <button className="gnb-menu-item" onClick={() => scrollToSection('about')}>
              About
            </button>
          </li>
        </ul>
        <button className="gnb-search-btn" onClick={onSearchFocus} aria-label="검색">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
