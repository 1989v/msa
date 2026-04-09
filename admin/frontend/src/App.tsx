import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { UnauthorizedPage } from '@/pages/UnauthorizedPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SystemPage } from '@/pages/SystemPage';

export default function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/admin" element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="system" element={<SystemPage />} />
      </Route>
    </Routes>
  );
}
