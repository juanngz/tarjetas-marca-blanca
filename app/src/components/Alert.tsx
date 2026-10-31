// An alert with an icon and words: never color alone (Interfaz guide).
// An error is read out at once; a notice (información) waits for the screen reader to finish.
import type { ReactNode } from "react";

export function Alert({
  id,
  tone = "error",
  children,
}: {
  id?: string;
  tone?: "error" | "info";
  children: ReactNode;
}) {
  return (
    <div id={id} className={`alert alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9.5" />
        <path d={tone === "error" ? "M12 7v6M12 16.5v.01" : "M12 11v6M12 7.5v.01"} />
      </svg>
      <p>{children}</p>
    </div>
  );
}
