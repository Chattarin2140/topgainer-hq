const express = require('express');
const router = express.Router();
const stockPriceService = require('../services/stockPrice');

// GET single stock price
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
      return res.status(400).json({ error: 'Valid symbol required' });
    }
    
    const price = await stockPriceService.getStockPrice(symbol.trim().toUpperCase());
    
    if (!price || price.price === undefined) {
      return res.status(404).json({ error: 'Price data not found' });
    }
    
    res.json(price);
  } catch (error) {
    console.error(`Error in GET /prices/:symbol:`, error);
    res.status(500).json({ error: error.message || 'Failed to fetch price' });
  }
});

// GET multiple stock prices
router.post('/batch', async (req, res) => {
  try {
    const { symbols } = req.body;

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'symbols array required' });
    }
    
    // Validate and clean symbols
    const validSymbols = symbols
      .filter(s => typeof s === 'string' && s.trim() !== '')
      .map(s => s.trim().toUpperCase());
    
    if (validSymbols.length === 0) {
      return res.status(400).json({ error: 'No valid symbols provided' });
    }
    
    if (validSymbols.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 symbols allowed per request' });
    }

    const prices = await stockPriceService.getMultiplePrices(validSymbols);
    
    if (!Array.isArray(prices) || prices.length === 0) {
      return res.status(500).json({ error: 'No prices returned' });
    }
    
    res.json(prices);
  } catch (error) {
    console.error(`Error in POST /prices/batch:`, error);
    res.status(500).json({ error: error.message || 'Failed to fetch prices' });
  }
});

// GET company profile
router.get('/profile/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
      return res.status(400).json({ error: 'Valid symbol required' });
    }
    
    const profile = await stockPriceService.getCompanyProfile(symbol.trim().toUpperCase());
    
    if (!profile || !profile.name) {
      return res.status(404).json({ error: 'Profile data not found' });
    }
    
    res.json(profile);
  } catch (error) {
    console.error(`Error in GET /prices/profile/:symbol:`, error);
    res.status(500).json({ error: error.message || 'Failed to fetch profile' });
  }
});

module.exports = router;
