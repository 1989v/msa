# Compaction Guide

## What is Compaction?
Auto-summarization when conversation reaches 64-75% of token budget.

## When to Manually Compact
- Task Group completion
- Spec document completion
- Phase transitions

## Pre-Compact Checklist
- [ ] git commit current work
- [ ] Record decisions in key-decisions.md
- [ ] Confirm next task clarity
- [ ] Verify work completion

## Post-Compact Recovery
1. Read CLAUDE.md
2. Read key-decisions.md
3. Check tasks.md checkboxes
4. Review git log

## Phase Transition Template
```
PHASE TRANSITION / CONTEXT RESTORATION REQUEST

## Previous Phase Summary
- **Feature**: [name]
- **Completed Tasks**: [list]
- **Key Decisions**: [list]

## Current Phase Goal
- [Next task description]

## Context to Load
1. docs/specs/{feature}/spec.md
2. docs/specs/{feature}/context/key-decisions.md
3. docs/specs/{feature}/tasks.md
```
