# Settings

The settings page configures dashboard preferences.

## Options

### Theme

Select from five themes:
- **Light** - Standard light theme
- **Dark** - Standard dark theme
- **Cyber Light** - Pink/cyan neon accents on light background
- **Cyber Dark** - Pink/cyan neon accents on dark background (default)
- **System** - Follows OS preference

### Default Version

Which PRD version to show by default when opening the dashboard. Affects:
- Stories page initial view
- Graph page initial view
- Metrics page initial view

### Timezone

Timezone used for activity log timestamps. Claude reads this setting and uses it when writing timestamps. Common options include:
- America/Costa_Rica (UTC-6)
- America/New_York
- America/Los_Angeles
- Europe/London
- UTC

## Persistence

Settings are persisted via `/api/settings` to `settings.json` in the dashboard directory.

```json
{
  "theme": "cyber-dark",
  "defaultVersion": "v0.1",
  "timezone": "America/Costa_Rica",
  "showDeadEnds": true,
  "showExternalDeps": true
}
```

## Graph Settings

Some settings are also stored for the graph page:
- **showDeadEnds** - Show stories with no dependents
- **showExternalDeps** - Show external dependency indicators
