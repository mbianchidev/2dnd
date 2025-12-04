---
on:
  schedule:
    - cron: "0 14 * * 1-5"  # 2 PM UTC, weekdays only (Mon-Fri)
  workflow_dispatch:
name: Daily Activity Report
permissions: read-all
timeout-minutes: 10
safe-outputs:
  create-issue:
    title-prefix: "[Daily Report 2DND] "
    labels: [report, automated]
engine: copilot
tools:
  github:
    toolsets: [default]
---

# Daily Repository Activity Report

Generate a comprehensive daily activity report for the repository covering the past 24 hours.

## Report Structure

Create a new issue with today's date in the title and include the following sections:

### 📊 Summary
- Total number of commits pushed
- Total number of issues opened/closed
- Total number of PRs opened/merged/closed
- Total number of comments and discussions

### 💻 Commits
List recent commits with:
- Commit SHA (short form)
- Author
- Commit message (first line)
- Timestamp

### 🐛 Issues Activity
**Opened Issues:**
- List new issues with their number, title, and author

**Closed Issues:**
- List closed issues with their number, title, and who closed them

### 🔀 Pull Requests Activity
**Opened PRs:**
- List new PRs with their number, title, and author

**Merged PRs:**
- List merged PRs with their number, title, and who merged them

**Closed PRs (not merged):**
- List closed (but not merged) PRs

### 💬 Discussions & Comments
- Total number of comments across issues and PRs
- Notable discussion threads (if any with high activity)

## Time Range
Focus on activity from the past 24 hours (since yesterday at this time).

## Formatting
- Use markdown formatting with headers, lists, and emojis
- Include clickable links to issues, PRs, and commits
- Keep it concise but informative
- If there's no activity in a section, write "No activity" instead of omitting the section
