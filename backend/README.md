# Backend Setup - Stock Options Tracker

## 📋 Prerequisites

- Node.js 14+
- MongoDB (Local หรือ Cloud)
- npm

---

## 🚀 Installation

### 1. Install MongoDB

#### Option A: Local Installation
```bash
# Windows: Download from https://www.mongodb.com/try/download/community
# Install and run MongoDB service

# Check if running
mongod --version
```

#### Option B: MongoDB Atlas (Cloud)
```
1. Go to https://www.mongodb.com/cloud/atlas
2. Create account + Cluster
3. Get connection string:
   mongodb+srv://user:password@cluster.mongodb.net/dbname
4. Update .env file
```

---

### 2. Install Dependencies

```bash
cd "c:\CODE\Stock Options Tracker\backend"
npm install
```

---

### 3. Configure .env

Modify `.env` file:

```env
# Local MongoDB
MONGODB_URI=mongodb://localhost:27017/stock-tracker

# Or MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/stock-tracker

PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

---

## ▶️ Run Backend

### Development Mode
```bash
npm install -g nodemon  # Install globally (optional)
npm run dev
```

Expected output:
```
✅ Connected to MongoDB
🚀 Server running on http://localhost:3000
```

### Production Mode
```bash
npm start
```

---

## 📊 MongoDB Compass

View databases/collections:

1. Open MongoDB Compass
2. Connection: `mongodb://localhost:27017`
3. Connect
4. Browse collections under `stock-tracker` database

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | Get all transactions |
| GET | `/api/transactions/:id` | Get single transaction |
| GET | `/api/transactions/symbol/:symbol` | Get by symbol |
| POST | `/api/transactions` | Create transaction |
| PUT | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |
| GET | `/api/health` | Health check |

---

## 📝 Example API Request

### Create Transaction
```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "type": "buy",
    "assetType": "stock",
    "quantity": 10,
    "price": 150,
    "commission": 5,
    "date": "2024-01-01"
  }'
```

### Get All Transactions
```bash
curl http://localhost:3000/api/transactions
```

---

## 🐛 Troubleshooting

### Error: `mongodb not found`
```bash
# Make sure MongoDB is running
mongod  # Start MongoDB service
```

### Error: `EADDRINUSE: address already in use :::3000`
```bash
# Port 3000 is already in use
npm run dev -- --port 3001  # Use different port
```

### Error: `Connection refused`
```bash
# Check MongoDB connection string in .env
# Make sure MongoDB service is running
```

---

## 📂 Project Structure

```
backend/
├── server.js           # Main server file
├── .env                # Environment variables
├── package.json        # Dependencies
├── models/
│   └── Transaction.js  # MongoDB schema
└── routes/
    └── transactions.js # API routes
```

---

## ✅ Verify Setup

```bash
# 1. Start backend
npm run dev

# 2. In another terminal, test API
curl http://localhost:3000/api/health

# Response should be:
# {"status":"OK","message":"Server is running"}
```

---

## 🔗 Frontend Integration

Frontend automatically makes API calls to:
```
http://localhost:3000/api/...
```

Make sure both are running:
- Backend: `npm run dev` in `backend/` folder
- Frontend: `npm run dev` in root folder

---

For issues, check server logs in terminal.
