# Story Edit

You are updating a PRD story based on user feedback.

TARGET STORY:
- ID: {{STORY_ID}}
- Title: {{TITLE}}
- Current Description: {{DESCRIPTION}}
- Current Intent: {{INTENT}}
- Tags: {{TAGS}}
- Depends On: {{DEPENDS_ON}}

Current Acceptance Criteria:
{{ACCEPTANCE}}

USER REQUESTED CHANGES:
{{REQUESTED_CHANGES}}

RELATED STORIES (share tags or dependencies - may need updates for consistency):
{{RELATED_STORIES}}

Tasks:
1. Generate updated description and acceptance criteria for the target story
2. Check if any related stories need updates to stay consistent
3. Be specific - avoid vague terms like "properly", "handle", "settings"

Output ONLY valid JSON (no markdown, no code blocks):
{
  "target": {
    "suggested_description": "Updated description based on changes",
    "suggested_acceptance": ["specific criterion 1", "specific criterion 2"],
    "suggested_intent": "Updated intent if needed"
  },
  "related_updates": [
    {
      "id": "X.Y.Z",
      "reason": "Why this story needs updating due to changes in {{STORY_ID}}",
      "suggested_description": "Updated description if changed",
      "suggested_acceptance": ["updated criteria if changed"]
    }
  ],
  "summary": "Brief description of what changed and why"
}

Only include related_updates for stories that actually need changes.
