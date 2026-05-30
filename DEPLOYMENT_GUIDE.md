# Deployment Guide: Netlify + Heroku + MongoDB Atlas

## Prerequisites
- GitHub account (for version control)
- Netlify account (free)
- Heroku account (free tier with limitations)
- MongoDB Atlas account (free tier)

---

## Step 1: Setup Database (MongoDB Atlas)

### 1.1 Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/cloud/atlas
2. Click "Sign Up" → Create free account
3. Create a project

### 1.2 Create Database Cluster
1. Click "Create Deployment" → Select "Free Tier" (M0)
2. Choose cloud provider (AWS/Google Cloud/Azure) and region
3. Click "Create"
4. Wait 5-10 minutes for cluster to initialize

### 1.3 Get Connection String
1. Click "Connect" → "Drivers"
2. Copy the connection string (MongoDB URI)
3. Replace `<password>` with your database password
4. Example: `mongodb+srv://user:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority`

### 1.4 Create Database User
1. Go to "Database Access"
2. Click "Add New Database User"
3. Create username/password (note these!)
4. Set "Built-in Role" → "Atlas Admin"

### 1.5 Whitelist IP (Allow all for testing)
1. Go to "Network Access"
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (0.0.0.0/0)
4. Confirm

---

## Step 2: Prepare Code for Deployment

### 2.1 Create `.gitignore` (if not exists)
Frontend root:
```
node_modules/
dist/
.env
.env.local
.DS_Store
```

Backend `.gitignore`:
```
node_modules/
.env
.DS_Store
```

### 2.2 Create `Procfile` in Backend
```
web: node server.js
```

### 2.3 Update Backend `package.json`
Ensure `"engines"` field exists:
```json
{
  "name": "stock-tracker-backend",
  "version": "1.0.0",
  "engines": {
    "node": "18.x"
  },
  ...
}
```

### 2.4 Update Frontend `vite.config.ts`
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
```

### 2.5 Create `.env.production` Frontend
```
VITE_API_URL=https://YOUR-HEROKU-APP.herokuapp.com/api
```

### 2.6 Update Frontend API calls
In `src/utils/api.ts`, use environment variable:
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
```

---

## Step 3: Push to GitHub

### 3.1 Initialize Git Repository
```bash
cd "c:\CODE\Stock Options Tracker"
git init
git add .
git commit -m "Initial commit"
```

### 3.2 Create GitHub Repository
1. Go to https://github.com/new
2. Create repo name: `stock-options-tracker`
3. Don't initialize with README
4. Click "Create repository"

### 3.3 Push to GitHub
```bash
git remote add origin https://github.com/YOUR-USERNAME/stock-options-tracker.git
git branch -M main
git push -u origin main
```

---

## Step 4: Deploy Backend to Heroku

### 4.1 Create Heroku Account & Install CLI
1. Go to https://www.heroku.com
2. Sign up (free)
3. Download Heroku CLI from https://devcenter.heroku.com/articles/heroku-cli

### 4.2 Login to Heroku
```bash
heroku login
```

### 4.3 Create Heroku App
```bash
cd "c:\CODE\Stock Options Tracker\backend"
heroku create your-app-name
```

### 4.4 Set Environment Variables
```bash
heroku config:set MONGODB_URI="mongodb+srv://user:password@cluster.mongodb.net/stock-tracker?retryWrites=true&w=majority"
heroku config:set JWT_SECRET="your-random-secret-key-change-this"
heroku config:set FINNHUB_API_KEY="d76ldspr01qtg3ne1l20d76ldspr01qtg3ne1l2g"
heroku config:set POLYGON_API_KEY="SvX2DV21eSimakQyGwI4TMY_yFpwHAqL"
heroku config:set CORS_ORIGIN="https://your-netlify-domain.netlify.app"
heroku config:set NODE_ENV="production"
```

### 4.5 Deploy to Heroku
```bash
git push heroku main
```

### 4.6 View Logs
```bash
heroku logs --tail
```

### 4.7 Get Heroku URL
```bash
heroku info
```
Your backend URL will be: `https://your-app-name.herokuapp.com`

---

## Step 5: Deploy Frontend to Netlify

### 5.1 Create Netlify Account
1. Go to https://www.netlify.com
2. Sign up with GitHub

### 5.2 Connect Repository
1. Click "Add new site" → "Import an existing project"
2. Select GitHub provider
3. Authorize & select `stock-options-tracker` repo

### 5.3 Configure Build Settings
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: 18

### 5.4 Set Environment Variables
In Netlify dashboard:
1. Go to "Site settings" → "Build & deploy" → "Environment"
2. Add variable:
   ```
   VITE_API_URL=https://your-app-name.herokuapp.com/api
   ```

### 5.5 Deploy
Click "Deploy site" - Netlify will automatically build and deploy!

---

## Step 6: Update CORS in Backend

After deploying, update Backend environment:
```bash
heroku config:set CORS_ORIGIN="https://your-site-name.netlify.app"
```

Then redeploy:
```bash
git push heroku main
```

---

## Step 7: Test Deployment

1. Visit your Netlify URL
2. Try logging in
3. Check browser console for errors
4. View Heroku logs for backend errors:
   ```bash
   heroku logs --tail
   ```

---

## Common Issues & Solutions

### Issue: "CORS error" 
**Solution**: Update `CORS_ORIGIN` in Heroku config

### Issue: "Cannot connect to database"
**Solution**: 
- Check MongoDB Atlas IP whitelist allows 0.0.0.0/0
- Verify connection string is correct
- Check username/password credentials

### Issue: Heroku app goes to sleep
**Solution**: Use paid tier or keep-alive service like https://uptimerobot.com

### Issue: Build fails on Netlify
**Solution**: Check build logs, ensure `npm run build` works locally

---

## Cost Breakdown (Estimated Monthly)

| Service | Free Tier | Cost |
|---------|-----------|------|
| MongoDB Atlas | 512MB (FREE) | $0 |
| Heroku | Limited (FREE) | $0 |
| Netlify | Unlimited builds | $0 |
| **Total** | - | **$0-5/month** |

*Note: Heroku free tier has limitations. Upgrade to $7/month for continuous uptime.*

---

## Next Steps for Production

1. **Upgrade Heroku**: Switch to paid tier ($7/month minimum)
2. **Upgrade MongoDB**: Scale to larger cluster if needed
3. **Set SSL Certificate**: Both platforms provide free SSL
4. **Add Domain**: Point custom domain to Netlify/Heroku
5. **Backup Database**: Enable MongoDB Atlas automated backups
6. **Monitor**: Use Heroku metrics & Netlify analytics

---

## Quick Deployment Checklist

- [ ] GitHub repository created & code pushed
- [ ] MongoDB Atlas cluster created & connection string noted
- [ ] Backend environment variables set in Heroku
- [ ] Frontend environment variables set in Netlify
- [ ] CORS_ORIGIN updated to Netlify URL
- [ ] Backend deployed to Heroku
- [ ] Frontend deployed to Netlify
- [ ] Test login/transactions work
- [ ] Check browser console for errors
- [ ] Check Heroku logs for backend errors

---

## Support Links

- Heroku Docs: https://devcenter.heroku.com
- Netlify Docs: https://docs.netlify.com
- MongoDB Atlas Docs: https://docs.atlas.mongodb.com
- Vite Docs: https://vitejs.dev

