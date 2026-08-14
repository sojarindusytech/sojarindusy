# Project Architecture & Standards - Sojar Indusy

## 1. Core Technology Stack
- **Framework**: Next.js 16+ (App Router) with Turbopack (`next dev --turbo`).
- **Font**: **Inter** (Primary typography across all pages and components).
- **UI System**: **shadcn/ui** (Reusable accessible component architecture).
- **Primitives**: **Radix UI** (`@radix-ui/*` accessible component primitives).
- **Icons**: **Lucide** (`lucide-react` clean iconography).
- **Styling**: **Tailwind CSS** (Utility-first styling with CSS custom properties).

## 2. Centralized Brand Colors & Theme
- **Background**: Pure Clean White (`#ffffff` / `#FFFFFF`)
- **Primary Brand Color**: `#024AE5` (Cobalt Royal Blue) -> Primary buttons, active states, key CTAs, focus rings
- **Secondary / Success Brand Color**: `#3C8B4F` (Industrial Precision Forest Green) -> Badges, growth indicators, success feedback, secondary buttons
- **Foreground / Text**: Deep slate charcoal (`#0F172A`)

## 3. Centralized Structure
- `src/components/ui/`: shadcn/ui and Radix UI basic primitives (`button.tsx`, `card.tsx`, `badge.tsx`, `table.tsx`, `input.tsx`, `select.tsx`, `label.tsx`).
- `src/components/common/`: Shared layout blocks (`Navbar.tsx`, `Footer.tsx`, `Icons.tsx`).
- `src/components/theme/`: Theme and Typography provider & switcher (`ThemeProvider.tsx`, `FontThemeSelector.tsx`).
- `src/lib/utils.ts`: Centralized `cn()` class merge utility.
- `src/lib/theme.ts`: Centralized theme color constants and font definitions.
- `src/lib/supabase/`: Full SSR Supabase client suite (`client.ts`, `server.ts`, `middleware.ts`, `admin.ts`).
- `src/types/`: TypeScript database models and interfaces.

## 4. Role-Based Architecture
- **Platform Owner** (`platform_owner`): Access to `/admin/dashboard`.
- **B2B Customer** (`customer`): Access to `/dashboard`.
