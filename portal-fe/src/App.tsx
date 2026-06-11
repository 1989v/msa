import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SearchPage from './pages/SearchPage';
import PortfolioPage from './pages/PortfolioPage';
import ShopPage from './pages/ShopPage';
import ShopProductDetailPage from './pages/ShopProductDetailPage';
import MyOrdersPage from './pages/MyOrdersPage';
import ShopLoginPage from './pages/ShopLoginPage';
import ShopOAuthCallbackPage from './pages/ShopOAuthCallbackPage';

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/shop/products/:id" element={<ShopProductDetailPage />} />
        <Route path="/shop/orders" element={<MyOrdersPage />} />
        <Route path="/shop/login" element={<ShopLoginPage />} />
        <Route path="/oauth/callback" element={<ShopOAuthCallbackPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
