import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ScanBarcode } from 'lucide-react';
import { DashboardStats } from '../components/DashboardStats';
import { DataTools } from '../components/DataTools';
import { DateNavigator } from '../components/DateNavigator';
import { PageHeader } from '../components/PageHeader';
import { RecentActivity } from '../components/RecentActivity';
import { useSelectedDate } from '../components/SelectedDateProvider';
import { focusRing, secondaryButton, textInput } from '../components/styles';
import { useToast } from '../components/ToastProvider';
import { renameSelf } from '../services/accountService';
import { useAccess } from '../components/AccessProvider';
import { useAuth } from '../components/AuthGate';
import { useDateTransactions, useTakenItems } from '../services/useLogisticsData';
import { formatLongDate } from '../utils/dateUtils';

export default function Dashboard() {
  const { date, setDate } = useSelectedDate();
  const { configured } = useAuth();
  const access = useAccess();
  const showScan = !configured || (access.featureEnabled('scan') && access.can('scanItem') && access.featureEnabled('transactions') && access.can('recordTransaction'));
  const showHistory = !configured || (access.featureEnabled('history') && (access.can('viewAllHistory') || access.can('recordTransaction')));
  const showTaken = !configured || (access.featureEnabled('taken') && access.can('viewCurrentlyTaken'));
  const showExport = !configured || (access.featureEnabled('excel') && access.can('exportExcel') && access.can('viewAllHistory'));
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
      {access.profile ? <YourName uid={access.profile.uid} name={access.profile.name} /> : null}
      <DateNavigator date={date} onChange={setDate} />
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}
      <DashboardStats stats={stats} loading={loading} />
      {showTaken ? (
        <p className="text-sm text-slate-500">
          Latest status: {taken.data ? taken.data.length : '…'} currently out. This does not change with the selected date.
        </p>
      ) : null}
      {showScan ? (
        <Link
          to="/scan"
          className={`flex h-16 items-center justify-center gap-3 rounded-2xl bg-orange-600 text-lg font-semibold tracking-wide text-white shadow-sm transition hover:bg-orange-700 active:bg-orange-800 ${focusRing}`}
        >
          <ScanBarcode size={24} />
          SCAN BARCODE
        </Link>
      ) : null}
      {showHistory ? <RecentActivity date={date} transactions={data} loading={loading} /> : null}
      {showExport ? <DataTools date={date} /> : null}
    </div>
  );
}

function YourName({ uid, name }: { uid: string; name: string }) {
  const toast = useToast();
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue(name);
  }, [name]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || value.trim() === name) return;
    setBusy(true);
    try {
      await renameSelf(uid, value);
      toast.success('Name saved. New transactions will use it.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your name.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end">
      <label className="block flex-1 text-sm font-medium text-slate-700" htmlFor="display-name">
        Your name on new transactions
        <input id="display-name" value={value} onChange={(event) => setValue(event.target.value)} className={`${textInput} mt-1`} />
      </label>
      <button type="submit" className={secondaryButton} disabled={busy || value.trim() === name}>Save name</button>
    </form>
  );
}
