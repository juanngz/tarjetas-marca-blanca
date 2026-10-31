// Resumen (11/10/2026, flujos-equipo.md): the Club's numbers, only for the manager. On top, in one row, the days
// to see (12/10/2026): the last 7, 30 or 90 days with a tap, or Otras, which opens Desde and Hasta; the last 7
// days at first. Every choice is an address (?from=2026-10-05&to=2026-10-11) and works without JavaScript.
// Then the four numbers that matter, and a chart for each question: day by day, how many times each customer
// came, each card side by side, and the busiest days and hours. Only counts: never a customer's name.
import type { CSSProperties, ReactNode } from "react";
import { Form, Link, redirect, useLocation, useNavigation } from "react-router";
import { BarChart } from "../../components/BarChart";
import { ChevronDownIcon } from "../../components/icons";
import { RegisterBar } from "../../components/RegisterBar";
import { keepTogether } from "../../components/text";
import { appFor } from "../../platform/app.server";
import type { Route } from "./+types/route";

export const meta: Route.MetaFunction = () => [{ title: "Resumen · Caja" }];

export async function loader({ request, context }: Route.LoaderArgs) {
  const register = await appFor(request, context.cloudflare).register({
    renew: false,
  });
  if (!register) throw redirect("/register/sign-in");
  const params = new URL(request.url).searchParams;
  const view = await register.summary({ from: params.get("from"), to: params.get("to") });
  if (view.result === "forbidden") throw redirect("/register");
  const { result: _, ...summary } = view;
  return summary;
}

type Summary = Route.ComponentProps["loaderData"];

/** A card's name or an hour never splits in two lines: "take-away", "¼ kg" and "9 a 10" stay together. */
const unbroken = (text: string) =>
  keepTogether(text)
    .replaceAll("take-away", "take‑away")
    .replaceAll("Take-away", "Take‑away")
    .replace(/(\d+) a (\d+)/g, "$1 a $2");

function Section({
  id,
  title,
  headline,
  children,
}: {
  id: string;
  title: string;
  headline: string;
  children: ReactNode;
}) {
  return (
    <section className="summary-section" aria-labelledby={id}>
      <div className="summary-section__head">
        <h2 id={id} className="summary-section__title">
          {title}
        </h2>
        <p className="summary-section__headline">{unbroken(headline)}</p>
      </div>
      {children}
    </section>
  );
}

/** The days, in one row: 7, 30 or 90 days with a tap; Otras opens Desde and Hasta over the screen. */
function Dates({ range }: { range: Summary["range"] }) {
  const other = !range.presets.some((preset) => preset.current);
  return (
    <nav className="date-filter" aria-label="Fechas">
      {range.presets.map((preset) => (
        <Link
          key={preset.label}
          to={`?from=${preset.from}&to=${preset.to}`}
          className="date-filter__option"
          aria-current={preset.current ? "true" : undefined}
          preventScrollReset
        >
          {preset.label}
        </Link>
      ))}
      {/* key: after picking, it closes. */}
      <details className="date-filter__more" key={`${range.from}:${range.to}`}>
        <summary className="date-filter__option" aria-current={other ? "true" : undefined}>
          Otras
          <ChevronDownIcon />
        </summary>
        <Form method="get" className="date-filter__panel" preventScrollReset>
          <div className="date-filter__fields">
            <label className="date-filter__field">
              <span className="field-label">Desde</span>
              <input
                name="from"
                type="date"
                className="field"
                defaultValue={range.from}
                max={range.today}
              />
            </label>
            <label className="date-filter__field">
              <span className="field-label">Hasta</span>
              <input
                name="to"
                type="date"
                className="field"
                defaultValue={range.to}
                max={range.today}
              />
            </label>
          </div>
          <button type="submit" className="button">
            Ver esas fechas
          </button>
        </Form>
      </details>
    </nav>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note?: string | null }) {
  return (
    <div className="stat">
      <dt className="stat__label">{label}</dt>
      <dd className="stat__value">{value}</dd>
      {note && <dd className="stat__note">{note}</dd>}
    </div>
  );
}

const TIMELINE = {
  day: { title: "Día por día", row: "Día" },
  week: { title: "Semana por semana", row: "Semana del" },
  month: { title: "Mes por mes", row: "Mes" },
};

/** A row per day, week or month: a bar with its stamps, and its new customers beside it. */
function Timeline({ timeline }: { timeline: Summary["timeline"] }) {
  const most = Math.max(1, ...timeline.rows.map((row) => row.stamps));
  return (
    <table className={`period-table${timeline.per === "day" ? "" : " period-table--stacked"}`}>
      <caption className="visually-hidden">Sellos y clientes nuevos</caption>
      <thead>
        <tr>
          <th scope="col">
            <span className="visually-hidden">{TIMELINE[timeline.per].row}</span>
          </th>
          <th scope="col">Sellos</th>
          <th scope="col" className="period-table__new">
            Nuevos
          </th>
        </tr>
      </thead>
      <tbody>
        {timeline.rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>
              <span className="period-table__stamps">
                {row.stamps > 0 && (
                  <span
                    className="period-table__bar"
                    aria-hidden="true"
                    style={{ "--share": row.stamps / most } as CSSProperties}
                  />
                )}
                <span className="period-table__value">
                  {row.stamps}
                  <span className="period-table__unit">
                    {row.stamps === 1 ? " sello" : " sellos"}
                  </span>
                </span>
              </span>
            </td>
            <td className="period-table__new">
              {row.newCustomers}
              <span className="period-table__unit">
                {row.newCustomers === 1 ? " nuevo" : " nuevos"}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const CARD_ROWS = [
  { label: "Clientes que la usaron", value: "visitors" },
  { label: "Sellos", value: "stamps" },
  { label: "Premios ganados", value: "earned" },
  { label: "Premios canjeados", value: "redeemed" },
] as const;

/** The three cards side by side: a column per card, a row per number. */
function Cards({ cards }: { cards: Summary["cards"] }) {
  return (
    <table className="card-table">
      <caption className="visually-hidden">Los números de cada tarjeta</caption>
      <thead>
        <tr>
          <td />
          {cards.map((card) => (
            <th key={card.name} scope="col">
              <span aria-hidden="true">{unbroken(card.short)}</span>
              <span className="visually-hidden">{card.name}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {CARD_ROWS.map((row) => (
          <tr key={row.value}>
            <th scope="row">{row.label}</th>
            {cards.map((card) => (
              <td key={card.name}>
                {/* When there's no room for the columns: the card's name beside its number. */}
                <span className="card-table__card">{unbroken(card.short)}</span>
                {card[row.value]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Stamps per hour (rows) and per day (columns): the darker, the more. Up to 7 days, a column per day picked,
 * with its date; longer, Monday to Sunday with all the weeks together, and a day like that on average below.
 * Every number is written; a zero, only for screen readers. When there's no room for the columns (big text),
 * a bar per day and a bar per hour instead.
 */
function HeatMap({ hours }: { hours: Summary["hours"] }) {
  const level = (value: number) => (value === 0 ? 0 : Math.ceil((value / hours.most) * 4));
  const foot =
    hours.averages === null ? "Los sellos de cada día" : "Los sellos de un día así, en promedio";
  return (
    <>
      {hours.note && <p className="note">{hours.note}</p>}
      <div className="heatmap-narrow">
        <BarChart
          caption="Sellos de cada día"
          bars={hours.columns.map((column, i) => ({ label: column.name, value: hours.totals[i] }))}
        />
        <BarChart
          caption="Sellos por hora"
          bars={hours.rows.map((row) => ({
            label: row.label,
            value: row.cells.reduce((sum, n) => sum + n, 0),
          }))}
        />
      </div>
      <table className="heatmap">
        <caption className="visually-hidden">Sellos por hora y día</caption>
        <thead>
          <tr>
            <td />
            {hours.columns.map((column) => (
              <th key={column.name} scope="col">
                <span aria-hidden="true">
                  {column.label}
                  {column.sub && <span className="heatmap__date">{column.sub}</span>}
                </span>
                <span className="visually-hidden">{column.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {row.cells.map((value, i) => (
                <td key={hours.columns[i].name} data-level={level(value)}>
                  {value > 0 ? value : <span className="visually-hidden">0</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="colgroup" colSpan={hours.columns.length + 1} className="heatmap__foot">
              {foot}
            </th>
          </tr>
          <tr>
            <td />
            {(hours.averages ?? hours.totals.map(String)).map((value, i) => (
              <td key={hours.columns[i].name}>{value}</td>
            ))}
          </tr>
        </tfoot>
      </table>
    </>
  );
}

export default function SummaryScreen({ loaderData }: Route.ComponentProps) {
  const { range, totals, timeline, visits, cardsHeadline, cards, hours } = loaderData;
  const navigation = useNavigation();
  const { pathname } = useLocation();
  // Other dates on their way: the numbers stay, dimmed, until the new ones come.
  const loading = navigation.state === "loading" && navigation.location.pathname === pathname;

  return (
    <>
      <RegisterBar back="/register" />
      <main className="screen screen--register screen--summary">
        <div className="summary-top">
          <div className="intro">
            <h1 className="title">Resumen</h1>
            <p>{range.says}</p>
          </div>
          <Dates range={range} />
        </div>

        <div
          className={`summary-body${loading ? " summary-body--loading" : ""}`}
          aria-busy={loading}
        >
          <dl className="stats">
            <Stat label="Sellos" value={totals.stamps} note={totals.perDay} />
            <Stat
              label="Clientes que vinieron"
              value={totals.visitors}
              note={totals.cameBack > 0 ? `${totals.cameBack} volvieron` : null}
            />
            <Stat label="Clientes nuevos" value={totals.newCustomers} />
            <Stat
              label="Premios canjeados"
              value={totals.redeemed}
              note={totals.pending > 0 ? `${totals.pending} sin canjear` : null}
            />
          </dl>

          <Section id="timeline" title={TIMELINE[timeline.per].title} headline={timeline.headline}>
            <Timeline timeline={timeline} />
          </Section>

          <Section id="visits" title="Cuántas veces vinieron" headline={visits.headline}>
            <p className="note">Los días que vino cada cliente, con cualquier tarjeta.</p>
            <BarChart caption="Cuántas veces vino cada cliente" bars={visits.bars} />
          </Section>

          <Section id="cards" title="Por tarjeta" headline={cardsHeadline}>
            <p className="note">
              Usar la tarjeta es sumar un sello o canjear un premio con ella. Cada cliente cuenta
              una vez.
            </p>
            <Cards cards={cards} />
          </Section>

          <Section id="hours" title="Días y horarios" headline={hours.headline}>
            {hours.rows.length > 0 && <HeatMap hours={hours} />}
          </Section>
        </div>
      </main>
    </>
  );
}
