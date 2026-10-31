// A bar chart that reads at a glance (Resumen, 11/10/2026): a row per bar, its name, the bar and its number
// written at its tip, so nothing has to be tapped to know how much. One color, the café's: what each bar is
// says its name, never its color. It's a list: a screen reader reads each name and its number; only the bar
// itself is hidden from it.
import type { CSSProperties } from "react";

export interface ChartBar {
  label: string;
  value: number;
}

export function BarChart({
  caption,
  bars,
  max,
  long = false,
}: {
  /** What the chart shows, for screen readers. */
  caption: string;
  bars: readonly ChartBar[];
  /** The value of a full bar. Charts that are compared share it; by default, the largest bar. */
  max?: number;
  /** Long names (a card's) go above their bar, not beside it. */
  long?: boolean;
}) {
  const full = Math.max(max ?? 0, ...bars.map((bar) => bar.value), 1);
  return (
    <ul className={`bar-chart${long ? " bar-chart--long" : ""}`} aria-label={caption}>
      {bars.map((bar) => (
        <li key={bar.label} className="bar-chart__row">
          <span className="bar-chart__label">{bar.label}</span>
          <span className="bar-chart__track">
            {bar.value > 0 && (
              <span
                className="bar-chart__bar"
                aria-hidden="true"
                style={{ "--share": bar.value / full } as CSSProperties}
              />
            )}
            <span className="bar-chart__value">{bar.value}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
