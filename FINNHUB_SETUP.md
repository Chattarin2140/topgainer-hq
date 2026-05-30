# Finnhub Stock Price API Setup Guide

## Overview
This guide will help you set up real-time stock price data from the Finnhub API, replacing the mock `Math.random()` pricing with actual market prices.

## Why Finnhub?
- **Free API**: Finnhub provides a free tier with 60 API calls/minute
- **Real-time Data**: Get current stock prices, company profiles, and market data
- **Easy Integration**: Simple REST API with no complexity
- **No Authentication Required**: Just need an API key

## Step 1: Create Finnhub Account

1. Go to https://finnhub.io/
2. Click "Get free API key" or sign up
3. Enter your email and create a password
4. Verify your email
5. Log in to your account

## Step 2: Get Your API Key

1. After logging in, go to your **Dashboard**
2. Look for "API tokens" or similar section
3. Copy your **API Key** (you'll see something like `cq8vp6hr01qsn7p2...`)
4. Keep this key safe - never commit it to git

## Step 3: Configure Backend

1. Open `backend/.env` file
2. Find the line: `FINNHUB_API_KEY=your_finnhub_api_key_here`
3. Replace with your actual key:
   ```
   FINNHUB_API_KEY=cq8vp6hr01qsn7p2abcd...
   ```

4. Save the file
5. **Restart the backend server**:
   ```bash
   npm start
   ```

## Step 4: Test the API Endpoints

### Test in Browser Console:

**Get single stock price:**
```javascript
fetch('http://localhost:3000/api/prices/AAPL')
  .then(r => r.json())
  .then(c => console.log(c))
```

**Expected Response:**
```json
{
  "symbol": "AAPL",
  "price": 150.25,
  "high": 151.50,
  "low": 149.80,
  "open": 150.00,
  "previousClose": 149.95,
  "timestamp": "2024-01-15T14:30:00Z"
}
```

**Get multiple prices at once:**
```javascript
fetch('http://localhost:3000/api/prices/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ symbols: ['AAPL', 'GOOGL', 'MSFT'] })
})
  .then(r => r.json())
  .then(c => console.log(c))
```

## Step 5: Use in Frontend

### How It Works:

1. **PositionsList** component now:
   - Fetches all symbols used in transactions
   - Calls `/api/prices/batch` to get current prices
   - Shows "API" label next to price source
   - Falls back to localStorage prices if API fails
   - Displays loading state while fetching

2. **Settings** page now has:
   - "Refresh Prices from API" button
   - Auto-updates all tracked symbols
   - Shows success/error messages

### Price Priority (highest to lowest):
1. **Real-time API price** from Finnhub ✨
2. **Manual price** entered in Settings
3. **No price** (displays 0, shows warning)

## Step 6: Monitor API Usage

1. Go to https://finnhub.io/dashboard
2. Check "API Usage" section
3. See current minute calls and monthly usage
4. Free tier: 60 calls/minute, 500 calls/month

## Troubleshooting

### Error: "Failed to fetch prices from API"

**Possible causes:**

1. **API Key not set or incorrect:**
   - Check backend/.env file
   - Make sure FINNHUB_API_KEY is not empty
   - Restart backend after changing

2. **Backend not running:**
   ```bash
   npm start  # in backend directory
   ```

3. **Invalid symbol:**
   - Only use valid stock symbols (AAPL, GOOGL, MSFT, etc.)
   - Finnhub API might not recognize some tickers

4. **Rate limit exceeded:**
   - Free tier: 60 calls/minute
   - Wait a minute before trying again
   - Consider upgrading for higher limits

### API returns old prices

- Finnhub updates prices with slight delay
- Typically 15-20 minute delay on free tier
- Use real-time subscription for instant data

### Want to check API manually?

Use curl:
```bash
curl "https://finnhub.io/api/v1/quote?symbol=AAPL&token=YOUR_API_KEY"
```

## API Rate Limits

**Free Tier:**
- 60 API calls per minute
- 500 API calls per month
- 15-20 minute delayed data

**Premium Tiers Available:**
- Real-time data
- Higher rate limits
- More features

## File Structure

```
backend/
├── .env                         # 👈 Add FINNHUB_API_KEY here
├── server.js                    # Routes registered here
├── routes/
│   └── prices.js               # API endpoints (/api/prices/*)
└── services/
    └── stockPrice.js           # Finnhub integration logic
```

## Frontend Components Using Prices

```
src/
└── components/
    └── PositionsList.tsx       # Fetches prices, shows source
└── pages/
    └── Settings.tsx            # Refresh button
```

## Next Steps

1. ✅ Set up Finnhub account
2. ✅ Get API key
3. ✅ Configure backend
4. ✅ Test endpoints
5. 🎉 Enjoy real-time prices!

## Support

If you encounter issues:
1. Check the Finnhub documentation: https://finnhub.io/docs/api/quote
2. Verify your API key is valid
3. Check browser console for errors
4. Ensure backend is running with correct env vars
