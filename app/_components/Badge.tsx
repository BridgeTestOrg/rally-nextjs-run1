import type { ReactNode } from "react";

export type BadgeVariant =
  | "playable"
  | "breezy"
  | "not_today"
  | "open"
  | "closed"
  | "success"
  | "duplicate";

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  playable: "rally-badge--green",
  open: "rally-badge--green",
  success: "rally-badge--green",
  breezy: "rally-badge--amber",
  duplicate: "rally-badge--amber",
  not_today: "rally-badge--grey",
  closed: "rally-badge--grey",
};

export function Badge({
  variant,
  children,
}: {
  variant: BadgeVariant;
  children: ReactNode;
}) {
  return (
    <span className={`rally-badge ${VARIANT_CLASS[variant]}`}>{children}</span>
  );
}
