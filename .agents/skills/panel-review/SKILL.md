---
name: panel-review
description: "Pre-push panel review of staged changes by architect + security personas. Catches design flaws and security gaps before the PR is even opened. Trigger before `git push` on any branch with non-trivial changes."
license: MIT
metadata:
  author: "Zava Engineering"
  source: "Zava platform team — derived from PR-review fatigue retrospective Q3"
---

# panel-review

Run a **two-persona review** (architect + security) on staged changes before you push. Surface findings as inline comments you can act on, fix, and amend — so the human PR reviewer sees clean, considered work, not first-draft.

## When to use this

- You have non-trivial staged changes (more than a typo fix, more than a config bump).
- You want to catch your own blind spots before paying the human-reviewer tax.
- You're working on a PR that touches: a new endpoint, schema change, auth boundary, dependency add, or anything in `infra/`.

## When NOT to use this

- Trivial fixes (typo, comment, version bump). The panel will surface noise.
- You're in the middle of an incident and need to ship a hotfix. Skip; the on-call panel reviews after.

## Inputs

- **Required:** staged changes (`git diff --staged`). Skill auto-reads.
- **Optional:** scope hint (`--scope auth`, `--scope storage`, `--scope ui`) to focus the personas.

## Output (fixed contract, always)

Return this exact structure every run so humans and tools can act on it without reformatting:

```markdown
## PR Review Report: <short change title>

Based on expert reviews from the architect and security personas, here's the comprehensive analysis:

---

### 🏛️ Architect Review

**Strengths:**
✅ <strength 1>
✅ <strength 2>
✅ <strength 3>

**Critical Concerns:**
1. **`[DESIGN FLAW|SCALING RISK|COUPLING|INCONSISTENT|OPPORTUNITY]` — <title>**
 - Evidence: `<file>:<line>`
 - Impact: <why it matters>
 - **Fix:** <actionable fix>

No concerns case: write exactly `No concerns.`

---

### 🛡️ Security Review

**Strengths:**
✅ <strength 1>
✅ <strength 2>
✅ <strength 3>

**Findings:**
- **🚨 BLOCKER — <title>**
  - Evidence: `<file>:<line>`
  - Impact: <impact>
  - **Required fix:** <actionable fix>
- **⚠️ WARNING — <title>**
  - Evidence: `<file>:<line>`
  - Impact: <impact>
  - **Suggested fix:** <actionable fix>
- **ℹ️ INFO — <title>**
  - Evidence: `<file>:<line>`
  - Impact: <impact>
  - Note: <observation>

No findings case: write exactly `No findings.`

---

### 📋 Security Baseline Checklist

| Item | Status | Notes |
|------|--------|-------|
| No new secrets | ✅/❌ | <brief note> |
| AuthN + AuthZ on handlers | ✅/❌ | <brief note> |
| Parameterized queries | ✅/❌ | <brief note> |
| Dependencies justified | ✅/❌ | <brief note> |
| PII masked in logs | ✅/❌ | <brief note> |

---

### Recommendation

**Do not merge in current state.** | **Safe to merge.**

**Next steps:**
1. <highest-priority action>
2. <next action>
3. <next action>

Gates:
- `ARCHITECT_GATE=PASS|FAIL`
- `SECURITY_GATE=PASS|FAIL`
- `OVERALL_GATE=PASS|FAIL`
```

## Process

1. **Read the diff.** `git diff --staged` is the source of truth, not the working tree.
2. **Run pass 1 (architecture) in isolation.** Invoke architect persona with explicit instruction: "architecture dimension only; no security findings."
3. **Run pass 2 (security) in isolation.** Invoke security persona with explicit instruction: "security dimension only; no architecture/style/test findings unless direct security risk."
4. **Normalize both outputs** into the fixed report structure above.
5. **Publish report** for action. Do not auto-amend the commit.

## Hard rules

- **One dimension per pass.** Mixed-dimension findings are invalid; rerun the offending pass.
- **Fixed schema only.** Do not improvise sections or headings.
- **Diff-only input.** Do not read files outside the diff unless explicitly asked.
- **Severity is honest.** A `BLOCKER` means "do not push."
- **No silent skips.** If a pass has no issues, emit the required `No concerns.` / `No findings.` text.

## Wired to the `pr-review-gate` hook

The `pr-review-gate.hook.md` triggers `panel-review` automatically on `pre-push` for branches matching `feat/*`, `fix/*`, `chore/*`. You can run it manually anytime.

## Example invocation

```
> Run panel-review on my staged changes. Scope: auth.
```

## See also

- `architect.agent.md` — persona invoked for architectural review
- `security.agent.md` — persona invoked for security review
- `secure-coding-base.instructions.md` — the security checklist applied
- `pr-review-gate.hook.md` — automated trigger
