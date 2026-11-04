import { useMemo, useState } from 'react';
import { LoadingState } from '../../components/EmptyState';
import { textInput } from '../../components/styles';
import { useAuditLog, useDirectory } from '../../services/useDirectory';
import { formatDateTime, isDateKey, toDateKey } from '../../utils/dateUtils';

export default function ActivityAdmin() {
  const audit = useAuditLog();
  const directory = useDirectory();
  const [userId, setUserId] = useState('ALL');
  const [action, setAction] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const actions = useMemo(() => [...new Set((audit.entries ?? []).map((entry) => entry.action))].sort(), [audit.entries]);
  const filtered = useMemo(() => {
    return (audit.entries ?? []).filter((entry) => {
      if (userId !== 'ALL' && entry.userId !== userId) return false;
      if (action !== 'ALL' && entry.action !== action) return false;
      if (!entry.timestamp) return !from && !to;
      const day = toDateKey(entry.timestamp);
      if (from && isDateKey(from) && day < from) return false;
      if (to && isDateKey(to) && day > to) return false;
      return true;
    });
  }, [audit.entries, userId, action, from, to]);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-500">
        Each row is written by the signed-in account named on it. Firestore rejects edits and deletes. A modified browser can skip a log or write a misleading description, but it cannot store the event under someone else’s user id.
      </p>
      <div className="grid gap-2 md:grid-cols-4">
        <select value={userId} onChange={(event) => setUserId(event.target.value)} className={textInput} aria-label="Filter by user">
          <option value="ALL">All users</option>
          {(directory.users ?? []).map((user) => <option key={user.uid} value={user.uid}>{user.name}</option>)}
        </select>
        <select value={action} onChange={(event) => setAction(event.target.value)} className={textInput} aria-label="Filter by action">
          <option value="ALL">All actions</option>
          {actions.map((item) => <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>)}
        </select>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={textInput} aria-label="From date" />
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={textInput} aria-label="To date" />
      </div>
      {audit.loading ? <LoadingState label="Loading activity" /> : null}
      {audit.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{audit.error}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-3 py-3 font-medium">When</th>
              <th className="px-3 py-3 font-medium">Who</th>
              <th className="px-3 py-3 font-medium">Action</th>
              <th className="px-3 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-3 whitespace-nowrap text-slate-600">{entry.timestamp ? formatDateTime(entry.timestamp) : '—'}</td>
                <td className="px-3 py-3">
                  <p className="font-medium text-slate-900">{entry.userName || 'Unknown'}</p>
                  <p className="text-xs text-slate-500">{entry.userEmail}</p>
                </td>
                <td className="px-3 py-3 text-slate-700">{entry.action.replace(/_/g, ' ')}</td>
                <td className="px-3 py-3 text-slate-700">
                  {entry.description}
                  {entry.targetId ? <p className="mt-1 text-xs text-slate-500">Record: {entry.targetId}</p> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && audit.entries ? <p className="px-3 py-6 text-sm text-slate-500">No activity matches those filters. The log shows the latest 300 events.</p> : null}
      </div>
    </div>
  );
}
