
type LogoProps = {
  /**
   * "dark" — Navy logo suitable for the cream background.
   * "light" — Cream logo suitable for dark photo backgrounds.
   */
  variant?: 'dark' | 'light';
  className?: string;
};

export default function Logo({ variant = 'dark', className = '' }: LogoProps) {
  const isDark = variant === 'dark';
  
  // Map to the theme's CSS variables (foreground = navy, background = cream)
  const badgeBg = isDark ? 'bg-foreground' : 'bg-background';
  const badgeFg = isDark ? 'text-background' : 'text-foreground';
  const wordmarkColor = isDark ? 'text-foreground' : 'text-background';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Icon Mark: A minimal, geometric origami plane/wayfinding arrow */}
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${badgeBg}`}>
        <svg 
          width="15" 
          height="15" 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className={badgeFg}
        >
          {/* Left Wing (Two-tone effect) */}
          <path 
            d="M3 11.5L21 3L10.5 13.5L3 11.5Z" 
            fill="currentColor" 
            fillOpacity="0.6" 
          />
          {/* Right Wing */}
          <path 
            d="M21 3L13.5 21L10.5 13.5L21 3Z" 
            fill="currentColor" 
          />
        </svg>
      </div>
      
      {/* Wordmark */}
      <span className={`font-bold text-base tracking-tight select-none ${wordmarkColor}`}>
        wayfare
      </span>
    </div>
  );
}
