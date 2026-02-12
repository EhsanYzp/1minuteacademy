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