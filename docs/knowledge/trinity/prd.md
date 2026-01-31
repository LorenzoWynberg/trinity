# PRD Guide

How to write effective PRDs (Product Requirements Documents) for Trinity.

## Structure

### Hierarchy

```
Phase → Epic → Story
```

| Level | Purpose | Example |
|-------|---------|---------|
| **Phase** | Major milestone | "MVP", "Growth", "Polish" |
| **Epic** | Complete feature | "Auth", "Payments", "Notifications" |
| **Story** | Single task | "Add login form", "Implement JWT middleware" |

### Story Format

```json
{
  "id": "STORY-1.2.3",
  "title": "Add login form",
  "intent": "Allow users to authenticate with email/password",
  "acceptance": [
    "Form validates email format",
    "Password minimum 8 characters",
    "Shows error on invalid credentials",
    "Redirects to dashboard on success"
  ],
  "priority": "high",
  "depends_on": ["mvp:auth:STORY-1.2.1"],
  "human_testing": {
    "required": true,
    "instructions": "Test login with valid/invalid credentials",
    "url": "/login"
  }
}
```

---

## Writing Good Stories

### Title

- Imperative verb + object: "Add login form", "Implement JWT auth"
- Specific, not vague: "Add login form" not "Work on auth"

### Intent

- Explains **why** this matters
- One sentence
- Business value, not technical details

**Good:** "Allow users to authenticate so they can access protected features"
**Bad:** "We need to add a login form component"

### Acceptance Criteria

- Testable, specific conditions
- Each criterion is pass/fail
- Cover happy path and edge cases
- No implementation details

**Good:**
```json
"acceptance": [
  "Form validates email format",
  "Password minimum 8 characters",
  "Shows error on invalid credentials",
  "Redirects to dashboard on success"
]
```

**Bad:**
```json
"acceptance": [
  "Use React Hook Form",
  "Store in Redux",
  "Make it look nice"
]
```

### Priority

| Priority | When to use |
|----------|-------------|
| `critical` | Blocks everything, must be first |
| `high` | Core functionality |
| `medium` | Important but not blocking |
| `low` | Nice to have |

---

## Dependencies

### Syntax

Universal 3-level reference:

```
"mvp"                        → whole phase
"mvp:auth"                   → epic in phase
"mvp:auth:STORY-1.1.2"       → specific story
```

### Rules

1. **Anything can depend on anything** - phase on story, epic on story, story on epic
2. **Deps must exist** - Trinity validates references
3. **No cycles** - A can't depend on B if B depends on A
4. **Cross-phase deps ok** - "growth:analytics" can depend on "mvp:auth:STORY-1.1.1"

### Patterns

**Sequential stories:**
```json
{ "id": "STORY-1.1.1", "title": "Create user model" },
{ "id": "STORY-1.1.2", "title": "Add signup endpoint", "depends_on": ["mvp:auth:STORY-1.1.1"] },
{ "id": "STORY-1.1.3", "title": "Add login endpoint", "depends_on": ["mvp:auth:STORY-1.1.2"] }
```

**Parallel stories:**
```json
{ "id": "STORY-1.1.1", "title": "Create user model" },
{ "id": "STORY-1.1.2", "title": "Add signup endpoint", "depends_on": ["mvp:auth:STORY-1.1.1"] },
{ "id": "STORY-1.1.3", "title": "Add login endpoint", "depends_on": ["mvp:auth:STORY-1.1.1"] }
// 1.1.2 and 1.1.3 can run in parallel - both only need 1.1.1
```

**Cross-epic deps:**
```json
// In mvp:payments
{ "id": "STORY-2.1.1", "title": "Add Stripe checkout", "depends_on": ["mvp:auth:STORY-1.1.3"] }
// Payments needs auth to exist first
```

---

## Human Testing

For stories that need manual verification (UI, UX, visual).

```json
{
  "human_testing": {
    "required": true,
    "instructions": "Test login with valid/invalid credentials",
    "url": "/login"
  }
}
```

**When to require:**
- UI changes visible to users
- UX flows that need human judgment
- Visual design verification
- Integration with external services

**When not needed:**
- Pure backend logic
- API endpoints (automated tests sufficient)
- Refactoring without behavior change

---

## Story Sizing

### Too Big

If a story takes more than a few hours, split it:

**Bad:**
```json
{ "title": "Add authentication system" }
```

**Good:**
```json
{ "title": "Create user model" },
{ "title": "Add signup endpoint" },
{ "title": "Add login endpoint" },
{ "title": "Add JWT middleware" },
{ "title": "Add protected routes" }
```

### Too Small

If stories are trivial, combine them:

**Bad:**
```json
{ "title": "Add email field to form" },
{ "title": "Add password field to form" },
{ "title": "Add submit button to form" }
```

**Good:**
```json
{ "title": "Add login form with email/password fields" }
```

---

## Tags

Use tags for filtering and grouping.

```json
{
  "title": "Add login form",
  "tags": ["auth", "frontend", "ui"]
}
```

**Common tags:**
- `frontend`, `backend`, `api`
- `auth`, `payments`, `notifications`
- `ui`, `ux`, `performance`
- `critical`, `tech-debt`, `refactor`

Query with: `trinity plan show --tag auth`

---

## Example PRD

```json
{
  "phases": [
    {
      "id": "mvp",
      "name": "MVP",
      "epics": [
        {
          "id": "auth",
          "name": "Authentication",
          "stories": [
            {
              "id": "STORY-1.1.1",
              "title": "Create user model",
              "intent": "Store user credentials and profile",
              "acceptance": [
                "User table with email, password_hash, created_at",
                "Unique constraint on email",
                "Password hashed with bcrypt"
              ],
              "priority": "critical"
            },
            {
              "id": "STORY-1.1.2",
              "title": "Add signup endpoint",
              "intent": "Allow new users to create accounts",
              "acceptance": [
                "POST /api/signup accepts email and password",
                "Validates email format",
                "Requires password minimum 8 characters",
                "Returns 201 with user ID on success",
                "Returns 400 on validation failure",
                "Returns 409 if email exists"
              ],
              "priority": "critical",
              "depends_on": ["mvp:auth:STORY-1.1.1"]
            }
          ]
        }
      ]
    }
  ]
}
```
