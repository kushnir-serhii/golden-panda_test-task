# Golden Panda – Test Task

Responsive landing page + interactive multi-step quiz with time tracking and Supabase data persistence.

## Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (no frameworks)
- **Storage**: [Supabase](https://supabase.com) (free hosted Postgres, called via REST API)
- **Hosting**: GitHub Pages

## Setup

### 1. Create Supabase table

In your Supabase project, run this SQL in the **SQL Editor**:

```sql
create table quiz_submissions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  age_range     text,
  current_weight int,
  target_weight  int,
  activity_level text,
  main_goal      text,
  email          text,
  time_spent_sec int
);
```

Enable Row Level Security and add an insert policy if needed:

```sql
alter table quiz_submissions enable row level security;
create policy "Allow anonymous inserts" on quiz_submissions
  for insert to anon with check (true);
```

### 2. Add credentials to script.js

Open `script.js` and replace the placeholder values near the top:

```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-anon-public-key';
```

Both values are in your Supabase project: **Settings → API**.

### 3. Deploy to GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Source: **Deploy from a branch** → `main` → `/ (root)`
4. GitHub will publish the site at `https://<username>.github.io/<repo-name>/`

## Local development

No build step needed. Open `index.html` directly in a browser, or serve with:

```bash
npx serve .
```

## Features

- Responsive layout (desktop / tablet / mobile)
- 6-step quiz with step navigation and progress bar
- Weight input validation (current 20–300 kg, target must be < current)
- Email format validation
- Time-on-page tracking via `localStorage` (persists across refreshes/tab switches)
- All quiz answers + time spent POSTed to Supabase on completion
- Quiz state restored from `localStorage` on page reload
