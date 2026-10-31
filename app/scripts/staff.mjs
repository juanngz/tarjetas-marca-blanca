// The register staff accounts (Flujo A of the staff flows).
// Run by Juan Cruz or Eugenia, never by CI or Claude. From app/:
//   npm run staff:create        a new person: email (what they sign in with), name, role and PIN
//   npm run staff:change-pin    a new PIN for someone who already exists, looked up by email (and unlocks them)
// Needed for the first manager: after that, the manager adds the rest from the app.
// - local: does it in the local database, with the PIN_HMAC_KEY from .dev.vars.
// - dev or prod: asks for that environment's PIN_HMAC_KEY (Bitwarden) and shows the command to run it.
// Uses the same rules and the same hash as the app (runs with tsx to import the TypeScript code).
// What it prints is for the team: in Spanish.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { argv, stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { normalizeStaffEmail, validateStaffName } from "../src/core/staff";
import { validatePin } from "../src/core/staffPin";
import { pinHmac } from "../src/platform/security/staffPin.server";

const action = argv[2];
if (action !== "create" && action !== "change-pin") {
  console.error("Uso: npm run staff:create o npm run staff:change-pin");
  process.exit(1);
}

const reader = createInterface({ input: stdin, output: stdout });
// The iterator keeps lines that arrive before asking (for example, if they're pasted together).
const lines = reader[Symbol.asyncIterator]();

function exit(message) {
  console.error(`\n${message}`);
  reader.close();
  process.exit(1);
}

async function ask(text) {
  stdout.write(text);
  const { value, done } = await lines.next();
  if (done) exit("Faltan datos.");
  return value.trim();
}

/** Like ask, but without showing what's typed (PIN and keys). */
async function askHidden(text) {
  reader._writeToOutput = () => {};
  try {
    return await ask(text);
  } finally {
    delete reader._writeToOutput;
    if (stdin.isTTY) stdout.write("\n");
  }
}

function localKey() {
  const line = readFileSync(".dev.vars", "utf8")
    .split("\n")
    .find((row) => row.startsWith("PIN_HMAC_KEY="));
  if (!line) exit("Falta PIN_HMAC_KEY en .dev.vars. Corré npm run setup.");
  return line.slice("PIN_HMAC_KEY=".length).trim();
}

/** The wrangler command for an environment. In dev and prod it's only shown: a person runs it. */
function command(env, sql) {
  if (env === "local") return ["--local", "--command", sql];
  return ["--remote", ...(env === "dev" ? ["--env", "dev"] : []), "--command", `"${sql}"`];
}

/** In the local database: the person with that email, or null. Read only. */
function localMember(email) {
  const output = execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "DB",
      "-c",
      "wrangler.jsonc",
      "--local",
      "--json",
      "--command",
      `SELECT id, name, pin_hmac FROM staff WHERE email = '${email}'`,
    ],
    { encoding: "utf8" },
  );
  return JSON.parse(output)[0]?.results[0] ?? null;
}

function run(env, sql, done) {
  const options = command(env, sql);
  if (env === "local") {
    execFileSync("npx", ["wrangler", "d1", "execute", "DB", "-c", "wrangler.jsonc", ...options], {
      stdio: "inherit",
    });
    console.log(`\n${done}`);
    return;
  }
  console.log(`\nPara hacerlo en ${env}, corré desde app/:\n`);
  console.log(`npx wrangler d1 execute DB -c wrangler.jsonc ${options.join(" ")}\n`);
  console.log("Después, pasale el PIN en persona y guardalo en Bitwarden (Caja · PIN del equipo).");
}

const env = await ask("¿En qué ambiente? (local, dev o prod): ");
if (!["local", "dev", "prod"].includes(env)) exit("Tiene que ser local, dev o prod.");

// Only letters, spaces, id digits and simple emails: that way nothing typed can break the SQL.
// The email follows the same rule as the register's sign-in (core/staff.ts).
const email = normalizeStaffEmail(await ask("Email de la persona (con el que entra a la caja): "));
if (!email) exit("Ese email no parece válido. Revisalo y probá de nuevo.");

let id;
let name;
let role;
/** Locally, when changing the PIN: the hash it had, to know whether the new PIN is the same. */
let previousPinHmac;
if (action === "create") {
  if (env === "local" && localMember(email)) exit("Ya hay alguien del equipo con ese email.");
  id = crypto.randomUUID();
  // The same rule as the Equipo screen (core/staff.ts).
  const typedName = validateStaffName(
    await ask("Nombre, como se va a ver en la caja (Juan · barista): "),
  );
  if (!typedName.ok) exit("El nombre lleva solo letras y espacios (2 a 30).");
  name = typedName.name;
  // The person types it in Spanish; the database stores the role in English.
  const roles = { barista: "barista", gerente: "manager" };
  const typed = await ask("Rol (barista o gerente): ");
  if (!(typed in roles)) exit("El rol es barista o gerente.");
  role = roles[typed];
} else if (env === "local") {
  // The PIN hash has the person's id inside: the id is needed, the email isn't enough.
  const member = localMember(email);
  if (!member) exit("No hay nadie del equipo con ese email.");
  id = member.id;
  name = member.name;
  previousPinHmac = member.pin_hmac;
} else {
  // In dev and prod the script doesn't touch the database: the id is looked up by hand.
  const remote = `--remote${env === "dev" ? " --env dev" : ""}`;
  console.log(
    `\nEl id sale de: npx wrangler d1 execute DB -c wrangler.jsonc ${remote} ` +
      `--command "SELECT id, name FROM staff WHERE email = '${email}'"\n`,
  );
  id = await ask("Id de la persona: ");
  if (!/^[0-9a-f-]{36}$/.test(id)) exit("Ese id no tiene la forma de un id (36 caracteres).");
}

const pin = await askHidden("PIN de 6 números (no se ve al escribirlo): ");
const result = validatePin(pin);
if (!result.ok) {
  exit(
    result.reason === "weak"
      ? "Ese PIN es fácil de adivinar. Elegí otro."
      : "El PIN tiene que tener 6 números.",
  );
}
if ((await askHidden("Repetí el PIN: ")) !== pin) exit("Los dos PIN no coinciden.");

const key =
  env === "local" ? localKey() : await askHidden(`PIN_HMAC_KEY de ${env} (de Bitwarden): `);
if (!key) exit("Falta la clave.");
reader.close();

const hash = await pinHmac(key, id, pin);
if (action === "create") {
  run(
    env,
    `INSERT INTO staff (id, email, name, role, pin_hmac, created_at) VALUES ('${id}', '${email}', '${name}', '${role}', '${hash}', ${Date.now()});`,
    `Listo: ${name} ya puede entrar a la caja en la compu con ${email}.`,
  );
} else {
  run(
    env,
    `UPDATE staff SET pin_hmac = '${hash}', failed_attempts = 0, locked_until = NULL, updated_at = ${Date.now()} WHERE id = '${id}';`,
    // Staff sessions carry a PIN fingerprint: they only end if the PIN changes.
    hash === previousPinHmac
      ? `Listo: ${name} quedó destrabada. Es el mismo PIN que tenía, así que sus sesiones abiertas siguen; para cerrarlas, poné otro PIN.`
      : `Listo: el PIN nuevo de ${name} ya sirve en la compu. Sus sesiones abiertas se cerraron.`,
  );
  if (env !== "local") {
    console.log(
      "Si el PIN es distinto del que tenía, sus sesiones abiertas se cierran. Si es el mismo, siguen.",
    );
  }
}
