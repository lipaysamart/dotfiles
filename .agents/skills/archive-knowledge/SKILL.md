---
name: archive-knowledge
description: >
  Archive knowledge to GitHub Issues using templates. Use when user requests 
  to archive, record, or submit knowledge with phrases like "归档一个 How-To", 
  "记录一个 TIL", "提交一个 Cheatsheet", "添加 Snippets", "记录 Troubleshoot". 
  Supports 5 templates: Til, How-To, Cheatsheet, Snippets, Troubleshoot.
---

# Archive Knowledge

Archives knowledge to GitHub Issues using the wiki repository's issue templates.

## Workflow

1. **Identify template type** from user request
2. **Collect information** through Q&A if user content is insufficient
3. **Generate preview** and show to user (including labels)
4. **Create labels** (auto-create 1-3 relevant tags with auto-assigned colors)
5. **Confirm and submit** via `gh issue create`

## Template Mapping

| Keyword | Template File | Title Prefix |
|---------|---------------|--------------|
| `til`, `today i learned`, `学到了` | `today-i-learned.md` | `[Til]` |
| `how-to`, `howto`, `指南` | `how-to-template.md` | `[How-To]` |
| `cheatsheet`, `速查`, `备忘` | `cheatsheet-template.md` | `[Cheatsheet]` |
| `snippets`, `代码片段`, `snippet` | `snippets-template.md` | (none) |
| `troubleshoot`, `故障排除`, `troubleshooting` | `troubleshoot-template.md` | `[Troubleshoot]` |

## Information Collection by Template

### TIL
- Context: Why/when did you learn this?
- Producer: What did you learn? (steps, commands, concepts)
- Action: How might you use this in the future?
- Reference: Links, docs

### How-To
- Context: Background
- Prerequisite: Requirements
- Producer: Steps
- Reference: Links

### Cheatsheet
- Context: Category/topic
- Director: Commands/shortcuts table

### Snippets
- Use Cases: When to use
- Produce: Code snippets

### Troubleshoot
- Context: Problem description
- Procedure: Solution steps
- Reference: Links

## Information Collection Strategy

- **Complete information**: If user provides all required fields, proceed directly
- **Incomplete information**: Use the `question` tool to collect missing details through Q&A
- Ask targeted questions based on the template's required fields

## Labels

1. **Identify 1-3 relevant labels** based on topic (e.g., `Docker`, `Kubernetes`, `Debugging`)
2. **Check existence**: `gh label list --limit 100`
3. **Auto-create if not exists**:
   ```bash
   gh label create "<label>" --color "<color>"
   ```
   - Auto-assign colors from a predefined palette
   - Common color palette: `#0075CA` (blue), `#0E8A16` (green), `#D93F0B` (orange), `#5319E7` (purple), `#1D76DB` (dark blue), `#E99695` (pink)
4. **Include in submission** via `--label` flag

## Submission

After user confirms preview:

```bash
gh issue create \
  --title "<title>" \
  --body "<body>" \
  --label "<label1>,<label2>"
```

**Important Notes:**
- **Titles must ALWAYS be in English, using Title Case** (e.g., "Caddy Docker Proxy vs Caddy")
- **Labels must use Title Case** (e.g., `Docker`, `Kubernetes`, not `docker`, `kubernetes`)
- **Do NOT use `--template` with `--body`** - they are mutually exclusive
- Construct body following the template structure manually
- Combine multiple labels with comma: `--label "label1,label2"`