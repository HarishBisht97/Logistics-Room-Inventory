import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { PageHeader } from '../components/PageHeader';
import { useSelectedDate } from '../components/SelectedDateProvider';
import { TransactionForm } from '../components/TransactionForm';
import { useToast } from '../components/ToastProvider';
import type { ScanLocationState, TransactionAction } from '../types';

function readState(value: unknown): ScanLocationState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as ScanLocationState;
  if (typeof state.barcode !== 'string' || !state.barcode.trim()) return null;
  return {
    barcode: state.barcode.trim(),
    name: typeof state.name === 'string' ? state.name : '',
    action: state.action === 'TAKING' || state.action === 'RETURNING' ? state.action : undefined,
    lockBarcode: Boolean(state.lockBarcode),
    returnTo: typeof state.returnTo === 'string' ? state.returnTo : undefined,
  };
}

export default function ScanItem() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { date, setDate } = useSelectedDate();
  const prefill = readState(location.state);
  const [captured, setCaptured] = useState<string | null>(prefill?.barcode ?? null);
  const [locked, setLocked] = useState(Boolean(prefill?.lockBarcode));

  useEffect(() => {
    const next = readState(location.state);
    setCaptured(next?.barcode ?? null);
    setLocked(Boolean(next?.lockBarcode));
  }, [location.key, location.state]);

  const showForm = captured !== null;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader
        title={showForm ? 'Register transaction' : 'Scan barcode'}
        description={
          showForm
            ? 'Confirm who is taking or returning this item.'
            : 'Use the camera, or type the barcode if scanning does not work.'
        }
      />
      {showForm ? (
        <TransactionForm
          key={`${location.key}:${captured}`}
          initialBarcode={captured}
          initialName={prefill?.name ?? ''}
          initialAction={prefill?.action ?? ''}
          initialDate={date}
          barcodeLocked={locked}
          onCancel={() => {
            if (prefill?.returnTo) {
              navigate(prefill.returnTo);
              return;
            }
            setCaptured(null);
            setLocked(false);
          }}
          onSubmitted={(result: { barcode: string; action: TransactionAction; transactionDate: string }) => {
            setDate(result.transactionDate);
            toast.success(
              result.action === 'TAKING'
                ? `${result.barcode} marked as taken.`
                : `${result.barcode} submitted back.`,
            );
            navigate(prefill?.returnTo ?? '/', { replace: true });
          }}
        />
      ) : (
        <BarcodeScanner
          onDetected={(code) => {
            setCaptured(code);
            setLocked(true);
          }}
        />
      )}
    </div>
  );
}
