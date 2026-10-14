import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";

const npmCli =
  process.env.npm_execpath ??
  resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`${args.join(" ")} exited with ${signal ?? code}.`));
      }
    });
  });
}

for (const [command, args] of [
  [process.execPath, ["scripts/deploy-local-migrations.mjs"]],
  [process.execPath, [npmCli, "run", "db:generate"]],
  [process.execPath, [npmCli, "run", "db:seed"]],
  [process.execPath, [npmCli, "run", "dev:app"]],
]) {
  try {
    await run(command, args);
  } catch (error) {
    console.error("Local development startup failed.", error);
    process.exitCode = 1;
    break;
  }
}
