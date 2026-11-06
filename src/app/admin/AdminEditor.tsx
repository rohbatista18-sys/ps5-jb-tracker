"use client";

import { useState, useTransition } from "react";
import type { AuditEntry, SiteConfig } from "@/lib/site-config";
import type { DonationLink, Localized, RepoConfig } from "@/lib/types";
import { saveNotices, saveResearchers, type SaveResult } from "./actions";
import styles from "./admin.module.css";

const LOCALES = ["pt", "en", "es", "fr"] as const;
const LOCALE_LABEL = { pt: "Português", en: "English", es: "Español", fr: "Français" } as const;

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20) || "dev";

const STORE_ERRORS: Record<string, string> = {
  session: "Sua sessão expirou. Recarregue a página e entre de novo.",
  store: "Não foi possível salvar no banco. Tente de novo.",
};

function Status({ result }: { result: SaveResult | null }) {
  if (!result) return null;
  return result.ok ? (
    <p className={styles.ok} role="status">
      Salvo. O site já mostra a mudança.
    </p>
  ) : (
    <p className={styles.error} role="alert">
      {STORE_ERRORS[result.error] ?? `Não salvo: ${result.error}`}
    </p>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{props.label}</span>
      <input
        className={styles.input}
        value={props.value}
        placeholder={props.placeholder}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.hint && <span className={styles.hint}>{props.hint}</span>}
    </label>
  );
}

// ---------- researchers ----------

function DonationRow({ d, onChange, onRemove }: { d: DonationLink; onChange: (d: DonationLink) => void; onRemove: () => void }) {
  const isCrypto = d.value !== undefined;
  return (
    <div className={styles.donation}>
      <Field label="Nome" value={d.label} onChange={(label) => onChange({ ...d, label })} placeholder="Ko-fi" />
      {isCrypto ? (
        <Field label="Endereço (cripto)" value={d.value ?? ""} onChange={(value) => onChange({ label: d.label, value })} />
      ) : (
        <Field label="Link https://" value={d.url ?? ""} onChange={(url) => onChange({ label: d.label, url })} />
      )}
      <button type="button" className={styles.small} onClick={onRemove}>
        Remover link
      </button>
    </div>
  );
}

function ResearcherEditor(props: {
  dev: RepoConfig;
  isNew: boolean;
  index: number;
  count: number;
  onChange: (d: RepoConfig) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const { dev, onChange } = props;
  const setDonation = (i: number, d: DonationLink) =>
    onChange({ ...dev, donations: dev.donations.map((x, j) => (j === i ? d : x)) });
  return (
    <fieldset className={styles.card}>
      <legend className={styles.legend}>
        {props.index + 1}. {dev.nickname || "Novo pesquisador"}
      </legend>
      <div className={styles.grid}>
        <Field
          label="Nome no GitHub"
          value={dev.nickname}
          onChange={(nickname) => onChange({ ...dev, nickname, ...(props.isNew ? { id: slug(nickname) } : {}) })}
          hint="Exatamente como no GitHub."
        />
        <Field
          label="Dono do repositório"
          value={dev.owner}
          onChange={(owner) => onChange({ ...dev, owner })}
        />
        <Field label="Repositório" value={dev.repo} onChange={(repo) => onChange({ ...dev, repo })} placeholder="PS5-14.10-Research" />
        <Field
          label="Perfil no X (sem @)"
          value={dev.x ?? ""}
          onChange={(x) => onChange({ ...dev, x })}
          hint="Deixe vazio se não tiver."
        />
        <Field
          label="ID interno"
          value={dev.id}
          onChange={(id) => onChange({ ...dev, id })}
          disabled={!props.isNew}
          hint={props.isNew ? "Não muda depois de salvo (guarda reações e resumos)." : "Fixo: guarda reações e resumos."}
        />
        <Field
          label="Nota quando não há doação"
          value={dev.donationNote ?? ""}
          onChange={(donationNote) => onChange({ ...dev, donationNote })}
        />
      </div>

      <div className={styles.donations}>
        <span className={styles.fieldLabel}>Links de doação</span>
        {dev.donations.map((d, i) => (
          <DonationRow
            key={i}
            d={d}
            onChange={(nd) => setDonation(i, nd)}
            onRemove={() => onChange({ ...dev, donations: dev.donations.filter((_, j) => j !== i) })}
          />
        ))}
        <div className={styles.row}>
          <button type="button" className={styles.small} onClick={() => onChange({ ...dev, donations: [...dev.donations, { label: "", url: "" }] })}>
            + Link
          </button>
          <button type="button" className={styles.small} onClick={() => onChange({ ...dev, donations: [...dev.donations, { label: "BTC", value: "" }] })}>
            + Endereço cripto
          </button>
        </div>
      </div>

      <div className={styles.row}>
        <button type="button" className={styles.small} disabled={props.index === 0} onClick={() => props.onMove(-1)}>
          ▲ Subir
        </button>
        <button type="button" className={styles.small} disabled={props.index === props.count - 1} onClick={() => props.onMove(1)}>
          ▼ Descer
        </button>
        <button type="button" className={`${styles.small} ${styles.danger}`} disabled={props.count <= 1} onClick={props.onRemove}>
          Remover pesquisador
        </button>
      </div>
    </fieldset>
  );
}

function Researchers({ initial }: { initial: RepoConfig[] }) {
  const [devs, setDevs] = useState(initial);
  const [savedIds, setSavedIds] = useState(() => new Set(initial.map((d) => d.id)));
  const [result, setResult] = useState<SaveResult | null>(null);
  const [pending, start] = useTransition();

  const update = (i: number, d: RepoConfig) => setDevs((all) => all.map((x, j) => (j === i ? d : x)));
  const move = (i: number, delta: number) =>
    setDevs((all) => {
      const next = [...all];
      const [d] = next.splice(i, 1);
      next.splice(i + delta, 0, d);
      return next;
    });

  return (
    <section className={styles.section} aria-labelledby="sec-devs">
      <h2 id="sec-devs" className={styles.h2}>
        Pesquisadores
      </h2>
      <p className={styles.hint}>Ordem, repositórios, perfis do X e links de doação dos cards da página inicial.</p>
      {devs.map((d, i) => (
        <ResearcherEditor
          key={i}
          dev={d}
          isNew={!savedIds.has(d.id)}
          index={i}
          count={devs.length}
          onChange={(nd) => update(i, nd)}
          onMove={(delta) => move(i, delta)}
          onRemove={() => {
            if (confirm(`Remover ${d.nickname} do site?`)) setDevs((all) => all.filter((_, j) => j !== i));
          }}
        />
      ))}
      <div className={styles.row}>
        <button
          type="button"
          className={styles.small}
          onClick={() => setDevs((all) => [...all, { id: "", nickname: "", owner: "", repo: "", donations: [] }])}
        >
          + Adicionar pesquisador
        </button>
        <button
          type="button"
          className={`px-btn ${styles.save}`}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveResearchers(devs);
              setResult(r);
              if (r.ok) setSavedIds(new Set(devs.map((d) => d.id)));
            })
          }
        >
          {pending ? "Salvando…" : "Salvar pesquisadores"}
        </button>
      </div>
      <Status result={result} />
    </section>
  );
}

// ---------- notices ----------

function LocalizedFields({ label, value, onChange }: { label: string; value: Localized; onChange: (v: Localized) => void }) {
  return (
    <div className={styles.grid}>
      {LOCALES.map((l) => (
        <Field key={l} label={`${label} · ${LOCALE_LABEL[l]}`} value={value[l]} onChange={(v) => onChange({ ...value, [l]: v })} />
      ))}
    </div>
  );
}

function Notices({ initial }: { initial: SiteConfig["notices"] }) {
  const [n, setN] = useState(initial);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <section className={styles.section} aria-labelledby="sec-notices">
      <h2 id="sec-notices" className={styles.h2}>
        Avisos
      </h2>

      <fieldset className={styles.card}>
        <legend className={styles.legend}>Aviso do guia (topo da página)</legend>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={n.guide.enabled}
            onChange={(e) => setN({ ...n, guide: { ...n.guide, enabled: e.target.checked } })}
          />
          Mostrar o aviso
        </label>
        <Field label="Link do guia (https://)" value={n.guide.url} onChange={(url) => setN({ ...n, guide: { ...n.guide, url } })} />
        <LocalizedFields label="Texto" value={n.guide.text} onChange={(text) => setN({ ...n, guide: { ...n.guide, text } })} />
        <LocalizedFields label="Texto do link" value={n.guide.link} onChange={(link) => setN({ ...n, guide: { ...n.guide, link } })} />
      </fieldset>

      <fieldset className={styles.card}>
        <legend className={styles.legend}>Faixa do aviãozinho</legend>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={n.banner.enabled}
            onChange={(e) => setN({ ...n, banner: { ...n.banner, enabled: e.target.checked } })}
          />
          Mostrar o avião com a faixa
        </label>
        <LocalizedFields label="Frase principal" value={n.banner.title} onChange={(title) => setN({ ...n, banner: { ...n.banner, title } })} />
        <LocalizedFields
          label="Complemento"
          value={n.banner.subtitle}
          onChange={(subtitle) => setN({ ...n, banner: { ...n.banner, subtitle } })}
        />
      </fieldset>

      <button
        type="button"
        className={`px-btn ${styles.save}`}
        disabled={pending}
        onClick={() => start(async () => setResult(await saveNotices(n)))}
      >
        {pending ? "Salvando…" : "Salvar avisos"}
      </button>
      <Status result={result} />
    </section>
  );
}

// ---------- audit ----------

function Audit({ entries }: { entries: AuditEntry[] }) {
  const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
  return (
    <section className={styles.section} aria-labelledby="sec-audit">
      <h2 id="sec-audit" className={styles.h2}>
        Histórico
      </h2>
      {entries.length ? (
        <ol className={styles.audit}>
          {entries.slice(0, 20).map((e, i) => (
            <li key={i}>
              <time dateTime={e.at}>{fmt.format(new Date(e.at))}</time> · @{e.by} ·{" "}
              {e.section === "researchers" ? "Pesquisadores" : "Avisos"}: {e.summary}
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.hint}>Nenhuma alteração ainda. Até a primeira, o site usa os valores originais.</p>
      )}
    </section>
  );
}

export default function AdminEditor({ initial, audit }: { initial: SiteConfig; audit: AuditEntry[] }) {
  return (
    <>
      <Researchers initial={initial.researchers} />
      <Notices initial={initial.notices} />
      <Audit entries={audit} />
    </>
  );
}
