// Deletes the local database and creates it again from the migrations.
// Only touches the local copy (.wrangler/state), never dev or prod.
// For when the local database broke or when switching to a branch with other migrations.
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const run = (command) => execSync(command, { stdio: "inherit" });

rmSync(".wrangler/state/v3/d1", { recursive: true, force: true });
console.log("Base local borrada.");

run("npm run db:migrate:local");

// Made-up data: Marta García (30.123.456) and Ana, barista. Never real data.
run("npm run db:seed");

console.log("\nBase local lista.");
