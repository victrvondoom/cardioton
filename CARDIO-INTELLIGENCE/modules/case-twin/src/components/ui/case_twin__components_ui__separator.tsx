import { cn } from "@/lib/case_twin__src_lib__utils";

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-slate-200", className)} />;
}
