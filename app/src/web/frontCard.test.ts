import { describe, expect, it } from "vitest";
import { onlyFrontChanges, revalidateUnlessOnlyFrontChanges } from "./frontCard";

describe("bring another card to the front", () => {
  const changes = (from: string, to: string) =>
    onlyFrontChanges(
      new URL(from, "https://club.example.test"),
      new URL(to, "https://club.example.test"),
    );

  it("from one chosen card to another, only the front changes", () => {
    expect(changes("/cards?front=take-away", "/cards?front=beans-half")).toBe(true);
  });

  it("from the cards with none chosen, too", () => {
    expect(changes("/cards", "/cards?front=beans-half")).toBe(true);
  });

  it("the same URL isn't a card change", () => {
    expect(changes("/cards?front=take-away", "/cards?front=take-away")).toBe(false);
  });

  it("going to another screen isn't a card change", () => {
    expect(changes("/cards?front=take-away", "/cards/take-away")).toBe(false);
  });

  it("if something else in the URL changes, it's not just a card change", () => {
    expect(changes("/cards?front=take-away&other=1", "/cards?front=beans-half")).toBe(false);
  });
});

describe("revalidate the customer's screens", () => {
  const args = (from: string, to: string) => ({
    currentUrl: new URL(from, "https://club.example.test"),
    nextUrl: new URL(to, "https://club.example.test"),
    currentParams: {},
    nextParams: {},
    defaultShouldRevalidate: true,
  });

  it("bringing another card to the front doesn't ask the server", () => {
    expect(revalidateUnlessOnlyFrontChanges(args("/cards", "/cards?front=beans-half"))).toBe(false);
  });

  it("anything else does what React Router would do", () => {
    expect(revalidateUnlessOnlyFrontChanges(args("/cards", "/cards/take-away"))).toBe(true);
  });
});
