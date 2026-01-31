# Graph

The graph page visualizes story dependencies using ReactFlow.

## Features

- Version filtering via dropdown
- Multiple layout options:
  - **Horizontal** - Left to right flow
  - **Vertical** - Top to bottom flow
  - **Compact** - Tighter spacing
- Custom saved layouts (per version)
- Fullscreen mode (native + CSS fallback)
- Minimap for navigation

## Toggles

- **Show dead ends** - Stories with no dependents
- **Show external dependencies** - External dep indicators

## Edge Coloring

Depth-based rainbow (25 colors) showing dependency chains. Deeper dependencies get different colors to visualize the chain length.

## Custom Layouts

Save and manage custom node arrangements per version.

**Built-in layouts:**
- Horizontal, Vertical, Compact

**Custom layouts:**
- Save current node positions as a named layout
- Set a default layout (star icon)
- Delete custom layouts
- Layouts stored per version in `graph-layouts-<version>.json`

**API endpoint:** `/api/graph-layout`

## Story ID Format

Stories use version-prefixed IDs for uniqueness across versions:

```
v0.1:1.2.3
 │    └── Story number (phase.epic.story)
 └── Version prefix
```

This allows the same story number (e.g., 1.1.1) to exist in multiple versions without conflict.

## Interactions

- **Click** - Highlight dependency chain (all ancestors)
- **Double-click** - Open story modal
- **Click background** - Clear highlighting
