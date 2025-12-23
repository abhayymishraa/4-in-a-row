# Deployment Setup Guide

## Quick Setup Instructions

### Option 1: Railway (Recommended - Easiest)

1. **Sign up**: Go to https://railway.app and create an account
2. **Create Project**: Click "New Project" → "Deploy from GitHub repo"
3. **Add PostgreSQL**:
   - Click "+ New" → "Database" → "PostgreSQL"
   - Railway will provide connection details automatically
4. **Deploy Backend**:
   - Click "+ New" → "GitHub Repo" → Select your repo
   - Set **Root Directory**: `backend`
   - Railway auto-detects Node.js
   - Add environment variables from `env/backend.env.example`:
     - Get DB credentials from PostgreSQL service (Railway auto-provides them)
     - Set `PORT` to Railway's assigned port (or leave empty, it auto-assigns)
     - `KAFKA_BROKERS` can be left empty (optional)
5. **Deploy Frontend**:
   - Click "+ New" → "GitHub Repo" → Select your repo  
   - Set **Root Directory**: `frontend`
   - Set **Build Command**: `npm install && npm run build`
   - Set **Start Command**: `npx serve -s dist -l $PORT`
   - Add environment variable:
     - `VITE_API_URL` = Your backend's public URL (from Railway)
6. **Get URLs**: 
   - Backend: Click backend service → Settings → Copy public URL
   - Frontend: Click frontend service → Settings → Copy public URL
7. **Update Frontend**: Set `VITE_API_URL` in frontend service to backend URL

**Why Railway?**
- Excellent WebSocket support (no config needed)
- Built-in PostgreSQL
- Automatic HTTPS
- $5/month free credit
- Simple GitHub integration

---

### Option 2: Render

1. **Sign up**: Go to https://render.com
2. **Create Web Service (Backend)**:
   - New → Web Service → Connect GitHub
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Add environment variables from `env/backend.env.example`
3. **Create PostgreSQL Database**:
   - New → PostgreSQL
   - Use connection details in backend env vars
4. **Create Static Site (Frontend)**:
   - New → Static Site → Connect GitHub
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`
   - Add environment variable: `VITE_API_URL` = backend URL

**Note**: Free tier spins down after inactivity (15 min), causing cold starts

---

### Option 3: Fly.io

1. **Install CLI**: `curl -L https://fly.io/install.sh | sh`
2. **Sign up**: `fly auth signup`
3. **Deploy Backend**:
   ```bash
   cd backend
   fly launch
   # Follow prompts, name it "emittr-backend"
   ```
4. **Add PostgreSQL**: `fly postgres create`
5. **Attach Database**: `fly postgres attach <db-name> -a emittr-backend`
6. **Set Environment Variables**:
   ```bash
   fly secrets set NODE_ENV=production
   fly secrets set LOG_LEVEL=info
   # DB vars are auto-set when you attach postgres
   ```
7. **Deploy**: `fly deploy`
8. **Deploy Frontend**:
   ```bash
   cd frontend
   fly launch --name emittr-frontend
   fly secrets set VITE_API_URL=https://emittr-backend.fly.dev
   fly deploy
   ```

---

## Environment Variables Setup

### Backend (.env file in `backend/` directory)

Copy `env/backend.env.example` to `backend/.env` and fill in:

```bash
NODE_ENV=production
PORT=3000                    # Or platform-assigned port
DB_HOST=your-db-host         # From your database provider
DB_PORT=5432
DB_NAME=emittr_game
DB_USER=postgres
DB_PASSWORD=your-password    # From your database provider
KAFKA_BROKERS=               # Optional, leave empty if not using
KAFKA_CLIENT_ID=emittr-game-backend
LOG_LEVEL=info
```

### Frontend (.env file in `frontend/` directory)

Create `frontend/.env` with:

```bash
VITE_API_URL=https://your-backend-url.com
```

**Important**: Vite requires `VITE_` prefix for environment variables to be accessible in code.

---

## Important Notes

1. **WebSockets**: All recommended platforms support WebSockets natively - no extra config needed
2. **Kafka is Optional**: Your app works fine without Kafka (it's already handled gracefully)
3. **Database**: Most platforms provide managed PostgreSQL - use their connection strings
4. **CORS**: Backend already allows all origins (`*`). For production, consider restricting to your frontend domain
5. **HTTPS**: All platforms provide automatic HTTPS - make sure `VITE_API_URL` uses `https://`

---

## Quick Checklist

- [ ] Choose a platform (Railway recommended)
- [ ] Set up PostgreSQL database
- [ ] Deploy backend with environment variables
- [ ] Get backend public URL
- [ ] Deploy frontend with `VITE_API_URL` pointing to backend
- [ ] Test WebSocket connection
- [ ] Test game functionality

---

## Troubleshooting

**WebSocket not connecting?**
- Check `VITE_API_URL` is correct in frontend
- Ensure backend URL is accessible (not behind firewall)
- Verify CORS settings allow your frontend domain

**Database connection failed?**
- Verify all DB environment variables are set correctly
- Check database is accessible from backend service
- Ensure database is running

**Build failures?**
- Check build logs for specific errors
- Verify all dependencies in `package.json`
- Ensure TypeScript compiles without errors
