interface NumberFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  hint?: string;
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  hint,
}: NumberFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center rounded-lg border border-control bg-card focus-within:border-accent">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-11 w-full min-w-0 bg-transparent px-3 text-base outline-none"
        />
        {suffix && (
          <span className="shrink-0 pr-3 text-sm text-muted">{suffix}</span>
        )}
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
