# aether-space landing page

This is a static landing site with a Vercel serverless contact endpoint that writes form submissions into a Notion database.

## Local structure

- Static pages: `index.html`, `problem.html`, `solution.html`, `team.html`
- Shared contact form logic: `contact-form.js`
- Vercel serverless endpoint: `api/contact.js`

## Notion setup

### 1. Create a Notion integration

1. Go to [https://www.notion.so/profile/integrations](https://www.notion.so/profile/integrations).
2. Create a new internal integration.
3. Copy the integration secret. This becomes `NOTION_API_KEY`.

### 2. Create the contacts database

Create a Notion database with these properties:

- `Name` as `title`
- `Email` as `email`
- `Message` as `rich_text`
- `Source Page` as `rich_text` or `select`
- `Submitted At` as `date`
- `Status` as `select`

Recommended `Status` option:

- `New`

### 3. Share the database with the integration

Open the Notion database, click `Share`, and invite the integration you created. Without this, the API route will not be able to create rows.

### 4. Copy the database ID

Open the database in Notion and copy the ID from the URL. This becomes `NOTION_DATABASE_ID`.

## Vercel setup

### 1. Import the repository

1. Go to [https://vercel.com/new](https://vercel.com/new).
2. Import `aether-space` from GitHub.
3. Use the default project settings for a static site with serverless functions.

### 2. Add environment variables

In the Vercel project settings, add:

- `NOTION_API_KEY`
- `NOTION_DATABASE_ID`

Add them to Production, Preview, and Development if you want the form to work in all environments.

### 3. Deploy

Trigger a deployment from Vercel or push to the connected branch. Vercel will serve the static HTML pages and the `/api/contact` serverless function together.

## How the contact flow works

1. A user opens the contact drawer on any site page.
2. `contact-form.js` validates `name`, `email`, and `message`.
3. The form posts JSON to `/api/contact`.
4. `api/contact.js` validates the payload, rejects honeypot spam, checks the Notion schema, and creates a new database row.

## Submission payload

The frontend sends:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "message": "We want to discuss launch logistics.",
  "page": "index",
  "submittedAt": "2026-03-24T18:00:00.000Z",
  "company": ""
}
```

## Notes

- The Notion secret is never exposed in the browser.
- If `Status` exists and includes a `New` option, new submissions are tagged automatically.
- If `Source Page` is a `select` property, make sure the page values you expect are supported in Notion.
