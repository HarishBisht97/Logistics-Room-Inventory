import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { diffDateKeys, formatLongDate, shiftDateKey, todayKey } from '../utils/dateUtils';
import { focusRing } from './styles';

interface DateNavigatorProps {
  date: string;
  onChange: (date: string) => void;
  onToday?: () => void;
  label?: string;
  embedded?: boolean;
  required?: boolean;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function DateNavigator({
  date,
  onChange,
  onToday,
  label = 'Selected date',
  embedded = false,
  required = false,
}: DateNavigatorProps) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(date.slice(0, 7));

  useEffect(() => {
    setVisibleMonth(date.slice(0, 7));
  }, [date]);

  const [year, month] = visibleMonth.split('-').map(Number);

  function moveMonth(amount: number) {
    const next = new Date(Date.UTC(year, month - 1 + amount, 1));
    setVisibleMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`);
  }

  function selectDay(day: number) {
    const next = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(next);
    setOpen(false);
  }

  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const today = todayKey();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return (
    <section className={embedded ? '' : 'rounded-2xl border border-slate-200 bg-white p-4'}>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <IconButton label="Previous day" onClick={() => onChange(shiftDateKey(date, -1))}>
          <ChevronLeft size={20} />
        </IconButton>
        <button
          type="button"
          className={`min-h-12 flex-1 rounded-xl text-base font-semibold text-slate-900 ${focusRing}`}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {formatLongDate(date)}
        </button>
        <IconButton label="Next day" onClick={() => onChange(shiftDateKey(date, 1))}>
          <ChevronRight size={20} />
        </IconButton>
      </div>
      <div className="mt-2 flex justify-center">
        <button
          type="button"
          className={`min-h-10 rounded-full px-4 text-sm font-semibold text-slate-700 ${focusRing}`}
          onClick={() => {
            if (onToday) onToday();
            else onChange(today);
            setOpen(false);
          }}
        >
          Today
        </button>
      </div>
      {open ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex gap-1">
              <IconButton label="Previous year" onClick={() => moveMonth(-12)}>
                <span className="text-xs font-semibold">«</span>
              </IconButton>
              <IconButton label="Previous month" onClick={() => moveMonth(-1)}>
                <ChevronLeft size={18} />
              </IconButton>
            </div>
            <p className="text-sm font-semibold text-slate-900">{MONTHS[month - 1]} {year}</p>
            <div className="flex gap-1">
              <IconButton label="Next month" onClick={() => moveMonth(1)}>
                <ChevronRight size={18} />
              </IconButton>
              <IconButton label="Next year" onClick={() => moveMonth(12)}>
                <span className="text-xs font-semibold">»</span>
              </IconButton>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400">
            {WEEKDAYS.map((weekday, index) => <span key={`${weekday}-${index}`}>{weekday}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              if (day === null) return <span key={`empty-${index}`} />;
              const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const selected = key === date;
              const isToday = key === today;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`min-h-10 rounded-lg text-sm font-semibold ${focusRing} ${
                    selected
                      ? 'bg-slate-900 text-white'
                      : isToday
                        ? 'text-slate-900 ring-1 ring-slate-900'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  aria-pressed={selected}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function shiftRange(start: string, end: string, nextStart: string): { start: string; end: string } {
  const delta = diffDateKeys(start, nextStart);
  return { start: nextStart, end: shiftDateKey(end, delta) };
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-700 ${focusRing}`}
    >
      {children}
    </button>
  );
}
