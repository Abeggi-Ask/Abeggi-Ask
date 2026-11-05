# Abeggi 🙏

**Borrow from friends without the awkwardness.**

Abeggi is a friendly IOU app on Stellar. Your friend asks to borrow, you approve and send the money, and both of you see the same record of what's owed, what's paid, and when it's due. No more "abeg, when you go pay?" and no more "I don't remember you lent me."

Money moves wallet-to-wallet in USDC. The contract never holds funds — it keeps the receipt.

---

## Why Abeggi

- **Lending between friends and family is everywhere**, and most of it lives in memory and WhatsApp chats.
- **Disputes come from fuzzy records**, not bad people. A shared, signed record fixes most of it.
- **Repaying on time should count for something.** Abeggi builds a simple on-chain repayment track record.

---

## Features (MVP)

- 🙋 **Request a loan** — borrower asks a specific friend for an amount, due date and note
- ✅ **Approve & fund** — lender approves; USDC goes straight to the borrower
- 💵 **Repay in parts** — pay back all at once or in pieces
- 🕊️ **Forgive** — lender can cancel what's left ("e don do, no wahala")
- ❌ **Decline / cancel** — lender declines, or borrower withdraws the request before it's funded
- ⏰ **Due dates & overdue status** — shown clearly to both sides
- ⭐ **Repayment record** — loans repaid, repaid on time, total borrowed

---

## Loan lifecycle

```
          borrower: request()
                 │
                 ▼
           ┌──────────┐   lender: decline()      ┌───────────┐
           │ Requested│ ───────────────────────► │ Declined  │
           └──────────┘                          └───────────┘
             │      │  borrower: cancel()        ┌───────────┐
             │      └──────────────────────────► │ Cancelled │
             │                                   └───────────┘
   lender: fund()   (USDC lender ──► borrower)
             ▼
           ┌──────────┐   borrower: repay()  (USDC borrower ──► lender)
           │  Active  │ ◄───────────┐  partial payments stay Active
           └──────────┘ ────────────┘
             │      │
   fully repaid     lender: forgive()
             ▼      ▼
      ┌────────┐ ┌───────────┐
      │ Repaid │ │ Forgiven  │
      └────────┘ └───────────┘

 "Overdue" is not stored — it's Active + now > due_date (derived).
```

---

## Tech stack

| Layer | Tool |
|---|---|
| Smart contract | Rust + `soroban-sdk` |
| Token | USDC (or native XLM for dev) via its Stellar Asset Contract |
| Contract tooling | Stellar CLI (`stellar`) |
| Frontend | Next.js (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Wallets | `@creit.tech/stellar-wallets-kit` |
| Chain access | `@stellar/stellar-sdk` + generated TypeScript bindings |
| Dates | `date-fns` |
| Hosting | Vercel |

---

## Project structure

```
abeggi/
├── contracts/
│   └── abeggi/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs        # contract
│           └── test.rs       # unit tests
├── packages/
│   └── abeggi-client/        # generated TS bindings (do not edit)
├── web/                      # Next.js app
│   ├── app/
│   │   ├── page.tsx              # landing
│   │   ├── dashboard/page.tsx    # "I owe" / "Owed to me" tabs
│   │   ├── request/page.tsx      # create a loan request
│   │   ├── loan/[id]/page.tsx    # loan details + actions
│   │   └── u/[address]/page.tsx  # public repayment record
│   ├── components/
│   │   ├── WalletButton.tsx
│   │   ├── LoanCard.tsx
│   │   ├── LoanActions.tsx       # fund / repay / forgive / decline / cancel
│   │   ├── RepayDialog.tsx
│   │   └── StatusBadge.tsx
│   ├── lib/
│   │   ├── wallet.ts
│   │   ├── abeggi.ts             # contract client wrapper
│   │   └── format.ts             # amounts (7 decimals), dates, overdue
│   └── .env.local
└── README.md
```

---

## Contract interface

```rust
// Set once at deploy time
fn __constructor(env: Env, token: Address);

// Borrower asks a lender for money
fn request(env: Env, borrower: Address, lender: Address,
           amount: i128, due_date: u64, note: String) -> u64; // returns loan id

// Lender approves and sends funds lender -> borrower
fn fund(env: Env, id: u64);

// Lender says no
fn decline(env: Env, id: u64);

// Borrower withdraws an unfunded request
fn cancel(env: Env, id: u64);

// Borrower pays back (partial allowed) borrower -> lender
fn repay(env: Env, id: u64, amount: i128);

// Lender forgives the remaining balance
fn forgive(env: Env, id: u64);

// Reads
fn get_loan(env: Env, id: u64) -> Loan;
fn loans_of(env: Env, user: Address) -> Vec<u64>;   // as borrower or lender
fn record_of(env: Env, user: Address) -> Record;
fn token(env: Env) -> Address;
```

### Data

```rust
#[contracttype]
#[derive(Clone, Copy, PartialEq)]
pub enum Status { Requested, Active, Repaid, Forgiven, Declined, Cancelled }

#[contracttype]
pub struct Loan {
    pub id: u64,
    pub borrower: Address,
    pub lender: Address,
    pub amount: i128,
    pub repaid: i128,
    pub due_date: u64,     // unix seconds
    pub note: String,      // ≤ 100 chars
    pub status: Status,
    pub created_at: u64,
    pub funded_at: u64,
    pub closed_at: u64,
}

#[contracttype]
pub struct Record {
    pub loans_taken: u32,
    pub loans_repaid: u32,
    pub repaid_on_time: u32,
    pub total_borrowed: i128,
    pub total_lent: i128,
}

#[contracttype]
pub enum DataKey {
    Token,                 // instance
    NextId,                // instance
    Loan(u64),             // persistent
    UserLoans(Address),    // persistent: Vec<u64>
    Record(Address),       // persistent
}
```

### Rules

| Function | Who signs | Allowed when | Effect |
|---|---|---|---|
| `request` | borrower | borrower ≠ lender, amount > 0, due_date in future | new loan, `Requested` |
| `fund` | lender | `Requested` | transfer lender → borrower, `Active` |
| `decline` | lender | `Requested` | `Declined` |
| `cancel` | borrower | `Requested` | `Cancelled` |
| `repay` | borrower | `Active`, 0 < amount ≤ remaining | transfer borrower → lender; if fully paid → `Repaid` |
| `forgive` | lender | `Active` | `Forgiven` |

- Both parties sign at different steps, so every loan has consent from both sides
- Transfers use `token::Client::transfer` directly between users — the contract never holds money
- `repaid_on_time` increments when a loan becomes `Repaid` with `now ≤ due_date`
- Keep `loans_of` lists bounded (e.g. cap at 200 per user, or paginate) to stay within storage limits
- Extend TTL on persistent entries when they're written

### Events

| Topic | Data |
|---|---|
| `("request", id)` | `(borrower, lender, amount, due_date)` |
| `("fund", id)` | `amount` |
| `("repay", id)` | `(amount, remaining)` |
| `("forgive", id)` | `remaining` |
| `("decline", id)` / `("cancel", id)` | — |

> **Amounts:** Stellar assets use 7 decimals. `1 USDC = 10_000_000` in contract units. The frontend converts.

---

## Getting started

### Prerequisites

- Rust (stable) and the Wasm target:
  ```bash
  rustup target add wasm32v1-none
  ```
- Stellar CLI — see the install guide at [developers.stellar.org](https://developers.stellar.org)
- Node.js 20+ and pnpm (or npm)
- A Stellar wallet extension (Freighter is easiest), switched to **Testnet**

### 1. Create two funded testnet identities (borrower + lender)

```bash
stellar keys generate ada --network testnet --fund
stellar keys generate bayo --network testnet --fund
```

### 2. Build and test

```bash
cd contracts/abeggi
cargo test
stellar contract build
```

### 3. Get the token contract ID

```bash
# native XLM for development
stellar contract id asset --asset native --network testnet
```

For USDC on testnet, use `--asset USDC:<TESTNET_USDC_ISSUER>` (check the current testnet issuer in Circle's/Stellar's docs).

### 4. Deploy

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/abeggi.wasm \
  --source ada \
  --network testnet \
  -- --token <TOKEN_CONTRACT_ID>
```

### 5. Generate TypeScript bindings

```bash
stellar contract bindings typescript \
  --network testnet \
  --contract-id <ABEGGI_CONTRACT_ID> \
  --output-dir packages/abeggi-client

cd packages/abeggi-client && npm install && npm run build
```

### 6. Run the frontend

```bash
cd web
pnpm install
pnpm add ../packages/abeggi-client
cp .env.example .env.local
pnpm dev
```

### Environment variables (`web/.env.local`)

```env
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
NEXT_PUBLIC_ABEGGI_CONTRACT_ID=C...
NEXT_PUBLIC_TOKEN_CONTRACT_ID=C...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### CLI walkthrough (Ada borrows 5 XLM from Bayo)

```bash
# Ada requests (due date = unix timestamp in the future)
stellar contract invoke --id <ABEGGI_ID> --source ada --network testnet -- \
  request --borrower $(stellar keys address ada) --lender $(stellar keys address bayo) \
  --amount 50000000 --due_date 1767225600 --note "Transport money"

# Bayo funds loan 0
stellar contract invoke --id <ABEGGI_ID> --source bayo --network testnet -- fund --id 0

# Ada repays 2 XLM, then 3 XLM
stellar contract invoke --id <ABEGGI_ID> --source ada --network testnet -- repay --id 0 --amount 20000000
stellar contract invoke --id <ABEGGI_ID> --source ada --network testnet -- repay --id 0 --amount 30000000

# Check
stellar contract invoke --id <ABEGGI_ID> --source ada --network testnet -- get_loan --id 0
```

---

## Frontend pages

| Route | What it does |
|---|---|
| `/` | Landing — "Borrow from friends without the awkwardness" |
| `/dashboard` | Two tabs: **I owe** and **Owed to me**, with status badges and due countdowns |
| `/request` | Enter lender's address (or paste a share link), amount, due date, note → sign |
| `/loan/[id]` | Loan detail with progress bar and the right action buttons for whoever is viewing |
| `/u/[address]` | Public repayment record — loans repaid, on-time rate |

### UX touches

- **Share link:** after a request, show a link to `/loan/[id]` to send to the lender on WhatsApp
- **Overdue badge:** red when `Active` and past due
- **Friendly copy:** "Abeg, send ₦..." / "You don pay finish 🎉"
- **Contacts later:** map addresses to nicknames locally so users don't stare at `GABC...XYZ`

---

## Roadmap

**Milestone 1 — Contract (week 1)**
- [ ] All six actions + reads
- [ ] Unit tests: every status transition, wrong signer, over-repayment, past due date, self-loan
- [ ] Deployed to testnet

**Milestone 2 — Frontend MVP (week 2)**
- [ ] Wallet connect, request flow, dashboard, loan detail with actions
- [ ] Share links and overdue badges

**Milestone 3 — Polish & launch**
- [ ] Repayment record page
- [ ] Reminders (email/push) from an off-chain worker watching due dates
- [ ] Switch to USDC, mainnet after review/audit
- [ ] Pilot with 3–5 friend groups or a campus community

**Later**
- Installment plans with scheduled amounts
- Group loans (several lenders chip in for one request)
- Naira on/off-ramp through a Stellar anchor (SEP-24)

---

## What Abeggi is (and isn't)

- It **is** a shared, signed, tamper-proof record plus a payment rail between people who trust each other.
- It **is not** a lender, a credit bureau, or a debt collector. The contract cannot force anyone to repay.
- No interest in the MVP — keep it a friends-and-family tool. Adding interest or lending to strangers brings in lending regulations; get legal advice before going there.

---

## Security notes

- Every action checks `require_auth()` for the correct party
- Status checks on every transition to prevent double-funding or repaying a closed loan
- `repay` can never exceed the remaining balance
- No funds held by the contract
- Get the contract reviewed before mainnet

---

## License

MIT
# Abeggi-Ask
