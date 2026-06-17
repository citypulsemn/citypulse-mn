export function Logo() {
  return (
    <a className="brand" href="/">
      <svg
        width="44"
        height="40"
        viewBox="0 0 80 70"
        fill="none"
        stroke="var(--gold)"
        strokeWidth="2.4"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 56 V42 H14 V52 H20 V30 H26 V20 L30 16 L34 20 V30 H40 V8 H44 V6 H48 V8 V34 H54 V26 H60 V18 H64 V14 H68 V18 V40 H74 V56" />
      </svg>
      <span className="word">
        <span className="cp">CITY PULSE</span>
        <span className="mn">M N</span>
      </span>
    </a>
  );
}
