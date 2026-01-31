# Generate Stories

You are creating PRD stories for an existing project.

PROJECT: {{PROJECT}}
TARGET VERSION: {{VERSION}}

EXISTING PHASES:
{{PHASES}}

EXISTING EPICS:
{{EPICS}}

EXISTING STORIES (for context and avoiding duplicates):
{{EXISTING_STORIES}}

USER REQUEST:
{{DESCRIPTION}}

Generate new stories that:
1. Fit into existing phases/epics OR suggest new epic if needed
2. Have specific, testable acceptance criteria
3. Include proper dependencies on existing stories
4. Avoid duplicating existing functionality
5. Are small enough to implement in one session

Output ONLY valid JSON (no markdown, no code blocks):
{
  "stories": [
    {
      "title": "Clear action-oriented title",
      "intent": "Why this story matters",
      "acceptance": ["Specific criterion 1", "Specific criterion 2"],
      "phase": 1,
      "epic": 1,
      "depends_on": ["X.Y.Z"],
      "tags": ["relevant", "tags"]
    }
  ],
  "new_epic": {
    "needed": false,
    "phase": 1,
    "name": "Epic Name",
    "description": "What this epic covers"
  },
  "reasoning": "Brief explanation of how stories fit the request"
}

Be specific in acceptance criteria - avoid vague terms.
