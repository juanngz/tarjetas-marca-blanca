// The foot of the customer's pages: the café's symbol, its name and where it is.
import { useBrand } from "./brand";

export function SiteFoot({ address }: { address: string }) {
  const brand = useBrand();
  return (
    <footer className="site-foot">
      <img src="/brand/symbol.svg" alt="" width={52} height={52} />
      <p>
        <strong>{brand.name}</strong>
        {brand.description} · {address}
      </p>
    </footer>
  );
}
