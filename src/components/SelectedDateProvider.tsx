import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { todayKey } from '../utils/dateUtils';

interface SelectedDateValue {
  date: string;
  setDate: (date: string) => void;
}

const SelectedDateContext = createContext<SelectedDateValue | null>(null);

export function SelectedDateProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState(todayKey);
  const value = useMemo(() => ({ date, setDate }), [date]);
  return <SelectedDateContext.Provider value={value}>{children}</SelectedDateContext.Provider>;
}

export function useSelectedDate(): SelectedDateValue {
  const value = useContext(SelectedDateContext);
  if (!value) throw new Error('Selected date is unavailable.');
  return value;
}
