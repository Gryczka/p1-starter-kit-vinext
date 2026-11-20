import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { startFixture } from "./content.mjs";

const sample = await startFixture();
const dir = await mkdtemp(join(tmpdir(), "p1-vinext-demo-"));
const envFile = join(dir, "sample.env");
let child;
const stop = () => child?.kill("SIGTERM");
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

async function run(command, args) {
  child = spawn(command, args, {
    env: { ...process.env, ...sample.env, WRANGLER_SEND_METRICS: "false" },
    stdio: "inherit",
  });
  const [code, signal] = await once(child, "exit");
  child = undefined;
  if (signal || code !== 0) throw new Error(command + " exited with " + (signal ?? code));
}

try {
  await writeFile(envFile, Object.entries(sample.env).map(([name, value]) => name + "=" + JSON.stringify(value)).join("\n") + "\n", {mode: 0o600});
  await run("pnpm", ["run", "build:workers"]);
  const port = Number(process.env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Set PORT to a valid TCP port.");
  console.log("Open http://127.0.0.1:" + port + "/guides/workers and expand Runtime.");
  await run("pnpm", ["exec", "wrangler", "dev", "--local", "--ip", "127.0.0.1", "--port", String(port), "--env-file", envFile, "--config", ".p1-output/server/wrangler.json"]);
} finally {
  await sample.close();
  await rm(dir, {recursive: true, force: true});
}
