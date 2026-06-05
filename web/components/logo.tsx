export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect x="2" y="2" width="44" height="44" rx="12" fill="#6366F1" />
      <rect x="12" y="13"   width="14" height="5.5" rx="2.75" fill="#fff"     fillOpacity=".95" />
      <rect x="12" y="21.25" width="24" height="5.5" rx="2.75" fill="#A5B4FC" />
      <rect x="12" y="29.5" width="19" height="5.5" rx="2.75" fill="#5EEAD4" />
    </svg>
  );
}
