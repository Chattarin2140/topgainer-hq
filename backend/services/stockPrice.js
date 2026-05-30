const axios = require('axios');

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || 'c1234567890';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const MAX_RETRIES = 3;

/**
 * ดึงราคาหุ้นปัจจุบันจาก Finnhub (with retry logic)
 */
const getStockPrice = async (symbol, retryCount = 0) => {
  try {
    const response = await axios.get(`${FINNHUB_BASE_URL}/quote`, {
      params: {
        symbol: symbol.toUpperCase(),
        token: FINNHUB_API_KEY,
      },
    });

    return {
      symbol: symbol.toUpperCase(),
      price: response.data.c, // current price
      high: response.data.h, // day high
      low: response.data.l, // day low
      open: response.data.o, // open price
      previousClose: response.data.pc, // previous close
      timestamp: new Date(),
    };
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.warn(`Retry ${retryCount + 1}/${MAX_RETRIES} for ${symbol}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return getStockPrice(symbol, retryCount + 1);
    }
    console.error(`Error fetching price for ${symbol}:`, error.message);
    throw new Error(`Could not fetch price for ${symbol}: ${error.message}`);
  }
};

/**
 * ดึงราคาหลายหุ้นพร้อมกัน
 */
const getMultiplePrices = async (symbols) => {
  try {
    const prices = await Promise.all(
      symbols.map((symbol) => getStockPrice(symbol))
    );
    return prices;
  } catch (error) {
    console.error('Error fetching multiple prices:', error.message);
    throw new Error(`Multiple prices fetch failed: ${error.message}`);
  }
};

/**
 * ดึงข้อมูล Profile ของบริษัท
 */
const getCompanyProfile = async (symbol) => {
  try {
    const response = await axios.get(`${FINNHUB_BASE_URL}/stock/profile2`, {
      params: {
        symbol: symbol.toUpperCase(),
        token: FINNHUB_API_KEY,
      },
    });

    return {
      symbol: response.data.ticker,
      name: response.data.name,
      country: response.data.country,
      currency: response.data.currency,
      marketCap: response.data.marketCapitalization,
      description: response.data.description,
    };
  } catch (error) {
    console.error(`Error fetching profile for ${symbol}:`, error.message);
    throw new Error(`Profile fetch failed for ${symbol}: ${error.message}`);
  }
};

module.exports = {
  getStockPrice,
  getMultiplePrices,
  getCompanyProfile,
};
