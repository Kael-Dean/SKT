---
name: fullstack-best-practices
description: |
  Best practices guide for Full-Stack Development covering React Native (iOS + Android),
  Next.js (Web), and Node.js + NestJS (Backend API). Use this skill when:
  - User wants to build a mobile app with React Native for iOS and/or Android
  - User wants to build a web app or website with Next.js
  - User wants to build a backend API with Node.js, Express, or NestJS
  - User asks about project structure, performance optimization, state management, or architecture patterns
  - User wants to connect frontend to backend or design a full-stack architecture
  - Keywords present: "React Native", "Expo", "Next.js", "NestJS", "Express", "TypeScript", "mobile app", "web app", "REST API", "GraphQL"
  Use this skill immediately when any of the above signals are detected to deliver production-ready quality output.
---

# Full-Stack Best Practices Skill

This guide covers 3 main stacks. Read the relevant reference file based on the task at hand:

| Task | Read Reference |
|------|---------------|
| React Native (iOS/Android) | `references/react-native.md` |
| Next.js (Web) | `references/nextjs.md` |
| Node.js / NestJS (Backend) | `references/backend.md` |
| Full-Stack Project | Read all relevant files |

## Quick Decision Guide

```
What does the user need?
├── Mobile App → react-native.md
├── Web App / Website → nextjs.md
├── API / Backend → backend.md
└── Full-Stack Project → read all references
```

## Core Principles Shared Across All Stacks

1. **TypeScript always** — Every project must use TypeScript to reduce bugs and improve maintainability
2. **Feature-based folder structure** — Organize code by feature, not by type
3. **Environment variables** — Never hardcode secrets; use `.env` with validation
4. **Testing** — Unit tests for business logic, integration tests for APIs
5. **Error handling** — Handle errors consistently across both frontend and backend
