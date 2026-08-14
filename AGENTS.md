# Project Architecture & Standards - Sojar Indusy

Refer to [.agents/rules/project_standards.md](file:///d:/17_Quinite_Technologies/Project%208%20Sojar%20Indusy/.agents/rules/project_standards.md) for full architectural guidelines.

## Mandatory Project Rules
- **Font**: Inter
- **UI**: shadcn/ui
- **Primitives**: Radix UI (`@radix-ui/*`)
- **Icons**: Lucide (`lucide-react`)
- **Styling**: Tailwind CSS
- **Colors**:
  - Background: `#FFFFFF` (White)
  - Primary Button & Brand: `#024AE5` (Cobalt Blue)
  - Secondary / Highlight: `#3C8B4F` (Brand Green)
  - Text / Foreground: `#0F172A`

## Centralized Architecture
- `src/components/ui/` for basic UI primitives.
- `src/components/common/` for shared widgets and layout components.
- `src/components/theme/` for typography and theme providers.
- `src/lib/theme.ts` & `src/lib/utils.ts` for centralized constants and utilities.
- `src/lib/supabase/` for Supabase SSR client integration.
