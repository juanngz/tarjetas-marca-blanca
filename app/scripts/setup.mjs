// Leaves the project ready for `npm run dev`. Can be run as many times as needed.
// See ../README.md, "Levantar el proyecto".
import { execSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, readFileSync } from "node:fs";

const run = (command) => execSync(command, { stdio: "inherit" });

run("npm install");

/** The variables in a file like .dev.vars: NAME=value, without the comments. */
function variables(file) {
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
}

if (existsSync(".dev.vars")) {
  // If the example gained new variables, the missing ones are added. The existing ones aren't touched.
  const example = variables(".dev.vars.example");
  const current = variables(".dev.vars");
  const missing = Object.keys(example).filter((name) => !(name in current));
  if (missing.length > 0) {
    appendFileSync(
      ".dev.vars",
      `\n${missing.map((name) => `${name}=${example[name]}`).join("\n")}\n`,
    );
    console.log(`Sumadas a .dev.vars: ${missing.join(", ")}.`);
  } else {
    console.log(".dev.vars ya existe y está completo: no se toca.");
  }
} else {
  copyFileSync(".dev.vars.example", ".dev.vars");
  console.log("Copiado .dev.vars.example a .dev.vars (claves de prueba).");
}

// Local database: only on this computer, never Cloudflare's.
run("npm run db:migrate:local");

// Cloudflare and route types.
run("npm run typegen");

console.log("\nListo. Ahora: npm run dev");
