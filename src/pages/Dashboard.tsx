import { Link } from 'react-router-dom';
import { ScanBarcode } from 'lucide-react';
import { DashboardStats } from '../components/DashboardStats';
import { DataTools } from '../components/DataTools';
import { PageHeader } from '../components/PageHeader';
import { RecentActivity } from '../components/RecentActivity';
import { focusRing } from '../components/styles';

export default function Dashboard() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description="Items leaving and returning to the logistics room, saved on this device."
      />
      <DashboardStats />
      <Link
        to="/scan"
        className={`flex h-16 items-center justify-center gap-3 rounded-2xl bg-orange-600 text-lg font-semibold tracking-wide text-white shadow-sm transition hover:bg-orange-700 active:bg-orange-800 ${focusRing}`}
      >
        <ScanBarcode size={24} />
        SCAN BARCODE
      </Link>
      <RecentActivity />
      <DataTools />
    </div>
  );
}
