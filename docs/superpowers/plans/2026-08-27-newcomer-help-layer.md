# Newcomer Help Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an ambient, opt-in help layer for users new to the Swiss basic-insurance system — persistent one-liners and ⓘ explainers on the inputs/badges, a "how the system works" drawer, a standalone `/[locale]/how-it-works` guide page, and a dismissible first-run card — without changing the existing fast path.

**Architecture:** All copy lives in the existing `next-intl` message files under a new `help` namespace (one source, rendered by both the inline ⓘ and the guide). A small dependency-free `src/lib/help.ts` holds the term/anchor catalog and the `localStorage` first-run helpers (unit-tested in the node env like the rest of `src/lib`). New client components under `src/components/help/` render the ⓘ tooltip, the slide-over drawer, the always-present banner + first-run card, and a query-preserving "back to comparison" link. One new server route `src/app/[locale]/how-it-works/page.tsx` renders the full guide with per-locale metadata and is added to the sitemap.

**Tech Stack:** Next.js 15 App Router, `next-intl@^4.13.6`, Tailwind CSS v4 (MD3 tokens), Vitest (node environment — no jsdom, no component-render tests; logic is extracted to `src/lib` and unit-tested, components are verified by `npm run lint` + `npm run build` + manual check, matching every prior feature in this repo).

## Global Constraints

- The spec is [docs/superpowers/specs/2026-08-27-newcomer-help-layer-design.md](../specs/2026-08-27-newcomer-help-layer-design.md). `requirement.md` REQ-28/29/30 and §5.5 are already committed on this branch.
- Core Principle #4 (minimal friction) stands: everything here is ambient (persistent one-liner) or opt-in (ⓘ, guide, first-run card). Nothing adds a required step or blocks the input→results flow (spec: "Constraints").
- Core Principle #2 (pure comparison tool) stands: help content explains the system and the terms only — no insurer-specific advice, no "pick X" recommendation (REQ-30; spec: "Constraints").
- Locales: `de` (default), `fr`, `it`, `en`. Every message key must exist with identical `{placeholder}` sets in all four files — `src/messages/messages.test.ts` enforces this and is the failing test for the messages task.
- Register per locale, matching the existing catalogs: `de` informal *du*, `fr` formal *vous*, `it` informal *tu*, `en` *you*.
- `formatChf` and all currency rendering are unchanged and locale-independent (requirement.md §9).
- Locale-aware links use `Link` / `usePathname` / `useRouter` from `@/i18n/navigation`, never `next/link` or `next/navigation` directly (except `useSearchParams`, which has no next-intl equivalent and is read directly, as `LanguageSwitcher.tsx` already does).
- `/admin`, `/admin/login`, `/api/**` are untouched.
- Tailwind: use the MD3 token utilities (`bg-primary-container`, `text-on-surface-variant`, `border-outline-variant`, `text-body-small`, …) defined in `src/app/globals.css`. No raw hex. Match the arbitrary-variant style already in the codebase, e.g. `list-none [&::-webkit-details-marker]:hidden` and `[details[open]_&]:before:content-['▾']` (see `CurrentPlanSection.tsx`).
- Commit after every task with the message shown in its final step.

---

## Task 1: `help` message namespace + how-it-works metadata keys (all four locales)

**Files:**
- Modify: `src/messages/de.json`, `src/messages/fr.json`, `src/messages/it.json`, `src/messages/en.json`
- Test: `src/messages/messages.test.ts` (existing, unmodified — it already asserts key + placeholder parity across all four files)

**Interfaces:**
- Produces: a `help` namespace and two new `meta` keys (`howItWorksTitle`, `howItWorksDescription`) consumed by every later task. Key shape (identical in all four files):
  - `meta.howItWorksTitle`, `meta.howItWorksDescription`
  - `help.tip.openLabel`, `help.tip.fullLink`
  - `help.terms.plz.{title,oneLiner,short}`
  - `help.terms.birthYear.{title,short}`  *(no `oneLiner` — the field keeps its existing dynamic hint)*
  - `help.terms.franchise.{title,oneLiner,short}`
  - `help.terms.models.{title,short}`
  - `help.banner.{text,cta}`
  - `help.firstRun.{text,cta,dismiss}`
  - `help.drawer.{title,close,readFull}`
  - `help.guide.{lead,back}`
  - `help.guide.rules.{heading,item1,item2,item3,item4}`
  - `help.guide.terms.{heading,intro}`
  - `help.guide.models.{heading,body}`
- No placeholders appear in any of these strings, so `messages.test.ts`'s placeholder check just requires the same key set everywhere.

- [ ] **Step 1: Run the parity test to confirm the starting state is green**

Run: `npm test -- messages`
Expected: PASS (baseline).

- [ ] **Step 2: Add the keys to `src/messages/de.json`**

Insert a `"help"` key after the existing `"footer"` block, and add the two `meta` keys inside the existing `"meta"` block. German copy (verbatim):

```json
"meta": {
  "...": "existing keys stay",
  "howItWorksTitle": "So funktioniert die Schweizer Grundversicherung – Krankenkassenvergleich",
  "howItWorksDescription": "Neu in der Schweiz? Wie die obligatorische Grundversicherung funktioniert: Anmeldefristen, Kassenwechsel, Franchise und Versicherungsmodelle — einfach erklärt."
},
"help": {
  "tip": {
    "openLabel": "Erklärung anzeigen",
    "fullLink": "Ganzer Leitfaden →"
  },
  "terms": {
    "plz": {
      "title": "Postleitzahl & Prämienregion",
      "oneLiner": "Bestimmt deine Prämienregion — Prämien unterscheiden sich nach Gemeinde, nicht nur nach Kanton.",
      "short": "Deine Prämie hängt davon ab, wo du wohnst. Viele Kantone sind in zwei oder drei Prämienregionen unterteilt, und die massgebende Region wird durch die Gemeinde bestimmt, nicht allein durch die Postleitzahl. Umfasst eine Postleitzahl mehrere Gemeinden, wählst du deine Gemeinde aus."
    },
    "birthYear": {
      "title": "Jahrgang & Altersklasse",
      "short": "Die Prämien unterscheiden sich in drei Altersklassen: Kinder (0–18), junge Erwachsene (19–25) und Erwachsene (ab 26). Dein Jahrgang bestimmt deine Altersklasse und damit auch, welche Franchise-Stufen dir zur Verfügung stehen."
    },
    "franchise": {
      "title": "Franchise (Selbstbehalt)",
      "oneLiner": "Eine höhere Franchise senkt deine monatliche Prämie.",
      "short": "Die Franchise ist der Betrag deiner Gesundheitskosten, den du jedes Jahr zuerst selbst zahlst, bevor die Kasse übernimmt. Erwachsene wählen zwischen CHF 300 und CHF 2500. Eine hohe Franchise bedeutet eine tiefere Prämie, aber ein höheres Eigenrisiko, wenn du zum Arzt musst. Die Leistungen sind in jedem Fall dieselben."
    },
    "models": {
      "title": "Versicherungsmodelle",
      "short": "Im Standardmodell gehst du zu jedem Arzt deiner Wahl. Alternative Modelle (Hausarzt, HMO, Telmed) verlangen, dass du bei gesundheitlichen Fragen zuerst eine bestimmte Stelle kontaktierst — deinen Hausarzt, ein Gesundheitszentrum oder eine telefonische Beratung. Dafür ist die Prämie tiefer. Der Leistungsumfang bleibt gleich."
    }
  },
  "banner": {
    "text": "🇨🇭 Neu in der Schweizer Grundversicherung?",
    "cta": "So funktioniert das System →"
  },
  "firstRun": {
    "text": "Neu im Schweizer System?",
    "cta": "Hier die 30-Sekunden-Version →",
    "dismiss": "Ausblenden"
  },
  "drawer": {
    "title": "So funktioniert die Schweizer Grundversicherung",
    "close": "Schliessen",
    "readFull": "Ganzen Leitfaden öffnen →"
  },
  "guide": {
    "lead": "Die Grundversicherung (OKP) ist obligatorisch und per Gesetz bei jeder Krankenkasse identisch. Du vergleichst also nur Preis, Modell und Service — nicht den Leistungsumfang.",
    "back": "← Zurück zum Vergleich",
    "rules": {
      "heading": "Die Regeln, die für alle gelten",
      "item1": "Die Grundversicherung ist obligatorisch. Nach dem Zuzug in die Schweiz hast du drei Monate Zeit, dich zu versichern — der Schutz gilt rückwirkend ab deiner Ankunft.",
      "item2": "Jede Krankenkasse muss dich in die Grundversicherung aufnehmen. Es gibt keine Gesundheitsfragen und keine Ablehnung.",
      "item3": "Du kannst die Krankenkasse einmal pro Jahr wechseln. Die Kündigung muss bis zum 30. November bei der bisherigen Kasse eintreffen, der Wechsel gilt ab dem 1. Januar.",
      "item4": "Der Leistungsumfang ist gesetzlich festgelegt und überall gleich. Eine günstigere Kasse bietet nicht weniger Versicherung."
    },
    "terms": {
      "heading": "Die Begriffe im Formular",
      "intro": "Kurz erklärt — dieselben Erläuterungen findest du auch neben jedem Eingabefeld."
    },
    "models": {
      "heading": "Standard oder alternatives Modell",
      "body": "Im Standardmodell wählst du deinen Arzt frei. Alternative Modelle (Hausarzt, HMO, Telmed) senken deine Prämie, dafür kontaktierst du bei gesundheitlichen Fragen zuerst eine festgelegte Stelle. Die Leistungen sind dieselben."
    }
  }
}
```

- [ ] **Step 3: Add the same keys to `src/messages/fr.json` (formal *vous*)**

```json
"meta": {
  "howItWorksTitle": "Comment fonctionne l'assurance de base suisse – Comparaison des primes",
  "howItWorksDescription": "Nouveau en Suisse ? Comment fonctionne l'assurance de base obligatoire : délais d'affiliation, changement de caisse, franchise et modèles d'assurance — expliqué simplement."
},
"help": {
  "tip": {
    "openLabel": "Afficher l'explication",
    "fullLink": "Guide complet →"
  },
  "terms": {
    "plz": {
      "title": "Code postal et région de primes",
      "oneLiner": "Détermine votre région de primes — les primes varient selon la commune, pas seulement selon le canton.",
      "short": "Votre prime dépend de votre lieu de domicile. De nombreux cantons sont divisés en deux ou trois régions de primes, et la région déterminante dépend de la commune, pas seulement du code postal. Si un code postal couvre plusieurs communes, vous choisissez la vôtre."
    },
    "birthYear": {
      "title": "Année de naissance et classe d'âge",
      "short": "Les primes diffèrent selon trois classes d'âge : enfants (0–18), jeunes adultes (19–25) et adultes (dès 26). Votre année de naissance détermine votre classe d'âge et donc aussi les franchises disponibles."
    },
    "franchise": {
      "title": "Franchise (participation)",
      "oneLiner": "Une franchise plus élevée réduit votre prime mensuelle.",
      "short": "La franchise est la part de vos frais de santé que vous payez vous-même chaque année avant que la caisse n'intervienne. Les adultes choisissent entre CHF 300 et CHF 2500. Une franchise élevée signifie une prime plus basse, mais un risque personnel plus grand en cas de recours au médecin. Les prestations restent identiques dans tous les cas."
    },
    "models": {
      "title": "Modèles d'assurance",
      "short": "Dans le modèle standard, vous consultez le médecin de votre choix. Les modèles alternatifs (médecin de famille, HMO, Telmed) exigent qu'en cas de problème de santé vous contactiez d'abord un point de contact défini — votre médecin de famille, un centre de santé ou un conseil téléphonique. En échange, la prime est plus basse. L'étendue des prestations reste la même."
    }
  },
  "banner": {
    "text": "🇨🇭 Nouveau dans l'assurance de base suisse ?",
    "cta": "Comment fonctionne le système →"
  },
  "firstRun": {
    "text": "Nouveau dans le système suisse ?",
    "cta": "La version en 30 secondes →",
    "dismiss": "Masquer"
  },
  "drawer": {
    "title": "Comment fonctionne l'assurance de base suisse",
    "close": "Fermer",
    "readFull": "Ouvrir le guide complet →"
  },
  "guide": {
    "lead": "L'assurance de base (AOS) est obligatoire et identique par la loi auprès de chaque caisse-maladie. Vous ne comparez donc que le prix, le modèle et le service — pas l'étendue des prestations.",
    "back": "← Retour à la comparaison",
    "rules": {
      "heading": "Les règles qui s'appliquent à tous",
      "item1": "L'assurance de base est obligatoire. Après votre arrivée en Suisse, vous avez trois mois pour vous assurer — la couverture s'applique rétroactivement à la date de votre arrivée.",
      "item2": "Chaque caisse-maladie doit vous accepter dans l'assurance de base. Il n'y a aucune question de santé ni aucun refus.",
      "item3": "Vous pouvez changer de caisse-maladie une fois par an. La résiliation doit parvenir à votre caisse actuelle au plus tard le 30 novembre ; le changement prend effet au 1er janvier.",
      "item4": "L'étendue des prestations est fixée par la loi et identique partout. Une caisse meilleur marché n'offre pas moins d'assurance."
    },
    "terms": {
      "heading": "Les termes du formulaire",
      "intro": "En bref — vous trouvez les mêmes explications à côté de chaque champ de saisie."
    },
    "models": {
      "heading": "Modèle standard ou alternatif",
      "body": "Dans le modèle standard, vous choisissez librement votre médecin. Les modèles alternatifs (médecin de famille, HMO, Telmed) réduisent votre prime ; en échange, vous contactez d'abord un point de contact défini en cas de problème de santé. Les prestations sont les mêmes."
    }
  }
}
```

- [ ] **Step 4: Add the same keys to `src/messages/it.json` (informal *tu*)**

```json
"meta": {
  "howItWorksTitle": "Come funziona l'assicurazione di base svizzera – Confronto dei premi",
  "howItWorksDescription": "Nuovo in Svizzera? Come funziona l'assicurazione di base obbligatoria: termini di affiliazione, cambio di cassa, franchigia e modelli assicurativi — spiegato in modo semplice."
},
"help": {
  "tip": {
    "openLabel": "Mostra la spiegazione",
    "fullLink": "Guida completa →"
  },
  "terms": {
    "plz": {
      "title": "Numero postale e regione di premio",
      "oneLiner": "Determina la tua regione di premio — i premi variano in base al Comune, non solo al Cantone.",
      "short": "Il tuo premio dipende da dove abiti. Molti Cantoni sono suddivisi in due o tre regioni di premio e la regione determinante dipende dal Comune, non solo dal numero postale. Se un numero postale copre più Comuni, scegli il tuo."
    },
    "birthYear": {
      "title": "Anno di nascita e fascia d'età",
      "short": "I premi variano in tre fasce d'età: bambini (0–18), giovani adulti (19–25) e adulti (dai 26). Il tuo anno di nascita determina la fascia d'età e quindi anche le franchigie disponibili."
    },
    "franchise": {
      "title": "Franchigia (partecipazione)",
      "oneLiner": "Una franchigia più alta riduce il tuo premio mensile.",
      "short": "La franchigia è la parte delle tue spese sanitarie che paghi tu stesso ogni anno prima che intervenga la cassa. Gli adulti scelgono tra CHF 300 e CHF 2500. Una franchigia alta significa un premio più basso, ma un rischio personale maggiore se devi andare dal medico. Le prestazioni sono comunque le stesse."
    },
    "models": {
      "title": "Modelli assicurativi",
      "short": "Nel modello standard vai da qualsiasi medico a tua scelta. I modelli alternativi (medico di famiglia, HMO, Telmed) richiedono che, in caso di problemi di salute, tu contatti prima un punto di riferimento definito — il tuo medico di famiglia, un centro sanitario o una consulenza telefonica. In cambio il premio è più basso. L'entità delle prestazioni resta invariata."
    }
  },
  "banner": {
    "text": "🇨🇭 Nuovo nell'assicurazione di base svizzera?",
    "cta": "Come funziona il sistema →"
  },
  "firstRun": {
    "text": "Nuovo nel sistema svizzero?",
    "cta": "La versione in 30 secondi →",
    "dismiss": "Nascondi"
  },
  "drawer": {
    "title": "Come funziona l'assicurazione di base svizzera",
    "close": "Chiudi",
    "readFull": "Apri la guida completa →"
  },
  "guide": {
    "lead": "L'assicurazione di base (AOMS) è obbligatoria e per legge identica presso ogni cassa malati. Confronti quindi solo il prezzo, il modello e il servizio — non l'entità delle prestazioni.",
    "back": "← Torna al confronto",
    "rules": {
      "heading": "Le regole valide per tutti",
      "item1": "L'assicurazione di base è obbligatoria. Dopo il trasferimento in Svizzera hai tre mesi di tempo per assicurarti — la copertura vale retroattivamente dalla data del tuo arrivo.",
      "item2": "Ogni cassa malati deve accettarti nell'assicurazione di base. Non ci sono domande sulla salute né rifiuti.",
      "item3": "Puoi cambiare cassa malati una volta all'anno. La disdetta deve pervenire alla cassa attuale entro il 30 novembre; il cambio ha effetto dal 1° gennaio.",
      "item4": "L'entità delle prestazioni è stabilita per legge ed è uguale ovunque. Una cassa più conveniente non offre meno assicurazione."
    },
    "terms": {
      "heading": "I termini del modulo",
      "intro": "In breve — le stesse spiegazioni le trovi anche accanto a ogni campo."
    },
    "models": {
      "heading": "Modello standard o alternativo",
      "body": "Nel modello standard scegli liberamente il tuo medico. I modelli alternativi (medico di famiglia, HMO, Telmed) riducono il premio; in cambio, in caso di problemi di salute contatti prima un punto di riferimento definito. Le prestazioni sono le stesse."
    }
  }
}
```

- [ ] **Step 5: Add the same keys to `src/messages/en.json`**

```json
"meta": {
  "howItWorksTitle": "How Swiss basic health insurance works – Premium comparison",
  "howItWorksDescription": "New to Switzerland? How mandatory basic insurance works: sign-up deadlines, switching insurers, the deductible, and insurance models — explained simply."
},
"help": {
  "tip": {
    "openLabel": "Show explanation",
    "fullLink": "Full guide →"
  },
  "terms": {
    "plz": {
      "title": "Postcode & premium region",
      "oneLiner": "Sets your premium region — premiums differ by municipality, not just by canton.",
      "short": "Your premium depends on where you live. Many cantons are split into two or three premium regions, and the region that applies is determined by the municipality, not the postcode alone. If a postcode covers several municipalities, you pick yours."
    },
    "birthYear": {
      "title": "Birth year & age group",
      "short": "Premiums differ across three age groups: children (0–18), young adults (19–25), and adults (26+). Your birth year sets your age group, and with it the deductible tiers available to you."
    },
    "franchise": {
      "title": "Deductible (Franchise)",
      "oneLiner": "A higher deductible lowers your monthly premium.",
      "short": "The deductible is the share of your medical costs you pay yourself each year before the insurer starts paying. Adults choose between CHF 300 and CHF 2500. A high deductible means a lower premium but more out-of-pocket risk if you need care. The coverage is identical either way."
    },
    "models": {
      "title": "Insurance models",
      "short": "In the standard model you see any doctor you choose. Alternative models (family doctor, HMO, Telmed) require you to contact a set first point of care for health questions — your family doctor, a health centre, or a phone advice line. In exchange the premium is lower. The scope of coverage stays the same."
    }
  },
  "banner": {
    "text": "🇨🇭 New to Swiss basic insurance?",
    "cta": "How the system works →"
  },
  "firstRun": {
    "text": "New to the Swiss system?",
    "cta": "Here's the 30-second version →",
    "dismiss": "Dismiss"
  },
  "drawer": {
    "title": "How Swiss basic insurance works",
    "close": "Close",
    "readFull": "Open the full guide →"
  },
  "guide": {
    "lead": "Basic insurance (OKP) is mandatory and, by law, identical at every insurer. So you're only comparing price, model, and service — not the scope of coverage.",
    "back": "← Back to comparison",
    "rules": {
      "heading": "The rules everyone follows",
      "item1": "Basic insurance is mandatory. After you move to Switzerland you have three months to take out cover — it applies retroactively to your arrival date.",
      "item2": "Every insurer must accept you for basic insurance. There are no health questions and no rejections.",
      "item3": "You can switch insurer once a year. Your cancellation must reach your current insurer by 30 November; the switch takes effect on 1 January.",
      "item4": "The scope of coverage is set by law and is the same everywhere. A cheaper insurer is not less insurance."
    },
    "terms": {
      "heading": "The words on the form",
      "intro": "In brief — you'll find the same explanations next to each input field."
    },
    "models": {
      "heading": "Standard or alternative model",
      "body": "In the standard model you choose your doctor freely. Alternative models (family doctor, HMO, Telmed) lower your premium; in exchange you contact a set first point of care for health questions. The coverage is the same."
    }
  }
}
```

- [ ] **Step 6: Run the parity test**

Run: `npm test -- messages`
Expected: PASS — all four files have the same key set and (unchanged) placeholder sets.

- [ ] **Step 7: Run the full suite and lint**

Run: `npm test && npm run lint`
Expected: PASS (no code touched yet, only JSON).

- [ ] **Step 8: Commit**

```bash
git add src/messages/
git commit -m "feat(help): add help message namespace + how-it-works metadata (de/fr/it/en)"
```

---

## Task 2: `src/lib/help.ts` — term/anchor catalog + first-run helpers

**Files:**
- Create: `src/lib/help.ts`
- Test: `src/lib/help.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 3–7):
  - `TERM_KEYS: readonly ["plz", "birthYear", "franchise", "models"]`
  - `type TermKey = (typeof TERM_KEYS)[number]`
  - `HELP_ANCHORS: Record<TermKey, string>` — section id on `/how-it-works` the ⓘ "full guide" link jumps to (`plz`/`birthYear`/`franchise` → `"begriffe"`, `models` → `"modelle"`)
  - `HELP_SEEN_KEY: "prixio.help.seen"`
  - `readHelpSeen(): boolean` — `true` only when `localStorage[HELP_SEEN_KEY] === "1"`; `false` on SSR, missing key, or any thrown error
  - `markHelpSeen(): void` — writes `"1"`; silently no-ops if `localStorage` throws

- [ ] **Step 1: Write the failing test**

Create `src/lib/help.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  TERM_KEYS,
  HELP_ANCHORS,
  HELP_SEEN_KEY,
  readHelpSeen,
  markHelpSeen,
} from "@/lib/help";

afterEach(() => {
  vi.unstubAllGlobals();
});

function fakeStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
  };
}

describe("HELP_ANCHORS", () => {
  it("has a non-empty anchor for every term key", () => {
    for (const key of TERM_KEYS) {
      expect(typeof HELP_ANCHORS[key]).toBe("string");
      expect(HELP_ANCHORS[key].length).toBeGreaterThan(0);
    }
  });
});

describe("readHelpSeen / markHelpSeen", () => {
  it("readHelpSeen is false when the key is absent", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() });
    expect(readHelpSeen()).toBe(false);
  });

  it("readHelpSeen is true after markHelpSeen", () => {
    const ls = fakeStorage();
    vi.stubGlobal("window", { localStorage: ls });
    markHelpSeen();
    expect(ls.getItem(HELP_SEEN_KEY)).toBe("1");
    expect(readHelpSeen()).toBe(true);
  });

  it("readHelpSeen is false (no throw) when localStorage access throws", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("blocked");
      },
    });
    expect(() => readHelpSeen()).not.toThrow();
    expect(readHelpSeen()).toBe(false);
  });

  it("markHelpSeen swallows a throwing localStorage", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("blocked");
      },
    });
    expect(() => markHelpSeen()).not.toThrow();
  });

  it("readHelpSeen is false when window is undefined (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(readHelpSeen()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- help`
Expected: FAIL — `Cannot find module '@/lib/help'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/help.ts`:

```ts
// Newcomer help layer — shared constants and first-run persistence.
// Design: docs/superpowers/specs/2026-08-27-newcomer-help-layer-design.md
//
// Dependency-free (no imports from src/i18n or src/components) so it unit-tests
// in the node env like the rest of src/lib.

export const TERM_KEYS = ["plz", "birthYear", "franchise", "models"] as const;
export type TermKey = (typeof TERM_KEYS)[number];

// Section id on /[locale]/how-it-works that each term's "full guide" link targets.
export const HELP_ANCHORS: Record<TermKey, string> = {
  plz: "begriffe",
  birthYear: "begriffe",
  franchise: "begriffe",
  models: "modelle",
};

export const HELP_SEEN_KEY = "prixio.help.seen";

// True only when the user has dismissed the first-run card before. Any failure
// mode — SSR, private-mode localStorage, blocked storage — reads as "not seen",
// so the card shows again rather than an error surfacing (REQ-29).
export function readHelpSeen(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(HELP_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markHelpSeen(): void {
  try {
    window.localStorage.setItem(HELP_SEEN_KEY, "1");
  } catch {
    // localStorage unavailable (private mode, blocked cookies). The card just
    // reappears next visit — not worth surfacing.
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- help`
Expected: PASS (all 6 assertions).

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/help.ts src/lib/help.test.ts
git commit -m "feat(help): term/anchor catalog + localStorage first-run helpers"
```

---

## Task 3: `HelpTip` component (Layer 2 — the ⓘ trigger)

**Files:**
- Create: `src/components/help/HelpTip.tsx`
- Test: manual + `npm run lint` + `npm run build` (no component-render test infra in this repo — the logic is in `src/lib/help.ts`, Task 2)

**Interfaces:**
- Consumes: `TermKey`, `HELP_ANCHORS` from `@/lib/help`; `help.tip.*` and `help.terms.<term>.{title,short}` from Task 1.
- Produces: `HelpTip({ term }: { term: TermKey })` — a `<details>`-based inline ⓘ. Popover on `sm:` and up (absolutely positioned), inline disclosure below `sm`. Consumed by Task 4.

- [ ] **Step 1: Write the component**

Create `src/components/help/HelpTip.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { HELP_ANCHORS, type TermKey } from "@/lib/help";

// Layer 2 of the newcomer help (spec §"Inline help"). One <details> element:
// - the <summary> is the ⓘ button (keyboard-operable, toggles [open], which the
//   [details[open]_&] variants below key off for the active style + panel show);
// - the panel is an anchored popover from the `sm` breakpoint up, and an inline
//   disclosure (normal block flow, pushes content down) on narrow viewports.
// Esc and outside-click close it on all sizes.
export function HelpTip({ term }: { term: TermKey }) {
  const t = useTranslations("help");
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function close(e: Event) {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "pointerdown" && el && el.contains(e.target as Node)) return;
      if (el) el.open = false;
    }

    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, []);

  return (
    <details ref={ref} className="group relative inline-block align-middle">
      <summary
        aria-label={t("tip.openLabel")}
        className="inline-flex h-[15px] w-[15px] cursor-pointer select-none items-center justify-center rounded-full border border-outline bg-surface text-[10px] font-bold italic text-on-surface-variant list-none [&::-webkit-details-marker]:hidden [details[open]_&]:border-primary [details[open]_&]:bg-primary [details[open]_&]:text-on-primary"
      >
        i
      </summary>
      <div
        role="group"
        className="mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-outline-variant bg-surface p-3 text-left shadow-[0_4px_12px_rgba(0,0,0,0.08)] sm:absolute sm:left-0 sm:z-20"
      >
        <p className="text-[12.5px] font-bold text-on-surface">{t(`terms.${term}.title`)}</p>
        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{t(`terms.${term}.short`)}</p>
        <Link
          href={`/how-it-works#${HELP_ANCHORS[term]}`}
          className="mt-2 inline-block text-[11.5px] font-semibold text-primary"
        >
          {t("tip.fullLink")}
        </Link>
      </div>
    </details>
  );
}
```

- [ ] **Step 2: Lint and typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS (Turbopack production build; catches type errors and bad Tailwind arbitrary values).

- [ ] **Step 4: Commit**

```bash
git add src/components/help/HelpTip.tsx
git commit -m "feat(help): HelpTip — responsive ⓘ popover/disclosure"
```

---

## Task 4: Wire `HelpTip` + Layer-1 one-liners into the inputs and the model badge

**Files:**
- Modify: `src/components/inputs/PlzInput.tsx`
- Modify: `src/components/inputs/BirthYearInput.tsx`
- Modify: `src/components/inputs/DeductibleSelect.tsx`
- Modify: `src/components/results/PlanRow.tsx`
- Test: manual + `npm run lint` + `npm run build`

**Interfaces:**
- Consumes: `HelpTip` (Task 3); `help.terms.plz.oneLiner`, `help.terms.franchise.oneLiner` (Task 1).
- Produces: no new exports. Each field label becomes a flex row of `<label>` + `<HelpTip>` (the ⓘ is a sibling of `<label>`, never a child, so clicking it never focuses the field's control).

- [ ] **Step 1: PlzInput — ⓘ beside the label, persistent one-liner, dual `aria-describedby`**

In `src/components/inputs/PlzInput.tsx`, replace the `<label>` and the conditional message block. The permanent one-liner is `#plz-hint`; the validation error (when present) is a second node `#plz-error`, and both ids go in `aria-describedby`.

```tsx
"use client";

import { useTranslations } from "next-intl";
import { validatePlz } from "@/lib/validate";
import { HelpTip } from "@/components/help/HelpTip";

type Props = {
  value: string;
  onChange: (value: string) => void;
  notFound?: boolean;
};

export function PlzInput({ value, onChange, notFound }: Props) {
  const t = useTranslations();
  const formatResult = value ? validatePlz(value) : { valid: true as const };
  const invalid = !formatResult.valid || Boolean(notFound);
  const errorMessage = !formatResult.valid
    ? t(`validation.${formatResult.code}`)
    : notFound
      ? t("inputs.plzNotFound")
      : null;

  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        <label htmlFor="plz" className="text-label-large text-on-surface-variant">
          {t("inputs.plzLabel")}
        </label>
        <HelpTip term="plz" />
      </div>
      <input
        id="plz"
        type="text"
        inputMode="numeric"
        maxLength={4}
        placeholder={t("inputs.plzPlaceholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={errorMessage ? "plz-hint plz-error" : "plz-hint"}
        aria-invalid={invalid}
        className={`w-full h-10 px-3 rounded-md border text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-container ${
          invalid ? "border-error focus:border-error" : "border-outline-variant focus:border-primary"
        }`}
      />
      <p id="plz-hint" className="text-body-small text-outline mt-1">
        {t("help.terms.plz.oneLiner")}
      </p>
      {errorMessage && (
        <p id="plz-error" className="text-body-small text-error mt-1">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: BirthYearInput — ⓘ beside the label only (keep the existing dynamic hint)**

In `src/components/inputs/BirthYearInput.tsx`, replace only the `<label>` element with the flex row:

```tsx
import { HelpTip } from "@/components/help/HelpTip";
// ...
      <div className="flex items-center gap-1 mb-1.5">
        <label htmlFor="by" className="text-label-large text-on-surface-variant">
          {t("inputs.birthYearLabel")}
        </label>
        <HelpTip term="birthYear" />
      </div>
```

Leave the `<input>` and the existing `<p id="by-hint">…</p>` exactly as they are.

- [ ] **Step 3: DeductibleSelect — ⓘ beside the label + persistent one-liner**

In `src/components/inputs/DeductibleSelect.tsx`, replace the `<label>` and add the one-liner after the `<select>`. Note this file uses `useTranslations("inputs")` scoped — add a second unscoped hook for the `help` key.

```tsx
"use client";

import { useTranslations } from "next-intl";
import type { Altersklasse } from "@/lib/types";
import { getFranchiseTiers } from "@/lib/ageband";
import { HelpTip } from "@/components/help/HelpTip";

type Props = {
  altersklasse: Altersklasse | null;
  value: number | null;
  onChange: (value: number) => void;
};

export function DeductibleSelect({ altersklasse, value, onChange }: Props) {
  const t = useTranslations("inputs");
  const th = useTranslations("help");
  const tiers = altersklasse ? getFranchiseTiers(altersklasse) : [];

  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        <label htmlFor="fran" className="text-label-large text-on-surface-variant">
          {t("deductibleLabel")}
        </label>
        <HelpTip term="franchise" />
      </div>
      <select
        id="fran"
        value={value ?? ""}
        disabled={!altersklasse}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-describedby="fran-hint"
        className="w-full h-10 px-3 rounded-md border border-outline-variant text-[15px] bg-surface outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary-container disabled:bg-surface-variant disabled:text-outline"
      >
        <option value="" disabled>
          {altersklasse ? t("deductibleChoose") : t("deductibleNeedsBirthYear")}
        </option>
        {tiers.map((tier) => (
          <option key={tier} value={tier}>
            CHF {tier}
          </option>
        ))}
      </select>
      <p id="fran-hint" className="text-body-small text-outline mt-1">
        {th("terms.franchise.oneLiner")}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: PlanRow — ⓘ in the model-badge row**

In `src/components/results/PlanRow.tsx`, add the import and drop a `<HelpTip term="models" />` into the model-badge line, right after the model-tag `<span>`. (This targets the current, flag-off row layout — a plain `<div>`. If `PRODUCT_DETAIL_DROPDOWN_ENABLED` is ever turned on, the row becomes a `<summary>` and this nested `<details>` would need to move out of the summary — note left for whoever flips that flag.)

```tsx
import { HelpTip } from "@/components/help/HelpTip";
// ...
        <div className="text-xs text-on-surface-variant mt-0.5 flex flex-wrap items-center gap-1">
          <span
            className={`inline-block px-1.5 py-px rounded text-[11px] font-semibold ${
              MODEL_TAG_CLASSES[plan.tarifart] ?? DEFAULT_MODEL_TAG_CLASSES
            }`}
          >
            {t(`copy.tarifart.${plan.tarifart}.label`)}
          </span>
          <HelpTip term="models" />
          {discountPct != null && discountPct > 0 && (
            <span className="inline-block px-1.5 py-px rounded text-[11px] font-bold bg-primary-container text-on-primary-container whitespace-nowrap">
              {t("results.discountBadge", { pct: discountPct.toFixed(1) })}
            </span>
          )}
          <span>· {t(`copy.tarifart.${plan.tarifart}.description`)}</span>
        </div>
```

- [ ] **Step 5: Lint and build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/de`.
- Each of PLZ, Jahrgang, Franchise shows a persistent hint line and an ⓘ beside the label.
- Clicking an ⓘ opens the explainer; on a desktop-width window it floats over the layout; narrowing the window below the `sm` breakpoint (~640px) makes the next ⓘ open inline, pushing content down.
- Tab to an ⓘ and press Enter/Space to open; press Esc to close; click elsewhere to close.
- Clicking the ⓘ does **not** move focus into the input.
- Fill in a valid comparison; each result row's model badge shows an ⓘ that opens the "Versicherungsmodelle" explainer.
- Enter an invalid PLZ (`99999`): the one-liner and the error message both show, and the input's `aria-describedby` lists both ids.

- [ ] **Step 7: Commit**

```bash
git add src/components/inputs/ src/components/results/PlanRow.tsx
git commit -m "feat(help): wire HelpTip + persistent one-liners into inputs and model badge"
```

---

## Task 5: `HowItWorksContent` + `HowItWorksDrawer`

**Files:**
- Create: `src/components/help/HowItWorksContent.tsx`
- Create: `src/components/help/HowItWorksDrawer.tsx`
- Test: manual + `npm run lint` + `npm run build`

**Interfaces:**
- Consumes: `help.guide.*`, `help.drawer.*`, `help.terms.<term>.{title,short}` (Task 1); `TERM_KEYS` (Task 2).
- Produces:
  - `HowItWorksContent({ full = false }: { full?: boolean })` — the shared three-section body. `full` adds section `id`s (`regeln`, `begriffe`, `modelle`), the `guide.terms.intro` line, and renders the terms as a full `<dl>` (title + short) instead of a chip row. Consumed by Task 5 (drawer) and Task 7 (page).
  - `HowItWorksDrawer({ open, onClose }: { open: boolean; onClose: () => void })` — slide-over rendering `HowItWorksContent` (not `full`) + a `Link` to `/how-it-works`. Consumed by Task 6.

- [ ] **Step 1: Write `HowItWorksContent`**

Create `src/components/help/HowItWorksContent.tsx` (marked `"use client"` so it renders identically inside the client drawer and on the server-rendered page without relying on `useTranslations` in an RSC — every other translated component in this repo is a client component):

```tsx
"use client";

import { useTranslations } from "next-intl";
import { TERM_KEYS } from "@/lib/help";

// Shared body for both the drawer (full=false: term chips) and the standalone
// /how-it-works page (full=true: <h1>, section ids, full term list). Content
// core, spec §"Content core" / §"Explainer surfaces".
export function HowItWorksContent({ full = false }: { full?: boolean }) {
  const t = useTranslations("help");
  const tt = useTranslations("help.terms");

  return (
    <div className="text-on-surface">
      {full ? (
        <h1 className="text-title-large">{t("drawer.title")}</h1>
      ) : (
        <h2 className="text-title-medium">{t("drawer.title")}</h2>
      )}
      <p className="mt-2 text-body-medium text-on-surface-variant">{t("guide.lead")}</p>

      <section id={full ? "regeln" : undefined} className="mt-5 border-t border-outline-variant pt-4">
        <h3 className="text-label-large text-on-surface">{t("guide.rules.heading")}</h3>
        <ul className="mt-2 list-disc pl-5 text-body-small text-on-surface-variant space-y-1.5">
          <li>{t("guide.rules.item1")}</li>
          <li>{t("guide.rules.item2")}</li>
          <li>{t("guide.rules.item3")}</li>
          <li>{t("guide.rules.item4")}</li>
        </ul>
      </section>

      <section id={full ? "begriffe" : undefined} className="mt-4 border-t border-outline-variant pt-4">
        <h3 className="text-label-large text-on-surface">{t("guide.terms.heading")}</h3>
        {full ? (
          <>
            <p className="mt-1 text-body-small text-on-surface-variant">{t("guide.terms.intro")}</p>
            <dl className="mt-3 space-y-3">
              {TERM_KEYS.map((key) => (
                <div key={key}>
                  <dt className="text-body-small font-bold text-on-surface">{tt(`${key}.title`)}</dt>
                  <dd className="text-body-small text-on-surface-variant">{tt(`${key}.short`)}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TERM_KEYS.map((key) => (
              <span
                key={key}
                className="rounded bg-primary-container px-1.5 py-0.5 text-[10.5px] font-semibold text-on-primary-container"
              >
                {tt(`${key}.title`)}
              </span>
            ))}
          </div>
        )}
      </section>

      <section id={full ? "modelle" : undefined} className="mt-4 border-t border-outline-variant pt-4">
        <h3 className="text-label-large text-on-surface">{t("guide.models.heading")}</h3>
        <p className="mt-2 text-body-small text-on-surface-variant">{t("guide.models.body")}</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Write `HowItWorksDrawer`**

Create `src/components/help/HowItWorksDrawer.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { HowItWorksContent } from "./HowItWorksContent";

// On-page slide-over (spec §"Drawer"). The comparator stays mounted underneath.
// Esc / scrim / ✕ close it; body scroll is locked while open; focus moves to ✕
// on open and returns to the opener on close. Not a full focus trap — a known
// v1 simplification noted in the spec's Testing section.
export function HowItWorksDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("help");
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    openerRef.current = (document.activeElement as HTMLElement) ?? null;
    closeRef.current?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      openerRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-[rgba(0,0,0,0.32)]"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("drawer.title")}
        className="absolute right-0 top-0 bottom-0 w-[min(420px,92vw)] overflow-y-auto border-l border-outline-variant bg-surface p-5 shadow-[-8px_0_28px_rgba(0,0,0,0.16)]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("drawer.close")}
          className="absolute right-4 top-4 text-base text-on-surface-variant"
        >
          ✕
        </button>
        <HowItWorksContent />
        <Link
          href="/how-it-works"
          onClick={onClose}
          className="mt-4 inline-block text-[12.5px] font-semibold text-primary"
        >
          {t("drawer.readFull")}
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/help/HowItWorksContent.tsx src/components/help/HowItWorksDrawer.tsx
git commit -m "feat(help): HowItWorksContent + slide-over drawer"
```

---

## Task 6: `NewcomerBanner` + mount banner & drawer in `InsuranceComparator`

**Files:**
- Create: `src/components/help/NewcomerBanner.tsx`
- Modify: `src/components/InsuranceComparator.tsx`
- Test: manual + `npm run lint` + `npm run build`

**Interfaces:**
- Consumes: `readHelpSeen`, `markHelpSeen` from `@/lib/help` (Task 2); `help.banner.*`, `help.firstRun.*` (Task 1); `HowItWorksDrawer` (Task 5).
- Produces: `NewcomerBanner({ onOpenGuide }: { onOpenGuide: () => void })` — the always-present banner plus, on a first visit only, the dismissible slim card above it. Both CTAs call `onOpenGuide`.

- [ ] **Step 1: Write `NewcomerBanner`**

Create `src/components/help/NewcomerBanner.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { readHelpSeen, markHelpSeen } from "@/lib/help";

// Always renders the banner. The first-run slim card renders only when the user
// hasn't dismissed it before — gated in an effect so SSR and first client render
// agree (no hydration mismatch), then it appears if needed (spec §"First-run").
export function NewcomerBanner({ onOpenGuide }: { onOpenGuide: () => void }) {
  const t = useTranslations("help");
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    setShowCard(!readHelpSeen());
  }, []);

  function dismiss() {
    markHelpSeen();
    setShowCard(false);
  }

  return (
    <>
      {showCard && (
        <div className="mb-3 flex items-start gap-2.5 rounded-lg bg-primary-container p-3 text-[13px] text-on-primary-container">
          <p className="flex-1">
            {t("firstRun.text")}{" "}
            <button
              type="button"
              onClick={onOpenGuide}
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              {t("firstRun.cta")}
            </button>
          </p>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("firstRun.dismiss")}
            className="p-0.5 text-sm leading-none text-on-surface-variant"
          >
            ✕
          </button>
        </div>
      )}
      <div className="mb-4 flex items-center justify-between gap-3 rounded-md bg-primary-container px-3 py-2 text-[13px] text-on-primary-container">
        <span>{t("banner.text")}</span>
        <button
          type="button"
          onClick={onOpenGuide}
          className="whitespace-nowrap font-semibold text-primary"
        >
          {t("banner.cta")}
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Mount in `InsuranceComparator`**

In `src/components/InsuranceComparator.tsx`:

Add imports near the other component imports:

```tsx
import { NewcomerBanner } from "./help/NewcomerBanner";
import { HowItWorksDrawer } from "./help/HowItWorksDrawer";
```

Add drawer state alongside the other `useState` calls (near the top of the component body):

```tsx
const [guideOpen, setGuideOpen] = useState(false);
```

In the returned JSX, the input card currently opens:

```tsx
      <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
```

Insert `<NewcomerBanner>` as the first child of that card:

```tsx
      <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-6">
        <NewcomerBanner onOpenGuide={() => setGuideOpen(true)} />
        <div className="flex items-start justify-between gap-3 mb-1">
```

And mount the drawer as the last child of `<main>`, immediately before its closing tag:

```tsx
      <HowItWorksDrawer open={guideOpen} onClose={() => setGuideOpen(false)} />
    </main>
  );
```

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`.
- First load of `http://localhost:3000/de` in a fresh profile (or after `localStorage.removeItem('prixio.help.seen')` + reload): the slim first-run card shows above the banner.
- Click the card's ✕: card disappears; reload — it stays gone; the banner remains.
- Click the banner CTA (or the card CTA before dismissing): the drawer slides in over the comparator; the page behind doesn't scroll; Esc, the ✕, and clicking the dimmed area all close it; focus returns to the CTA.
- With `localStorage` disabled in devtools, the first-run card still renders and dismiss doesn't throw.

- [ ] **Step 5: Commit**

```bash
git add src/components/help/NewcomerBanner.tsx src/components/InsuranceComparator.tsx
git commit -m "feat(help): newcomer banner + first-run card + drawer wiring"
```

---

## Task 7: `/[locale]/how-it-works` standalone guide page

**Files:**
- Create: `src/app/[locale]/how-it-works/page.tsx`
- Create: `src/components/help/BackToComparisonLink.tsx`
- Test: manual + `npm run build`

**Interfaces:**
- Consumes: `HowItWorksContent` (Task 5); `meta.howItWorksTitle`, `meta.howItWorksDescription`, `help.guide.back` (Task 1); `getSiteUrl` from `@/lib/site-url`; `routing` from `@/i18n/routing`.
- Produces: the route `/[locale]/how-it-works` with per-locale `generateMetadata` (title/description/OpenGraph/Twitter + `hreflang` alternates incl. `x-default` → German), and `BackToComparisonLink` — a client component that renders a locale-aware `Link` back to `/` carrying the current query string.

- [ ] **Step 1: Write `BackToComparisonLink`**

Create `src/components/help/BackToComparisonLink.tsx`:

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// Carries the in-progress comparison (query string) back to /[locale] so a user
// who opened the guide mid-comparison returns to their inputs (spec §"Standalone
// page"). Client component so the page itself stays statically rendered.
export function BackToComparisonLink() {
  const t = useTranslations("help");
  const qs = useSearchParams().toString();
  return (
    <Link href={qs ? `/?${qs}` : "/"} className="text-[12.5px] font-semibold text-primary">
      {t("guide.back")}
    </Link>
  );
}
```

- [ ] **Step 2: Write the page**

Create `src/app/[locale]/how-it-works/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";
import { HowItWorksContent } from "@/components/help/HowItWorksContent";
import { BackToComparisonLink } from "@/components/help/BackToComparisonLink";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const baseUrl = getSiteUrl();

  return {
    title: t("howItWorksTitle"),
    description: t("howItWorksDescription"),
    alternates: {
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, `${baseUrl}/${l}/how-it-works`])),
        "x-default": `${baseUrl}/${routing.defaultLocale}/how-it-works`,
      },
    },
    openGraph: {
      title: t("howItWorksTitle"),
      description: t("howItWorksDescription"),
      type: "article",
    },
    twitter: {
      card: "summary",
      title: t("howItWorksTitle"),
      description: t("howItWorksDescription"),
    },
  };
}

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="mx-auto my-8 max-w-[720px] px-4">
      <Suspense fallback={null}>
        <BackToComparisonLink />
      </Suspense>
      <div className="mt-4">
        <HowItWorksContent full />
      </div>
      <div className="mt-6">
        <Suspense fallback={null}>
          <BackToComparisonLink />
        </Suspense>
      </div>
    </main>
  );
}
```

(The `[locale]` param values come from the `generateStaticParams` already declared in `src/app/[locale]/layout.tsx` — child routes inherit it, so it isn't redeclared here.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS, and the build output lists `/[locale]/how-it-works` prerendered for all four locales.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`.
- `http://localhost:3000/de/how-it-works` renders the full guide: lead, the four rules, the term list (title + short for PLZ, Jahrgang, Franchise, Modelle), the models section.
- `/fr/how-it-works`, `/it/how-it-works`, `/en/how-it-works` render in the right language.
- From `/de?plz=8001&birthYear=1990&franchise=300`, open the drawer, click "Ganzen Leitfaden öffnen →" → lands on `/de/how-it-works`; the "← Zurück zum Vergleich" link goes back to `/de?plz=8001&birthYear=1990&franchise=300`.
- From a field ⓘ, "Ganzer Leitfaden →" lands on `/de/how-it-works#begriffe` and scrolls to the terms section; the models ⓘ link targets `#modelle`.
- View source: `<title>` and `<meta name="description">` are the localized how-it-works strings; `<link rel="alternate" hreflang="…">` tags are present for de/fr/it/en + x-default.

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/how-it-works/ src/components/help/BackToComparisonLink.tsx
git commit -m "feat(help): standalone /how-it-works guide page + per-locale metadata"
```

---

## Task 8: Add the guide pages to the sitemap

**Files:**
- Modify: `src/app/sitemap.ts`
- Test: `src/app/sitemap.test.ts` (create)

**Interfaces:**
- Consumes: `routing` from `@/i18n/routing`, `getSiteUrl` from `@/lib/site-url`.
- Produces: a sitemap of 8 entries — `/{locale}` and `/{locale}/how-it-works` for each of the four locales — each carrying `hreflang` alternates. No parameterized URLs (REQ-20).

- [ ] **Step 1: Write the failing test**

Create `src/app/sitemap.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);

  it("lists /{locale} and /{locale}/how-it-works for all four locales (8 entries)", () => {
    expect([...urls].sort()).toEqual(
      [
        "https://example.com/de",
        "https://example.com/de/how-it-works",
        "https://example.com/en",
        "https://example.com/en/how-it-works",
        "https://example.com/fr",
        "https://example.com/fr/how-it-works",
        "https://example.com/it",
        "https://example.com/it/how-it-works",
      ].sort(),
    );
  });

  it("contains no parameterized URLs", () => {
    expect(urls.every((u) => !u.includes("?"))).toBe(true);
  });

  it("every entry carries hreflang alternates for all four locales", () => {
    for (const entry of entries) {
      expect(Object.keys(entry.alternates?.languages ?? {}).sort()).toEqual(["de", "en", "fr", "it"]);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- sitemap`
Expected: FAIL — current sitemap has 4 entries, no `/how-it-works`.

- [ ] **Step 3: Update `src/app/sitemap.ts`**

```ts
import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";

// One entry per (locale × indexable path). Only base URLs and the evergreen
// how-it-works guide are listed — never parameterised comparison URLs (REQ-20).
// Each entry carries hreflang alternates so search engines link the language
// versions of the same page together.
const INDEXABLE_PATHS = ["", "/how-it-works"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();

  return routing.locales.flatMap((locale) =>
    INDEXABLE_PATHS.map((path) => ({
      url: `${baseUrl}/${locale}${path}`,
      lastModified: new Date(),
      changeFrequency: "yearly" as const,
      priority: path === "" ? (locale === routing.defaultLocale ? 1 : 0.9) : 0.6,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${baseUrl}/${l}${path}`]),
        ),
      },
    })),
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- sitemap`
Expected: PASS.

- [ ] **Step 5: Full suite, lint, build**

Run: `npm test && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/sitemap.ts src/app/sitemap.test.ts
git commit -m "feat(help): add /how-it-works guide pages to the sitemap"
```

---

## Final verification

- [ ] `npm test` — all green (adds `help.test.ts`, `sitemap.test.ts`; `messages.test.ts` covers the new `help` namespace parity).
- [ ] `npm run lint` — clean.
- [ ] `npm run build` — clean; build output shows `/[locale]` and `/[locale]/how-it-works` prerendered for de/fr/it/en.
- [ ] Manual pass on `npm run dev`, all four locales: ⓘ on every input + model badge; persistent one-liners on PLZ and Franchise; first-run card (fresh profile) → dismiss persists; banner always present; drawer opens/closes (Esc, scrim, ✕) with scroll lock and focus return; `/how-it-works` page renders full content and the query-preserving back link; ⓘ "full guide" deep links to `#begriffe` / `#modelle`.
- [ ] Keyboard-only pass: Tab to each ⓘ, open/close with Enter + Esc; Tab through the drawer; Tab to the banner CTA.
- [ ] `mockups/main.html` (already updated on this branch) still matches the built UI; adjust it if any class/structure drifted during implementation.
- [ ] Update `docs/superpowers/specs/2026-08-27-newcomer-help-layer-design.md` **Status** line if anything changed materially from the spec (e.g. the Layer-3 link goes to `/how-it-works#anchor`, not the drawer — a deliberate simplification to avoid threading drawer state through `PlanRow`; confirm the spec's "Layer 3" wording is acceptable or amend it).

## Deviations from the spec (intentional, for review)

1. **Layer-3 "full explainer" link opens the standalone page (`/how-it-works#anchor`), not the drawer.** The spec says it "opens the drawer scrolled to the matching section." Opening the drawer from `HelpTip` would require lifting drawer state to `InsuranceComparator` and threading an opener callback down through `PlzInput` / `BirthYearInput` / `DeductibleSelect` / `PlanList` / `PlanRow`. A locale-aware `Link` to the page's `#begriffe` / `#modelle` anchors gets the user to the same content with no cross-tree coupling. Flagged for the spec review gate.
2. **Drawer focus handling is "focus the close button + Esc + restore on close", not a full Tab focus trap.** The spec's Testing section already lists a full trap as the intent; this is the v1 simplification. A trap can be added later without an API change.
3. **`HelpTip` does not move focus into the popover on open** (spec §"Layer 2" says "on open, focus moves into the panel"). It's a `<details>`/`<summary>` disclosure: opening keeps focus on the ⓘ trigger, Esc/outside-click closes, and the panel's link is reachable by Tab. Moving focus into a small on-hover-style explainer is unusual and fights the `<details>` model; keeping focus on the trigger is the lower-surprise behavior. Flag for the review gate — if the spec's wording is firm, add an on-open `panelRef.current?.focus()` with `tabIndex={-1}` on the panel.
4. **No component-render tests.** This repo's Vitest runs in the `node` environment with no jsdom/RTL, and every prior feature verified components manually. Testable logic is extracted to `src/lib/help.ts`; components get lint + build + a manual checklist. Introducing jsdom is out of scope for this feature.
