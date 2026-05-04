# 🚀 Kairo-webapp — Honest Free Deployment Guide
> Based on a full code review of every service, config, and API file in the project.

---

## ⚠️ Read This First — What CAN and CANNOT Deploy for Free

After reading your entire codebase, here is the honest picture:

| Feature | Deploy for Free? | Platform | Notes |
|---|---|---|---|
| **React Frontend** | ✅ Yes | Vercel | Works perfectly |
| **Backend REST API** | ✅ Yes | Render | Auth, workspaces, meetings, tasks, calendar, notifications |
| **PostgreSQL + pgvector** | ✅ Yes | Supabase | Already configured in your `.env` |
| **File Storage** (audio, images) | ✅ Yes | Supabase | Already set up |
| **Calendar Sync** (Google OAuth) | ✅ Yes | Render | Just update redirect URI |
| **Groq AI** (Whisper mode recaps) | ✅ Yes | Render | Groq is free, key already in `.env` |
| **Mistral AI** (Summaries) | ✅ Yes | Render | Free tier via HuggingFace API |
| **Puppeteer Meeting Bot** | ❌ No | Anywhere free | Needs real browser + 1GB+ RAM |
| **WhisperX Transcription** | ❌ No | Anywhere free | Needs Python venv, 2GB+ RAM, `torch` |
| **Speaker Diarization** | ❌ No | Anywhere free | Needs `speechbrain` + heavy model files |
| **Voice Embedding Service** | ❌ No | Anywhere free | Needs ECAPA-TDNN model, Python process |

**Bottom line:** The entire backend API (auth, meetings CRUD, kanban, notifications, calendar, tasks) deploys fine for free. The AI features that require a local Python process with heavy ML models (WhisperX, SpeechBrain, Puppeteer) physically cannot run on free cloud services. **For an FYP demo this is perfectly fine** — run the bot locally, use the deployed backend.

---

## 🔴 Critical Code Fix Required BEFORE Deploying

### The `api.ts` Problem

Your `frontend/src/services/api.ts` line 1 is **hardcoded**:

```typescript
const API_BASE_URL = 'http://localhost:5000/api'; // ← This will NEVER work in production
```

This means your deployed frontend will try to call `localhost:5000` from the user's browser — which doesn't exist. **The app will be completely broken without this fix.**

### Fix Applied

I have updated `frontend/src/services/api.ts`, line 1 to:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
```

---

## Step 1 — Push Code to GitHub

```powershell
# From a:\FYP\Kairo-webapp
git add .
git commit -m "fix: use env var for API URL and add deployment guide"
git push -u origin main
```

---

## Step 2 — Set Up Supabase Database

You already have a Supabase project (it's in your `.env`). You just need to point Prisma at it.

### 2a. Get your Supabase PostgreSQL connection string

1. Go to [supabase.com](https://supabase.com) → your project → **Settings → Database**
2. Copy the **URI** connection string:
   ```
   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
   ```

### 2b. Enable pgvector

In Supabase dashboard → **SQL Editor**:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2c. Run Prisma migrations

**Temporarily** update `backend/.env` with the Supabase URL, then run:
```powershell
cd backend
npx prisma db push
```

---

## Step 3 — Deploy Backend to Render

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repo
3. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `node src/server.js`
   - **Plan**: `Free`

### Environment Variables on Render
Add your variables from `backend/.env` to the Render dashboard, specifically:
- `DATABASE_URL`: Your Supabase URL
- `FRONTEND_URL`: Your Vercel URL (Step 4)
- `GOOGLE_REDIRECT_URI`: `https://kairo-backend.onrender.com/api/calendar/oauth/google/callback`

---

## Step 4 — Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Configure:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Environment Variables**:
   - `VITE_API_URL`: `https://kairo-backend.onrender.com/api`

---

## Step 5 — Update Google OAuth

Update your Redirect URI in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) to:
`https://kairo-backend.onrender.com/api/calendar/oauth/google/callback`

---

## Summary Checklist

- [x] Fix `api.ts` (Done)
- [ ] Push code to GitHub
- [ ] Enable `vector` extension on Supabase
- [ ] Run `npx prisma db push` against Supabase
- [ ] Create Render service (Backend)
- [ ] Create Vercel project (Frontend)
- [ ] Update Google OAuth Redirect URI
