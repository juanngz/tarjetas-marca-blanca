import { describe, expect, it } from "vitest";
import { fakePins, fakeSessions, fixedClock, inMemoryStaff, memoryLogger } from "../../test/fakes";
import { FAILED_SIGN_IN_MS, type StaffSignInInput, staffSignIn } from "./staffSignIn";

const AT_10 = new Date("2026-10-07T13:00:00Z");
const minutesLater = (minutes: number) => new Date(AT_10.getTime() + minutes * 60_000);

// One message for every way in that fails: wrong email, wrong PIN or locked out. So it never tells which
// emails are on the team, and whoever got locked out still knows what to do.
const WRONG = "Revisá tu email y tu PIN. Si ya probaste varias veces, esperá 15 minutos.";

/** The register with Ana (barista, PIN 428613), at 10 in the morning unless told otherwise. */
function atTheRegister() {
  const team = inMemoryStaff();
  const logger = memoryLogger();
  /** How long each answer waited before going out. */
  const waited: number[] = [];
  const wait = async (ms: number) => void waited.push(ms);
  const ana = team.add({ id: "ana", email: "ana@example.com", name: "Ana", pin: "428613" });
  const signIn = (input: Partial<StaffSignInInput>, at = AT_10) =>
    staffSignIn(
      { email: "ana@example.com", pin: "428613", ...input },
      {
        staff: team.staff,
        pins: fakePins,
        sessions: fakeSessions,
        clock: fixedClock(at),
        wait,
        logger,
      },
    );
  const failTimes = async (times: number, at = AT_10, email = "ana@example.com") => {
    for (let i = 0; i < times; i++) await signIn({ email, pin: "111222" }, at);
  };
  return { team, logger, ana, signIn, failTimes, waited };
}

describe("a staff member signs in at the register", () => {
  it("with their email and PIN, gets their session", async () => {
    const { signIn } = atTheRegister();
    expect(await signIn({})).toEqual({
      result: "signed-in",
      cookie: "staff-session-of-ana",
      member: { id: "ana", name: "Ana", role: "barista" },
    });
  });

  it("the email can be typed in capitals and with spaces", async () => {
    const { signIn } = atTheRegister();
    expect(await signIn({ email: " Ana@Example.com " })).toMatchObject({ result: "signed-in" });
  });

  it("with a wrong PIN, doesn't get in", async () => {
    const { signIn } = atTheRegister();
    expect(await signIn({ pin: "111222" })).toEqual({
      result: "error",
      reason: "wrong",
      message: WRONG,
      email: "ana@example.com",
    });
  });

  it("with an email nobody has, sees the same message as with a wrong PIN", async () => {
    const { signIn } = atTheRegister();
    expect(await signIn({ email: "otra@example.com" })).toMatchObject({ message: WRONG });
  });

  it("with something that isn't an email, sees the same message", async () => {
    const { signIn } = atTheRegister();
    expect(await signIn({ email: "ana" })).toMatchObject({ reason: "wrong", message: WRONG });
  });

  it("a PIN that isn't 6 digits says how it is, and doesn't count as a failed attempt", async () => {
    const { team, signIn } = atTheRegister();
    expect(await signIn({ pin: "4286" })).toMatchObject({
      reason: "pin-format",
      message: "Tu PIN tiene 6 números. Revisalo y probá de nuevo.",
    });
    expect(team.stored.get("ana")?.failedAttempts).toBe(0);
  });

  it("someone who no longer works there doesn't get in, even with their PIN", async () => {
    const { team, signIn } = atTheRegister();
    team.add({ id: "beto", email: "beto@example.com", deactivatedAt: AT_10, pin: "582913" });
    expect(await signIn({ email: "beto@example.com", pin: "582913" })).toMatchObject({
      reason: "wrong",
      message: WRONG,
    });
  });

  it("a wrong PIN counts as a failed attempt", async () => {
    const { team, failTimes } = atTheRegister();
    await failTimes(1);
    expect(team.stored.get("ana")?.failedAttempts).toBe(1);
  });

  it("the fifth wrong PIN in a row locks them out", async () => {
    const { signIn, failTimes } = atTheRegister();
    await failTimes(4);
    expect(await signIn({ pin: "111222" })).toMatchObject({ reason: "locked", message: WRONG });
  });

  it("locked out, not even the right PIN gets them in", async () => {
    const { signIn, failTimes } = atTheRegister();
    await failTimes(5);
    expect(await signIn({}, minutesLater(14))).toMatchObject({ reason: "locked" });
  });

  it("locked out, trying again doesn't extend the lockout", async () => {
    const { signIn, failTimes } = atTheRegister();
    await failTimes(5);
    await failTimes(3, minutesLater(10));
    expect(await signIn({}, minutesLater(15))).toMatchObject({ result: "signed-in" });
  });

  it("after 15 minutes, gets in with the right PIN", async () => {
    const { signIn, failTimes } = atTheRegister();
    await failTimes(5);
    expect(await signIn({}, minutesLater(15))).toMatchObject({ result: "signed-in" });
  });

  it("getting it right starts the failed attempts from zero", async () => {
    const { signIn, failTimes } = atTheRegister();
    await failTimes(4);
    await signIn({});
    await failTimes(3);
    // Without starting from zero, this would be the eighth in a row.
    expect(await signIn({ pin: "111222" })).toMatchObject({ reason: "wrong" });
  });

  it("thirty PINs sent at once count like thirty in a row: the right one, last, doesn't get in", async () => {
    const { signIn } = atTheRegister();
    const wrong = Array.from({ length: 29 }, () => signIn({ pin: "111222" }));
    const results = await Promise.all([...wrong, signIn({})]);
    expect(results.filter((r) => r.result === "signed-in")).toEqual([]);
  });

  it("ten wrong PINs sent at once lock them out for 15 minutes, like five in a row", async () => {
    const { signIn } = atTheRegister();
    await Promise.all(Array.from({ length: 10 }, () => signIn({ pin: "111222" })));
    expect(await signIn({}, minutesLater(14))).toMatchObject({ reason: "locked" });
    expect(await signIn({}, minutesLater(15))).toMatchObject({ result: "signed-in" });
  });

  it("locked out, sees the same message as with a wrong PIN", async () => {
    const { signIn, failTimes } = atTheRegister();
    await failTimes(5);
    expect(await signIn({}, minutesLater(1))).toMatchObject({ reason: "locked", message: WRONG });
  });

  it("after 5 wrong PINs, an email nobody has sees the same message as one that's locked out", async () => {
    // So the answers don't tell which emails are on the team.
    const { signIn, failTimes } = atTheRegister();
    const nobody = "nadie@example.com";
    await failTimes(5);
    await failTimes(5, AT_10, nobody);
    const messageOf = async (email: string) =>
      ((await signIn({ email, pin: "111222" })) as { message: string }).message;
    expect(await messageOf(nobody)).toBe(await messageOf("ana@example.com"));
  });

  it("one person's failed attempts don't lock out another", async () => {
    const { team, signIn, failTimes } = atTheRegister();
    team.add({ id: "juan", email: "juan@example.com", name: "Juan", pin: "582913" });
    await failTimes(5);
    expect(await signIn({ email: "juan@example.com", pin: "582913" })).toMatchObject({
      result: "signed-in",
    });
  });

  it("an email nobody has, a wrong PIN and being locked out take the same steps, so they take as long", async () => {
    // Each step is a trip to the database: if one way did fewer, its answer would come faster, and the
    // time would tell which emails are on the team.
    const { team, signIn, failTimes } = atTheRegister();
    const steps: string[] = [];
    const watched = Object.fromEntries(
      Object.entries(team.staff).map(([name, step]) => [
        name,
        (...args: unknown[]) => {
          steps.push(name);
          return (step as (...a: unknown[]) => unknown)(...args);
        },
      ]),
    ) as unknown as typeof team.staff;
    const stepsOf = async (input: Partial<StaffSignInInput>) => {
      steps.length = 0;
      await staffSignIn(
        { email: "ana@example.com", pin: "428613", ...input },
        {
          staff: watched,
          pins: fakePins,
          sessions: fakeSessions,
          clock: fixedClock(AT_10),
          wait: async () => {},
          logger: memoryLogger(),
        },
      );
      return [...steps];
    };

    const wrongPin = await stepsOf({ pin: "111222" });
    expect(await stepsOf({ email: "nadie@example.com", pin: "111222" })).toEqual(wrongPin);
    await failTimes(5);
    expect(await signIn({}, minutesLater(1))).toMatchObject({ reason: "locked" });
    expect(await stepsOf({})).toEqual(wrongPin);
  });

  it("an email nobody has, a wrong PIN and being locked out all take at least as long", async () => {
    // Whatever the database did, the answer goes out at the same time: the time doesn't tell which
    // emails are on the team. Here the clock doesn't move, so each one waits the whole minimum.
    const { signIn, failTimes, waited } = atTheRegister();
    await signIn({ email: "nadie@example.com" });
    await signIn({ pin: "111222" });
    await failTimes(4);
    await signIn({});
    expect(waited).toEqual(Array(7).fill(FAILED_SIGN_IN_MS));
  });

  it("only waits what's left: what the database took counts", async () => {
    const team = inMemoryStaff();
    team.add({ id: "ana", email: "ana@example.com", name: "Ana", pin: "428613" });
    const waited: number[] = [];
    // The first time it's asked, when it starts; then, half a second later.
    let asked = 0;
    const clock = { now: () => (asked++ === 0 ? AT_10 : new Date(AT_10.getTime() + 500)) };
    await staffSignIn(
      { email: "ana@example.com", pin: "111222" },
      {
        staff: team.staff,
        pins: fakePins,
        sessions: fakeSessions,
        clock,
        wait: async (ms) => void waited.push(ms),
        logger: memoryLogger(),
      },
    );
    expect(waited).toEqual([FAILED_SIGN_IN_MS - 500]);
  });

  it("getting in doesn't wait, nor a PIN that isn't 6 digits", async () => {
    const { signIn, waited } = atTheRegister();
    await signIn({});
    await signIn({ pin: "4286" });
    expect(waited).toEqual([]);
  });

  it("the log says who signed in, without their email or PIN", async () => {
    const { logger, signIn } = atTheRegister();
    await signIn({});
    expect(logger.events).toEqual([{ event: "staff-signed-in", data: { memberId: "ana" } }]);
  });

  it("the log says who got locked out", async () => {
    const { logger, failTimes } = atTheRegister();
    await failTimes(5);
    expect(logger.events).toEqual([{ event: "staff-locked-out", data: { memberId: "ana" } }]);
  });
});
