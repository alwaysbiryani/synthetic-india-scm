# Kick the tires

An **unofficial** playground for stacking criticisms of Grier & Grier (2026), *Promises, Promises: Governance and Growth in India under Modi and the BJP*.

This is **not** the authors’ analysis, **not** their website, and **not** affiliated with Texas Tech. It is inspired by their paper and public replication files. For the real argument, read the [paper](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7248338) and [their data companion](https://rgrier88.github.io/modi-promises/).

Repo: [alwaysbiryani/synthetic-india-scm](https://github.com/alwaysbiryani/synthetic-india-scm)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/alwaysbiryani/synthetic-india-scm)

**Local:** `npm run dev` → [http://localhost:3000](http://localhost:3000)

**Chart:** black = real India · dashed = paper synthetic · red = stacked scenario

## What you can do

- Re-weight the donor pool (sliders renormalize to 100%)
- Stack five standard objections: weight cap, GDP haircut, V-Dem vs statute, COVID window, policy lag / capital
- Read a live gap and leave-one-out placebo *p*-value under those choices
- Open full notes at the bottom: criticism, what data, and what the knob actually does

Haircuts, statutory/DIF scores, COVID interpolation, and Solow capital are **transforms of the public panels**, not new microdata. Nested Stata `synth` is not re-run; the dashed line uses the published donor recipe.

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

Standalone Next.js app. Data is bundled in `data/panel.json`. No environment variables.

[Import this repo on Vercel](https://vercel.com/new/clone?repository-url=https://github.com/alwaysbiryani/synthetic-india-scm). Framework Next.js, root directory `.`, build `next build`.

```bash
npx vercel login
npx vercel -y          # preview
npx vercel -y --prod   # production
```

If this app ever lives as `dashboard/` inside a monorepo, set Vercel **Root Directory** to `dashboard`.

## Data

From the authors’ public replication panels:

- `income_panel.dta` — Penn World Table 11.0
- `governance_panel.dta` — V-Dem

Sri Lanka GDP is imputed (0.88× Philippines) because LKA is not in the income panel.

> Grier, Kevin and Robin Grier (2026). “Promises, Promises: Governance and Growth in India under Modi and the BJP.” Working paper, Texas Tech University.
