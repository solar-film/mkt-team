interface ProgressBarProps {
  value: number;
  color?: string;
  label?: string;
  showPercentage?: boolean;
}

export default function ProgressBar({
  value,
  color = 'primary',
  label,
  showPercentage = true,
}: ProgressBarProps) {
  const clampedValue = Math.min(value, 100);

  return (
    <div className="progress-bar-container">
      {label && <span>{label}</span>}
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${clampedValue}%`,
            background: `var(--color-${color})`,
          }}
        />
      </div>
      {showPercentage && (
        <span className="progress-percentage">{Math.round(clampedValue)}%</span>
      )}
    </div>
  );
}
