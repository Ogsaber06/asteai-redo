# Contributing to AsteAI

> **You do NOT need OpenTofu, Terraform, or any AWS infra tools.**
> The database and all cloud infra is already provisioned and managed by the team lead.
> You just need bun + AWS CLI to develop locally.

---

## For new team members — first-time setup

You need two things from your team lead before starting:

1. **AWS access keys** — Access Key ID + Secret Access Key
2. **Your IP added to the allowlist** — so your laptop can reach the database

---

### Step 1 — Install the tools (2 things only)

| Tool | Install |
|------|---------|
| **bun** | `curl -fsSL https://bun.sh/install \| bash` |
| **AWS CLI v2** | https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html |

That's it. No Docker, no Terraform, no psql required.

---

### Step 2 — Configure AWS CLI

```bash
aws configure
# AWS Access Key ID:     <from your team lead>
# AWS Secret Access Key: <from your team lead>
# Default region:        ap-south-1
# Default output format: json
```

---

### Step 3 — Clone and run setup

```bash
git clone <repo-url>
cd asteai-redo
bun run setup
```

This one command:
- Checks your AWS credentials work
- Installs all dependencies
- Generates your `.env.local` files automatically
- Prints your public IP

At the end you'll see:
```
  Your public IP: 1.2.3.4/32
  Send this to your team lead so they can whitelist it.
```

Send that IP to your team lead. They'll add it in ~2 minutes. You only need to do this once (or when your IP changes).

---

### Step 4 — Start developing

```bash
bun run dev:api   # NestJS API  → http://localhost:3001
bun run dev:web   # Next.js     → http://localhost:3000
```

That's it. You're done.

---

## Daily workflow

```bash
git pull
bun install   # only if package.json changed
bun run dev:api
bun run dev:web
```

---

## Querying the database

Use the **RDS Query Editor** in the AWS console — no psql, no tunnels.

1. Go to: https://ap-south-1.console.aws.amazon.com/rds/home?region=ap-south-1#query-editor
2. Select **`asteai-development`**
3. **Connect with Secrets Manager** → pick `asteai/development/db-master-password`
4. Database: `asteai`
5. Write SQL and run it

---

## Running a new migration

Send the SQL file to the team lead or paste it into the RDS Query Editor as `asteai_root`.

---

## If your IP changes

Run:
```bash
curl https://checkip.amazonaws.com
```

Send the new IP to your team lead. They'll update the allowlist in a few minutes.

---

## Project structure

```
asteai-redo/
├── apps/
│   ├── api/          # NestJS REST API  (:3001)
│   └── web/          # Next.js frontend (:3000)
├── packages/
│   ├── types/        # shared TypeScript types
│   └── db/migrations # SQL schema migrations
├── scripts/
│   └── dev-setup.sh  # first-time setup script
└── docs/
    └── ARCHITECTURE.md
```

---

## For team leads only — managing infra

Everything below requires OpenTofu and is only done by whoever manages the AWS infra.

### Add a new developer

1. Get their IP: they run `curl https://checkip.amazonaws.com`
2. Edit `infra/terraform.tfvars`:
```hcl
developer_ips = [
  "103.210.90.18/32",  # eugene
  "49.37.12.55/32",    # new dev's IP
]

team_members = [
  { name = "alice", iam_user = "alice", role = "backend",
    create_access_key = true, can_assume_app_role = true },
]
```
3. `cd infra && tofu apply`
4. Share their credentials:
```bash
tofu output -json access_keys       # send securely (1Password/Signal)
tofu output -json console_passwords
tofu output console_login_url
```

### Run a migration

```bash
# Connect to the DB as master
./infra/db-connect.sh --master   # requires publicly_accessible = true
# or use RDS Query Editor in the console
```
