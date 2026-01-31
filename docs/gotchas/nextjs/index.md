# Next.js Gotchas

Common pitfalls when working with Next.js and React.

## Hydration Issues

Radix components generate unique IDs at runtime. Server/client mismatch causes hydration errors.

**Fix 1: Suspense boundary** (for useSearchParams):
```tsx
<Suspense fallback={<div className="..." />}>
  <VersionSelectorInner {...props} />
</Suspense>
```

**Fix 2: Extract to client component** (for Tabs in server components):
```tsx
// learnings-tabs.tsx - 'use client'
export function LearningsTabs({ learnings }) { ... }

// page.tsx - server component
<LearningsTabs learnings={learnings} />
```

## iOS Fullscreen Fallback

iOS Safari doesn't support Fullscreen API. Use CSS-based fallback:
```tsx
const [fullscreenSupported, setFullscreenSupported] = useState(true)
useEffect(() => {
  const doc = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }
  setFullscreenSupported(!!(doc.requestFullscreen || doc.webkitRequestFullscreen))
}, [])

// In handler: if !fullscreenSupported, use CSS instead of native
<div className={isPseudoFullscreen ? "fixed inset-0 z-[9999] h-screen" : "h-[calc(100vh-2rem)]"}>
```

## shadcn CLI Usage

Always use shadcn CLI to add components - never create them manually:
```bash
npx shadcn@latest add input
npx shadcn@latest add button
# etc.
```

This ensures proper Radix primitives, cva variants, and consistent styling.

## Mobile Hamburger Menu

Use `mounted` state to avoid hydration mismatch:
```tsx
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])

{mounted && <MobileMenu />}  // Only render after hydration
```

---
<!-- updatedAt: 2026-01-27 -->
<!-- lastCompactedAt: 2026-01-26 -->
