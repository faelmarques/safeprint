// Marca: uma folha saindo da fenda da máquina.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#1d63eb" />
      <rect x="9" y="6" width="14" height="13" rx="1.5" fill="#fff" />
      <path d="M12 10h8M12 13h8M12 16h5" stroke="#1d63eb" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="6" y="19" width="20" height="5" rx="2.5" fill="#0f3fa8" />
      <rect x="9" y="20.75" width="14" height="1.5" rx=".75" fill="#8ec6ff" />
    </svg>
  );
}

export function Logo({ name = "SafePrint" }: { name?: string }) {
  return (
    <a href="/" className="flex items-center gap-2.5" aria-label={`${name} — início`}>
      <LogoMark />
      <span className="font-semibold tracking-tight text-[17px] leading-none">{name}</span>
    </a>
  );
}
