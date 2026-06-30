type BrandMarkSize = "sm" | "md" | "lg";

type BrandMarkProps = {
  size?: BrandMarkSize;
  onDark?: boolean;
  className?: string;
};

const crestSizeMap: Record<BrandMarkSize, string> = {
  sm: "h-9",
  md: "h-10",
  lg: "h-12",
};

/** Heraldic crest: shield + upward chevron, ink (or slate on dark) fill with brass stroke. */
export function BrandMark({ size = "md", onDark = false, className = "" }: BrandMarkProps) {
  const fill = onDark ? "#142943" : "#0A1628";
  return (
    <svg
      viewBox="0 0 38 42"
      fill="none"
      role="img"
      aria-label="LeaderShield Funding crest"
      data-testid="brand-mark"
      className={`${crestSizeMap[size]} w-auto shrink-0 ${className}`}
    >
      <path
        d="M19 1.5 35.5 7v13c0 11-7.4 17.6-16.5 20.8C9.9 37.6 2.5 31 2.5 20V7L19 1.5Z"
        fill={fill}
        stroke="#C9A24B"
        strokeWidth="1.6"
      />
      <path
        d="M19 11v18M11.5 17.5 19 11l7.5 6.5"
        stroke="#C9A24B"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type BrandLockupSize = "sm" | "md" | "lg";

type BrandLockupProps = {
  size?: BrandLockupSize;
  onDark?: boolean;
  showTagline?: boolean;
  className?: string;
};

const wordSizeMap: Record<BrandLockupSize, string> = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
};

const tagSizeMap: Record<BrandLockupSize, string> = {
  sm: "text-[9px]",
  md: "text-[10px]",
  lg: "text-[11px]",
};

/** Full brand lockup: crest + wordmark (Leader heavy/ink, Shield brass, Funding mono caps). */
export function BrandLockup({
  size = "md",
  onDark = false,
  showTagline = true,
  className = "",
}: BrandLockupProps) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <BrandMark size={size} onDark={onDark} />
      <span className="leading-tight">
        <span className={`block font-display tracking-tight ${wordSizeMap[size]}`}>
          <span className={onDark ? "font-black text-white" : "font-black text-[#0A1628]"}>Leader</span>
          <span className="font-semibold text-[#C9A24B]">Shield</span>
          <span className="align-super text-[0.5em] font-semibold text-[#C9A24B]">™</span>
        </span>
        {showTagline && (
          <span
            className={`block font-mono font-medium uppercase tracking-[0.34em] ${tagSizeMap[size]} ${
              onDark ? "text-white/50" : "text-[#5C6B82]"
            }`}
          >
            Funding
          </span>
        )}
      </span>
    </span>
  );
}
