import { runMigrations } from "./migrations.js";

export async function setup() {
  await runMigrations();
}
