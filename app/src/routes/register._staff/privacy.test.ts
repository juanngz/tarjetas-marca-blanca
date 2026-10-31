// The DNI never travels in any register response (CLAUDE.md, plan, stage 4): not the number, with or
// without dots, and not its hash. Marta's document is hashed with the test key, like the app does.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { createCustomer, createStaffMember, staffCookie } from "../../../test/factories";
import { args, dataOf, get, post, TEST_SECRETS } from "../../../test/routes";
import { hmacDocumentHasher } from "../../platform/security/documentHasher.server";
import { action as search } from "../register._staff._index/route";
import { loader as activity } from "../register._staff.activity/route";
import { loader as card, action as tap } from "../register._staff.card.$code/route";
import { loader as done, action as undo } from "../register._staff.done.$entry/route";
import { loader as layout } from "./route";

let t: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  t = await testDb();
});
beforeEach(async () => {
  await t.clear();
});
afterAll(async () => {
  await t.close();
});

/** Everything a response carries: its headers and its body or data. */
async function everything(result: unknown): Promise<string> {
  if (result instanceof Response) {
    return JSON.stringify([...result.headers]) + (await result.clone().text());
  }
  return JSON.stringify(dataOf(result));
}

/** Runs it and returns what came back, whether it was returned or thrown (a redirect, a 404). */
async function respond(run: () => Promise<unknown>) {
  try {
    return await run();
  } catch (thrown) {
    return thrown;
  }
}

const location = (result: unknown) =>
  result instanceof Response ? (result.headers.get("Location") ?? "") : "";

describe("the register never sends the DNI", () => {
  it("in any of its screens or actions", async () => {
    const dniHmac = await hmacDocumentHasher(TEST_SECRETS.DNI_HMAC_KEY).hmac("dni", "30123456");
    const { cards } = await createCustomer(t.db, { dniHmac });
    const takeAway = cards.find((c) => c.type === "take-away");
    if (!takeAway) throw new Error("Missing the take-away card.");
    const cookie = await staffCookie(await createStaffMember(t.db));
    const code = takeAway.shortCode;

    const responses: unknown[] = [];
    const keep = async (run: () => Promise<unknown>) => {
      const result = await respond(run);
      responses.push(result);
      return result;
    };

    await keep(() => layout(args(get("/register", cookie), t.d1)));
    await keep(() => search(args(post("/register", { code }, cookie), t.d1)));
    await keep(() => search(args(post("/register", { code: takeAway.qrCode }, cookie), t.d1)));
    await keep(() => card(args(get(`/register/card/${code}`, cookie), t.d1, { code })));
    const stamped = await keep(() =>
      tap(
        args(post(`/register/card/${code}`, { intent: "stamp", version: "0" }, cookie), t.d1, {
          code,
        }),
      ),
    );
    const entry = location(stamped).split("/").at(-1) ?? "";
    await keep(() => done(args(get(`/register/done/${entry}`, cookie), t.d1, { entry })));
    const undone = await keep(() =>
      undo(args(post(`/register/done/${entry}`, { intent: "undo" }, cookie), t.d1, { entry })),
    );
    const undoId = location(undone).split("/").at(-1) ?? "";
    await keep(() => done(args(get(`/register/done/${undoId}`, cookie), t.d1, { entry: undoId })));
    // Movimientos, the manager's.
    const bruno = await createStaffMember(t.db, { name: "Bruno", role: "manager" });
    const asManager = await staffCookie(bruno);
    await keep(() => activity(args(get("/register/activity", asManager), t.d1)));

    const sent = (await Promise.all(responses.map(everything))).join("\n");
    expect(sent).toContain("Marta García");
    for (const secret of ["30123456", "30.123.456", dniHmac]) expect(sent).not.toContain(secret);
  });
});
