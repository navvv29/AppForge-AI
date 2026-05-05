# Compensation Intelligence System

A structured, queryable, comparable compensation platform inspired by Levels.fyi. 
Built using Next.js (App Router), Tailwind CSS, Next.js API Routes, PostgreSQL, and Prisma ORM.

## Tech Stack
- Frontend: Next.js + Tailwind CSS
- Backend: Next.js API Routes (TypeScript)
- Database: PostgreSQL + Prisma ORM
- Deployment: Vercel (Next.js) + Neon/Supabase (PostgreSQL)

## Local Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file in the root directory and add your PostgreSQL connection string:
   ```env
   DATABASE_URL="postgresql://user:password@host:port/dbname?schema=public"
   ```

3. **Database Setup**
   Push the schema to your database (creates tables without migrations):
   ```bash
   npx prisma db push
   ```
   Or if you prefer migrations:
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Seed the Database**
   Populate the database with 30+ realistic salary entries:
   ```bash
   npm run prisma:seed
   ```
   *Note: Ensure `ts-node` is correctly configured in your `package.json` under `prisma.seed` as already set.*

5. **Run the Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features & Edge Cases Handled
- **Company Normalization:** "Google", " google ", "GOOGLE" are all treated equally.
- **Computed Total Compensation:** Handled strictly on the server side (`base_salary` + `bonus` + `stock`).
- **Input Validation:** Strict type-checking, preventing negative salaries, invalid format levels (must be `L[0-9]+`), and enforcing default values for `bonus` and `stock`.
- **Duplicate Prevention:** Before creating a salary entry via `POST /api/ingest-salary`, it checks against existing records for the same profile and returns a `409` conflict if found.
- **Empty & Error States:** Graceful fallbacks instead of 500 crashes (e.g. `[]` when no filters match, `404` pages when specific data does not exist).
- **Responsive Aesthetics:** Premium and intuitive interface tailored using Tailwind CSS with a clean and modern dark mode built-in.

## Deployment

1. **Database:** Create a PostgreSQL database on Neon or Supabase.
2. **Vercel:** Connect your GitHub repository to Vercel. Add the `DATABASE_URL` environment variable during configuration.
3. **Build Command:** Vercel will automatically run `npm run build` and Prisma will generate the client automatically (handled securely).

## License
MIT
