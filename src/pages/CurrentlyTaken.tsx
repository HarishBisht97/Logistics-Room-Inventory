import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PackageCheck, ScanBarcode } from 'lucide-react';
import { EmptyState, LoadingState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { SearchField } from '../components/SearchField';
import { TakenItemCard } from '../components/TakenItemCard';
import { focusRing, secondaryButton } from '../components/styles';
import { useTakenItems } from '../services/useLogisticsData';
import type { ItemRecord } from '../types';

export default function CurrentlyTaken() {
  const navigate = useNavigate();
  const { data, loading, error } = useTakenItems();
  const items = data;
  const [query, setQuery] = useState('');
  const [newestFirst, setNewestFirst] = useState(true);

  const filtered = useMemo(() => {
    const list = [...(items ?? [])].sort((left, right) => {
      const order = (right.takenAt ?? '').localeCompare(left.takenAt ?? '');
      return newestFirst ? order : -order;
    });
    const needle = query.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((item) =>
      item.barcode.toLowerCase().includes(needle)
      || (item.currentHolder ?? '').toLowerCase().includes(needle),
    );
  }, [items, query, newestFirst]);

  function returnItem(item: ItemRecord) {
    navigate('/scan', {
      state: {
        barcode: item.barcode,
        name: item.currentHolder ?? '',
        action: 'RETURNING',
        lockBarcode: true,
        returnTo: '/taken',
      },
    });
  }

  const total = items?.length ?? 0;
  const description = items === undefined
    ? 'The latest status of every item, independent of the selected date.'
    : total === 0
      ? 'Every tracked item is back in the logistics room.'
      : `Total currently taken: ${total}. This is the latest status, not the selected calendar date.`;

  return (
    <div className="space-y-5">
      <PageHeader title="Currently taken items" description={description} />
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search by barcode or name"
      />
      <button type="button" className={secondaryButton} onClick={() => setNewestFirst((current) => !current)}>
        {newestFirst ? 'Newest first' : 'Oldest first'}
      </button>
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}
      {loading ? <LoadingState label="Loading taken items" /> : null}
      {items && items.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="All items are back"
          description="Nothing is checked out of the logistics room right now."
          action={
            <Link to="/scan" className={`inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white ${focusRing}`}>
              <ScanBarcode size={18} />
              Scan barcode
            </Link>
          }
        />
      ) : null}
      {items && items.length > 0 && filtered.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="No matching items"
          description="Try a different barcode or name."
        />
      ) : null}
      {filtered.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((item) => (
            <TakenItemCard key={item.barcode} item={item} onReturn={returnItem} />
          ))}
        </div>
      ) : null}
      {items && query.trim() && filtered.length > 0 ? (
        <p className="text-sm text-slate-500">
          Showing {filtered.length} of {total}
        </p>
      ) : null}
    </div>
  );
}
