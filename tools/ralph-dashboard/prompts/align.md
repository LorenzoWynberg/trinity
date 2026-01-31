# Align PRD with Vision

You are analyzing a PRD to check alignment with the user's stated vision and goals.

## User's Vision
{{VISION}}

## Scope: {{SCOPE}}
{{SCOPE_DESCRIPTION}}

## Current Stories
{{STORIES}}

## Analysis Required

Analyze how well the current stories align with the user's vision. Consider:

1. **Coverage**: Do the stories fully cover what's needed to achieve the vision?
2. **Gaps**: What capabilities or features are missing?
3. **Misalignments**: Are there stories that don't serve the vision or seem out of scope?
4. **Priority**: Are the most important aspects of the vision well-represented?

## Output JSON

{
  "alignment_score": 0-100,
  "summary": "Brief overall assessment of alignment",
  "gaps": [
    {
      "description": "What's missing",
      "priority": "high" | "medium" | "low",
      "suggested_stories": [
        {
          "title": "Story title",
          "intent": "Why this story matters",
          "acceptance": ["Criterion 1", "Criterion 2"],
          "phase": 1,
          "epic": 1
        }
      ]
    }
  ],
  "misalignments": [
    {
      "story_id": "X.Y.Z",
      "title": "Story title",
      "issue": "Why this story doesn't align with the vision",
      "suggestion": "remove" | "modify" | "keep"
    }
  ],
  "modifications": [
    {
      "story_id": "X.Y.Z",
      "current_title": "Current title",
      "suggested_title": "Better title if needed",
      "suggested_intent": "Updated intent",
      "suggested_acceptance": ["Updated criterion 1", "Updated criterion 2"],
      "reason": "Why this modification improves alignment"
    }
  ],
  "new_stories": [
    {
      "title": "Story title",
      "intent": "Why this matters for the vision",
      "acceptance": ["Specific criterion 1", "Specific criterion 2"],
      "phase": 1,
      "epic": 1,
      "priority": "high" | "medium" | "low",
      "gap_reference": "Which gap this addresses"
    }
  ]
}

Be pragmatic and specific:
- Only flag real issues that impact the vision
- Suggest concrete, actionable changes
- Use specific acceptance criteria (avoid vague terms like "properly", "handle", "settings")
- Keep story titles concise and action-oriented
