# BitSpot

BitSpot is a minimal crypto/stock exchange platform built as two cooperating services: a **backend** API (auth + order intake, backed by Postgres) and a **matching engine** (an in-memory order book that matches trades and streams fills back to the API). The two talk to each other asynchronously over Redis queues, so the API stays responsive while the engine does the actual matching.

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
- **engine/** — Bun + TypeScript matching engine. Consumes orders from Redis, maintains an in-memory order book (`ASK`/`BID` maps per market) and per-user balances, matches incoming orders against resting orders, and publishes the fill results back to the backend over Redis.

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
├── backend/                  API service
│   ├── index.ts               Express app entrypoint
│   ├── src/
│   │   ├── controller/         Route handlers (auth, order)
│   │   ├── routes/             Express routers
│   │   ├── middleware/         Auth + error-handling middleware
│   │   ├── schemas/            Zod request schemas
│   │   ├── utilites/           DB client, Redis publisher, error/response helpers
│   │   ├── types/              Shared TypeScript types
│   │   └── constants/          Engine request types, queue names
│   └── prisma/
│       ├── schema.prisma       Users / Orders / Stocks / Fills models
│       └── migrations/         Prisma migration history
└── engine/                    Matching engine service
    └── index.ts                Order book, balance ledger, matching loop
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

| Method | Path              | Auth required | Description |
|--------|--------------------|:--:|--------------|
| POST   | `/signup`           | ✗ | Create a new user |
| GET    | `/login`            | ✗ | Authenticate and receive a JWT |
| POST   | `/order`             | ✓ | Submit a market or limit order |
| GET    | `/fills/:symbol`     | ✓ | List fills for the authenticated user on a symbol |
| DELETE | `/order/:orderId`    | ✓ | Cancel an order *(not yet implemented)* |
| GET    | `/stocks`            | ✓ | List available stocks *(not yet implemented)* |
| GET    | `/balance`           | ✓ | Get user balance *(not yet implemented)* |
| GET    | `/orders`            | ✓ | List user orders *(not yet implemented)* |
| GET    | `/orderbook/:symbol` | ✓ | Get the order book for a symbol *(not yet implemented)* |

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
    "side": "buy"
  }'
```

## Data model

The Postgres schema (see `backend/prisma/schema.prisma`) models:

- **Users** — username/password credentials, linked to their orders
- **Stocks** — tradable markets (symbol + title)
- **Orders** — side (`BUY`/`SELL`), type (`LIMIT`/`MARKET`), quantity, filled quantity, and status (`FILLED`/`PARTIALLY`/`EMPTY`/`CANCELLED`)
- **Fills** — individual matches between a buy order and a sell order, with price and quantity

## Development notes

- Both services are Bun projects; use `bun`/`bunx` rather than `npm`/`node` (see the Cursor rules in each package for details).
- The engine currently keeps the order book and balances **in memory**, so restarting it resets matching state — persistence/replay is a natural next step.
- Several read-only order routes (`/stocks`, `/balance`, `/orders`, `/orderbook/:symbol`) and order cancellation are scaffolded but not yet wired up to handlers.

## License

No license has been specified for this project yet.
