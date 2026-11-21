#!/usr/bin/env node
// Uploads one backup file to the private R2 backups bucket, verifies the
// size, then prunes remote copies to the newest KEEP under backups/inventory-.
// Usage: node upload-backup.js /path/to/inventory-YYYYMMDD-HHMMSS.dump
// Credentials come from ~/.backup-r2.env (not the app's .env).
const fs = require('fs');
const os = require('os');
const path = require('path');
const apiRequire = require('module').createRequire(
  '/var/www/inventory/api/package.json',
);
const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = apiRequire('@aws-sdk/client-s3');

const KEEP = 14;
const PREFIX = 'backups/inventory-';

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

async function main() {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) throw new Error('backup file not found');
  const base = path.basename(file);
  if (!/^inventory-\d{8}-\d{6}\.dump$/.test(base))
    throw new Error('unexpected backup file name: ' + base);

  const env = loadEnv(path.join(os.homedir(), '.backup-r2.env'));
  for (const k of [
    'BACKUP_R2_ENDPOINT',
    'BACKUP_R2_BUCKET',
    'BACKUP_R2_ACCESS_KEY_ID',
    'BACKUP_R2_SECRET_ACCESS_KEY',
  ])
    if (!env[k]) throw new Error('missing ' + k + ' in ~/.backup-r2.env');

  const s3 = new S3Client({
    region: 'auto',
    endpoint: env.BACKUP_R2_ENDPOINT,
    credentials: {
      accessKeyId: env.BACKUP_R2_ACCESS_KEY_ID,
      secretAccessKey: env.BACKUP_R2_SECRET_ACCESS_KEY,
    },
  });
  const Bucket = env.BACKUP_R2_BUCKET;
  const Key = 'backups/' + base;
  const body = fs.readFileSync(file);

  await s3.send(
    new PutObjectCommand({
      Bucket,
      Key,
      Body: body,
      ContentType: 'application/octet-stream',
    }),
  );
  const head = await s3.send(new HeadObjectCommand({ Bucket, Key }));
  if (head.ContentLength !== body.length)
    throw new Error(
      `size mismatch: local ${body.length} remote ${head.ContentLength}`,
    );
  console.log(`uploaded ${Key} (${body.length} bytes, verified)`);

  // Prune only after a verified upload; only touches the backups/inventory- prefix.
  const objs = [];
  let token;
  do {
    const r = await s3.send(
      new ListObjectsV2Command({
        Bucket,
        Prefix: PREFIX,
        ContinuationToken: token,
      }),
    );
    objs.push(...(r.Contents || []));
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);

  // Names embed the UTC timestamp, so lexical order == chronological.
  const keys = objs
    .map((o) => o.Key)
    .filter((k) => /^backups\/inventory-\d{8}-\d{6}\.dump$/.test(k))
    .sort()
    .reverse();
  const old = keys.slice(KEEP);
  if (old.length) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket,
        Delete: { Objects: old.map((Key) => ({ Key })) },
      }),
    );
    console.log(`pruned ${old.length} old remote backup(s)`);
  }
  console.log(`remote now holds ${Math.min(keys.length, KEEP)} backup(s)`);
}

main().catch((e) => {
  console.error('UPLOAD FAILED: ' + (e && e.message ? e.message : e));
  process.exit(1);
});
