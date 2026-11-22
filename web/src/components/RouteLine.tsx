import { motion, useReducedMotion } from "framer-motion";

export function RouteLine({ className = "" }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const route = "M-30 420C80 365 105 195 235 240S405 410 520 265 670 110 810 205";
  return (
    <svg viewBox="0 0 760 560" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label="Stylised route between pickup and drop-off">
      <g stroke="#211d1b" strokeOpacity=".08">{Array.from({ length: 10 }, (_, index) => <path key={`v${index}`} d={`M${index * 85} 0v560`} />)}{Array.from({ length: 8 }, (_, index) => <path key={`h${index}`} d={`M0 ${index * 80}h760`} />)}</g>
      <path d="M-20 105c120 60 210-80 330 5s250 40 470-55M90-20c50 130-35 250 80 360s70 175 125 240M520-30c-70 120 35 210-10 310s60 190 150 280" fill="none" stroke="#fff8ec" strokeWidth="24" strokeLinecap="round" opacity=".85" />
      <path d={route} fill="none" stroke="#fff8ec" strokeWidth="22" strokeLinecap="round" />
      <motion.path d={route} fill="none" stroke="var(--color-signature)" strokeWidth="9" strokeLinecap="round" initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: .9, ease: "easeOut" }} />
      <g transform="translate(235 240)"><circle r="19" fill="var(--color-paper)" /><circle r="10" fill="var(--color-deep)" /></g>
      <g transform="translate(670 110)"><circle r="19" fill="var(--color-paper)" /><circle r="10" fill="var(--color-warm)" /></g>
    </svg>
  );
}
