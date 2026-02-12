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
