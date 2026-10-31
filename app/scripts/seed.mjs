// Made-up data for the local database: never real data (CLAUDE.md).
// - Marta García, DNI 30.123.456, with an empty card of each kind the café has: to sign in as a customer.
// - Ana, barista, ana@example.com, PIN 428613: to sign in at the register (/register).
// - Bruno, manager, bruno@example.com, PIN 517284: to manage the team (/register/team).
// The hashes are computed with the keys in .dev.vars, like the app does: that's why it's a script and not a
// seed.sql. Only touches a local database: the one you develop with or, with --persist-to, another one
// (the end-to-end tests use .wrangler/e2e). Can be run again: what already exists stays as it was.
// Run with tsx, to use the app's own rules and hashes: npm run db:seed
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { argv } from "node:process";
import { activeCafe } from "../src/cafes";
import { nameForSearch } from "../src/core/search";
import { randomCodeGenerator } from "../src/platform/codes.server";
import { hmacDocumentHasher } from "../src/platform/security/documentHasher.server";
import { pinHmac } from "../src/platform/security/staffPin.server";

const MARTA = { id: "00000000-0000-4000-8000-000000000001", name: "Marta García", dni: "30123456" };
const ANA = {
  id: "00000000-0000-4000-8000-000000000101",
  email: "ana@example.com",
  name: "Ana",
  role: "barista",
  pin: "428613",
};
const BRUNO = {
  id: "00000000-0000-4000-8000-000000000102",
  email: "bruno@example.com",
  name: "Bruno",
  role: "manager",
  pin: "517284",
};

const persistTo = argv.includes("--persist-to") ? argv[argv.indexOf("--persist-to") + 1] : null;

function key(name) {
  const line = readFileSync(".dev.vars", "utf8")
    .split("\n")
    .find((row) => row.startsWith(`${name}=`));
  if (!line) {
    console.error(`Falta ${name} en .dev.vars. Corré npm run setup.`);
    process.exit(1);
  }
  return line.slice(name.length + 1).trim();
}

const now = Date.now();
const dniHmac = await hmacDocumentHasher(key("DNI_HMAC_KEY")).hmac("dni", MARTA.dni);
const staffRow = async (member) =>
  `('${member.id}', '${member.email}', '${member.name}', '${member.role}', '${await pinHmac(key("PIN_HMAC_KEY"), member.id, member.pin)}', ${now})`;

// OR IGNORE: if it's already there (or Marta signed up from the app with the same DNI), it stays as it was.
// Her cards only go in if this Marta was created.
const statements = [
  `INSERT OR IGNORE INTO customers (id, dni_hmac, name, name_search, created_at) VALUES ('${MARTA.id}', '${dniHmac}', '${MARTA.name}', '${nameForSearch(MARTA.name)}', ${now})`,
  // A Marta from before name_search: the register finds her by name too.
  `UPDATE customers SET name_search = '${nameForSearch(MARTA.name)}' WHERE id = '${MARTA.id}' AND name_search IS NULL`,
  ...activeCafe.cards.map(
    (card, i) =>
      `INSERT OR IGNORE INTO cards (id, customer_id, type, qr_code, short_code, created_at)
       SELECT '00000000-0000-4000-8000-00000000001${i + 1}', '${MARTA.id}', '${card.type}',
         '${randomCodeGenerator.qrCode()}', '${randomCodeGenerator.shortCode()}', ${now}
       WHERE EXISTS (SELECT 1 FROM customers WHERE id = '${MARTA.id}')`,
  ),
  `INSERT OR IGNORE INTO staff (id, email, name, role, pin_hmac, created_at) VALUES ${await staffRow(ANA)}, ${await staffRow(BRUNO)}`,
];

execFileSync(
  "npx",
  [
    "wrangler",
    "d1",
    "execute",
    "DB",
    "-c",
    "wrangler.jsonc",
    "--local",
    ...(persistTo ? ["--persist-to", persistTo] : []),
    "--command",
    `${statements.join(";\n")};`,
  ],
  { stdio: persistTo ? "ignore" : "inherit" },
);

console.log("\nDatos inventados listos:");
console.log("- Cliente: Marta García, DNI 30.123.456 (en /).");
console.log("- Caja: Ana, barista, ana@example.com, PIN 428613 (en /register).");
console.log("- Equipo: Bruno, gerente, bruno@example.com, PIN 517284 (en /register/team).");
console.log("Si ya existían, quedaron como estaban.");
