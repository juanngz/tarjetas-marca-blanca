import { describe, expect, it } from "vitest";
import { statusOf } from "../../test/routes";
import { formOf, formText } from "./form";

describe("read a form field", () => {
  it("returns what was typed", () => {
    const form = new FormData();
    form.append("name", "Marta García");
    expect(formText(form, "name")).toBe("Marta García");
  });

  it("a missing field comes as null", () => {
    expect(formText(new FormData(), "name")).toBeNull();
  });

  it("a file comes as null", () => {
    const form = new FormData();
    form.append("name", new Blob(["x"]));
    expect(formText(form, "name")).toBeNull();
  });
});

describe("read what a phone sent", () => {
  const sent = (body: string, type: string) =>
    new Request("https://club.example.test/register", {
      method: "POST",
      body,
      headers: { "Content-Type": type },
    });

  it("a form comes as is", async () => {
    const form = await formOf(sent("code=K7M2QX", "application/x-www-form-urlencoded"));
    expect(formText(form, "code")).toBe("K7M2QX");
  });

  it.each([
    ["JSON", '{"code":"K7M2QX"}', "application/json"],
    ["plain text", "code=K7M2QX", "text/plain"],
    ["a broken multipart", "--x\r\n", "multipart/form-data; boundary=y"],
  ])("%s isn't a form: a 400, never a server error", async (_, body, type) => {
    const thrown = await formOf(sent(body, type)).catch((error: unknown) => error);
    expect(statusOf(thrown)).toBe(400);
  });
});
