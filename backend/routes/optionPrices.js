const express = require('express');
const router = express.Router();
const optionPriceService = require('../services/optionPrice');

// GET single option price
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
      return res.status(400).json({ error: 'Valid symbol required' });
    }
    
    const price = await optionPriceService.getOptionPrice(symbol.trim().toUpperCase());
    
    if (!price || price.price === undefined) {
      return res.status(404).json({ error: 'Option price data not found' });
    }
    
    res.json(price);
  } catch (error) {
    console.error(`Error in GET /option-prices/:symbol:`, error);
    res.status(500).json({ error: error.message || 'Failed to fetch option price' });
  }
});

// GET multiple option prices (for symbols like LWLG where you want the underlying option)
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

    const prices = await optionPriceService.getOptionPrices(validSymbols);
    res.json(Array.isArray(prices) ? prices : []);
  } catch (error) {
    console.error(`Error in POST /option-prices/batch:`, error);
    res.status(500).json({ error: error.message || 'Failed to fetch option prices' });
  }
});

module.exports = router;
