# Refine Edit

You are refining suggestions for a PRD story based on user feedback.

TARGET STORY:
- ID: {{STORY_ID}}
- Title: {{TITLE}}
- Tags: {{TAGS}}
- Depends on: {{DEPENDS_ON}}

CURRENT SUGGESTED DESCRIPTION:
{{CURRENT_DESCRIPTION}}

CURRENT SUGGESTED ACCEPTANCE CRITERIA:
{{CURRENT_ACCEPTANCE}}

USER FEEDBACK:
{{USER_FEEDBACK}}

{{RELATED_STORIES_SECTION}}

Based on the user's feedback:
1. Generate improved suggestions for the target story
2. {{RELATED_CHECK_INSTRUCTION}}

Output format (JSON only, no markdown):
{
  "target": {
    "suggested_description": "Updated description",
    "suggested_acceptance": ["criterion 1", "criterion 2"]
  }{{RELATED_OUTPUT_SCHEMA}}
}

Only include related_updates for stories that actually need changes. Keep suggestions specific and testable.
