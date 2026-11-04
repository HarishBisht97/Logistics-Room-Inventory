import { Search } from 'lucide-react';
import { textInput } from './styles';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function SearchField({ value, onChange, placeholder }: SearchFieldProps) {
  return (
    <label className="relative block">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={18} />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${textInput} pl-10`}
      />
    </label>
  );
}
