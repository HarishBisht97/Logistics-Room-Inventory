import { useState, type FormEvent } from 'react';
import { useAccess } from '../../components/AccessProvider';
import { secondaryButton, textInput } from '../../components/styles';
import { useToast } from '../../components/ToastProvider';
import { renameSelf, saveSettings } from '../../services/accountService';
import { FEATURE_LABELS } from '../../services/accessModel';
import { FEATURE_KEYS, type AppSettings } from '../../types/access';

export default function SettingsAdmin() {
  const access = useAccess();
  const toast = useToast();
  const [settings, setSettings] = useState<AppSettings>(access.settings);
  const [name, setName] = useState(access.profile?.name ?? '');
  const [busy, setBusy] = useState(false);

  if (!access.isSuperAdmin) {
    return <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">Only a super admin can change application settings.</p>;
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!access.profile || busy) return;
    setBusy(true);
    try {
      if (name.trim() && name.trim() !== access.profile.name) await renameSelf(access.profile.uid, name);
      await saveSettings(access.profile, settings);
      toast.success('Settings saved. Other devices will pick them up.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save settings.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSave(event)} className="space-y-4">
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Branding</h2>
        <Field label="Your display name" value={name} onChange={setName} />
        <Field label="Application name" value={settings.applicationName} onChange={(value) => setSettings((current) => ({ ...current, applicationName: value }))} />
        <Field label="Institution" value={settings.institutionName} onChange={(value) => setSettings((current) => ({ ...current, institutionName: value }))} />
        <Field label="Logo URL" value={settings.logoUrl} onChange={(value) => setSettings((current) => ({ ...current, logoUrl: value }))} placeholder="https://… or blank for the IIT Bombay seal" />
        <p className="text-sm leading-6 text-slate-500">Leave the logo blank to keep the official IIT Bombay seal. A custom logo is used at its own proportions and is not recolored.</p>
      </section>
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Who can join</h2>
        <Toggle
          label="Allow new registrations without an invitation"
          checked={settings.registrationEnabled}
          onChange={(registrationEnabled) => setSettings((current) => ({ ...current, registrationEnabled }))}
        />
        <Toggle
          label="Require approval before a new account can use the logbook"
          checked={settings.approvalRequired}
          onChange={(approvalRequired) => setSettings((current) => ({ ...current, approvalRequired }))}
        />
        <p className="text-sm leading-6 text-slate-500">Open registration can only create regular users. Admin access still requires an invitation or a role change by a super admin. Nobody can choose the super admin role.</p>
      </section>
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Features</h2>
        {FEATURE_KEYS.map((key) => (
          <Toggle
            key={key}
            label={FEATURE_LABELS[key]}
            checked={settings.features[key]}
            onChange={(checked) => setSettings((current) => ({ ...current, features: { ...current.features, [key]: checked } }))}
          />
        ))}
        <Toggle
          label="Allow a super admin to correct a transaction without changing who created it"
          checked={settings.transactionEditingEnabled}
          onChange={(transactionEditingEnabled) => setSettings((current) => ({ ...current, transactionEditingEnabled }))}
        />
        <p className="text-sm leading-6 text-slate-500">Transaction history stays append-only in the scan form. The correction switch only opens a protected Firestore update for a super admin; it does not add an edit screen.</p>
      </section>
      <button type="submit" className={secondaryButton} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
    </form>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={`${textInput} mt-1`} />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 text-sm text-slate-800">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
