import 'dotenv/config';
import path from 'node:path';
import type { PrismaConfig } from 'prisma';

// Prisma will recursively load every `*.prisma` file under this folder
// (including `prisma/models/*.prisma`) which lets us keep auth models in
// separate files.
export default {
  schema: path.join('prisma'),
} satisfies PrismaConfig;

