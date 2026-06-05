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
│   └── swagger.config.ts
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

The server listens on `http://localhost:<PORT>` (default `PORT=3000` in `.env.example`).

### Swagger (API testing)

Swagger UI is available at `http://localhost:<PORT>/api/docs` when `NODE_ENV` is not `production`.

Auth endpoints under `/api/auth/*` are served by Better-Auth and documented in Swagger under **Auth**. To test protected endpoints:

1. Sign in via curl/Postman and capture the session cookie:

   ```bash
   curl -i -c cookies.txt -b cookies.txt \
     -X POST http://localhost:4000/api/auth/sign-in/email \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"Password1"}'
   ```

2. In Swagger UI, click **Authorize** and set the `better-auth.session_token` cookie value.

3. Try `GET /api/me` or `GET /api/auth/get-session` from the **Auth** section.

### Health checks

| Endpoint         | Description                        |
| ---------------- | ---------------------------------- |
| `GET /health`    | API is running                     |
| `GET /health/db` | PostgreSQL connectivity via Prisma |

### Authentication (Better-Auth)

Full setup guide: [api/docs/better-auth-and-swagger.md](api/docs/better-auth-and-swagger.md)

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
