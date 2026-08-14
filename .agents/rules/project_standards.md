# Project Architecture & Standards - Sojar Indusy

## 1. Core Framework & Build Tools
- **Next.js**: Use the latest Next.js version with the **App Router** (`src/app/`).
- **Turbopack**: Turbopack is the default bundler for local development (`next dev --turbo`). Always verify compatibility with Turbopack.

## 2. Design System & UI Components
- **Tailwind CSS**: Use Tailwind CSS for all layout and styling. Utilize CSS variables for theme customization and dark mode support.
- **shadcn/ui**: Use shadcn/ui component primitives.
  - All basic UI primitives MUST reside in `src/components/ui/` (e.g., `button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `dialog.tsx`).
  - Layout & common widgets (navigation, headers, footers, stat widgets) MUST reside in `src/components/common/`.
  - Feature-specific compound components MUST reside in `src/components/features/<feature_name>/`.
  - Do NOT create ad-hoc styled components when a shadcn/ui primitive exists or can be composed.

## 3. Centralized Utilities & Libraries
- **Centralized Utilities**: Keep all generic utilities in `src/lib/utils.ts` (e.g., `cn()` utility combining `clsx` and `tailwind-merge`).
- **Supabase Client Layer**:
  - `src/lib/supabase/client.ts` -> Client-side / browser Supabase client using `@supabase/ssr` `createBrowserClient`.
  - `src/lib/supabase/server.ts` -> Server-side Supabase client using `@supabase/ssr` `createServerClient` with Next.js cookie handling.
  - `src/lib/supabase/middleware.ts` -> Middleware session refresh helper.
  - `src/lib/supabase/admin.ts` -> Admin / service-role operations (server-only).
- **Types**: All database models and shared TypeScript interfaces MUST reside in `src/types/`.

## 4. Code Quality & Scalability
- Strictly typed TypeScript (`strict: true`).
- Clear separation between Client Components (`"use client"`) and Server Components.
- Handle loading states, error boundaries, and empty states gracefully.
- Never expose sensitive service keys (`SUPABASE_SERVICE_ROLE_KEY`) on the client.
