# Synthetic India — SCM Stress-Testing Suite

Interactive synthetic-control dashboard for Grier & Grier (2026), *Promises, Promises: Governance and Growth in India under Modi and the BJP*. Compare real India with the paper’s published Synthetic India, then re-weight donors and stack standard critiques.

**Live local:** `npm run dev` → [http://localhost:3000](http://localhost:3000)

## What you can do

- Re-weight the donor pool (sliders auto-normalize to 100%)
- Cap any single country (default 15%) and/or drop one-party states
- Haircut India’s post-2015 GDP (base-year revision critique)
- Swap V-Dem for constructed statutory / DIF-style series
- Truncate at 2019 or interpolate 2020–21
- Lag treatment 0–7 years or switch GDP to a Solow capital stock
- See a live leave-one-out placebo p-value under the current constraints

Amber = paper recipe. Emerald = your specification.

## Run locally

```bash
npm install
npm run dev
```

```bash
npm run build && npm start
```

Requires Node 20+. No API keys or environment variables.

## Deploy on Vercel

This folder is a standalone Next.js app. Data is bundled in `data/panel.json` (no Stata runtime).

1. Push this directory to GitHub (it is the repo root).
2. In Vercel: **Add New Project** → import the repo.
3. Framework: Next.js. Root directory: `.` (leave default).
4. Build command `next build`, output default. No env vars.

CLI:

```bash
npx vercel -y          # preview
npx vercel -y --prod   # production
```

If this app ever lives as `dashboard/` inside a monorepo, set Vercel **Root Directory** to `dashboard`.

## Data

Derived from the authors’ replication panels:

- `income_panel.dta` — Penn World Table 11.0
- `governance_panel.dta` — V-Dem

Sri Lanka GDP is imputed (0.88× Philippines) because LKA is not in the income panel. GDP haircuts, statutory/DIF scores, COVID interpolation, and Solow capital are **transforms of those series**, not new microdata. Nested Stata `synth` is not re-run; the amber line uses the published donor weights.

Paper: [SSRN 7248338](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7248338) · [data companion](https://rgrier88.github.io/modi-promises/)

> Grier, Kevin and Robin Grier (2026). “Promises, Promises: Governance and Growth in India under Modi and the BJP.” Working paper, Texas Tech University.
