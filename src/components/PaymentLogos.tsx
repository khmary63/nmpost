// SVG-логотипы платёжных систем для футера
// Используем currentColor где возможно, чтобы попадать в дизайн-систему

export const VisaLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 1000 324" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="Visa">
    <path fill="#1A1F71" d="M433.4 5.5l-65.4 313.6h-78.9L354.5 5.5h78.9zM764.6 207.9l41.6-114.6 23.9 114.6h-65.5zm88.2 111.2H926L862.1 5.5h-67.4c-15.2 0-28 8.8-33.7 22.4L642.5 319.1h82.9l16.5-45.6h101.3l9.6 45.6zM657.5 216.7c.3-80.5-111.3-85-110.6-121 .3-11 10.7-22.6 33.6-25.6 11.4-1.5 42.6-2.6 78 13.4l13.8-64.7C653.3 12.9 628.8 6 598.4 6c-78 0-132.9 41.5-133.4 100.9-.5 43.9 39.2 68.4 69 83 30.7 14.9 41.1 24.5 40.9 37.9-.2 20.5-24.5 29.5-47.2 29.9-39.7.6-62.7-10.7-81-19.3l-14.3 66.9c18.4 8.4 52.4 15.8 87.6 16.2 82.9 0 137.1-41 137.5-104.8M320.6 5.5L192.7 319.1h-83.4L46.4 75.6c-3.8-15-7.1-20.4-18.7-26.7C8.8 38.5-22.4 28.7-50 22.6L-48.1 5.5H85.1c17 0 32.3 11.3 36.2 30.9l33.2 176.4L237.2 5.5h83.4z"/>
  </svg>
);

export const MastercardLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 152 108" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="Mastercard">
    <circle cx="56" cy="54" r="50" fill="#EB001B"/>
    <circle cx="96" cy="54" r="50" fill="#F79E1B"/>
    <path fill="#FF5F00" d="M76 16.6a49.9 49.9 0 010 74.8 49.9 49.9 0 010-74.8z"/>
  </svg>
);

export const MirLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 200 60" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="МИР">
    <rect width="200" height="60" rx="6" fill="#0F754E"/>
    <text x="100" y="40" textAnchor="middle" fill="#fff" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="28" letterSpacing="2">МИР</text>
  </svg>
);

export const TBankLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 200 60" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="Т-Банк">
    <rect width="200" height="60" rx="6" fill="#FFDD2D"/>
    <text x="100" y="40" textAnchor="middle" fill="#000" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="22" letterSpacing="0.5">Т-Банк</text>
  </svg>
);

export const SbpLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 200 60" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="СБП">
    <rect width="200" height="60" rx="6" fill="#fff" stroke="#1F1F1F" strokeWidth="1"/>
    <path d="M30 18l8 12-8 12V18z" fill="#5B57A6"/>
    <path d="M40 18l8 12-8 12V18z" fill="#1F8FE0"/>
    <path d="M50 18l8 12-8 12V18z" fill="#3DA82E"/>
    <path d="M60 18l8 12-8 12V18z" fill="#F7B500"/>
    <path d="M70 18l8 12-8 12V18z" fill="#E53935"/>
    <text x="135" y="38" textAnchor="middle" fill="#1F1F1F" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="20" letterSpacing="1">СБП</text>
  </svg>
);
