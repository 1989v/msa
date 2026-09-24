import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import './ShopHeader.css';
import { buildLoginHref } from '../auth/auth';

/**
 * ShopHeader — 쇼핑 플로우 공용 헤더.
 * 로고(/shop) / 장바구니(로그인 시) / 주문내역 / 판매자(로그인 시) / 로그인·로그아웃 / 포털 홈 복귀.
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
          {isLoggedIn && (
            <Link to="/shop/cart" className="shop-header-link">
              장바구니
            </Link>
          )}
          <Link to="/shop/orders" className="shop-header-link">
            주문내역
          </Link>
          {isLoggedIn && (
            // 상품 화면이 판매자 여부를 가르고, 아니면 입점 신청으로 안내한다
            <Link to="/shop/seller/products" className="shop-header-link">
              판매자
            </Link>
          )}
          {isLoggedIn ? (
            <button type="button" className="shop-header-link" onClick={handleLogout}>
              로그아웃
            </button>
          ) : (
            <a href={buildLoginHref()} className="shop-header-link">
              로그인
            </a>
          )}
          <Link to="/" className="shop-header-link shop-header-home">
            포털 홈
          </Link>
        </nav>
      </div>
    </header>
  );
}
