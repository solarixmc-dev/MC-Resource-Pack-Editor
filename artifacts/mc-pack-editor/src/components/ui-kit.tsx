import { forwardRef, useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { X, type LucideIcon } from "lucide-react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ── Button ──────────────────────────────────────────────────────────────── */

type ButtonVariant = "default" | "primary" | "ghost" | "danger" | "subtle" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/95",
  default:
    "bg-secondary text-secondary-foreground border border-border hover:bg-accent hover:border-accent-border",
  outline:
    "bg-transparent text-foreground border border-border hover:bg-accent",
  subtle:
    "bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground",
  ghost: "bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
  danger:
    "bg-destructive/10 text-destructive border border-destructive/25 hover:bg-destructive/20",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-xs",
  md: "h-8 gap-2 px-3 text-sm",
  lg: "h-10 gap-2 px-4 text-sm",
  icon: "h-8 w-8",
  "icon-sm": "h-7 w-7",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size = "md", icon: Icon, loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex flex-shrink-0 select-none items-center justify-center rounded-md font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-45",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {Icon && (
        <Icon
          className={cn(size === "sm" || size === "icon-sm" ? "h-3.5 w-3.5" : "h-4 w-4", loading && "animate-spin")}
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
});

/* ── Icon button ─────────────────────────────────────────────────────────── */

export function IconButton({
  icon: Icon,
  label,
  size = "icon",
  variant = "ghost",
  className,
  ...props
}: Omit<ButtonProps, "icon" | "children"> & { icon: LucideIcon; label: string }) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn("rounded-md", className)}
      title={label}
      aria-label={label}
      {...props}
    >
      <Icon className={size === "icon-sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
    </Button>
  );
}

/* ── Pack badge ──────────────────────────────────────────────────────────── */

export function PackBadge({
  color,
  label,
  onClick,
  active,
  muted,
  className,
  title,
}: {
  color: string;
  label: string;
  onClick?: () => void;
  active?: boolean;
  muted?: boolean;
  className?: string;
  title?: string;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      title={title ?? label}
      className={cn(
        "inline-flex max-w-[11rem] items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium transition-all",
        muted && "opacity-40 grayscale",
        onClick && "hover:brightness-125",
        className,
      )}
      style={{
        background: `${color}1f`,
        color,
        borderColor: active ? color : `${color}44`,
        boxShadow: active ? `0 0 0 1px ${color}55` : undefined,
      }}
    >
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{label}</span>
    </Tag>
  );
}

/* ── Status pill ─────────────────────────────────────────────────────────── */

export function StatPill({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  onClick,
  title,
}: {
  icon?: LucideIcon;
  label: string;
  value?: ReactNode;
  tone?: "neutral" | "primary" | "warning" | "danger";
  onClick?: () => void;
  title?: string;
}) {
  const tones = {
    neutral: "text-muted-foreground",
    primary: "text-primary",
    warning: "text-warning",
    danger: "text-destructive",
  };
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
        tones[tone],
        onClick && "hover:bg-accent hover:text-foreground",
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{label}</span>
      {value !== undefined && <span className="tabular font-semibold text-foreground">{value}</span>}
    </Tag>
  );
}

/* ── Keyboard hint ───────────────────────────────────────────────────────── */

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

/* ── Segmented control ───────────────────────────────────────────────────── */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; icon?: LucideIcon; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/60 p-0.5", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            title={opt.title ?? opt.label}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Switch ──────────────────────────────────────────────────────────────── */

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-secondary border border-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-card shadow-sm transition-transform",
            checked ? "translate-x-[1.125rem]" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}

/* ── Field ───────────────────────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs font-medium text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export const inputClass =
  "h-8 w-full rounded-md border border-border bg-input/60 px-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-ring focus:bg-input focus:outline-none";

/* ── Section header ──────────────────────────────────────────────────────── */

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-16 text-center", className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted/60">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground text-balance">{title}</p>
        {description && (
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground text-pretty">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ── Modal shell ─────────────────────────────────────────────────────────── */

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "md",
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  bodyClassName?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const widths = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
  };

  return (
    <div
      className="animate-overlay fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn(
          "animate-pop flex max-h-[88vh] w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl",
          widths[size],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} size="icon-sm" />
        </header>
        <div className={cn("min-h-0 flex-1 overflow-y-auto p-4", bodyClassName)}>{children}</div>
        {footer && (
          <footer className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-border bg-muted/30 px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
