### local → production 

1.select main from left bottom section 
2.commit
3.push

### local → staging 

1.select staging from left bottom section 
2.commit
3.push

### staging → production

```bash
git checkout main
git pull origin main
git merge origin/staging
git push origin main
```


### production → staging

```bash
git checkout staging
git pull origin staging
git merge origin/main
git push origin staging
```

### Why Vercel shows 2 deployments (Production + Preview)

This repo is set up to use **two Vercel projects** pointing to the **same GitHub repo** (see `docs/deployments.md`):

- **Prod project**: Production Branch = `main`
- **Staging project**: Production Branch = `staging`

So when you push:

- Push to `staging`:
    - Staging project deploys **Production** (because `staging` is its production branch)
    - Prod project deploys a **Preview** (because `staging` is *not* its production branch)

- Push to `main`:
    - Prod project deploys **Production**
    - Staging project deploys a **Preview** (because `main` is *not* its production branch)

Those “extra” Preview deploys are normal Vercel Git-integration behavior when multiple projects watch the same repo.

### How to stop the extra Preview deploys

If you want **only one deploy** on `staging` pushes and **only one deploy** on `main` pushes, add an **Ignored Build Step** per Vercel project:

- In the **Prod** Vercel project, set the project’s **Ignore Command / Ignored Build Step** to ignore everything except `main`.

    Where it is in the UI depends on the Vercel dashboard version, but it’s usually under Project **Settings** → **Build & Development Settings** (or similar) and is named **Ignore Command**.

```bash
if [ "$VERCEL_GIT_COMMIT_REF" != "main" ]; then
    echo "Ignore deploy for branch $VERCEL_GIT_COMMIT_REF"
    exit 0
fi
exit 1
```

- In the **Staging** Vercel project, ignore only `main` (so feature branches + `staging` still work there):

```bash
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then
    echo "Ignore main branch in staging project"
    exit 0
fi
exit 1
```

(In Vercel, an Ignored Build Step that exits `0` skips the deployment; a non-zero exit continues the build.)

If you can’t find the UI setting, you can also configure it in-repo via the `ignoreCommand` property (see Vercel “Project Configuration” docs). Note: a repo-based `ignoreCommand` applies to any Vercel project using this repo, so for different behavior per project you’ll typically still prefer the dashboard setting (or a `vercel.ts` that branches on env vars).

This repo already includes a branch-aware `ignoreCommand` in `vercel.json`. To activate it per project, set this **project environment variable** in Vercel:

- Prod Vercel project: `DEPLOY_TARGET=prod`
- Staging Vercel project: `DEPLOY_TARGET=staging`

That makes Vercel skip only the “cross-branch” Preview deploys:

- Prod project ignores `staging` branch deploys
- Staging project ignores `main` branch deploys

Note: Vercel limits `ignoreCommand` length. This repo keeps `vercel.json` short and puts the logic in [scripts/vercelIgnore.mjs](scripts/vercelIgnore.mjs).

### Local content preview (no Supabase content reads)

```bash
npm run dev:local
```

### Validate topic JSON (always do before syncing)

```bash
npm run content:validate
```

### Validate compiled journeys vs schema / rules

```bash
npm run journey:parity
```

### Sync topics → Supabase (production)

```bash
npm run content:sync
```

### Sync topics → Supabase (staging)

```bash
npm run content:sync:staging
```

## Supabase schema

Migrations live under the supabase folder. New staging projects need the SQL run once in order:
- Start with `supabase/001_init.sql`
- Continue in order up to the latest file.

(After schema is applied, use the content sync commands above to populate the `topics` table.)


Scenario 1: we want to go into production directly (we will use this for a while until things getting serious)

0. if main is behind staging in commits:
        ```bash
        git checkout main
        git pull origin main
        git merge origin/staging
        git push origin main
        ```
1.commit
2.push
3.if error in ci or detect sth while testing in production:
    3.1. make changes
    3.2 go to 1

Scenario 2: we want to test things in staging before going into production (after things get serious we only use this scenario)

0. if staging is behind main in commits:
        ```bash
        git checkout staging
        git pull origin staging
        git merge origin/main
        git push origin staging 
        ```
1.select staging in vs code
2.commit
3.push
4.test in staging + check green ci
    5.1 if ok
        5.1.1staging → production
            ```bash
            git checkout main
            git pull origin main
            git merge origin/staging
            git push origin main
            ```
    5.2 if not ok
        5.2.2make more changes until ok (go again to 2) 