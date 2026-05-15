# 🚀 GEM SAAS — Local Development Startup Guide

**Configuration:** May 12, 2026  
**Frontend Port:** 5174 (Changed from 5173 — Docker reserved)  
**Backend Port:** 5008 (Default)  
**Database:** electrification  

---

## ⚡ Quick Start (2 Steps)

### Step 1: Start Backend
```bash
cd backend
npm start
# Backend will run on http://localhost:5008
```

### Step 2: Start Frontend
```bash
cd frontend
npm run dev
# Frontend will run on http://localhost:5174
```

**Access:** http://localhost:5174

---

## 🔐 Login Credentials

| Field | Value |
|-------|-------|
| **Email** | admin@proquelec.sn |
| **Password** | admin123 |

---

## 📋 Detailed Steps

### Prerequisites
```bash
# Ensure you have:
- Node.js v18+ installed
- PostgreSQL running (on localhost:5435)
- Database "electrification" exists
```

### Backend Setup
```bash
cd backend

# 1. Install dependencies
npm install

# 2. Create .env.local if needed
cat > .env.local <<EOF
DATABASE_URL=postgresql://user:password@127.0.0.1:5435/electrification
NODE_ENV=development
PORT=5008
JWT_SECRET=development-secret-key-min-32-chars-long-1234
CORS_ORIGINS=http://localhost:5174,http://localhost:5173
EOF

# 3. Run migrations (if needed)
npx prisma migrate deploy

# 4. Start server
npm start
```

**Expected Output:**
```
✅ Server running on http://localhost:5008
✅ API available at http://localhost:5008/api
```

### Frontend Setup
```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start dev server on port 5174
npm run dev

# 3. Open http://localhost:5174
```

**Expected Output:**
```
✅ Local:   http://localhost:5174/
✅ API Proxy: http://localhost:5008/api
```

---

## 🔗 Connection Verification

### Check Backend Connection
```bash
curl http://localhost:5008/api/health
# Expected: { "status": "ok" }
```

### Check Frontend Connection
```bash
# Open browser to http://localhost:5174
# You should see the login page
```

### Check Database Connection
```bash
# Backend logs should show:
# ✅ Database connected
```

---

## 📱 Login & First Steps

1. **Open:** http://localhost:5174
2. **Enter:**
   - Email: `admin@proquelec.sn`
   - Password: `admin123`
3. **Click:** Login
4. **Expected:** Dashboard with Supervision Senelec project

---

## 🛠️ Port Configuration

### Frontend Port: 5174 (PERMANENT)
**Changed from:** 5173 (Docker reserved)  
**Location:** `frontend/vite.config.ts` line 142  
**Reason:** Port 5173 is used by another Docker application  

```typescript
server: {
  port: 5174,  // PERMANENT - Never change
  strictPort: true,
  ...
}
```

### Backend Port: 5008 (Default)
**Location:** `.env` or `backend/src/app.js`  
**Can be changed:** Set PORT env var if needed  

```bash
PORT=5008 npm start  # Default
PORT=3000 npm start  # Custom
```

---

## 🐛 Troubleshooting

### Frontend won't start
```bash
# Error: Port 5174 already in use?
# Solution: Change port in vite.config.ts OR
# Find process: lsof -i :5174
# Kill process: kill -9 <PID>

# OR use different port temporarily:
npm run dev -- --port 5175
```

### Backend connection error
```bash
# Error: Cannot connect to backend
# Check:
1. Is backend running? (curl http://localhost:5008/api/health)
2. Is database running?
3. Check backend logs for errors
4. Verify DATABASE_URL in .env
```

### Database connection error
```bash
# Error: Cannot connect to database
# Solution:
1. Ensure PostgreSQL is running
2. Verify database "electrification" exists
3. Check DATABASE_URL is correct
4. Run: npx prisma db push
```

### Cannot login
```bash
# Check backend logs for error
# Verify credentials: admin@proquelec.sn / admin123
# Check JWT_SECRET is set in backend/.env
```

---

## 📊 Ports Summary

| Service | Port | Status | Notes |
|---------|------|--------|-------|
| Frontend | 5174 | ✅ | Vite dev server |
| Backend | 5008 | ✅ | Express API |
| Database | 5435 | ✅ | PostgreSQL |
| Docker | 5173 | ❌ | Reserved (not using) |

---

## 🔄 Common Workflows

### Full Fresh Start
```bash
# Terminal 1: Backend
cd backend
npm install
npm start

# Terminal 2: Frontend (after backend is ready)
cd frontend
npm install
npm run dev
```

### Hot Reload Development
```bash
# Both backend and frontend auto-reload on file changes
# No need to restart unless dependencies change
```

### Database Reset
```bash
cd backend
npx prisma migrate reset  # Warning: Deletes all data
npm start
```

---

## ✅ Health Check

Run this to verify everything is working:

```bash
#!/bin/bash

echo "🏥 GEM SAAS Health Check"
echo ""

# Check Backend
echo "Backend API..."
if curl -s http://localhost:5008/api/health | grep -q ok; then
    echo "  ✅ Backend running"
else
    echo "  ❌ Backend not responding"
fi

# Check Frontend
echo "Frontend..."
if curl -s http://localhost:5174 | grep -q "<!doctype" ; then
    echo "  ✅ Frontend running"
else
    echo "  ❌ Frontend not responding"
fi

# Check Database
echo "Database..."
if psql -d electrification -c "SELECT 1" > /dev/null 2>&1; then
    echo "  ✅ Database connected"
else
    echo "  ❌ Database not responding"
fi

echo ""
echo "🎉 All systems ready!"
```

---

## 📝 Environment Files

### Backend (.env or .env.local)
```
DATABASE_URL=postgresql://user:pass@127.0.0.1:5435/electrification
NODE_ENV=development
PORT=5008
JWT_SECRET=your-secret-key-min-32-chars-required-here
LOG_LEVEL=debug
CORS_ORIGINS=http://localhost:5174
```

### Frontend (auto-configured)
No .env needed — uses Vite proxy to http://localhost:5008

---

## 🚀 Next Steps

After login:

1. **Verify installation:**
   - [ ] Can login with admin credentials
   - [ ] See Supervision Senelec project
   - [ ] Access dashboard

2. **Test features:**
   - [ ] Create new project
   - [ ] View missions
   - [ ] Check templates
   - [ ] Test offline mode

3. **Run tests:**
   ```bash
   npm test -- multitenant-isolation.security.test.js
   ```

4. **Check hot reload:**
   - Edit a frontend file
   - Should auto-reload in browser

---

## 📞 Support

| Issue | Solution |
|-------|----------|
| Port conflict | Use `lsof -i :<port>` to find process |
| Database error | Check PostgreSQL is running |
| Module not found | Run `npm install` in backend/frontend |
| Slow startup | First start is slower (compilation) |
| CORS error | Check CORS_ORIGINS in backend .env |

---

## ⚙️ Configuration Summary

```
✅ Frontend Port: 5174 (PERMANENT - was 5173)
✅ Backend Port: 5008 (default)
✅ Database: electrification
✅ Login: admin@proquelec.sn / admin123
✅ API Proxy: Configured in vite.config.ts
✅ Auto-reload: Enabled for both frontend & backend
```

---

**Ready to develop? 🚀**

```bash
# Terminal 1
cd backend && npm start

# Terminal 2
cd frontend && npm run dev

# Open browser
open http://localhost:5174
```

**Login:** admin@proquelec.sn / admin123
