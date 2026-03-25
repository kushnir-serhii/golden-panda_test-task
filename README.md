# Golden Panda

Responsive landing page with an interactive multi-step quiz, time-on-page tracking, and Supabase data persistence.

## Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Storage**: [Supabase](https://supabase.com) (Postgres)
- **Hosting**: GitHub Pages

## Features

- Responsive layout (desktop / tablet / mobile)
- 6-step quiz with progress bar and step navigation
- Weight input validation (current 20–300 kg, target must be less than current)
- Email format validation
- Time-on-page tracking persisted across tab switches and page refreshes
- Quiz answers and time spent saved to Supabase on completion
- Quiz state restored from `localStorage` on page reload

## Local development

No build step needed. Open `index.html` in a browser, or run a local server:

```bash
npx serve .
```
