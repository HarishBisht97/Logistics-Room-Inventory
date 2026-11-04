import { useRef, useState, type FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import { addTransaction } from '../services/transactionService';
import { useItemLookup } from '../services/useLogisticsData';
import { createDocumentId } from '../services/firestoreRecords';
import type { ItemRecord, TransactionAction } from '../types';
import { formatDate, formatDateKey, formatTime, isDateKey, todayKey } from '../utils/dateUtils';
import { hasErrors, validateTransaction, type FieldErrors } from '../utils/validation';
import { DateNavigator } from './DateNavigator';
import { greenButton, orangeButton, secondaryButton, textInput, textInputError } from './styles';

interface TransactionFormProps {
  initialBarcode: string;
  initialName?: string;
  initialAction?: TransactionAction | '';
  initialDate: string;
  barcodeLocked?: boolean;
  onCancel: () => void;
  onSubmitted: (result: { barcode: string; action: TransactionAction; transactionDate: string }) => void;
}

type Lookup =
  | { state: 'idle'; item: null }
  | { state: 'done'; item: ItemRecord | null; message?: string }
  | { state: 'error'; item: null; message?: string };

export function TransactionForm({
  initialBarcode,
  initialName = '',
  initialAction = '',
  initialDate,
  barcodeLocked = false,
  onCancel,
  onSubmitted,
}: TransactionFormProps) {
  const [barcode, setBarcode] = useState(initialBarcode);
  const [locked, setLocked] = useState(barcodeLocked);
  const [name, setName] = useState(initialName);
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<TransactionAction | ''>(initialAction);
  const [transactionDate, setTransactionDate] = useState(isDateKey(initialDate) ? initialDate : todayKey());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const attempt = useRef<{ key: string; fingerprint: string } | null>(null);
  const lookup = useItemLookup(barcode) as Lookup;

  function clearFieldError(field: keyof FieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;

    const nextErrors = validateTransaction({ barcode, name, reason, action, transactionDate });
    setErrors(nextErrors);
    setFormError('');
    if (hasErrors(nextErrors) || (action !== 'TAKING' && action !== 'RETURNING')) return;

    const fingerprint = `${barcode.trim()}|${name.trim()}|${reason.trim()}|${action}|${transactionDate}`;
    if (!attempt.current || attempt.current.fingerprint !== fingerprint) {
      attempt.current = { key: createDocumentId(), fingerprint };
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      await addTransaction({
        barcode,
        name,
        reason,
        action,
        transactionDate,
        idempotencyKey: attempt.current.key,
      });
      onSubmitted({ barcode: barcode.trim(), action, transactionDate });
    } catch (error) {
      inFlight.current = false;
      setSubmitting(false);
      setFormError(error instanceof Error ? error.message : 'Could not save the transaction.');
    }
  }

  const submitClass = action === 'RETURNING' ? greenButton : orangeButton;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-slate-700" htmlFor="barcode">
            Barcode / Item ID <span className="text-red-600">*</span>
          </label>
          {locked ? (
            <button
              type="button"
              onClick={() => setLocked(false)}
              className="text-sm font-semibold text-slate-700 underline-offset-2 hover:underline"
            >
              Edit
            </button>
          ) : null}
        </div>
        <input
          id="barcode"
          value={barcode}
          readOnly={locked}
          onChange={(event) => {
            setBarcode(event.target.value);
            clearFieldError('barcode');
          }}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={128}
          aria-invalid={errors.barcode ? true : undefined}
          aria-describedby={errors.barcode ? 'barcode-error' : undefined}
          className={`${textInput} font-mono text-lg ${locked ? 'bg-slate-50' : ''} ${errors.barcode ? textInputError : ''}`}
        />
        {errors.barcode ? <p id="barcode-error" className="mt-1.5 text-sm text-red-600">{errors.barcode}</p> : null}
        <ItemStatus lookup={lookup} action={action} prefilledName={initialName} />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="person-name">
          Name <span className="text-red-600">*</span>
        </label>
        <input
          id="person-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            clearFieldError('name');
          }}
          autoComplete="name"
          autoCapitalize="words"
          maxLength={80}
          placeholder="Person taking or returning the item"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'name-error' : undefined}
          className={`${textInput} ${errors.name ? textInputError : ''}`}
        />
        {errors.name ? <p id="name-error" className="mt-1.5 text-sm text-red-600">{errors.name}</p> : null}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="reason">
          Reason <span className="text-red-600">*</span>
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            clearFieldError('reason');
          }}
          rows={3}
          maxLength={300}
          placeholder={action === 'RETURNING' ? 'Why is this item coming back?' : 'Why is this item leaving the room?'}
          aria-invalid={errors.reason ? true : undefined}
          aria-describedby={errors.reason ? 'reason-error' : undefined}
          className={`${textInput} resize-none ${errors.reason ? textInputError : ''}`}
        />
        {errors.reason ? <p id="reason-error" className="mt-1.5 text-sm text-red-600">{errors.reason}</p> : null}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="action">
          Action <span className="text-red-600">*</span>
        </label>
        <select
          id="action"
          value={action}
          onChange={(event) => {
            setAction(event.target.value as TransactionAction | '');
            clearFieldError('action');
          }}
          aria-invalid={errors.action ? true : undefined}
          aria-describedby={errors.action ? 'action-error' : undefined}
          className={`${textInput} ${errors.action ? textInputError : ''}`}
        >
          <option value="">Select action</option>
          <option value="TAKING">Taking</option>
          <option value="RETURNING">Submitting Back</option>
        </select>
        {errors.action ? <p id="action-error" className="mt-1.5 text-sm text-red-600">{errors.action}</p> : null}
      </div>

      <div>
        <DateNavigator
          embedded
          required
          label="Transaction date"
          date={transactionDate}
          onChange={(next) => {
            setTransactionDate(next);
            clearFieldError('transactionDate');
          }}
        />
        {errors.transactionDate ? <p className="mt-1.5 text-sm text-red-600">{errors.transactionDate}</p> : null}
        {transactionDate !== todayKey() ? (
          <p className="mt-2 text-sm leading-6 text-slate-500">
            This record is saved on {formatDateKey(transactionDate)}. Current item status still follows the latest actual state, not this calendar date.
          </p>
        ) : null}
      </div>

      {formError ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{formError}</p>
      ) : null}

      <div className="flex scroll-mb-28 flex-col gap-2 pt-1">
        <button type="submit" className={`${submitClass} w-full`} disabled={submitting}>
          {submitting ? <LoaderCircle className="animate-spin" size={18} /> : null}
          {submitting ? 'Saving…' : 'Save transaction'}
        </button>
        <button type="button" onClick={onCancel} className={`${secondaryButton} w-full`} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ItemStatus({
  lookup,
  action,
  prefilledName,
}: {
  lookup: Lookup;
  action: TransactionAction | '';
  prefilledName: string;
}) {
  if (lookup.state === 'error') {
    return <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{lookup.message}</p>;
  }
  if (lookup.state !== 'done') return null;
  const item = lookup.item;

  if (!item) {
    return (
      <p className={`mt-2 rounded-xl px-3 py-2 text-sm ${action === 'RETURNING' ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600'}`}>
        {action === 'RETURNING'
          ? 'This barcode has not been taken, so it cannot be submitted back.'
          : 'New barcode. Taking it will start tracking this item.'}
      </p>
    );
  }

  if (item.status === 'TAKEN') {
    const when = item.lastTransactionDate
      ? `${formatDateKey(item.lastTransactionDate)}${item.takenAt ? `, ${formatTime(item.takenAt)}` : ''}`
      : item.takenAt
        ? `${formatDate(item.takenAt)}, ${formatTime(item.takenAt)}`
        : 'an earlier time';
    const conflict = action === 'TAKING';
    return (
      <div className={`mt-2 rounded-xl px-3 py-2 text-sm ${conflict ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-800'}`}>
        <p>
          {conflict
            ? `This item is already taken by ${item.currentHolder}. Submit it back before taking it again.`
            : `Currently taken by ${item.currentHolder} since ${when}.`}
        </p>
        {action === 'RETURNING' && prefilledName ? (
          <p className="mt-1">The name is filled from that person. Change it if someone else is returning the item.</p>
        ) : null}
      </div>
    );
  }

  return (
    <p className={`mt-2 rounded-xl px-3 py-2 text-sm ${action === 'RETURNING' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
      {action === 'RETURNING'
        ? 'This item is already in the logistics room, so it cannot be submitted back.'
        : 'This item is in the logistics room.'}
    </p>
  );
}
