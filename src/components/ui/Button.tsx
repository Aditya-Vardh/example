"use client";

import { motion, useReducedMotion } from "motion/react";

type ButtonVariant = "ghost" | "outline" | "solid" | "quiet";

export function Button({
  children,
  onClick,
  variant = "ghost",
  title,
  disabled = false,
  active = false,
  className = "",
  ariaLabel,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  title?: string;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  ariaLabel?: string;
  type?: "button" | "submit";
}) {
  const reduced = useReducedMotion();

  const tones: Record<ButtonVariant, string> = {
    ghost: "border border-line bg-white/[0.04] text-ink-soft hover:border-line-strong hover:bg-white/[0.09]",
    outline: "border border-line-strong text-ink-soft hover:border-white/45 hover:text-ink",
    solid: "bg-pearl text-obsidian hover:brightness-[1.06]",
    quiet: "text-muted hover:text-ink",
  };

  const activeClass = active ? "border-white/45 bg-white/12 text-ink" : "";

  return (
    <motion.button
      type={type}
      title={title}
      aria-label={ariaLabel ?? (typeof children === "string" ? children : title)}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
      whileHover={reduced || disabled ? undefined : { y: -1 }}
      whileTap={reduced || disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      className={`focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${tones[variant]} ${activeClass} ${className}`}
    >
      {children}
    </motion.button>
  );
}
