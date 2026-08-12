# Raw BAG data

Committed here so the exact source is auditable and
`npm run ingest -- --local data/raw --publication-date <YYYY-MM-DD>`
works offline (architecture.md §3.1).

| File | Source | Refresh |
|---|---|---|
| `praemien.csv` | `https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1Byw6RtaWVuX0NILmNzdg%3D%3D` (decodes to `/Praemien/Praemien_CH.csv`) | Re-run `npm run ingest` (no `--local`) whenever BAG publishes new/updated data — see architecture.md §12. Historically published ~Sept/Oct for the following year. |
| `praemienregionen.xlsx` | `https://www.priminfo.admin.ch/downloads/praemienregionen.xlsx` | Same as above; sheet `A_COM` is the one consumed. |

Neither source publishes a machine-readable "published on" date — pass the real date via
`--publication-date <YYYY-MM-DD>` when running the ingest (check the BAG premium
press release date for that year).
