import type { ReactNode } from "react";

/**
 * The court is the labelled image. Its card is a sibling, because everything
 * inside `role="img"` is hidden from assistive technology.
 */
export function CourtArt({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rally-court-art">
      <div role="img" aria-label={label} className="rally-court">
        <span className="rally-court__kitchen rally-court__kitchen--far" />
        <span className="rally-court__net" />
        <span className="rally-court__kitchen rally-court__kitchen--near" />
        <span className="rally-court__center rally-court__center--far" />
        <span className="rally-court__center rally-court__center--near" />
        <span className="rally-court__ball" />
      </div>
      {children}
    </div>
  );
}
