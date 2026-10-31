// Layer 4: axe plus the project's own rules for every screen (CLAUDE.md, "Reglas que no cambian"):
// text never under 16px, main buttons of 56px (the register's, 72px), nothing tappable under 48px,
// no horizontal scroll at 360px, and the same at 200% (interfaz.md: "tiene que aguantar 200% sin cortar texto").
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

const MIN_TEXT = 16;
const MIN_TAP = 48;
const MIN_MAIN_BUTTON = 56;
const MIN_REGISTER_BUTTON = 72;

/** What the page breaks, measured in the browser. Turnstile's widget is Cloudflare's, not ours. */
function measure(page: Page) {
  return page.evaluate(
    ({ minText, minTap, minMainButton, minRegisterButton }) => {
      const visible = (el: Element) => {
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return (
          box.width > 0 &&
          box.height > 0 &&
          style.visibility !== "hidden" &&
          !el.closest("[inert], [aria-hidden='true'], .turnstile")
        );
      };
      // Its size in the layout, without transforms: a button pressed a moment ago (scale 0.97) isn't smaller.
      const height = (el: Element) => (el as HTMLElement).offsetHeight;
      const describe = (el: Element) =>
        `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}"`;

      const smallText = [...document.body.querySelectorAll("*")]
        .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()))
        .filter(visible)
        .filter((el) => Number.parseFloat(getComputedStyle(el).fontSize) < minText)
        .map(describe);

      // A field's label isn't tapped (the field is); a checkbox's label is: it's what the finger hits.
      const tappable = [
        ...document.querySelectorAll(
          "a[href], button, input:not([type='checkbox']):not([type='radio']), summary, label:has(input[type='checkbox'], input[type='radio'])",
        ),
      ].filter(visible);
      const smallTaps = tappable.filter((el) => height(el) < minTap).map(describe);
      const smallMainButtons = tappable
        .filter((el) => el.classList.contains("button"))
        .filter((el) => height(el) < minMainButton)
        .map(describe);
      const smallRegisterButtons = tappable
        .filter((el) => el.classList.contains("button--register"))
        .filter((el) => height(el) < minRegisterButton)
        .map(describe);

      const root = document.documentElement;
      return {
        smallText,
        smallTaps,
        smallMainButtons,
        smallRegisterButtons,
        horizontalScroll: root.scrollWidth > root.clientWidth,
      };
    },
    {
      minText: MIN_TEXT,
      minTap: MIN_TAP,
      minMainButton: MIN_MAIN_BUTTON,
      minRegisterButton: MIN_REGISTER_BUTTON,
    },
  );
}

/**
 * At 200%, a phone zooms the whole page (Safari's aA, Chrome's zoom that follows the system's text size):
 * the 360px screen behaves like one of 180px. Nothing may go past the right edge, text included.
 */
async function measureAt200(page: Page) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Sin tamaño de pantalla");
  await page.setViewportSize({ width: viewport.width / 2, height: viewport.height / 2 });
  const found = await page.evaluate(() => {
    const root = document.documentElement;
    const edge = root.clientWidth;
    const pastTheEdge = [...document.body.querySelectorAll("*")]
      .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()))
      .filter((el) => !el.closest("[inert], [aria-hidden='true'], .turnstile"))
      .filter((el) => {
        const box = el.getBoundingClientRect();
        return box.width > 0 && box.right > edge + 1;
      })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}"`);
    return { horizontalScroll: root.scrollWidth > root.clientWidth, pastTheEdge };
  });
  await page.setViewportSize(viewport);
  return found;
}

export async function expectScreenRules(page: Page) {
  const axe = await new AxeBuilder({ page }).exclude(".turnstile").analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  const found = await measure(page);
  expect(found.smallText, `text under ${MIN_TEXT}px`).toEqual([]);
  expect(found.smallTaps, `tappable under ${MIN_TAP}px`).toEqual([]);
  expect(found.smallMainButtons, `main button under ${MIN_MAIN_BUTTON}px`).toEqual([]);
  expect(found.smallRegisterButtons, `register button under ${MIN_REGISTER_BUTTON}px`).toEqual([]);
  expect(found.horizontalScroll, "horizontal scroll at 360px").toBe(false);

  const at200 = await measureAt200(page);
  expect(at200.pastTheEdge, "text past the right edge at 200%").toEqual([]);
  expect(at200.horizontalScroll, "horizontal scroll at 200%").toBe(false);
}
