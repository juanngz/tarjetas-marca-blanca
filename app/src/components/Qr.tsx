// A card's QR: only the long code, no web address (plan, decision of 06/10/2026).
// Black on pure white, with a white margin: what the register's camera reads best.
import { encode } from "uqr";

export function Qr({ code, name }: { code: string; name: string }) {
  const { data, size } = encode(code, { ecc: "M", border: 0 });
  let path = "";
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`;
    });
  });
  return (
    <div className="qr">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Código QR de la tarjeta ${name}`}
        shapeRendering="crispEdges"
      >
        <path d={path} fill="#000000" />
      </svg>
    </div>
  );
}
