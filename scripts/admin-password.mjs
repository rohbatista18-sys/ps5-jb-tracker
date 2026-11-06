// Makes one ADMIN_USERS entry ("name:salt:hash", scrypt) for the /admin login.
// Run it on your own machine: `node scripts/admin-password.mjs`. The password is typed hidden
// and never printed or saved; only the hash is shown. Join several entries with commas and put
// the result in the ADMIN_USERS environment variable (Vercel → Settings → Environment Variables).
// Also prints a fresh random value you can use for ADMIN_SESSION_SECRET.
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

const name = (await ask("Usuário: ")).trim();
if (!/^[A-Za-z0-9_.-]{2,40}$/.test(name)) {
  console.error("Usuário inválido: use 2 a 40 letras, números, _ . ou -");
  process.exit(1);
}
const password = await ask("Senha (não aparece): ", true);
const again = await ask("Repita a senha: ", true);
if (password !== again) {
  console.error("As senhas não conferem.");
  process.exit(1);
}
if (password.length < 12) {
  console.error("Use pelo menos 12 caracteres.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64, SCRYPT);
console.log("\nEntrada para ADMIN_USERS:");
console.log(`${name}:${salt.toString("base64url")}:${hash.toString("base64url")}`);
console.log("\nSugestão de ADMIN_SESSION_SECRET (use uma só vez, para todos os usuários):");
console.log(randomBytes(32).toString("base64url"));
