import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import './ShopHeader.css';

/**
 * ShopHeader — 쇼핑 플로우 공용 헤더.
 * 로고(/shop) / 주문내역 / 로그인·로그아웃 / 포털 홈 복귀.
 */
export default function ShopHeader() {
  const { isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/shop');
  };

  return (
    <header className="shop-header">
      <div className="shop-header-inner">
        <Link to="/shop" className="shop-header-logo">
          쇼핑
        </Link>
        <nav className="shop-header-nav">
          <Link to="/shop/orders" className="shop-header-link">
            주문내역
          </Link>
          {isLoggedIn ? (
            <button type="button" className="shop-header-link" onClick={handleLogout}>
              로그아웃
            </button>
          ) : (
            <Link to="/shop/login" className="shop-header-link">
              로그인
            </Link>
          )}
          <Link to="/" className="shop-header-link shop-header-home">
            포털 홈
          </Link>
        </nav>
      </div>
    </header>
  );
}
