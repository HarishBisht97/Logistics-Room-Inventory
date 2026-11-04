import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { LoadingState } from './components/EmptyState';
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
