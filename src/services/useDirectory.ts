import { useEffect, useState } from 'react';
import type { AuditEntry, Invitation, UserProfile } from '../types/access';
import { watchAuditLog, watchInvitations, watchUsers } from './accountService';

export function useDirectory() {
  const [users, setUsers] = useState<UserProfile[] | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => watchUsers((next) => {
    setUsers(next);
    setError('');
  }, setError), []);

  return { users, error, loading: users === undefined && error === '' };
}

export function useInvitations() {
  const [invitations, setInvitations] = useState<Invitation[] | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => watchInvitations((next) => {
    setInvitations(next);
    setError('');
  }, setError), []);

  return { invitations, error, loading: invitations === undefined && error === '' };
}

export function useAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[] | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => watchAuditLog((next) => {
    setEntries(next);
    setError('');
  }, setError), []);

  return { entries, error, loading: entries === undefined && error === '' };
}
