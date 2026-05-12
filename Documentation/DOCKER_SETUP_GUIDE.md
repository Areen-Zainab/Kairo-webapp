# 🐳 Kairo-webapp Docker Setup Guide

This guide explains how to set up the Kairo-webapp environment using Docker. This approach packages the Frontend, Backend, AI Layer, and Database into containers, ensuring "it works on every machine."

---

## 📋 Prerequisites

1.  **System Requirements**:
    *   **RAM**: 8GB Minimum (16GB Recommended).
    *   **Disk Space**: 20GB+ free (AI models are large).
    *   **Architecture**: AMD64 (Standard Intel/AMD processors).
2.  **Software**:
    *   [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed on Windows.
    *   **WSL 2** enabled in Docker settings.

---

## 🚀 Step-by-Step Setup

### Step 1: Configuration
Ensure you have the following files in your project root (created during setup):
*   `docker-compose.yml`
*   `.env.docker`
*   `backend/Dockerfile`
*   `frontend/Dockerfile`
*   `frontend/nginx.conf`

### Step 2: Build the Environment
Open PowerShell in the project root (`a:\FYP\Kairo-webapp`) and run:
```powershell
docker-compose build
```
> [!NOTE]
> The first build will take 10-20 minutes as it downloads heavy AI libraries (PyTorch, WhisperX). Subsequent builds will be much faster.

### Step 3: Launch Services
Start all containers in "detached" mode (running in the background):
```powershell
docker-compose up -d
```

### Step 4: Initialize the Database
Since the Docker database is fresh, you must run the Prisma migrations:
```powershell
docker-compose exec backend npx prisma migrate deploy
```

---

## 🛠️ Usage & Ports

| Service | URL | Role |
| :--- | :--- | :--- |
| **Frontend** | `http://localhost` | The main React UI (Port 80) |
| **Backend** | `http://localhost:5000` | API Server |
| **Database** | `localhost:5432` | PostgreSQL + pgvector |

### Useful Commands

*   **View Logs**: `docker-compose logs -f backend` (useful for debugging AI transcription).
*   **Stop App**: `docker-compose down`.
*   **Restart App**: `docker-compose restart`.
*   **Reset Database**: `docker-compose down -v` (Warning: deletes all data).

---

## 🔍 Architecture Overview

*   **Networking**: The frontend uses **Nginx** to proxy requests starting with `/api` to the backend container internally.
*   **AI Execution**: The backend container runs a Python virtual environment internally. When a meeting is processed, it spawns Python subprocesses to run the agents and WhisperX.
*   **Persistence**: Database data is stored in a Docker volume called `db_data`. Meeting recordings are synced to `./backend/data`.
