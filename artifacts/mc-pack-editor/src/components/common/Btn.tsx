import React from "react";

export interface BtnProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "ghost" | "danger" | "primary";
  className?: string;
  disabled?: boolean;
  title?: string;
}

export function Btn({
  children,
  onClick,
  variant = "default",
  className = "",
  disabled = false,
  title,
}: BtnProps) {
  const base =
    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer select-none";
  const variants = {
    default: "bg-slate-100 dark:bg-dark-tertiary text-slate-700 dark:text-dark-text-secondary hover:bg-slate-200 dark:hover:bg-dark-border border border-slate-200 dark:border-dark-border",
    ghost: "text-slate-600 dark:text-dark-text-secondary hover:text-slate-900 dark:hover:text-dark-text hover:bg-slate-100 dark:hover:bg-dark-tertiary",
    danger: "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-900",
    primary: "bg-black dark:bg-dark-text text-white dark:text-dark-bg hover:bg-gray-800 dark:hover:bg-dark-tertiary",
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

export default Btn;
