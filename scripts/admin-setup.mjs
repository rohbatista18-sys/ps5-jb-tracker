// One-step admin setup: asks for each admin's username and password (hidden), builds ADMIN_USERS
// (scrypt hashes) and a fresh ADMIN_SESSION_SECRET, and saves both to Vercel → Production via the
// Vercel CLI. Nothing secret is printed or written to disk; values go to the CLI through stdin.
// Run from the project folder: `node scripts/admin-setup.mjs` (you must be logged in to Vercel).
// Afterwards redeploy so the new variables take effect.
import { spawn } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import { stdin, stdout } from "node:process";
import readline from "node:readline";

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }; // must match src/lib/admin-auth.ts

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) stdout.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) stdout.write("\n");
      resolve(answer);
    });
  });
}

/** `vercel env add NAME production --sensitive --force`, value sent on stdin (not in the args). */
function setVercelEnv(name, value) {
  return new Promise((resolve, reject) => {
    // One fixed command string (name is one of our two constants), so nothing user-typed is ever
    // passed through the shell; the value itself only travels on stdin.
    const child = spawn(`npx --yes vercel@latest env add ${name} production --sensitive --force`, {
      shell: true,
      stdio: ["pipe", "ignore", "pipe"],
    });
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.trim().split("\n").pop() || `exit ${code}`))));
    child.stdin.end(`${value}\n`);
  });
}

console.log("Configuração do admin. Deixe o usuário em branco para terminar.\n");
const entries = [];
for (;;) {
  const name = (await ask(`Usuário ${entries.length + 1}: `)).trim();
  if (!name) break;
  if (!/^[A-Za-z0-9_.-]{2,40}$/.test(name)) {
    console.log("  Usuário inválido: 2 a 40 letras, números, _ . ou -");
    continue;
  }
  if (entries.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
    console.log("  Esse usuário já foi adicionado.");
    continue;
  }
  const password = await ask("  Senha (não aparece): ", true);
  const again = await ask("  Repita a senha: ", true);
  if (password !== again) {
    console.log("  As senhas não conferem. Tente esse usuário de novo.");
    continue;
  }
  if (password.length < 12) {
    console.log("  Use pelo menos 12 caracteres. Tente esse usuário de novo.");
    continue;
  }
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, SCRYPT);
  entries.push({ name, line: `${name}:${salt.toString("base64url")}:${hash.toString("base64url")}` });
  console.log(`  ${name} adicionado.\n`);
}

if (!entries.length) {
  console.log("Nenhum usuário. Nada foi alterado.");
  process.exit(0);
}

const confirm = (await ask(`\nSalvar ${entries.map((e) => e.name).join(", ")} na Vercel (Production)? [s/N] `)).trim().toLowerCase();
if (confirm !== "s" && confirm !== "sim") {
  console.log("Cancelado. Nada foi alterado.");
  process.exit(0);
}

try {
  await setVercelEnv("ADMIN_USERS", entries.map((e) => e.line).join(","));
  console.log("ADMIN_USERS salvo.");
  await setVercelEnv("ADMIN_SESSION_SECRET", randomBytes(32).toString("base64url"));
  console.log("ADMIN_SESSION_SECRET salvo (novo; sessões antigas deixam de valer).");
  console.log("\nPronto. Agora é só publicar de novo para valer.");
} catch (e) {
  console.error(`\nFalhou ao salvar na Vercel: ${e.message}`);
  console.error("Confira se você está logado (npx vercel login) e rodando dentro da pasta do projeto.");
  process.exit(1);
}
