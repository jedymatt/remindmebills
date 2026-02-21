import { AlertTriangle } from "lucide-react";

export function PlaygroundBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <AlertTriangle className="size-4 shrink-0" />
      <p className="text-sm">
        <span className="font-medium">Playground Mode</span> — Changes are
        temporary and won&apos;t be saved.
      </p>
    </div>
  );
}
