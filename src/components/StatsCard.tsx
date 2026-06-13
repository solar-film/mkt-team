interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
  subtitle?: string;
}

export default function StatsCard({
  title,
  value,
  icon,
  color = 'primary',
  subtitle,
}: StatsCardProps) {
  return (
    <div className={`stats-card stats-card--${color}`}>
      <div className="stats-card-icon">{icon}</div>
      <div className="stats-card-info">
        <h3 className="stats-card-value">{value}</h3>
        <p className="stats-card-title">{title}</p>
        {subtitle && <small>{subtitle}</small>}
      </div>
    </div>
  );
}
