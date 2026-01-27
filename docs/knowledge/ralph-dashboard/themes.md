# Themes

Five themes available: `light`, `dark`, `cyber-light`, `cyber-dark`, `system`

- **system** - Follows OS preference (light/dark)

## Cyber Themes

Cyber themes use pink/cyan neon accents. Graph page uses `resolvedTheme` to detect dark mode:

```tsx
const isDark = resolvedTheme === 'dark' || resolvedTheme === 'cyber-dark'
const isCyber = resolvedTheme === 'cyber-dark' || resolvedTheme === 'cyber-light'
```

**Cyber-dark graph colors:**
- Story nodes: Cyan backgrounds, purple text
- Version nodes: Yellow backgrounds, cyan text

**Tailwind custom variants:**
```tsx
cyber-dark:bg-cyan-900/80 cyber-dark:text-purple-200
```

## Mobile Responsiveness

**Scrollable tabs:** Wrap TabsList for horizontal scroll on mobile:
```tsx
<div className="overflow-x-auto -mx-2 px-2 pb-2">
  <TabsList className="inline-flex w-max md:w-auto">
    {/* triggers */}
  </TabsList>
</div>
```

**Hamburger menu:** Use `mounted` state to avoid hydration mismatch:
```tsx
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])

{mounted && <MobileMenu />}  // Only render after hydration
```

**ReactFlow controls:** Position higher on mobile via CSS:
```css
@media (max-width: 768px) {
  .react-flow__controls { bottom: 80px !important; }
}
```
