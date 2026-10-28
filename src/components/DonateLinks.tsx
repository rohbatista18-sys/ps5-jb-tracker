import type { DonationLink } from "@/lib/types";
import { fill, type Dictionary } from "@/i18n/dictionaries";
import CopyButton from "./CopyButton";
import styles from "./DonateLinks.module.css";

const shorten = (v: string) => (v.length > 14 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v);

interface Props {
  nickname: string;
  donations: DonationLink[];
  hasNote?: boolean;
  dict: Dictionary["donate"];
  newTab: string;
}

export default function DonateLinks({ nickname, donations, hasNote, dict, newTab }: Props) {
  return (
    <div className={styles.donate} aria-label={fill(dict.supportName, { name: nickname })} role="group">
      <span className={styles.heading} aria-hidden="true">
        {dict.support}
      </span>
      {donations.length > 0 && (
      <ul className={styles.list}>
        {donations.map((d) => (
          <li key={d.label} className={styles.item}>
            {d.url ? (
              <a
                className={`px-btn ${styles.link}`}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                data-kind={d.label.toLowerCase()}
              >
                {d.label}
                <span aria-hidden="true">↗</span>
                <span className="sr-only"> {newTab}</span>
              </a>
            ) : d.value ? (
              <span className={styles.crypto}>
                <span className={styles.cryptoLabel}>{d.label}</span>
                <code className={styles.address} title={d.value}>
                  {shorten(d.value)}
                </code>
                <CopyButton
                  value={d.value}
                  ariaLabel={fill(dict.copyAria, { label: fill(dict.address, { label: d.label }), value: d.value })}
                  text={dict}
                  className={`px-btn ${styles.copy}`}
                />
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      )}
      {hasNote && <p className={styles.note}>{dict.noDonation}</p>}
      {donations.length > 0 && <p className={styles.purpose}>{dict.purpose}</p>}
    </div>
  );
}
