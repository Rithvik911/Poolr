import { X } from "lucide-react";

export function Toast({ message, tone = "info", onClose }: { message: string; tone?: "info" | "success" | "error"; onClose: () => void }) {
  const toneClass = tone === "success" ? "bg-success text-white" : tone === "error" ? "bg-error text-white" : "bg-ink text-paper";
  return (
    <div role="status" className={`fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center justify-between gap-4 rounded-2xl px-4 py-3 shadow-xl md:bottom-6 ${toneClass}`}>
      <span className="min-w-0 break-words text-sm font-semibold">{message}</span>
      <button type="button" onClick={onClose} className="shrink-0 rounded-full p-1 hover:bg-white/15" aria-label="Dismiss"><X className="size-4" /></button>
    </div>
  );
}
