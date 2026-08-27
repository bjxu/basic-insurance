# Add Portuguese & Spanish Locales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `pt` (Portuguese) and `es` (Spanish) as first-class locales alongside the existing `de`/`fr`/`it`/`en`, each on its own crawlable URL with full UI translation.

**Architecture:** The next-intl setup is entirely driven by `routing.locales`. Adding two codes to that array wires up routing, `Accept-Language` negotiation, static generation, per-locale metadata, and `hreflang`/sitemap automatically. The remaining work is two new message catalogs plus extending the few spots that hardcode the four-locale set (language switcher, date-format map, `src/lib/format.ts` unit maps) and updating three test files.

**Tech Stack:** Next.js 15 (App Router), next-intl v4, TypeScript, Vitest.

## Global Constraints

- Locale routing: `localePrefix: "always"`, `defaultLocale: "de"` — unchanged.
- New message catalogs MUST have byte-for-byte identical key paths AND identical `{placeholder}` names as `src/messages/de.json`. `src/messages/messages.test.ts` enforces both.
- Regional variants for `DATE_LOCALE`: `pt` → `"pt-PT"`, `es` → `"es-ES"` (European).
- `formatChf` stays identical across all locales (Swiss currency convention, requirement.md §9) — do not touch it.
- `src/lib/productDescriptions.ts` `LOCALES` array stays `de/en/fr/it` — do not add pt/es.
- Admin panel (`/admin`, `/admin/login`, `/api/admin/**`) — do not touch.
- Locale code order wherever a full list is written literally: `de, en, es, fr, it, pt` (alphabetical).

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/i18n/routing.ts` | Canonical locale list | Modify: add `"pt"`, `"es"` |
| `src/messages/pt.json` | Portuguese UI catalog | Create |
| `src/messages/es.json` | Spanish UI catalog | Create |
| `src/messages/messages.test.ts` | Cross-catalog parity test | Modify: add pt/es rows |
| `src/lib/format.ts` | Locale-aware member-count formatting | Modify: extend `Locale` + 3 maps |
| `src/lib/format.test.ts` | format.ts unit tests | Modify: add pt/es assertions |
| `src/components/LanguageSwitcher.tsx` | Switcher endonym labels | Modify: add pt/es names |
| `src/components/InsuranceComparator.tsx` | `DATE_LOCALE` map | Modify: add pt/es entries |
| `src/app/sitemap.test.ts` | Sitemap/hreflang test | Modify: 8→12 entries, 6 locales |

---

## Task 1: Locale-aware formatting for pt/es (`src/lib/format.ts`)

**Files:**
- Modify: `src/lib/format.ts` (the `Locale` type ~line 17, `MEMBER_COUNT_UNITS` ~line 19, `INSURED_WORD` ~line 47, `AS_OF_WORD` ~line 54)
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `formatMemberCount(count: number, locale: string): string` and `formatMemberCountDetail(count: number, asOfYear: number, locale: string): string` — unchanged signatures — now return Portuguese/Spanish unit words for `locale === "pt" | "es"`.

- [ ] **Step 1: Add the failing assertions to `src/lib/format.test.ts`**

In the existing `it("formats thousands rounded to the nearest whole unit, per locale", …)` block, add after the `"it"` line:

```ts
    expect(formatMemberCount(813080, "pt")).toBe("813 mil");
    expect(formatMemberCount(813080, "es")).toBe("813 mil");
```

In the existing `it("formats millions with one decimal, per locale", …)` block, add after the last line:

```ts
    expect(formatMemberCount(1537730, "pt")).toBe("1.5 mi.");
    expect(formatMemberCount(1537730, "es")).toBe("1.5 M");
```

In the existing `it("formats the exact grouped count with the data-as-of year, per locale", …)` block, add after the `"it"` line:

```ts
    expect(formatMemberCountDetail(1537730, 2024, "pt")).toBe("1'537'730 segurados · em 2024");
    expect(formatMemberCountDetail(1537730, 2024, "es")).toBe("1'537'730 asegurados · en 2024");
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — pt/es fall through to the German fallback, so e.g. `formatMemberCount(813080, "pt")` returns `"813 Tsd."` not `"813 mil"`.

- [ ] **Step 3: Extend `src/lib/format.ts`**

Change the `Locale` type:

```ts
type Locale = "de" | "fr" | "it" | "en" | "pt" | "es";
```

Add entries to `MEMBER_COUNT_UNITS` (keep existing entries):

```ts
  pt: { million: "mi.", thousand: "mil" },
  es: { million: "M", thousand: "mil" },
```

Add entries to `INSURED_WORD`:

```ts
  pt: "segurados",
  es: "asegurados",
```

Add entries to `AS_OF_WORD`:

```ts
  pt: "em",
  es: "en",
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS (all blocks, including the unchanged `"falls back to German units for an unrecognized locale"` case).

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat(i18n): locale-aware member-count formatting for pt/es"
```

---

## Task 2: Portuguese & Spanish message catalogs

**Files:**
- Create: `src/messages/pt.json`
- Create: `src/messages/es.json`
- Modify: `src/messages/messages.test.ts`

**Interfaces:**
- Consumes: `src/messages/de.json` as the key/placeholder authority.
- Produces: two catalogs `import`-able as `pt` / `es`, consumed by `src/i18n/request.ts`'s `import(\`../messages/${locale}.json\`)` (Task 3) and by `messages.test.ts`.

- [ ] **Step 1: Add the failing parity rows to `src/messages/messages.test.ts`**

Add two imports after the existing message imports:

```ts
import pt from "./pt.json";
import es from "./es.json";
```

Add two rows to the `it.each([...])` table (after the `["it", itMessages]` row):

```ts
    ["pt", pt],
    ["es", es],
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/messages/messages.test.ts`
Expected: FAIL — `Cannot find module './pt.json'` (files don't exist yet).

- [ ] **Step 3: Create `src/messages/pt.json`**

```json
{
  "meta": {
    "title": "Comparação de seguros de saúde – Seguro básico Suíça",
    "description": "Compare os prémios do seguro básico de saúde suíço – todas as seguradoras, todos os modelos, dados oficiais da autoridade suíça de saúde (OFSP).",
    "ogTitle": "Comparação de seguros de saúde – Seguro básico Suíça",
    "ogDescription": "Compare os prémios do seguro básico de saúde suíço – todas as seguradoras, todos os modelos, dados oficiais da autoridade suíça de saúde (OFSP).",
    "twitterTitle": "Comparação de seguros de saúde – Seguro básico Suíça",
    "twitterDescription": "Compare os prémios do seguro básico de saúde suíço – dados oficiais da autoridade suíça de saúde (OFSP).",
    "howItWorksTitle": "Como funciona o seguro básico de saúde suíço – Comparação de prémios",
    "howItWorksDescription": "Novo na Suíça? Como funciona o seguro básico obrigatório: prazos de inscrição, mudança de seguradora, a franquia e os modelos de seguro — explicado de forma simples."
  },
  "inputs": {
    "title": "Comparação de prémios",
    "tagline": "Introduza os seus dados — as seguradoras mais baratas aparecem de imediato.",
    "plzLabel": "Código postal (PLZ)",
    "plzPlaceholder": "ex.: 3001",
    "plzNotFound": "Código postal não encontrado — por favor verifique.",
    "birthYearLabel": "Ano de nascimento",
    "birthYearPlaceholder": "ex.: 1985",
    "birthYearHintDefault": "Determina a faixa etária e os níveis de franquia disponíveis",
    "birthYearHintResolved": "→ {altersklasse}, franquia CHF {min}–{max}",
    "deductibleLabel": "Franquia",
    "deductibleChoose": "Escolher…",
    "deductibleNeedsBirthYear": "Introduza primeiro o ano de nascimento",
    "gemeindeAmbiguous": "O código postal {plz} abrange várias regiões de prémio. Por favor escolha o seu município:",
    "gemeindeConfirmed": "✓ Município: {name}",
    "premiumsLoading": "A carregar os dados dos prémios…",
    "premiumsError": "Não foi possível carregar os dados dos prémios. Por favor tente novamente.",
    "retry": "Tentar novamente"
  },
  "validation": {
    "invalidPlzFormat": "Código postal inválido — introduza um código postal suíço de 4 dígitos.",
    "invalidPremium": "Por favor introduza um prémio mensal válido.",
    "nonPositivePremium": "O prémio mensal deve ser superior a CHF 0.",
    "invalidBirthYear": "Por favor introduza um ano de nascimento válido.",
    "futureBirthYear": "O ano de nascimento está no futuro.",
    "unrealisticBirthYear": "Por favor introduza um ano de nascimento realista (máx. ~120 anos)."
  },
  "currentPlan": {
    "summaryTitle": "Quanto paga atualmente?",
    "summaryHint": "(opcional — mostra a sua poupança)",
    "insurerLabel": "Seguradora atual",
    "premiumLabel": "Prémio mensal",
    "premiumPlaceholder": "ex.: 350"
  },
  "filterBar": {
    "yearLabel": "Ano:",
    "altModelsLabel": "Modelos alternativos: {state}",
    "accidentLabel": "Acidente: {state}",
    "stateOn": "ativado",
    "stateOff": "desativado",
    "included": "incluída",
    "excluded": "excluída"
  },
  "results": {
    "summary": "{count} seguradoras · {model} · Cobertura de acidentes {coverage} · {year}",
    "modelAlt": "modelo mais barato por seguradora",
    "modelStandard": "oferta standard mais barata por seguradora",
    "emptyTitle": "Nenhuma oferta encontrada",
    "emptyMessage": "Não existem prémios nos dados da OFSP para esta combinação. Por favor verifique os seus dados ou ajuste os filtros.",
    "discountBadge": "até −{pct}% vs. standard",
    "yourInsurerBadge": "A sua seguradora",
    "perMonth": "/mês",
    "discountBadgeExact": "−{pct}% vs. standard",
    "shownAboveTag": "mostrada acima"
  },
  "headline": {
    "savingsCurrent": "Se não fizer nada: {amount}/mês com {insurer}.",
    "savingsCheapest": "Oferta mais barata para o seu perfil em {year}: {amount}/mês com {insurer} —",
    "savingsAmount": "poupe {amount}/ano ao mudar.",
    "alreadyCheapestExact": "Já tem a oferta mais barata para o seu perfil.",
    "alreadyCheapestBelow": "O seu prémio está abaixo de todas as ofertas para este perfil — verifique se a franquia e o modelo são comparáveis.",
    "alreadyCheapestDetail": "{insurer} · {amount}/mês.",
    "cheapestOnlyTitle": "Oferta mais barata: {amount}/mês com {insurer}.",
    "cheapestOnlyCta": "Introduza a sua seguradora atual para ver quanto poderia poupar. ↓"
  },
  "footer": {
    "dataNotice": "Dados: dados abertos da OFSP · Publicação {date} · Apenas prestações obrigatórias · Sem patrocínio, sem ligações de intermediação",
    "levyNotice": "Os preços incluem a redistribuição da taxa sobre o CO₂/COV (CHF {amount}/mês, {year}) — igual para todas as seguradoras, sem efeito na classificação"
  },
  "help": {
    "tip": {
      "openLabel": "Mostrar explicação",
      "fullLink": "Guia completo →"
    },
    "terms": {
      "plz": {
        "title": "Código postal e região de prémio",
        "oneLiner": "Define a sua região de prémio — os prémios variam por município, não apenas por cantão.",
        "short": "O seu prémio depende do local onde vive. Muitos cantões estão divididos em duas ou três regiões de prémio, e a região aplicável é determinada pelo município, não apenas pelo código postal. Se um código postal abranger vários municípios, escolhe o seu."
      },
      "birthYear": {
        "title": "Ano de nascimento e faixa etária",
        "short": "Os prémios diferem em três faixas etárias: crianças (0–18), jovens adultos (19–25) e adultos (26+). O seu ano de nascimento define a sua faixa etária e, com ela, os níveis de franquia disponíveis."
      },
      "franchise": {
        "title": "Franquia (Franchise)",
        "oneLiner": "Uma franquia mais elevada reduz o seu prémio mensal.",
        "short": "A franquia é a parte dos seus custos de saúde que paga do seu bolso todos os anos antes de a seguradora começar a pagar. Os adultos escolhem entre CHF 300 e CHF 2500. Uma franquia elevada significa um prémio mais baixo, mas mais risco de despesas próprias se precisar de cuidados. A cobertura é idêntica em qualquer dos casos."
      },
      "unfalldeckung": {
        "title": "Cobertura de acidentes",
        "short": "O seguro básico normalmente também cobre acidentes. Se estiver empregado pelo menos 8 horas por semana por uma entidade patronal, está coberto contra acidentes através dela e pode excluir a cobertura de acidentes da sua seguradora de saúde — o que reduz ligeiramente o prémio. Em caso de dúvida, mantenha-a incluída."
      },
      "models": {
        "title": "Modelos de seguro",
        "short": "Escolhe entre o modelo standard (livre escolha do médico) e um modelo alternativo mais barato com um primeiro ponto de contacto fixo. A cobertura é igual em todos.",
        "altGroup": "Modelos alternativos"
      }
    },
    "banner": {
      "text": "🇨🇭 Novo no seguro básico suíço?",
      "cta": "Como funciona o sistema →"
    },
    "drawer": {
      "title": "Como funciona o seguro básico suíço",
      "close": "Fechar",
      "readFull": "Abrir o guia completo →"
    },
    "guide": {
      "lead": "O seguro básico é obrigatório e, por lei, idêntico em todas as seguradoras. Por isso, está apenas a comparar preço, modelo e serviço — não o âmbito da cobertura.",
      "back": "← Voltar à comparação",
      "rules": {
        "heading": "As regras que se aplicam a todos",
        "item1": "O seguro básico é obrigatório. Depois de se mudar para a Suíça, tem três meses para fazer um seguro — a proteção aplica-se retroativamente à data da sua chegada.",
        "item2": "Todas as seguradoras têm de o aceitar no seguro básico. Não há perguntas de saúde nem recusas.",
        "item3": "Pode mudar de seguradora uma vez por ano. A rescisão tem de chegar à sua seguradora atual até 30 de novembro; a mudança entra em vigor a 1 de janeiro.",
        "item4": "O âmbito da cobertura é definido por lei e é igual em todo o lado. Uma seguradora mais barata não é menos seguro."
      },
      "terms": {
        "heading": "Os termos do formulário",
        "intro": "Em resumo — encontra as mesmas explicações ao lado de cada campo."
      },
      "models": {
        "heading": "Modelo standard ou alternativo"
      }
    }
  },
  "copy": {
    "tarifart": {
      "standard": { "label": "Standard", "description": "Livre escolha do médico" },
      "hausarzt": { "label": "Médico de família", "description": "O primeiro ponto de contacto é sempre o médico de família escolhido" },
      "telmed": { "label": "Telmed", "description": "É necessário telefonar para uma linha de apoio antes de cada consulta" },
      "hmo": { "label": "HMO", "description": "O primeiro ponto de contacto é sempre o centro HMO" },
      "andere": { "label": "Modelo alternativo", "description": "Escolha limitada do primeiro ponto de contacto" }
    },
    "altersklasse": {
      "kind": "Criança (0–18)",
      "jung": "Jovem adulto (19–25)",
      "erwachsen": "Adulto (26+)"
    }
  },
  "languageSwitcher": {
    "menuLabel": "Escolher idioma"
  }
}
```

- [ ] **Step 4: Create `src/messages/es.json`**

```json
{
  "meta": {
    "title": "Comparación de seguros de salud – Seguro básico Suiza",
    "description": "Compara las primas del seguro básico de salud suizo: todas las aseguradoras, todos los modelos, datos oficiales de la autoridad sanitaria suiza (OFSP).",
    "ogTitle": "Comparación de seguros de salud – Seguro básico Suiza",
    "ogDescription": "Compara las primas del seguro básico de salud suizo: todas las aseguradoras, todos los modelos, datos oficiales de la autoridad sanitaria suiza (OFSP).",
    "twitterTitle": "Comparación de seguros de salud – Seguro básico Suiza",
    "twitterDescription": "Compara las primas del seguro básico de salud suizo: datos oficiales de la autoridad sanitaria suiza (OFSP).",
    "howItWorksTitle": "Cómo funciona el seguro básico de salud suizo – Comparación de primas",
    "howItWorksDescription": "¿Nuevo en Suiza? Cómo funciona el seguro básico obligatorio: plazos de inscripción, cambio de aseguradora, la franquicia y los modelos de seguro — explicado de forma sencilla."
  },
  "inputs": {
    "title": "Comparación de primas",
    "tagline": "Introduce tus datos: las aseguradoras más baratas aparecen al instante.",
    "plzLabel": "Código postal (PLZ)",
    "plzPlaceholder": "p. ej. 3001",
    "plzNotFound": "Código postal no encontrado: compruébalo, por favor.",
    "birthYearLabel": "Año de nacimiento",
    "birthYearPlaceholder": "p. ej. 1985",
    "birthYearHintDefault": "Determina el grupo de edad y los niveles de franquicia disponibles",
    "birthYearHintResolved": "→ {altersklasse}, franquicia CHF {min}–{max}",
    "deductibleLabel": "Franquicia",
    "deductibleChoose": "Elegir…",
    "deductibleNeedsBirthYear": "Introduce primero el año de nacimiento",
    "gemeindeAmbiguous": "El código postal {plz} abarca varias regiones de prima. Elige tu municipio, por favor:",
    "gemeindeConfirmed": "✓ Municipio: {name}",
    "premiumsLoading": "Cargando los datos de primas…",
    "premiumsError": "No se pudieron cargar los datos de primas. Inténtalo de nuevo, por favor.",
    "retry": "Intentar de nuevo"
  },
  "validation": {
    "invalidPlzFormat": "Código postal no válido: introduce un código postal suizo de 4 cifras.",
    "invalidPremium": "Introduce una prima mensual válida, por favor.",
    "nonPositivePremium": "La prima mensual debe ser mayor que CHF 0.",
    "invalidBirthYear": "Introduce un año de nacimiento válido, por favor.",
    "futureBirthYear": "El año de nacimiento está en el futuro.",
    "unrealisticBirthYear": "Introduce un año de nacimiento realista (máx. ~120 años)."
  },
  "currentPlan": {
    "summaryTitle": "¿Cuánto pagas actualmente?",
    "summaryHint": "(opcional: muestra tu ahorro)",
    "insurerLabel": "Aseguradora actual",
    "premiumLabel": "Prima mensual",
    "premiumPlaceholder": "p. ej. 350"
  },
  "filterBar": {
    "yearLabel": "Año:",
    "altModelsLabel": "Modelos alternativos: {state}",
    "accidentLabel": "Accidente: {state}",
    "stateOn": "activado",
    "stateOff": "desactivado",
    "included": "incluida",
    "excluded": "excluida"
  },
  "results": {
    "summary": "{count} aseguradoras · {model} · Cobertura de accidentes {coverage} · {year}",
    "modelAlt": "modelo más barato por aseguradora",
    "modelStandard": "oferta estándar más barata por aseguradora",
    "emptyTitle": "No se han encontrado ofertas",
    "emptyMessage": "No hay primas en los datos de la OFSP para esta combinación. Comprueba tus datos o ajusta los filtros.",
    "discountBadge": "hasta −{pct}% frente al estándar",
    "yourInsurerBadge": "Tu aseguradora",
    "perMonth": "/mes",
    "discountBadgeExact": "−{pct}% frente al estándar",
    "shownAboveTag": "mostrada arriba"
  },
  "headline": {
    "savingsCurrent": "Si no haces nada: {amount}/mes con {insurer}.",
    "savingsCheapest": "Oferta más barata para tu perfil en {year}: {amount}/mes con {insurer} —",
    "savingsAmount": "ahorra {amount}/año al cambiar.",
    "alreadyCheapestExact": "Ya tienes la oferta más barata para tu perfil.",
    "alreadyCheapestBelow": "Tu prima está por debajo de todas las ofertas para este perfil: comprueba si la franquicia y el modelo son comparables.",
    "alreadyCheapestDetail": "{insurer} · {amount}/mes.",
    "cheapestOnlyTitle": "Oferta más barata: {amount}/mes con {insurer}.",
    "cheapestOnlyCta": "Introduce tu aseguradora actual para ver cuánto podrías ahorrar. ↓"
  },
  "footer": {
    "dataNotice": "Datos: datos abiertos de la OFSP · Publicación {date} · Solo prestaciones obligatorias · Sin patrocinio, sin enlaces de intermediación",
    "levyNotice": "Los precios incluyen la redistribución de la tasa sobre el CO₂/COV (CHF {amount}/mes, {year}): igual para todas las aseguradoras, sin efecto en la clasificación"
  },
  "help": {
    "tip": {
      "openLabel": "Mostrar explicación",
      "fullLink": "Guía completa →"
    },
    "terms": {
      "plz": {
        "title": "Código postal y región de prima",
        "oneLiner": "Define tu región de prima: las primas varían según el municipio, no solo según el cantón.",
        "short": "Tu prima depende de dónde vivas. Muchos cantones están divididos en dos o tres regiones de prima, y la región que se aplica la determina el municipio, no solo el código postal. Si un código postal abarca varios municipios, eliges el tuyo."
      },
      "birthYear": {
        "title": "Año de nacimiento y grupo de edad",
        "short": "Las primas difieren en tres grupos de edad: niños (0–18), adultos jóvenes (19–25) y adultos (26+). Tu año de nacimiento define tu grupo de edad y, con él, los niveles de franquicia disponibles."
      },
      "franchise": {
        "title": "Franquicia (Franchise)",
        "oneLiner": "Una franquicia más alta reduce tu prima mensual.",
        "short": "La franquicia es la parte de tus gastos sanitarios que pagas de tu bolsillo cada año antes de que la aseguradora empiece a pagar. Los adultos eligen entre CHF 300 y CHF 2500. Una franquicia alta significa una prima más baja, pero más riesgo de gastos propios si necesitas atención. La cobertura es idéntica en cualquier caso."
      },
      "unfalldeckung": {
        "title": "Cobertura de accidentes",
        "short": "El seguro básico normalmente también cubre los accidentes. Si trabajas al menos 8 horas por semana para un empleador, estás cubierto contra accidentes a través de él y puedes excluir la cobertura de accidentes de tu seguro de salud, lo que reduce ligeramente la prima. En caso de duda, déjala incluida."
      },
      "models": {
        "title": "Modelos de seguro",
        "short": "Eliges entre el modelo estándar (libre elección de médico) y un modelo alternativo más barato con un primer punto de contacto fijo. La cobertura es la misma en todos.",
        "altGroup": "Modelos alternativos"
      }
    },
    "banner": {
      "text": "🇨🇭 ¿Nuevo en el seguro básico suizo?",
      "cta": "Cómo funciona el sistema →"
    },
    "drawer": {
      "title": "Cómo funciona el seguro básico suizo",
      "close": "Cerrar",
      "readFull": "Abrir la guía completa →"
    },
    "guide": {
      "lead": "El seguro básico es obligatorio y, por ley, idéntico en todas las aseguradoras. Así que solo comparas precio, modelo y servicio, no el alcance de la cobertura.",
      "back": "← Volver a la comparación",
      "rules": {
        "heading": "Las reglas que se aplican a todos",
        "item1": "El seguro básico es obligatorio. Después de mudarte a Suiza tienes tres meses para contratarlo; la protección se aplica de forma retroactiva a la fecha de tu llegada.",
        "item2": "Todas las aseguradoras deben aceptarte en el seguro básico. No hay preguntas de salud ni rechazos.",
        "item3": "Puedes cambiar de aseguradora una vez al año. La baja debe llegar a tu aseguradora actual antes del 30 de noviembre; el cambio surte efecto el 1 de enero.",
        "item4": "El alcance de la cobertura está fijado por ley y es el mismo en todas partes. Una aseguradora más barata no es menos seguro."
      },
      "terms": {
        "heading": "Los términos del formulario",
        "intro": "En resumen: encontrarás las mismas explicaciones junto a cada campo."
      },
      "models": {
        "heading": "Modelo estándar o alternativo"
      }
    }
  },
  "copy": {
    "tarifart": {
      "standard": { "label": "Estándar", "description": "Libre elección de médico" },
      "hausarzt": { "label": "Médico de familia", "description": "El primer punto de contacto es siempre el médico de familia elegido" },
      "telmed": { "label": "Telmed", "description": "Hay que llamar a una línea de atención antes de cada visita al médico" },
      "hmo": { "label": "HMO", "description": "El primer punto de contacto es siempre el centro HMO" },
      "andere": { "label": "Modelo alternativo", "description": "Elección limitada del primer punto de contacto" }
    },
    "altersklasse": {
      "kind": "Niño (0–18)",
      "jung": "Adulto joven (19–25)",
      "erwachsen": "Adulto (26+)"
    }
  },
  "languageSwitcher": {
    "menuLabel": "Elegir idioma"
  }
}
```

- [ ] **Step 5: Run the parity test to verify it passes**

Run: `npx vitest run src/messages/messages.test.ts`
Expected: PASS — both new catalogs have exactly `de.json`'s key set and placeholder set. If it fails on a key/placeholder mismatch, fix the offending line in the new catalog (do not change `de.json` or the test's `deKeys` source).

- [ ] **Step 6: Commit**

```bash
git add src/messages/pt.json src/messages/es.json src/messages/messages.test.ts
git commit -m "feat(i18n): add Portuguese and Spanish message catalogs"
```

---

## Task 3: Register pt/es locales and wire up switcher, dates, sitemap

**Files:**
- Modify: `src/i18n/routing.ts`
- Modify: `src/components/LanguageSwitcher.tsx` (`LANGUAGE_NAMES` ~line 10)
- Modify: `src/components/InsuranceComparator.tsx` (`DATE_LOCALE` ~line 47)
- Modify: `src/app/sitemap.test.ts` (full rewrite of the test bodies)
- Test: `src/app/sitemap.test.ts`, plus full `npm test` + `npm run build`

**Interfaces:**
- Consumes: `pt.json` / `es.json` from Task 2 (loaded by `src/i18n/request.ts` via dynamic import — no code change needed there), and the pt/es unit maps from Task 1.
- Produces: `routing.locales === ["de", "fr", "it", "en", "pt", "es"]`; `Locale` union (exported from `src/i18n/routing.ts`) gains `"pt" | "es"`; `sitemap()` returns 12 entries.

- [ ] **Step 1: Rewrite the test bodies in `src/app/sitemap.test.ts`**

Replace the entire file with:

```ts
import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);
  const LOCALES = ["de", "en", "es", "fr", "it", "pt"];

  it("lists /{locale} and /{locale}/how-it-works for all six locales (12 entries)", () => {
    expect([...urls].sort()).toEqual(
      LOCALES.flatMap((l) => [
        `https://example.com/${l}`,
        `https://example.com/${l}/how-it-works`,
      ]).sort(),
    );
  });

  it("contains no parameterized URLs", () => {
    expect(urls.every((u) => !u.includes("?"))).toBe(true);
  });

  it("every entry carries hreflang alternates for all six locales with correct per-path targeting", () => {
    for (const entry of entries) {
      const languages = entry.alternates?.languages ?? {};
      expect(Object.keys(languages).sort()).toEqual([...LOCALES].sort());

      const entryPath = entry.url.replace("https://example.com", "");
      const isHowItWorksPath = entryPath.endsWith("/how-it-works");

      for (const locale of LOCALES) {
        const expectedAlternate = isHowItWorksPath
          ? `https://example.com/${locale}/how-it-works`
          : `https://example.com/${locale}`;
        expect(languages[locale as keyof typeof languages]).toBe(expectedAlternate);
      }
    }
  });
});
```

- [ ] **Step 2: Run the sitemap test to verify it fails**

Run: `npx vitest run src/app/sitemap.test.ts`
Expected: FAIL — routing still has 4 locales, so `sitemap()` returns 8 entries and the alternates have 4 keys.

- [ ] **Step 3: Add pt/es to `src/i18n/routing.ts`**

```ts
export const routing = defineRouting({
  locales: ["de", "fr", "it", "en", "pt", "es"],
  defaultLocale: "de",
  localePrefix: "always",
});
```

(Leave the explanatory comment; optionally update "All four locales" → "All six locales".)

- [ ] **Step 4: Add pt/es to `LANGUAGE_NAMES` in `src/components/LanguageSwitcher.tsx`**

```ts
const LANGUAGE_NAMES: Record<(typeof routing.locales)[number], string> = {
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  en: "English",
  pt: "Português",
  es: "Español",
};
```

- [ ] **Step 5: Add pt/es to `DATE_LOCALE` in `src/components/InsuranceComparator.tsx`**

```ts
const DATE_LOCALE: Record<Locale, string> = { de: "de-CH", fr: "fr-CH", it: "it-CH", en: "en-CH", pt: "pt-PT", es: "es-ES" };
```

- [ ] **Step 6: Run the sitemap test to verify it passes**

Run: `npx vitest run src/app/sitemap.test.ts`
Expected: PASS (12 entries, 6-key alternates).

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS. Watch specifically for `src/lib/help.test.ts` (imports only `de.json` — unaffected) and any snapshot that enumerates locales. If another test hardcodes the four-locale list, update it to the six-locale list in `de, en, es, fr, it, pt` order.

- [ ] **Step 8: Type-check and build**

Run: `npm run build`
Expected: SUCCESS. The build statically generates `/pt` and `/es` (and `/pt/how-it-works`, `/es/how-it-works`) via `generateStaticParams`. A TypeScript error in `DATE_LOCALE` means Step 5 was missed; a missing-message error means a key is absent from a new catalog.

- [ ] **Step 9: Commit**

```bash
git add src/i18n/routing.ts src/components/LanguageSwitcher.tsx src/components/InsuranceComparator.tsx src/app/sitemap.test.ts
git commit -m "feat(i18n): register pt/es locales in routing, switcher, dates, sitemap"
```

---

## Task 4: Manual verification & PR

**Files:** none (verification + PR only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify Portuguese**

- Visit `http://localhost:3000/pt` — comparator renders in Portuguese, heading "Comparação de prémios".
- Visit `http://localhost:3000/pt/how-it-works` — guide renders in Portuguese.
- View source: `<html lang="pt">`, `<title>` is the Portuguese `meta.title`, and `<link rel="alternate" hreflang="pt" …>` + `hreflang="es"` + `x-default` are present.

- [ ] **Step 3: Verify Spanish**

- Visit `http://localhost:3000/es` and `http://localhost:3000/es/how-it-works` — render in Spanish.
- View source: `<html lang="es">`, Spanish `<title>`.

- [ ] **Step 4: Verify the switcher and negotiation**

- On `/de?plz=8000&birthYear=1990`, pick "Português" in the switcher → lands on `/pt?plz=8000&birthYear=1990` with the comparison intact.
- `curl -s -H 'Accept-Language: es' -i http://localhost:3000/` → `location:` header points to `/es`.
- `curl -s -H 'Accept-Language: pt-PT,pt;q=0.9' -i http://localhost:3000/` → redirects to `/pt`.

- [ ] **Step 5: Verify the footer date**

On `/pt` and `/es`, the footer's publication date renders in the locale's format (no crash, no `Invalid Date`).

- [ ] **Step 6: Final full check**

Run: `npm test && npm run build`
Expected: both PASS.

- [ ] **Step 7: Push and open the PR**

```bash
git push -u origin feat/add-pt-es-locales
gh pr create --base main --title "feat(i18n): add Portuguese and Spanish locales" --body "$(cat <<'EOF'
## What

Adds `pt` (Portuguese, pt-PT) and `es` (Spanish, es-ES) as first-class locales alongside de/fr/it/en, each on its own crawlable `/{locale}` URL with full UI translation.

## Changes

- `src/i18n/routing.ts` — `pt`, `es` added to `locales` (drives routing, negotiation, static generation, hreflang, sitemap, switcher).
- `src/messages/pt.json`, `src/messages/es.json` — full UI catalogs, same keys/placeholders as `de.json` (enforced by `messages.test.ts`).
- `src/components/LanguageSwitcher.tsx` — `Português` / `Español` entries.
- `src/components/InsuranceComparator.tsx` — `pt-PT` / `es-ES` in `DATE_LOCALE`.
- `src/lib/format.ts` — pt/es unit words for the member-count badge.
- `messages.test.ts`, `sitemap.test.ts`, `format.test.ts` — extended to 6 locales.

Design & spec: `docs/superpowers/specs/2026-08-27-add-pt-es-locales-design.md`

## Out of scope

Crawled provider product descriptions (`product-descriptions.json`) stay de/en/fr/it — the lookup falls back to the generic per-Tarifart description. Admin panel untouched.

## Translation quality

Machine-authored with correct insurance terminology, consistent with how fr/it/en were done. Native FR/IT/PT/ES review is a recommended non-blocking follow-up.

## Verification

- `npm test` — pass (parity + sitemap + format)
- `npm run build` — pass, statically generates `/pt`, `/es`, `/pt/how-it-works`, `/es/how-it-works`
- Manual: both locales render; switcher preserves query state; `Accept-Language` negotiation; per-locale `<title>`/`<html lang>`/`hreflang`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Core wiring (`routing.ts`, two catalogs) → Tasks 2 & 3. ✅
- Hardcoded four-locale spots (`LanguageSwitcher`, `DATE_LOCALE`, `format.ts`) → Tasks 1 & 3. ✅
- Deliberately unchanged (`productDescriptions.ts`, `formatChf`, admin, `robots.ts`) → Global Constraints + not touched by any task. ✅
- Testing (`messages.test.ts`, `sitemap.test.ts`, `format.test.ts`, `npm test`, `npm run build`, manual pass) → Tasks 1, 2, 3, 4. ✅
- Insurance terminology table → applied in the Task 2 catalog content. ✅
- Follow-up note → PR body. ✅

**Placeholder scan:** No TBD/TODO. All code steps contain literal content, including both full JSON catalogs and the full sitemap test rewrite. ✅

**Type consistency:** `Locale` in `src/lib/format.ts` is a module-local type (Task 1) — distinct from the `Locale` exported by `src/i18n/routing.ts` (used in `InsuranceComparator.tsx`, Task 3); both get `"pt" | "es"`. `DATE_LOCALE` keys match the routing `Locale` union after Task 3. `LANGUAGE_NAMES` is typed `Record<(typeof routing.locales)[number], string>` so it must list all six after Task 3 Step 3. Catalog key paths are validated against `de.json` by `messages.test.ts`. ✅
