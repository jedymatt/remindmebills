import { Info } from "lucide-react";

export function PlaygroundBanner() {
  return (
    <div className="border-ledger-accent/20 bg-ledger-accent-soft/50 text-ledger-accent-strong flex items-center gap-2 rounded-lg border px-4 py-3">
      <Info className="size-4 shrink-0" />
      <p className="text-sm">
        <span className="font-medium">Playground mode</span>
        {" — changes are temporary and won't be saved."}
      </p>
    </div>
  );
}
