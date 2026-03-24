# CSM Health App

A customer health tracking tool for Customer Success Managers (CSMs). Admins and CSMs can track customer health scores, manage accounts, and submit monthly health surveys.

## Tech Stack

- **Frontend:** React
- **Database:** Supabase (Postgres)
- **Auth:** Supabase Auth — Email/password or Google OAuth (no self-signup)
- **Deployed:** Netlify

## Roles

| Role | Access |
|---|---|
| `admin` | Full access — dashboards, user management, all customers, all CSMs, CSV import |
| `csm` | Own assigned customers only — view, edit, complete surveys. No dashboard access. |

### CSM Permissions Detail

- CSMs see only customers where `customers.csm` matches their `full_name`
- CSMs cannot access the Dashboard or User Management tabs
- Row-level security (RLS) enforces CSM data isolation at the database level

## Local Development

```bash
npm install
npm start
```

## Database (Supabase)

Project URL: `https://bkpvwqdtmyfamhryytql.supabase.co`

### Tables

| Table | Description |
|---|---|
| `customers` | Customer accounts with health scores and CSM assignments |
| `customer_history` | Historical health score records per customer |
| `user_profiles` | User roles and profile data (`admin` or `csm`) |

### Keeping the Free Tier Active

Supabase pauses free projects after **1 week of inactivity**. A daily cron job via [cron-job.org](https://cron-job.org) prevents this.

**Setup steps:**

1. Create a free account at [cron-job.org](https://cron-job.org)
2. Click **Create cronjob** — Common tab:

| Field | Value |
|---|---|
| Title | `Supabase Keep Alive` |
| URL | `https://bkpvwqdtmyfamhryytql.supabase.co/rest/v1/customers?limit=1` |
| Schedule | Every day at 3 AM (`0 3 * * *`) |

3. Advanced tab — add these **Headers**:

| Key | Value |
|---|---|
| `apikey` | `<Supabase anon key from supabaseClient.js>` |
| `Authorization` | `Bearer <Supabase anon key>` |

4. Click **Test Run** — confirm `200 OK`
5. Click **Create**

Enable failure notifications so you are alerted if the job stops working.

## Automated Slack Reminders

Monthly survey reminders are sent to Slack via GitHub Actions on the 1st of each month.

See [SLACK_SETUP.md](./SLACK_SETUP.md) for full setup instructions.

## Authentication

Users can sign in via:
- **Google OAuth** — recommended, no password needed
- **Email/password** — supported but not the primary flow

Google OAuth is configured in Supabase → Authentication → Providers → Google. The callback URL is `https://bkpvwqdtmyfamhryytql.supabase.co/auth/v1/callback`.

After a Google sign-in, the app looks up the user's profile in `user_profiles` by email. If no matching profile exists, access is denied.

## User Management

Admins create and manage users from the **User Management** tab. Key rules:

- **Full Name is required for CSM users** — it is used as the unique CSM identifier and must match the `csm` field on customer records
- `csm_name` in `user_profiles` is auto-set to `full_name` — no separate CSM Name field
- CSM dropdown lists in the app are populated dynamically from active CSM user profiles (no hardcoded names)
- Users are created directly in Supabase Auth — no email confirmation required (disabled in Supabase Auth settings)

### Adding a New CSM

1. Admin goes to **User Management** → **Add User**
2. Enters **Full Name** (e.g. `Brooke Taylor`), **Email**, **Role: CSM**
3. New customer records should use that exact full name in the `csm` field

## Build for Production

```bash
npm run build
```
