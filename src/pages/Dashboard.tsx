import { Link } from 'react-router-dom';
import { ScanBarcode } from 'lucide-react';
import { DashboardStats } from '../components/DashboardStats';
import { DataTools } from '../components/DataTools';
import { DateNavigator } from '../components/DateNavigator';
import { PageHeader } from '../components/PageHeader';
import { RecentActivity } from '../components/RecentActivity';
import { useSelectedDate } from '../components/SelectedDateProvider';
import { focusRing } from '../components/styles';
import { useAuth } from '../components/AuthGate';
import { useDateTransactions, useTakenItems } from '../services/useLogisticsData';
import { formatLongDate } from '../utils/dateUtils';

export default function Dashboard() {
  const { date, setDate } = useSelectedDate();
  const { configured } = useAuth();
  const { data, loading, error } = useDateTransactions(date, date);
  const taken = useTakenItems();
  const stats = data
    ? {
        transactions: data.length,
        taking: data.filter((transaction) => transaction.action === 'TAKING').length,
        returning: data.filter((transaction) => transaction.action === 'RETURNING').length,
      }
    : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description={
          configured
            ? `Records for ${formatLongDate(date)} from Firestore.`
            : `Records for ${formatLongDate(date)} saved on this device.`
        }
      />
      <DateNavigator date={date} onChange={setDate} />
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}
      <DashboardStats stats={stats} loading={loading} />
      <p className="text-sm text-slate-500">
        Latest status: {taken.data ? taken.data.length : '…'} currently out. This does not change with the selected date.
      </p>
      <Link
        to="/scan"
        className={`flex h-16 items-center justify-center gap-3 rounded-2xl bg-orange-600 text-lg font-semibold tracking-wide text-white shadow-sm transition hover:bg-orange-700 active:bg-orange-800 ${focusRing}`}
      >
        <ScanBarcode size={24} />
        SCAN BARCODE
      </Link>
      <RecentActivity date={date} transactions={data} loading={loading} />
      <DataTools date={date} />
    </div>
  );
}
