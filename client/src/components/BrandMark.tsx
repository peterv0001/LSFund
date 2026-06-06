type BrandMarkProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: { box: "h-8 w-8 rounded-md", text: "text-xs" },
  md: { box: "h-10 w-10 rounded-lg", text: "text-sm" },
  lg: { box: "h-12 w-12 rounded-lg", text: "text-base" },
};

export function BrandMark({ size = "md", className = "" }: BrandMarkProps) {
  const s = sizeMap[size];
  return (
    <div
      className={`relative ${s.box} bg-gradient-to-br from-[#0A1628] to-[#15294B] flex items-center justify-center ring-1 ring-[#C9A24B]/50 shadow-sm shrink-0 ${className}`}
      data-testid="brand-mark"
    >
      <span
        className={`font-display font-extrabold tracking-tight ${s.text} text-transparent bg-clip-text bg-gradient-to-br from-[#EBCB6D] to-[#B8862F]`}
      >
        LS
      </span>
    </div>
  );
}
