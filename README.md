# Multi-Location Inventory Management System

Documentation: [system-design.md](system-design.md), [tech-stack.md](tech-stack.md).

## Backend API (`api/`)

NestJS REST API with Prisma and PostgreSQL (Neon for development).

### Project structure

```
api/src/
├── main.ts
├── app.module.ts
├── config/
│   └── env.validation.ts
├── prisma/                 # shared DB layer
│   ├── prisma.module.ts
│   └── prisma.service.ts
└── modules/                # feature modules
    ├── auth/
    └── health/
```

Future domain modules (`products`, `stores`, etc.) go under `api/src/modules/<name>/`.

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/)
- A [Neon](https://neon.tech/) PostgreSQL database (or any PostgreSQL instance)

### Setup

1. Copy the environment template and add your Neon connection string:

   ```bash
   cd api
   cp .env.example .env
   ```

   Edit `api/.env` and set `DATABASE_URL`. Use Neon's **direct** connection URL for migrations if the pooled URL fails. Include `sslmode=require` for Neon.

   Also set Better-Auth environment variables (at minimum `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`) as defined in `api/.env.example`.

2. Install dependencies and apply migrations:

   ```bash
   pnpm install
   pnpm prisma:migrate
   ```

3. Start the API:

   ```bash
   pnpm start:dev
   ```

The server listens on `http://localhost:<PORT>` (default `PORT=4000` in `.env.example`).

### API testing (Postman)

Use Postman (or curl) to test endpoints. Auth routes under `/api/auth/*` are served by Better-Auth.

1. Sign in and capture the session cookie:

   ```bash
   curl -i -c cookies.txt -b cookies.txt \
     -X POST http://localhost:4000/api/auth/sign-in/email \
     -H "Content-Type: application/json" \
     -H "Origin: http://localhost:4000" \
     -d '{"email":"admin@example.com","password":"Password1"}'
   ```

2. Postman stores the `better-auth.session_token` cookie automatically for the same host.

3. Call protected routes such as `GET /api/me` or `GET /stores`.

### Health checks

| Endpoint         | Description                        |
| ---------------- | ---------------------------------- |
| `GET /health`    | API is running                     |
| `GET /health/db` | PostgreSQL connectivity via Prisma |

### Authentication (Better-Auth)

Full setup guide: [api/docs/better-auth.md](api/docs/better-auth.md)

Better-Auth handles auth routes under `/api/auth/*`. Sessions use an HTTP-only cookie (`better-auth.session_token`), 1-hour expiry, and `SameSite=Strict` (Secure in production).

| Endpoint | Method | Auth | Notes |
|----------|--------|------|-------|
| `/api/auth/sign-up/email` | POST | Public (dev only) | Requires `role` (`admin` or `branch_manager`); optional `storeId` for managers. Returns 403 in production |
| `/api/auth/sign-in/email` | POST | Public | Requires matching Origin header |
| `/api/auth/sign-out` | POST | Session | Invalidates server session |
| `/api/auth/get-session` | GET | Session | Returns user + session |
| `/api/me` | GET | Session | Nest alias for session user |

**Production env vars** (validated at startup): `BETTER_AUTH_SECRET` (32+ chars), `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`. Set `ALLOW_PUBLIC_SIGNUP=true` only if you intentionally allow public registration in production. In production, users are created by admins via a future `POST /api/users` endpoint (not public sign-up).

Regenerate auth Prisma models after config changes:

```bash
npx better-auth generate --config src/modules/auth/auth.config.ts --output prisma/models/auth.prisma --yes
```

### Object storage (Cloudflare R2)

Image uploads (architecture + how to add new types): [api/docs/image-upload.md](api/docs/image-upload.md)  
Cloudflare R2 setup for production: [api/docs/r2-object-storage.md](api/docs/r2-object-storage.md)

Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and `R2_ENDPOINT` in `api/.env`. Without them, logos are stored locally under `api/uploads/` (dev only).

### Useful commands

| Command                | Description                |
| ---------------------- | -------------------------- |
| `pnpm start:dev`       | Dev server with hot reload |
| `pnpm prisma:migrate`  | Run pending migrations     |
| `pnpm prisma:studio`   | Open Prisma Studio         |
| `pnpm prisma:generate` | Regenerate Prisma client   |

### Next steps

- Add domain modules under `api/src/modules/` (`products`, `stores`, etc.)
- Add Prisma models in `api/prisma/models/*.prisma` (see system design §6)
- Frontend (`web/`) is planned separately
