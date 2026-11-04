export const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900';

export const textInput =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 disabled:bg-slate-50';

export const textInputError = 'border-red-400 focus:border-red-600';

export const secondaryButton =
  `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60 ${focusRing}`;

export const orangeButton =
  `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60 ${focusRing}`;

export const greenButton =
  `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60 ${focusRing}`;

export const darkButton =
  `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 ${focusRing}`;
