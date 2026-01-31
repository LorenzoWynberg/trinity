# Metrics

The metrics page displays token usage, costs, and duration statistics.

## Overview Stats

- Total tokens (input + output)
- Total cost estimate
- Total duration
- Stories completed

## Version Filtering

Filter metrics by PRD version to see costs per release.

## Story Breakdown

Table showing per-story metrics:

| Column | Description |
|--------|-------------|
| Story | Story ID and title |
| Input Tokens | Tokens sent to Claude |
| Output Tokens | Tokens received from Claude |
| Cost | Estimated cost for this story |
| Duration | Time spent on story |

## Data Source

Metrics are read from `metrics.json` in the Ralph CLI directory, updated after each story completion.
