import { BookOpen, Construction, Layers, Truck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  OPERATIONS,
  type OperationId,
  type OperationInfo,
} from "@/lib/simkon/operations";
import { cn } from "@/lib/utils";

const ICONS: Record<OperationId, typeof Truck> = {
  earthmoving: Truck,
  bricklaying: Layers,
  concreting: Construction,
};

type Props = {
  selected: OperationId;
  onSelect: (id: OperationId) => void;
  /** Optional: close mobile drawer when navigating */
  onNavigate?: () => void;
  className?: string;
};

export function OperationSidebar({
  selected,
  onSelect,
  onNavigate,
  className,
}: Props) {
  return (
    <nav
      className={cn("flex h-full min-h-0 flex-col", className)}
      aria-label="Navigasi operasi"
    >
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Operasi
        </p>
        <ul className="space-y-1">
          {OPERATIONS.map((op) => (
            <li key={op.id}>
              <OperationItem
                op={op}
                active={selected === op.id}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 shrink-0 border-t border-border pt-4">
        <Link
          to="/manual"
          onClick={() => onNavigate?.()}
          className={cn(
            "flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-transparent px-3 py-3 text-left",
            "text-foreground transition-[background-color,border-color] duration-[var(--motion-quick)]",
            "hover:border-border hover:bg-muted",
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-muted text-muted-foreground">
            <BookOpen className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium leading-snug">Manual</span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
              Panduan umum SiklOps
            </span>
          </span>
        </Link>
      </div>
    </nav>
  );
}

function OperationItem({
  op,
  active,
  onSelect,
}: {
  op: OperationInfo;
  active: boolean;
  onSelect: (id: OperationId) => void;
}) {
  const Icon = ICONS[op.id] ?? Truck;
  const disabled = !op.available;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (!disabled) onSelect(op.id);
      }}
      className={cn(
        "flex w-full items-start gap-3 rounded-[var(--radius-md)] border px-3 py-3 text-left transition-[background-color,border-color,opacity] duration-[var(--motion-quick)]",
        active && op.available
          ? "border-primary/30 bg-primary text-primary-foreground shadow-sm"
          : "border-transparent bg-transparent",
        !active && op.available && "hover:bg-muted text-foreground",
        disabled && "cursor-not-allowed opacity-55",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)]",
          active && op.available
            ? "bg-primary-foreground/15 text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium leading-snug">{op.shortTitle}</span>
        </span>
        <span
          className={cn(
            "mt-0.5 block text-xs leading-snug",
            active && op.available
              ? "text-primary-foreground/75"
              : "text-muted-foreground",
          )}
        >
          {op.available
            ? `${op.loaderLabel} + ${op.haulerLabel}`
            : "Segera hadir"}
        </span>
      </span>
    </button>
  );
}
