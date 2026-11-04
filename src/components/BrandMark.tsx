interface BrandMarkProps {
  compact?: boolean;
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img
        src="/icons/iitb.svg"
        alt="Indian Institute of Technology Bombay"
        className={compact ? 'h-9 w-auto shrink-0' : 'h-14 w-auto shrink-0'}
      />
      <p className={compact ? 'text-sm leading-tight font-semibold text-slate-900' : 'text-sm leading-snug font-semibold text-slate-900'}>
        IIT Bombay Logistics Management System
      </p>
    </div>
  );
}
