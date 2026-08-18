import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function sql(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

const email = argument("--email")?.trim().toLowerCase();
const name = argument("--name")?.trim();
const remote = process.argv.includes("--remote");
const environment = argument("--env") ?? (remote ? "production" : undefined);
const password = process.env.PMP_ALPHA_PASSWORD;

if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("请提供有效的 --email");
if (!name || name.length > 80) throw new Error("请提供 1–80 字符的 --name");
if (!password || password.length < 12 || password.length > 256) throw new Error("请通过 PMP_ALPHA_PASSWORD 环境变量提供 12–256 字符密码");

const salt = randomBytes(16);
const iterations = 120_000;
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
const encoded = `pbkdf2-sha256$${iterations}$${salt.toString("base64")}$${hash.toString("base64")}`;
const command = `INSERT INTO users (id, email, display_name, password_hash, verified) VALUES (${sql(randomUUID())}, ${sql(email)}, ${sql(name)}, ${sql(encoded)}, 1) ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, password_hash = excluded.password_hash, verified = 1, updated_at = CURRENT_TIMESTAMP;`;

const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error("请通过 pnpm user:create 运行此脚本");
const args = [pnpmCli, "--filter", "@pmp/web", "exec", "wrangler", "d1", "execute", "DB", remote ? "--remote" : "--local", "--command", command];
if (environment) args.splice(args.length - 2, 0, "--env", environment);
const result = spawnSync(process.execPath, args, { cwd: process.cwd(), stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`账号 ${email} 已写入 ${remote ? environment ?? "production" : "local"} D1。`);

