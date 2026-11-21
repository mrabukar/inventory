# Database Backup Guide (local + offsite R2)

How to give any project on this server a **nightly Postgres backup** that is
verified, kept locally (last 7), and copied offsite to a private Cloudflare R2
bucket (last 14).

This is the exact pattern running for the `inventory` project. The generic,
multi-project scripts in sections 5 and 6 are parameterised versions of it.
The inventory-specific scripts were tested in production; the generic versions
below have not been run yet. Test each project once by hand (section 8).

---

## 1. How it works

```
cron 02:xx  ->  backup-db.sh <project> <env-file>
                  1. pg_dump -Fc  -> temp file
                  2. pg_restore --list  (verify the dump is readable)
                  3. rename to <project>-YYYYMMDD-HHMMSS.dump   (chmod 600)
                  4. upload-backup.js -> R2  backups/<project>/...
                       - verifies remote size == local size
                       - only then prunes remote to newest 14
                  5. prune local to newest 7
                  6. log everything to ~/db-backups/backup.log
```

Safety rules built in:

- Old backups are deleted **only after** the new one is created and verified.
- A failed dump or failed verification deletes **nothing**.
- A failed upload keeps the local backup and deletes **no** remote copies;
  the next night retries.
- Pruning only matches `<project>-*.dump` for that one project, so one
  project can never delete another project's backups.
- Credentials are read from env files at run time and never written into
  scripts, logs or git.

## 2. Layout on the server

| What | Where |
|---|---|
| Shared scripts | `~/backup-tools/backup-db.sh`, `~/backup-tools/upload-backup.js` |
| Local backups | `~/db-backups/<project>-<timestamp>.dump` |
| Log | `~/db-backups/backup.log` |
| R2 credentials | `~/.backup-r2.env` (chmod 600, **outside every repo**) |
| Cron | `crontab -e` as the `deploy` user |

Keep one copy of the scripts in `~/backup-tools/` and call it once per
project. Do not copy the script into every project.

> The `inventory` project currently uses its own copies in
> `/var/www/inventory/scripts/`. You can switch it to the shared scripts
> later, or leave it as is.

## 3. One-time setup: R2 bucket and token

Do this once for the whole server (or once per project if you want hard
isolation, see the note at the end of this section).

1. Cloudflare dashboard -> **R2** -> **Create bucket**, e.g. `server-backups`.
2. Keep it **private**: do not enable the `r2.dev` public URL and do not
   attach a custom domain.
3. R2 -> **Manage API tokens** -> create a token with **Object Read & Write**,
   scoped to **this bucket only**.
4. Create `~/.backup-r2.env` **in your home directory** (not inside a repo):

   ```bash
   install -m 600 /dev/null ~/.backup-r2.env
   nano ~/.backup-r2.env
   ```

   ```
   BACKUP_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   BACKUP_R2_BUCKET=server-backups
   BACKUP_R2_ACCESS_KEY_ID=...
   BACKUP_R2_SECRET_ACCESS_KEY=...
   ```

5. Check the permissions: `ls -l ~/.backup-r2.env` must show `-rw-------`.

Common mistake: typing `~/` in an IDE "new file" box can create a literal
folder named `~` inside the current project. Always create secrets with the
terminal as above, and confirm with `ls -la ~/.backup-r2.env`.

Objects are stored as `backups/<project>/<project>-<timestamp>.dump`, so all
projects can share one bucket. If you want a leaked token to expose only one
project, create one bucket and one token per project and one env file per
project (see section 10).

**Never use the app's image/upload bucket for backups.** It may serve files
publicly, and the app's own key could delete the backups.

## 4. Per-project checklist: find the database

For each project, find where its database URL lives:

```bash
pm2 describe <app-name> | grep -E 'exec cwd|script path'
ls -la <that-dir>/.env*
grep -E '^DATABASE_URL=' <that-dir>/.env | sed -E 's#(://[^:]+:)[^@]+@#\1****@#'
```

Check:

- Is it Postgres? (`postgresql://...`). This guide covers Postgres only;
  MySQL and Mongo need different tools.
- Is it `localhost` or a hosted DB (Neon, etc.)? Hosted databases may need
  `sslmode=require` and a **direct** (non-pooled) connection URL for
  `pg_dump`.
- Query parameters like `?schema=public` are stripped by the script, because
  `pg_dump` does not understand them.
- Write down the project name (lowercase letters, digits, hyphens only):
  e.g. `inventory`, `fonex`, `skyview`, `brro`, `greenfield`, `phonivo`.

Pick a cron time per project, staggered by 10 minutes so dumps do not overlap.

## 5. The scripts

### 5.1 `~/backup-tools/backup-db.sh`

```bash
#!/usr/bin/env bash
# Usage: backup-db.sh <project> <path-to-env-file-with-DATABASE_URL>
# Dumps, verifies, uploads offsite, prunes. Keeps newest KEEP local copies.
set -euo pipefail

PROJECT="${1:?usage: backup-db.sh <project> <env-file>}"
ENV_FILE="${2:?usage: backup-db.sh <project> <env-file>}"
[[ "$PROJECT" =~ ^[a-z0-9-]+$ ]] || { echo "bad project name" >&2; exit 2; }

BACKUP_DIR="$HOME/db-backups"
KEEP=7
LOG="$BACKUP_DIR/backup.log"
TOOLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$BACKUP_DIR"
log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') [$PROJECT] $*" >> "$LOG"; }

TMP="$BACKUP_DIR/.$PROJECT-in-progress.dump"
trap 'rm -f "$TMP"' EXIT

DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- \
  | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
DATABASE_URL="${DATABASE_URL%%\?*}"      # strip ?schema=... style params
if [ -z "$DATABASE_URL" ]; then log "FAILED: DATABASE_URL not found in $ENV_FILE"; exit 1; fi

if ! pg_dump -Fc "$DATABASE_URL" -f "$TMP" 2>>"$LOG"; then
  log "FAILED: pg_dump error; old backups kept"; exit 1
fi
if ! pg_restore --list "$TMP" >/dev/null 2>>"$LOG"; then
  log "FAILED: dump did not verify; old backups kept"; exit 1
fi

FINAL="$BACKUP_DIR/$PROJECT-$(date -u +%Y%m%d-%H%M%S).dump"
mv "$TMP" "$FINAL"
chmod 600 "$FINAL"
log "OK: created $(basename "$FINAL") ($(du -h "$FINAL" | cut -f1))"

# Offsite copy. Failure is logged but never affects the local backup.
UPLOAD_RC=0
if [ -f "$HOME/.backup-r2.env" ]; then
  if OUT="$(/usr/bin/node "$TOOLS_DIR/upload-backup.js" "$FINAL" "$PROJECT" 2>&1)"; then
    log "OK offsite: $(echo "$OUT" | grep -v -iE 'warning|node >=|aws|more information|trace-warnings' | tr '\n' ' ')"
  else
    log "FAILED offsite upload: $(echo "$OUT" | tr '\n' ' ')"
    UPLOAD_RC=1
  fi
else
  log "SKIPPED offsite upload: ~/.backup-r2.env not found"
fi

# Prune local: keep newest KEEP for THIS project only.
ls -1t "$BACKUP_DIR/$PROJECT"-*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -f -- "$old" && log "pruned $(basename "$old")"
done

exit "$UPLOAD_RC"
```

> Careful with project names that are prefixes of each other (for example
> `app` and `app-staging`): the glob `app-*.dump` would match both. Use
> names that do not start with another project's name followed by a hyphen.

### 5.2 `~/backup-tools/upload-backup.js`

```js
#!/usr/bin/env node
// Usage: node upload-backup.js <file> <project>
// Uploads to R2 at backups/<project>/<file>, verifies size, then prunes the
// remote copies of THIS project to the newest KEEP.
const fs = require('fs');
const os = require('os');
const path = require('path');

// @aws-sdk/client-s3 is borrowed from a project that already has it installed.
// Override with: SDK_FROM=/path/to/some/project/package.json
const SDK_FROM = process.env.SDK_FROM || '/var/www/inventory/api/package.json';
const {
  S3Client, PutObjectCommand, HeadObjectCommand,
  ListObjectsV2Command, DeleteObjectsCommand,
} = require('module').createRequire(SDK_FROM)('@aws-sdk/client-s3');

const KEEP = 14;

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

async function main() {
  const [file, project] = process.argv.slice(2);
  if (!file || !fs.existsSync(file)) throw new Error('backup file not found');
  if (!/^[a-z0-9-]+$/.test(project || '')) throw new Error('bad project name');
  const base = path.basename(file);
  const nameRe = new RegExp(`^${project}-\\d{8}-\\d{6}\\.dump$`);
  if (!nameRe.test(base)) throw new Error('unexpected backup file name: ' + base);

  // Optional per-project override: ~/.backup-r2.<project>.env, else shared file.
  const own = path.join(os.homedir(), `.backup-r2.${project}.env`);
  const envFile = fs.existsSync(own) ? own : path.join(os.homedir(), '.backup-r2.env');
  const env = loadEnv(envFile);
  for (const k of ['BACKUP_R2_ENDPOINT', 'BACKUP_R2_BUCKET',
                   'BACKUP_R2_ACCESS_KEY_ID', 'BACKUP_R2_SECRET_ACCESS_KEY'])
    if (!env[k]) throw new Error(`missing ${k} in ${envFile}`);

  const s3 = new S3Client({
    region: 'auto',
    endpoint: env.BACKUP_R2_ENDPOINT,
    credentials: {
      accessKeyId: env.BACKUP_R2_ACCESS_KEY_ID,
      secretAccessKey: env.BACKUP_R2_SECRET_ACCESS_KEY,
    },
  });
  const Bucket = env.BACKUP_R2_BUCKET;
  const Prefix = `backups/${project}/`;
  const Key = Prefix + base;
  const body = fs.readFileSync(file);

  await s3.send(new PutObjectCommand({
    Bucket, Key, Body: body, ContentType: 'application/octet-stream' }));
  const head = await s3.send(new HeadObjectCommand({ Bucket, Key }));
  if (head.ContentLength !== body.length)
    throw new Error(`size mismatch: local ${body.length} remote ${head.ContentLength}`);
  console.log(`uploaded ${Key} (${body.length} bytes, verified)`);

  // Prune only after a verified upload, only inside this project's prefix.
  const objs = [];
  let token;
  do {
    const r = await s3.send(new ListObjectsV2Command({
      Bucket, Prefix, ContinuationToken: token }));
    objs.push(...(r.Contents || []));
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);

  const keyRe = new RegExp(`^backups/${project}/${project}-\\d{8}-\\d{6}\\.dump$`);
  const keys = objs.map((o) => o.Key).filter((k) => keyRe.test(k)).sort().reverse();
  const old = keys.slice(KEEP);
  if (old.length) {
    await s3.send(new DeleteObjectsCommand({
      Bucket, Delete: { Objects: old.map((k) => ({ Key: k })) } }));
    console.log(`pruned ${old.length} old remote backup(s)`);
  }
  console.log(`remote now holds ${Math.min(keys.length, KEEP)} backup(s)`);
}

main().catch((e) => {
  console.error('UPLOAD FAILED: ' + (e && e.message ? e.message : e));
  process.exit(1);
});
```

## 6. Install

```bash
mkdir -p ~/backup-tools ~/db-backups
# create the two files above, then:
chmod 750 ~/backup-tools/backup-db.sh
chmod 640 ~/backup-tools/upload-backup.js
```

## 7. Schedule (cron)

Edit with `crontab -e` as the `deploy` user. Server time is **UTC**
(`timedatectl`). Stagger projects by 10 minutes:

```cron
0  2 * * * /home/deploy/backup-tools/backup-db.sh inventory  /var/www/inventory/api/.env
10 2 * * * /home/deploy/backup-tools/backup-db.sh fonex      /var/www/fonex/api/.env
20 2 * * * /home/deploy/backup-tools/backup-db.sh skyview    /var/www/skyview/api/.env
30 2 * * * /home/deploy/backup-tools/backup-db.sh brro       /var/www/brro/api/.env
```

The paths above are **examples**. Use the real env path found in section 4.

Never overwrite the crontab blindly. Append safely:

```bash
(crontab -l 2>/dev/null; echo '10 2 * * * /home/deploy/backup-tools/backup-db.sh fonex /var/www/fonex/api/.env') | crontab -
crontab -l
```

## 8. Test each project once, by hand

Do this before trusting the cron entry:

```bash
~/backup-tools/backup-db.sh fonex /var/www/fonex/api/.env; echo "exit=$?"
tail -5 ~/db-backups/backup.log
ls -lh ~/db-backups | grep fonex
```

Expected: `exit=0`, a log line `OK: created fonex-....dump`, and a log line
`OK offsite: uploaded backups/fonex/fonex-....dump (... bytes, verified)`.

The test only reads the database. It adds one dump file and one R2 object
and deletes nothing (until you exceed 7 local or 14 remote copies).

Also confirm the object is visible in the Cloudflare dashboard under
`backups/<project>/`.

## 9. Restore (and how to test a restore safely)

An untested backup is a hope, not a backup. Test restores into a **scratch
database**, never into production.

```bash
# 1. Pick a dump (local, or download it from R2 first)
ls -lt ~/db-backups/<project>-*.dump | head

# 2. Create a scratch database
createdb -h localhost -U <user> restore_test

# 3. Restore into the scratch DB
pg_restore --no-owner --no-privileges -d "postgresql://<user>:<pass>@localhost:5432/restore_test" \
  ~/db-backups/<project>-YYYYMMDD-HHMMSS.dump

# 4. Compare a few row counts against production
psql "postgresql://<user>:<pass>@localhost:5432/restore_test" -c 'select count(*) from "user";'

# 5. Drop the scratch DB
dropdb -h localhost -U <user> restore_test
```

For a real disaster (production database lost), restore into a **new empty
database**, point the app at it, and verify before switching traffic. Do not
restore on top of a live database without a fresh backup of its current
state first.

To download a dump from R2 you need the same credentials. A one-off with the
AWS CLI is the simplest, if installed:

```bash
aws s3 cp s3://<bucket>/backups/<project>/<file>.dump . \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com
```

Or download it from the Cloudflare dashboard.

## 10. Per-project isolation (optional, more secure)

If projects belong to different clients or teams, give each its own bucket
and token:

1. Create bucket `backups-<project>` and a token scoped to it.
2. Save as `~/.backup-r2.<project>.env` (chmod 600) with the same four
   variables. The upload script automatically prefers this file over the
   shared `~/.backup-r2.env`.

## 11. Monitoring (do not skip)

Failures are **logged, not announced**. Make checking routine:

```bash
# last runs
tail -30 ~/db-backups/backup.log

# any failures
grep -E 'FAILED|SKIPPED' ~/db-backups/backup.log | tail

# freshest backup per project (should be < 26h old)
for f in ~/db-backups/*-*.dump; do echo "$f"; done | sed -E 's#.*/([a-z0-9-]+)-[0-9]{8}-.*#\1#' | sort -u |
while read -r p; do ls -1t ~/db-backups/$p-*.dump | head -1; done
```

Check the log the morning after adding a project, then weekly. If you want
alerts, add a dead-man's-switch service (e.g. healthchecks.io): ping its URL
at the end of a successful run, and it emails you when the ping is missing.

Rotate `backup.log` occasionally (it grows slowly):
`tail -n 2000 ~/db-backups/backup.log > /tmp/bl && mv /tmp/bl ~/db-backups/backup.log`.

## 12. Security notes

- Dumps contain **real customer data**. Keep `~/db-backups` readable by
  `deploy` only (files are chmod 600).
- The R2 bucket must stay private. Re-check the dashboard when you create it.
- Never commit `.env` or `.backup-r2*.env` files. Check with
  `git status` before every commit.
- Do not paste keys into chats, tickets or notes files that live in a repo.
  If a key was ever exposed, rotate it in Cloudflare and update the env file.
- The R2 token should be **bucket-scoped, Object Read & Write only**.
- Consider enabling an R2 lifecycle rule or bucket versioning as an extra
  safety net against accidental deletion.

## 13. Troubleshooting

| Symptom in `backup.log` | Likely cause / fix |
|---|---|
| `DATABASE_URL not found` | Wrong env path, or the variable has another name. Check section 4. |
| `pg_dump: error: connection ... failed` | Wrong credentials, DB not on localhost, or hosted DB needs `sslmode=require` / a direct URL. |
| `pg_dump: error: server version mismatch` | Server newer than client `pg_dump`. Install a matching `postgresql-client-<ver>`. |
| `dump did not verify` | Dump file corrupt or truncated (disk full?). Check `df -h`. |
| `FAILED offsite upload: missing BACKUP_R2_...` | A variable is missing or misspelled in the env file. |
| `AccessDenied` / `403` | Token not scoped to this bucket, or lacks write permission. |
| `SKIPPED offsite upload` | `~/.backup-r2.env` is missing or in the wrong place (see the `~` folder warning in section 3). |
| `size mismatch` | Interrupted upload. It retries on the next run. |
| Cron never ran | `grep CRON /var/log/syslog | tail`; use absolute paths; check `crontab -l`. |
| Warning about Node `>=22` | From the AWS SDK on Node 20. Harmless now; plan a Node upgrade before the SDK drops Node 20 (after the first week of January 2027). |

## 14. Rollout checklist per new project

- [ ] Project name chosen (lowercase, hyphens, not a prefix of another)
- [ ] `DATABASE_URL` location found; DB is Postgres
- [ ] `pg_dump` can connect (manual test)
- [ ] Bucket exists, private, token scoped; `~/.backup-r2.env` is in `~`
- [ ] Scripts installed in `~/backup-tools/`
- [ ] Manual test run: exit 0, local dump, remote object verified
- [ ] Cron entry added (staggered, absolute paths)
- [ ] Log checked the morning after the first scheduled run
- [ ] Restore tested once into a scratch database
