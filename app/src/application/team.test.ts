import { describe, expect, it } from "vitest";
import { fakePinHmac, holdingAnswers, inMemoryStaff, sequentialPins } from "../../test/fakes";
import { exampleCafe } from "../cafes/example";
import {
  addBarista,
  changeTeamMember,
  newPinFor,
  setActive,
  viewTeam,
  viewTeamMember,
} from "./team";

const AT = new Date("2026-10-08T15:00:00Z");

/** Bruno is the manager; Ana and Beto are baristas; Carla is another manager. */
function theTeam() {
  const team = inMemoryStaff();
  const bruno = team.add({
    id: "bruno",
    email: "bruno@example.com",
    name: "Bruno",
    role: "manager",
  });
  team.add({ id: "ana", email: "ana@example.com", name: "Ana" });
  team.add({ id: "beto", email: "beto@example.com", name: "Beto" });
  team.add({ id: "carla", email: "carla@example.com", name: "Carla", role: "manager" });
  const pins = sequentialPins();
  const deps = { staff: team.staff, pins };
  const manager = { id: bruno.id, name: bruno.name, role: bruno.role };
  const barista = { id: "ana", name: "Ana", role: "barista" as const };
  return { team, pins, deps, manager, barista };
}

describe("the Equipo screen", () => {
  it("is only for the manager", async () => {
    const { deps, barista } = theTeam();
    expect(await viewTeam({ actor: barista }, deps)).toEqual({ result: "forbidden" });
  });

  it("shows the active ones by name, and says whom the manager can change", async () => {
    const { deps, manager } = theTeam();
    const view = await viewTeam({ actor: manager }, deps);
    if (view.result !== "ok") throw new Error("It should show the team.");
    expect(view.active.map((m) => [m.name, m.canChange])).toEqual([
      ["Ana", true],
      ["Beto", true],
      ["Bruno", false],
      ["Carla", false],
    ]);
  });

  it("the ones who no longer work there go apart", async () => {
    const { team, deps, manager } = theTeam();
    team.add({ id: "dani", email: "dani@example.com", name: "Dani", deactivatedAt: AT });
    const view = await viewTeam({ actor: manager }, deps);
    if (view.result !== "ok") throw new Error("It should show the team.");
    expect(view.inactive.map((m) => m.name)).toEqual(["Dani"]);
    expect(view.active.map((m) => m.name)).not.toContain("Dani");
  });
});

describe("add a barista", () => {
  it("with their email and name; the app makes up the PIN and shows it once", async () => {
    const { team, pins, deps, manager } = theTeam();
    const added = await addBarista(
      { actor: manager, email: " Juan@Example.com ", name: "  Juan   Cruz ", at: AT },
      deps,
    );
    if (added.result !== "added") throw new Error("It should add the barista.");
    expect(added.pin).toBe(pins.given[0]);
    expect(team.stored.get(added.member.id)).toMatchObject({
      email: "juan@example.com",
      name: "Juan Cruz",
      role: "barista",
      pinHmac: fakePinHmac(added.member.id, added.pin),
      deactivatedAt: null,
      createdAt: AT,
    });
  });

  it("the PIN is never stored as is", async () => {
    const { team, deps, manager } = theTeam();
    const added = await addBarista(
      { actor: manager, email: "juan@example.com", name: "Juan", at: AT },
      deps,
    );
    if (added.result !== "added") throw new Error("It should add the barista.");
    expect(JSON.stringify(team.stored.get(added.member.id))).not.toContain(`"${added.pin}"`);
  });

  it("it's recorded who added them and when", async () => {
    const { team, deps, manager } = theTeam();
    const added = await addBarista(
      { actor: manager, email: "juan@example.com", name: "Juan", at: AT },
      deps,
    );
    if (added.result !== "added") throw new Error("It should add the barista.");
    expect(team.audit).toEqual([
      { staffId: added.member.id, byId: "bruno", change: "added", at: AT },
    ]);
  });

  it("a barista can't add anyone, and nothing is saved", async () => {
    const { team, deps, barista } = theTeam();
    const result = await addBarista(
      { actor: barista, email: "juan@example.com", name: "Juan", at: AT },
      deps,
    );
    expect(result).toEqual({ result: "forbidden" });
    expect(team.stored.size).toBe(4);
  });

  it("an email that isn't one says how it should be", async () => {
    const { deps, manager } = theTeam();
    expect(
      await addBarista({ actor: manager, email: "juan", name: "Juan", at: AT }, deps),
    ).toMatchObject({
      result: "error",
      field: "email",
      message: "Revisá el email: tiene que ser como nombre@ejemplo.com.",
    });
  });

  it("a name with numbers or symbols says what it takes", async () => {
    const { deps, manager } = theTeam();
    expect(
      await addBarista({ actor: manager, email: "juan@example.com", name: "Juan2", at: AT }, deps),
    ).toMatchObject({ field: "name", message: "El nombre lleva solo letras y espacios." });
  });

  it("an email someone already has isn't used twice", async () => {
    const { team, deps, manager } = theTeam();
    expect(
      await addBarista({ actor: manager, email: "ana@example.com", name: "Ana Dos", at: AT }, deps),
    ).toMatchObject({ field: "email", message: "Ya hay alguien del equipo con ese email." });
    expect(team.stored.size).toBe(4);
  });

  it("an email someone already has, in capitals, isn't used twice either", async () => {
    const { team, deps, manager } = theTeam();
    expect(
      await addBarista(
        { actor: manager, email: " ANA@Example.com ", name: "Ana Dos", at: AT },
        deps,
      ),
    ).toMatchObject({ field: "email", message: "Ya hay alguien del equipo con ese email." });
    expect(team.stored.size).toBe(4);
  });
});

describe("a person's screen", () => {
  it("shows them and what was done to them, the most recent first", async () => {
    const { deps, manager } = theTeam();
    await setActive({ actor: manager, memberId: "ana", active: false, at: AT }, deps);
    const view = await viewTeamMember(
      { actor: manager, memberId: "ana", now: AT },
      exampleCafe,
      deps,
    );
    expect(view).toMatchObject({
      result: "ok",
      member: { name: "Ana", email: "ana@example.com", role: "barista" },
      canChange: true,
      history: [{ change: "deactivated", at: AT, byName: "Bruno", when: "8 de octubre, 12:00" }],
    });
  });

  // The database is in the EU: the person and their history are asked at once, one trip instead of two.
  it("asks the person and their history at once", async () => {
    const { deps, manager } = theTeam();
    const { held, askedBeforeAnyAnswer } = holdingAnswers(deps);
    const viewing = viewTeamMember({ actor: manager, memberId: "ana", now: AT }, exampleCafe, held);
    expect(await askedBeforeAnyAnswer()).toEqual(["staff.findProfile", "staff.history"]);
    expect((await viewing).result).toBe("ok");
  });

  it("another manager is only seen", async () => {
    const { deps, manager } = theTeam();
    expect(
      await viewTeamMember({ actor: manager, memberId: "carla", now: AT }, exampleCafe, deps),
    ).toMatchObject({
      canChange: false,
    });
  });

  it("someone who doesn't exist isn't found", async () => {
    const { deps, manager } = theTeam();
    expect(
      await viewTeamMember({ actor: manager, memberId: "nadie", now: AT }, exampleCafe, deps),
    ).toEqual({
      result: "not-found",
    });
  });

  it("a barista can't see it", async () => {
    const { deps, barista } = theTeam();
    expect(
      await viewTeamMember({ actor: barista, memberId: "beto", now: AT }, exampleCafe, deps),
    ).toEqual({
      result: "forbidden",
    });
  });
});

describe("change a barista's name or email", () => {
  it("changes both, and records each change", async () => {
    const { team, deps, manager } = theTeam();
    const result = await changeTeamMember(
      { actor: manager, memberId: "ana", name: "Ana María", email: "anam@example.com", at: AT },
      deps,
    );
    expect(result).toEqual({ result: "changed" });
    expect(team.stored.get("ana")).toMatchObject({ name: "Ana María", email: "anam@example.com" });
    expect(team.audit.map((a) => a.change)).toEqual(["name-changed", "email-changed"]);
  });

  it("only what changed is recorded", async () => {
    const { team, deps, manager } = theTeam();
    await changeTeamMember(
      { actor: manager, memberId: "ana", name: "Ana María", email: "ana@example.com", at: AT },
      deps,
    );
    expect(team.audit.map((a) => a.change)).toEqual(["name-changed"]);
  });

  it("without changes, nothing is recorded", async () => {
    const { team, deps, manager } = theTeam();
    await changeTeamMember(
      { actor: manager, memberId: "ana", name: "Ana", email: "ana@example.com", at: AT },
      deps,
    );
    expect(team.audit).toEqual([]);
  });

  it("another person's email isn't taken", async () => {
    const { team, deps, manager } = theTeam();
    expect(
      await changeTeamMember(
        { actor: manager, memberId: "ana", name: "Ana", email: "beto@example.com", at: AT },
        deps,
      ),
    ).toMatchObject({ field: "email", message: "Ya hay alguien del equipo con ese email." });
    expect(team.stored.get("ana")?.email).toBe("ana@example.com");
  });

  it("another manager can't be changed", async () => {
    const { deps, manager } = theTeam();
    expect(
      await changeTeamMember(
        { actor: manager, memberId: "carla", name: "Carla", email: "c@example.com", at: AT },
        deps,
      ),
    ).toEqual({ result: "forbidden" });
  });

  it("the manager can't change themselves", async () => {
    const { deps, manager } = theTeam();
    expect(
      await changeTeamMember(
        { actor: manager, memberId: "bruno", name: "Bru", email: "bruno@example.com", at: AT },
        deps,
      ),
    ).toEqual({ result: "forbidden" });
  });
});

describe("a new PIN for a barista", () => {
  it("is made up by the app and shown once; the one they had stops working", async () => {
    const { team, pins, deps, manager } = theTeam();
    const result = await newPinFor({ actor: manager, memberId: "ana", at: AT }, deps);
    expect(result).toEqual({
      result: "new-pin",
      pin: pins.given[0],
      name: "Ana",
      email: "ana@example.com",
    });
    expect(team.stored.get("ana")?.pinHmac).toBe(fakePinHmac("ana", pins.given[0]));
  });

  it("unlocks them if they were locked out", async () => {
    const { team, deps, manager } = theTeam();
    team.add({
      id: "eva",
      email: "eva@example.com",
      name: "Eva",
      failedAttempts: 3,
      lockedUntil: AT,
    });
    await newPinFor({ actor: manager, memberId: "eva", at: AT }, deps);
    expect(team.stored.get("eva")).toMatchObject({ failedAttempts: 0, lockedUntil: null });
  });

  it("is recorded, without the PIN", async () => {
    const { team, deps, manager } = theTeam();
    await newPinFor({ actor: manager, memberId: "ana", at: AT }, deps);
    expect(team.audit).toEqual([{ staffId: "ana", byId: "bruno", change: "pin-reset", at: AT }]);
  });

  it("someone who no longer works there doesn't get one", async () => {
    const { team, deps, manager } = theTeam();
    team.add({ id: "dani", email: "dani@example.com", name: "Dani", deactivatedAt: AT });
    expect(await newPinFor({ actor: manager, memberId: "dani", at: AT }, deps)).toEqual({
      result: "inactive",
    });
  });

  it("the manager can't make one for themselves: the developers do, with the script", async () => {
    const { deps, manager } = theTeam();
    expect(await newPinFor({ actor: manager, memberId: "bruno", at: AT }, deps)).toEqual({
      result: "forbidden",
    });
  });
});

describe("deactivate and reactivate", () => {
  it("deactivating keeps the person, with the date they stopped", async () => {
    const { team, deps, manager } = theTeam();
    expect(
      await setActive({ actor: manager, memberId: "ana", active: false, at: AT }, deps),
    ).toEqual({
      result: "changed",
    });
    expect(team.stored.get("ana")?.deactivatedAt).toEqual(AT);
  });

  it("reactivating lets them in again", async () => {
    const { team, deps, manager } = theTeam();
    await setActive({ actor: manager, memberId: "ana", active: false, at: AT }, deps);
    await setActive({ actor: manager, memberId: "ana", active: true, at: AT }, deps);
    expect(team.stored.get("ana")?.deactivatedAt).toBeNull();
    expect(team.audit.map((a) => a.change)).toEqual(["deactivated", "reactivated"]);
  });

  it("tapping it twice records it once", async () => {
    const { team, deps, manager } = theTeam();
    await setActive({ actor: manager, memberId: "ana", active: false, at: AT }, deps);
    await setActive({ actor: manager, memberId: "ana", active: false, at: AT }, deps);
    expect(team.audit).toHaveLength(1);
  });

  it("the manager can't deactivate themselves", async () => {
    const { deps, manager } = theTeam();
    expect(
      await setActive({ actor: manager, memberId: "bruno", active: false, at: AT }, deps),
    ).toEqual({
      result: "forbidden",
    });
  });
});
