# BitSpot

BitSpot is a minimal crypto/stock exchange platform built as two cooperating services: a **backend** API (auth + order intake, backed by Postgres) and a **matching engine** (an in-memory order book that matches trades and streams fills back to the API). The two talk to each other asynchronously over Redis queues, so the API stays responsive while the engine does the actual matching.

> **Status:** early/actively-broken prototype. The core matching logic works, but auth and the backend↔engine bridge currently have bugs that block end-to-end flows — see [Known issues](#known-issues) before trying to run it.

## Architecture

```
                 POST /order                    BRPOP incoming-order
   Client  ───────────────────▶  Backend  ───────────────────────────▶  Engine
                                  (Express)         Redis                (order book,
                                     ▲                                    balances)
                                     │            BRPOP Response-queue:N       │
                                     └────────────────────────────────────────┘
                                                    Redis
```

- **backend/** — Express + TypeScript API. Handles signup/login (JWT auth) and order submission. Persists users, orders, and fills in Postgres via Prisma. Forwards order requests to the engine through a Redis list (`incoming-order`) and blocks on a per-request response queue (`Response-queue<queue_id>`) until the engine replies.
- **engine/** — Bun + TypeScript matching engine. Consumes requests from Redis, maintains an in-memory order book (`ASK`/`BID` maps per market, `engine/src/state.ts`) and per-user balances, matches incoming orders against resting orders (`engine/src/services/orderbook.service.ts`), and publishes results back to the backend over Redis.

Communication between the two services is entirely queue-based (no direct HTTP calls), which decouples request handling from matching and allows the engine to be scaled or restarted independently.

## Tech stack

| Layer            | Technology |
|-------------------|------------|
| Runtime            | [Bun](https://bun.com) |
| API server         | Express 5 |
| Database           | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| Message queue      | Redis (order intake + response queues) |
| Validation         | Zod |
| Auth               | JWT (`jsonwebtoken`) + Bun's built-in password hashing |
| Language           | TypeScript |

## Project structure

```
BitSpot/
├── backend/                       API service
│   ├── index.ts                    Express app entrypoint (auth routes → auth middleware → order routes)
│   ├── src/
│   │   ├── controller/               auth.controller.ts, order.controller.ts
│   │   ├── routes/                   auth.route.ts, order.route.ts
│   │   ├── middleware/               auth.middleware.ts (JWT check), error.middleware.ts
│   │   ├── schemas/                  Zod request schemas (auth, order)
│   │   ├── utilites/                 db client, Redis publisher (sendEngine),
│   │   │                             response waiter (untilWeGotBack), ApiError/ApiResponse,
│   │   │                             asyncHandler, order DB helpers
│   │   ├── types/                    Shared TypeScript types (order, engine, express augmentation)
│   │   └── constants/                Engine request types, queue names
│   └── prisma/
│       ├── schema.prisma             Users / Orders / stocks / fills models
│       └── migrations/                Prisma migration history
└── engine/                        Matching engine service
    ├── index.ts                    Redis consumer loop, dispatches by requestType
    └── src/
        ├── services/
        │   ├── order.service.ts       Order intake orchestration, cancel handling
        │   ├── orderbook.service.ts   Price-level matching (the actual matching engine)
        │   └── balance.service.ts     Balance lock/unlock helpers
        ├── state.ts                  In-memory BALANCES + ORDERBOOK (seeded with SOL, BTC)
        ├── types.ts                   Shared engine types
        ├── errors.ts                   APiError class
        └── redisClient.ts             Redis clients + sendtoBackend helper
```

## Prerequisites

- [Bun](https://bun.com) v1.3+
- PostgreSQL database
- Redis server

## Getting started

### 1. Clone and install dependencies

```bash
git clone https://github.com/Ankitsinghsisodya/BitSpot.git
cd BitSpot

cd backend && bun install
cd ../engine && bun install
```

### 2. Configure environment variables

Bun automatically loads `.env` files, so create one in `backend/`:

```bash
# backend/.env
DATABASE_URL="postgresql://user:password@localhost:5432/bitspot"
JWT_SECRET="replace-with-a-strong-secret"
```

The `engine/` service reads no required environment variables by default; it connects to Redis on `localhost:6379` unless configured otherwise via the standard `redis` client options.

### 3. Set up the database

From `backend/`:

```bash
bunx prisma migrate deploy   # apply existing migrations
bunx prisma generate         # generate the Prisma client
```

You'll also need at least one row in the `stocks` table (e.g. `BTC`, `SOL`) matching the markets seeded in `engine/src/state.ts`, since order placement looks up the stock by symbol before forwarding to the engine.

### 4. Run Redis

Make sure a Redis instance is reachable (e.g. `redis-server` locally, or via Docker):

```bash
docker run -p 6379:6379 redis
```

### 5. Start the services

In separate terminals:

```bash
# Terminal 1 — matching engine
cd engine
bun run index.ts

# Terminal 2 — backend API
cd backend
bun run index.ts
```

The API is now available at `http://localhost:3000`.

## API overview

| Method | Path              | Auth required | Status |
|--------|--------------------|:--:|--------------|
| POST   | `/signup`           | ✗ | Implemented, but currently **broken** — see [Known issues](#known-issues) |
| GET    | `/login`            | ✗ | Implemented, but currently **broken** — see [Known issues](#known-issues) |
| POST   | `/order`             | ✓ | Implemented (submit a market or limit order) |
| GET    | `/orders`            | ✓ | Implemented (list the authenticated user's orders) |
| GET    | `/fills/:symbol`     | ✓ | Implemented (list fills for the authenticated user on a symbol) |
| GET    | `/balance`           | ✓ | Implemented (fetch balance from the engine) |
| DELETE | `/order/:orderId`    | ✓ | Implemented, but currently **buggy** — see [Known issues](#known-issues) |
| GET    | `/stocks`            | ✓ | *Not implemented (no route wired up)* |
| GET    | `/orderbook/:symbol` | ✓ | *Not implemented (no route wired up)* |

Authenticated routes expect an `Authorization: Bearer <token>` header with the JWT returned from `/login`.

### Example: place an order

```bash
curl -X POST http://localhost:3000/order \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "limit",
    "price": 100,
    "qty": 5,
    "market_id": "BTC",
    "side": "BID"
  }'
```

## Data model

The Postgres schema (see `backend/prisma/schema.prisma`) models:

- **Users** — username/password credentials, linked to their orders
- **stocks** — tradable markets (symbol + title)
- **Orders** — side (`ASK`/`BID`), type (`LIMIT`/`MARKET`), quantity, filled quantity, and status (`FILLED`/`PARTIALLY`/`EMPTY`/`CANCELLED`); `price` is nullable to support market orders
- **fills** — individual matches between a buy order and a sell order, with price and quantity

## Known issues

The codebase is mid-refactor; these are the concrete bugs currently blocking a full end-to-end run:

- **Auth is broken at runtime.** `backend/src/schemas/auth.schema.ts` defines `authRequest` but doesn't export it, and `auth.controller.ts` never imports it — both `signup` and `login` reference an undefined `authRequest` and will throw.
- **Backend and engine are listening on different queues.** The backend publishes order/balance/cancel requests to the `incoming-order` Redis list (`backend/src/constants/index.ts`), but `engine/index.ts` currently does `BRPOP incoming-request` — a mismatched queue name — so the engine never sees requests pushed by the backend.
- **`DELETE /order/:orderId` is inconsistent.** The route declares `:orderId`, but the controller reads `req.params.id`, and the subsequent `typeof orderId !== "number"` check will always be true (Express route params are always strings), so the handler always rejects the request.
- **Markets are duplicated across two sources of truth.** The engine's tradable markets are hardcoded in `engine/src/state.ts` (`SOL`, `BTC`), while the backend validates `market_id` against the Postgres `stocks` table — the two lists must be kept in sync manually.
- **No persistence in the engine.** The order book and balances live only in memory (`engine/src/state.ts`), so restarting the engine wipes all open orders and balances — persistence/replay is a natural next step.
- **Several read routes are still unimplemented**: `/stocks` and `/orderbook/:symbol` have no route registered at all.

## License

No license has been specified for this project yet.
