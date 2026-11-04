import { useEffect, type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, action, className = '' }: PageHeaderProps) {
  useEffect(() => {
    document.title = `${title} · IPT Logbook`;
  }, [title]);

  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
