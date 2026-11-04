import { useState } from 'react';

interface BrandMarkProps {
  compact?: boolean;
  name?: string;
  institution?: string;
  logoUrl?: string;
}

export function BrandMark({
  compact = false,
  name = 'IPT Logbook',
  institution = 'Indian Institute of Technology Bombay',
  logoUrl = '',
}: BrandMarkProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const configuredLogo = logoUrl.trim();
  const logo = configuredLogo && !logoFailed ? configuredLogo : '/icons/iitb.svg';

  return (
    <div className="flex min-w-0 items-center gap-3">
      <img
        src={logo}
        alt={institution}
        className={compact ? 'h-9 w-auto shrink-0 object-contain' : 'h-14 w-auto shrink-0 object-contain'}
        onError={() => setLogoFailed(true)}
      />
      <p className={compact ? 'text-sm leading-tight font-semibold text-slate-900' : 'text-sm leading-snug font-semibold text-slate-900'}>
        {name}
      </p>
    </div>
  );
}
