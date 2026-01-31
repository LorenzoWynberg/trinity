# Refine Stories

Review these stories for clarity and testability:

STORIES TO REVIEW:
{{STORIES}}

For each story, check:
1. Are acceptance criteria specific and testable?
2. Are there vague terms? ("settings", "improve", "properly", "handle")
3. Should it be split into smaller stories?

Output JSON:
{
  "refinements": [
    {
      "id": "X.Y.Z",
      "title": "story title",
      "status": "ok" | "needs_work",
      "issues": ["issue 1"],
      "suggested_description": "clearer description",
      "suggested_acceptance": ["criterion 1", "criterion 2"],
      "tags": ["from", "original"],
      "depends_on": ["from", "original"]
    }
  ],
  "summary": "X of Y stories need refinement"
}

Copy tags and depends_on from original. Be pragmatic - only flag real issues.
