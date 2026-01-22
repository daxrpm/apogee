---
title: Getting Started
description: Installation and quick start guide for Apogee rocket simulator
---

# Getting Started

Welcome to Apogee! This section will help you get up and running with the rocket simulator.

## Prerequisites

- **Python ≥ 3.11**
- **[uv](https://github.com/astral-sh/uv)** package manager

## Quick Install

```bash
# Clone repository
git clone https://github.com/daxrpm/apogee.git
cd apogee

# Install all packages
uv sync
```

## Your First Launch

```bash
uv run apogee-launch --h-target-km 200 --payload-kg 5000
```

This simulates a Falcon 9 launch to a 200 km circular orbit with a 5000 kg payload.

## Next Steps

- [Installation](installation.md) - Detailed setup instructions
- [Quick Start](quickstart.md) - Step-by-step first simulation
- [Architecture](architecture.md) - Understanding the codebase
