const GRADIENT_COLORS = [
  'linear-gradient(135deg, #8b5cf6, #6d28d9)',
  'linear-gradient(135deg, #06b6d4, #0891b2)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #ef4444, #dc2626)',
  'linear-gradient(135deg, #ec4899, #db2777)',
  'linear-gradient(135deg, #3b82f6, #2563eb)',
  'linear-gradient(135deg, #14b8a6, #0d9488)',
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash) + (i * 11);
  }
  hash ^= name.length * 17;
  return Math.abs(hash);
}

interface MemberAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function MemberAvatar({
  name,
  size = 'md',
  className = '',
}: MemberAvatarProps) {
  const colorIndex = hashName(name) % GRADIENT_COLORS.length;
  
  let initial = name ? name.charAt(0) : '';
  const leadingVowels = ['เ', 'แ', 'โ', 'ใ', 'ไ'];
  if (leadingVowels.includes(initial) && name.length > 1) {
    initial = name.charAt(1);
  }

  return (
    <div
      className={`avatar avatar-${size} ${className}`.trim()}
      style={{ background: GRADIENT_COLORS[colorIndex] }}
    >
      {initial}
    </div>
  );
}
