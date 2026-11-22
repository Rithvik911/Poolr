export function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(paise / 100);
}

export function rupeesToPaise(value: string): number | null {
  const normalised = value.trim().replace(/,/g, "");
  if (!/^\d{1,7}(?:\.\d{0,2})?$/.test(normalised)) return null;
  const [rupees, fraction = ""] = normalised.split(".");
  const paise = `${fraction}00`.slice(0, 2);
  const result = Number(rupees) * 100 + Number(paise);
  return Number.isSafeInteger(result) ? result : null;
}

export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(metres / 1000)} km`;
}

export function formatLocalTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function toDatetimeLocal(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
