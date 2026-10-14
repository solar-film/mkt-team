'use client';

interface ActionItemMultiSelectProps {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  exclusiveValue?: string;
}

export default function ActionItemMultiSelect({
  label,
  options,
  value,
  onChange,
  exclusiveValue,
}: ActionItemMultiSelectProps) {
  const toggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(selected => selected !== optionValue));
    } else if (optionValue === exclusiveValue) {
      onChange([optionValue]);
    } else {
      onChange([...value.filter(selected => selected !== exclusiveValue), optionValue]);
    }
  };

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>
        {label} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>(เลือกได้หลายรายการ)</span>
      </legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {options.map(option => (
          <label key={option.value} style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer',
            padding: '0.35rem 0.6rem', borderRadius: 'var(--radius-md)',
            border: `1px solid ${value.includes(option.value) ? 'var(--color-primary)' : 'var(--color-border)'}`,
            backgroundColor: value.includes(option.value) ? 'var(--color-surface-hover)' : 'var(--color-surface)',
            fontSize: '0.8rem',
          }}>
            <input
              type="checkbox"
              checked={value.includes(option.value)}
              onChange={() => toggle(option.value)}
              style={{ accentColor: 'var(--color-primary)', margin: 0 }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
