import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { createCustomer, signedInCookie } from "../../../test/factories";
import { IN_PROD, TEST_SECRETS } from "../../../test/routes";
import { handleLiveRequest, isLiveRequest } from "./liveRequest.server";
import { durableCardWatchers } from "./watchers.server";

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

/** Card watches in memory: which card each screen was handed to, and what each card was told. */
function fakeWatches() {
  const listening: string[] = [];
  const told: { cardId: string; change: unknown }[] = [];
  const watches = {
    idFromName: (name: string) => name,
    get: (cardId: string) => ({
      fetch: async () => {
        listening.push(cardId);
        return new Response("listening");
      },
      notify: async (change: unknown) => void told.push({ cardId, change }),
    }),
  };
  return { watches, listening, told };
}

function liveRequest(
  path: string,
  { cookie, origin = IN_PROD, upgrade = "websocket" }: Record<string, string | undefined> = {},
) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  if (origin) headers.Origin = origin;
  if (upgrade) headers.Upgrade = upgrade;
  return new Request(`${IN_PROD}${path}`, { headers });
}

async function open(request: Request) {
  const fake = fakeWatches();
  // biome-ignore lint/suspicious/noExplicitAny: the test's env is built by hand.
  const env = { DB: t.d1, ...TEST_SECRETS, CARD_WATCH: fake.watches } as any;
  const response = await handleLiveRequest(request, env);
  return { status: response.status, listening: fake.listening };
}

describe("the code screen listening to its card", () => {
  it("is the live address", () => {
    expect(isLiveRequest(new Request(`${IN_PROD}/live/cards/take-away`))).toBe(true);
    expect(isLiveRequest(new Request(`${IN_PROD}/cards/take-away`))).toBe(false);
  });

  it("listens to her own card of that type", async () => {
    const { customer, cards } = await createCustomer(t.db);
    const cookie = await signedInCookie(customer.id);
    const result = await open(liveRequest("/live/cards/take-away", { cookie }));
    expect(result.listening).toEqual([cards.find((c) => c.type === "take-away")?.id]);
  });

  it("without a session, doesn't listen", async () => {
    expect(await open(liveRequest("/live/cards/take-away"))).toEqual({
      status: 401,
      listening: [],
    });
  });

  it("a card type she doesn't have, doesn't listen", async () => {
    const { customer } = await createCustomer(t.db);
    const cookie = await signedInCookie(customer.id);
    expect(await open(liveRequest("/live/cards/other", { cookie }))).toEqual({
      status: 404,
      listening: [],
    });
  });

  it("from another site, doesn't listen, even with her cookie", async () => {
    const { customer } = await createCustomer(t.db);
    const cookie = await signedInCookie(customer.id);
    const fromElsewhere = liveRequest("/live/cards/take-away", {
      cookie,
      origin: "https://otro-sitio.example",
    });
    expect(await open(fromElsewhere)).toEqual({ status: 403, listening: [] });
  });

  it("without a WebSocket, doesn't listen", async () => {
    const { customer } = await createCustomer(t.db);
    const cookie = await signedInCookie(customer.id);
    const plain = liveRequest("/live/cards/take-away", { cookie, upgrade: "" });
    expect(await open(plain)).toEqual({ status: 426, listening: [] });
  });
});

describe("telling a card's screens", () => {
  it("tells that card's watch what happened", async () => {
    const fake = fakeWatches();
    // biome-ignore lint/suspicious/noExplicitAny: a fake namespace.
    await durableCardWatchers(fake.watches as any).changed("card-1", { version: 3, kind: "stamp" });
    expect(fake.told).toEqual([{ cardId: "card-1", change: { version: 3, kind: "stamp" } }]);
  });

  it("without the binding, nobody is listening and nothing fails", async () => {
    await expect(
      durableCardWatchers(undefined).changed("card-1", { version: 3, kind: "stamp" }),
    ).resolves.toBeUndefined();
  });
});
