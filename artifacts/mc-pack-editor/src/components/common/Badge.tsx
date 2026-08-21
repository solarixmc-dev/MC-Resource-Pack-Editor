import React from "react";

export interface BadgeProps {
  color: string;
  label: string;
}

export function Badge({ color, label }: BadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-dark-tertiary text-slate-600 dark:text-dark-text-secondary border border-slate-200 dark:border-dark-border"
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

export default Badge;
