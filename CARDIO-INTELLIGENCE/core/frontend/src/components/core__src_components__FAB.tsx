/**
 * Contextual new-case shortcut for the patient workflow.
 */
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function FAB() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/intake")}
      className="group fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 right-6 z-30 inline-flex items-center gap-2 h-11 pl-2.5 pr-3 rounded-xl border border-accent-brand bg-accent-brand text-[#171717] font-medium text-sm shadow-[var(--shadow-raise)] hover:bg-brand-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg transition-colors duration-150"
      title="New case (N)"
      aria-label="Start a new case"
    >
      <span className="w-7 h-7 rounded-lg grid place-items-center bg-black/10">
        <Plus size={16} aria-hidden="true" />
      </span>
      <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 group-hover:max-w-[180px]">
        <span className="pl-1">New case</span>
      </span>
      <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] text-mono-tech bg-black/10 rounded">
        N
      </kbd>
    </button>
  );
}
