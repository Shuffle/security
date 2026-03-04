# Shuffle Security Documentation

Welcome to the Shuffle Security documentation. This guide will help you understand how Shuffle Security works and how to get started.

## Quick Links

- [Getting Started](/docs/getting-started) - Set up Shuffle Security with your Shuffle Infrastructure instance
- [Shuffle Pipelines](/docs/shuffle-pipelines) - Learn how detection pipelines work with Tenzir
- [Self-Hosting](/docs/setup) - Deploy your own Shuffle Security instance
- [Shuffle API Documentation](https://shuffler.io/docs/API) - Complete API reference

## What is Shuffle Security?

Shuffle Security is a purpose-built security operations interface built on top of [Shuffle Infrastructure](https://shuffler.io). It's the same powerful automation platform you already know — just focused entirely on security workflows.

Think of it as a **security-first lens** on Shuffle Infrastructure. All the automation, integrations, and orchestration capabilities are there, but the interface is designed around how security teams actually work:

- **Incident Management** — Triage, investigate, and resolve security incidents with structured workflows
- **Detection Pipelines** — Deploy and manage detection sensors using Tenzir and Sigma rules
- **Case Tracking** — Build investigation cases with full audit trails, tasks, and collaboration
- **Usecase Templates** — Pre-built security workflows for SIEM, SOAR, XDR, and more
- **Threat Intelligence** — Integrate threat feeds and IOC management directly into your workflows

## How It Works

Shuffle Security is a frontend application that connects to your existing Shuffle Infrastructure backend. There is no separate backend — your data, workflows, and integrations all live in Shuffle Infrastructure.

```
┌──────────────────┐     ┌──────────────────────┐
│ Shuffle Security │────▶│ Shuffle Infrastructure│
│   (Frontend UI)  │◀────│    (Backend + API)    │
└──────────────────┘     └──────────────────────┘
                                │
                                ▼
                     ┌────────────────────┐
                     │ Your Integrations, │
                     │ Workflows & Data   │
                     └────────────────────┘
```

If you already have a Shuffle Infrastructure instance at [shuffler.io](https://shuffler.io) or self-hosted, you can point Shuffle Security at it and start working immediately.

## Getting Started

1. **Have a Shuffle Infrastructure instance** — Either use [Shuffle Cloud](https://shuffler.io) or [self-host](https://github.com/Shuffle/Shuffle) your own
2. **Configure the connection** — Point Shuffle Security to your backend URL
3. **Authenticate** — Use your existing Shuffle credentials to log in

See the [Getting Started guide](/docs/getting-started) for step-by-step instructions.
