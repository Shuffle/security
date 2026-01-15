# Shutdown Security Documentation

Welcome to the Shutdown Security documentation. This guide will help you understand how to set up and use Shutdown Security with your Shuffle Automation instance.

## Quick Links

- [Setup Guide](/docs/setup) - Configure Shutdown Security to connect to your Shuffle backend
- [Shuffle API Documentation](https://shuffler.io/docs/API) - Complete API reference

## What is Shutdown Security?

Shutdown Security is an open-source alert and case management interface designed to work with [Shuffle Automation](https://shuffler.io). It provides:

- **Alert Management** - View, triage, and manage security alerts from your automation workflows
- **Case Tracking** - Create and track investigation cases with full audit trails
- **Template System** - Build reusable case templates for consistent incident response

## Getting Started

1. **Have a Shuffle Instance** - You need access to either Shuffle Cloud or a self-hosted Shuffle Automation instance
2. **Configure the Connection** - Point Shutdown Security to your Shuffle backend URL
3. **Authenticate** - Use your Shuffle credentials to log in

See the [Setup Guide](/docs/setup) for detailed configuration instructions.

## Architecture

```
┌───────────────────┐     ┌─────────────────────┐
│ Shutdown Security │────▶│  Shuffle Automation │
│    (Frontend)     │◀────│     (Backend)       │
└───────────────────┘     └─────────────────────┘
                               │
                               ▼
                         ┌─────────────┐
                         │  Your Data  │
                         │  & Workflows│
                         └─────────────┘
```

Shutdown Security is a frontend application that communicates with the Shuffle Automation API. All data is stored and processed by your Shuffle instance.
