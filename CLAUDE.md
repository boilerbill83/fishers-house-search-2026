# Claude Code Session Guide

## Git / Push Setup (CRITICAL — do this first every session)

The local git proxy resets each session and is **read-only**. Before any push, set the remote to use the PAT:

```bash
PAT=$(cat /home/user/fishers-house-search-2026/.github_pat)
git remote set-url origin https://${PAT}@github.com/boilerbill83/fishers-house-search-2026.git
```

**The PAT is stored in `/home/user/fishers-house-search-2026/.github_pat`** (gitignored). Run the two lines above at the start of every session before pushing.

If push is rejected (remote ahead), rebase first:
```bash
git pull --rebase origin main && git push origin main
```

If rebase conflicts: `git rebase --abort`, then `git reset --hard origin/main` and re-apply changes manually.

## Updating a Property Status

1. Edit `propertyData.js` — find the address, change `status: "Active"` to `"Pending"`, `"Sold"`, etc.
2. Commit and push:
```bash
git add propertyData.js && git commit -m "Mark [address] as [status]" && git push origin main
```

That's it. GitHub Actions auto-deploys to https://boilerbill83.github.io/fishers-house-search-2026/ in ~1-2 min.

## Project Structure

| File | Purpose |
|------|---------|
| `propertyData.js` | All 16 property objects — edit statuses, prices, notes here |
| `App.js` | React UI — scoring, filters, summary table, cards |
| `.github/workflows/deploy.yml` | CI/CD: npm install → webpack build → deploy to gh-pages |

## Adding a New Property

When adding a new house, always check the `neighborhoodSummary` field. If it is blank (`""`):

1. Search the web for the subdivision name + "Fishers IN" to find HOA details, amenities, pool info, and home count.
2. Write a 1–2 sentence factual summary covering: confirmed amenities, pool status (Yes/No/separate membership), HOA fee context, and home count if available.
3. Set `hasNeighborhoodPool` to match the confirmed pool status.
4. If a property shares a neighborhood already in the file, reuse that neighborhood's `neighborhoodSummary`.

Also update `commuteHusband` to match the file's realistic 8am rush-hour scale (43–57 min) based on the property's location — south Fishers ~43–46 min, central ~47–50 min, north/east ~51–57 min.

## Key Property Fields

```js
status: "Active" | "Pending" | "Sold"   // what to update most often
price: 619900                             // list price
notes: "..."                              // freeform notes shown on card
```

## Deploy Check

Watch build progress at: https://github.com/boilerbill83/fishers-house-search-2026/actions
