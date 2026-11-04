import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { LoadingState } from './components/EmptyState';
import AdminLayout from './pages/admin/AdminLayout';
import AccessAdmin from './pages/admin/AccessAdmin';
import ActivityAdmin from './pages/admin/ActivityAdmin';
import AdminHome from './pages/admin/AdminHome';
import Approvals from './pages/admin/Approvals';
import SettingsAdmin from './pages/admin/SettingsAdmin';
import UserAdmin from './pages/admin/UserAdmin';
import CurrentlyTaken from './pages/CurrentlyTaken';
import Dashboard from './pages/Dashboard';
import TransactionHistory from './pages/TransactionHistory';

const ScanItem = lazy(() => import('./pages/ScanItem'));

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route
          path="scan"
          element={
            <Suspense fallback={<LoadingState label="Opening scanner" />}>
              <ScanItem />
            </Suspense>
          }
        />
        <Route path="taken" element={<CurrentlyTaken />} />
        <Route path="history" element={<TransactionHistory />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminHome />} />
          <Route path="users" element={<UserAdmin />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="activity" element={<ActivityAdmin />} />
          <Route path="access" element={<AccessAdmin />} />
          <Route path="settings" element={<SettingsAdmin />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
