import { Suspense } from "react";
import { adminConfigured, getAdminSession } from "@/lib/admin-auth";
import { getAudit, loadSiteConfig } from "@/lib/site-config";
import { hasSupabase } from "@/lib/supabase";
import AdminEditor from "./AdminEditor";
import styles from "./admin.module.css";

const ERRORS: Record<string, string> = {
  config: "O login de admin ainda não está configurado no servidor.",
  login: "Usuário ou senha incorretos.",
  wait: "Muitas tentativas. Espere 15 minutos e tente de novo.",
};

async function Admin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const error = (await searchParams).error;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  if (!adminConfigured()) {
    return (
      <section className={styles.box}>
        <h2 className={styles.h2}>Admin não configurado</h2>
        <p>
          Para ativar o login, defina no servidor as variáveis <code>ADMIN_USERS</code> (gerada com{" "}
          <code>node scripts/admin-password.mjs</code>) e <code>ADMIN_SESSION_SECRET</code> (32+ caracteres).
        </p>
      </section>
    );
  }

  const session = await getAdminSession();
  if (!session) {
    return (
      <section className={styles.box}>
        <h2 className={styles.h2}>Entrar</h2>
        {message && (
          <p className={styles.error} role="alert">
            {message}
          </p>
        )}
        <form action="/api/admin/login" method="post" className={styles.loginForm}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Usuário</span>
            <input className={styles.input} name="user" autoComplete="username" required maxLength={60} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Senha</span>
            <input
              className={styles.input}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={200}
            />
          </label>
          <button type="submit" className={`px-btn ${styles.login}`}>
            Entrar
          </button>
        </form>
      </section>
    );
  }

  const [config, audit] = await Promise.all([loadSiteConfig(), getAudit()]);
  return (
    <>
      <div className={styles.session}>
        <span>
          Conectado como <strong>@{session.login}</strong>
        </span>
        {!hasSupabase() && <span className={styles.warn}>Sem banco: alterações ficam só na memória deste servidor.</span>}
        <form action="/api/admin/logout" method="post">
          <button type="submit" className={styles.linkButton}>
            Sair
          </button>
        </form>
      </div>
      <AdminEditor initial={config} audit={audit} />
    </>
  );
}

export default function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <main className={styles.page}>
      <h1 className={styles.h1}>Painel admin</h1>
      <Suspense fallback={<p>Carregando…</p>}>
        <Admin searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
