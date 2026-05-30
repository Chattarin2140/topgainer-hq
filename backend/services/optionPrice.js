const axios = require('axios');

const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
const POLYGON_BASE_URL = 'https://api.polygon.io/v2';
const MAX_RETRIES = 3;
const BATCH_SIZE = 10;

const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

/**
 * Pick the best contract from option chain.
 * Priority: explicit option symbol match -> latest valid quote with tight spread.
 */
const selectBestContract = (contracts, optionSymbol) => {
  if (!Array.isArray(contracts) || contracts.length === 0) return null;

  if (optionSymbol) {
    const normalized = optionSymbol.trim().toUpperCase();
    const exact = contracts.find((c) => {
      const ticker = c?.details?.ticker || c?.ticker;
      return typeof ticker === 'string' && ticker.toUpperCase() === normalized;
    });
    if (exact) return exact;
  }

  const withValidQuotes = contracts.filter((c) => {
    const bid = c?.last_quote?.bid;
    const ask = c?.last_quote?.ask;
    return Number.isFinite(bid) && Number.isFinite(ask) && bid >= 0 && ask >= bid;
  });

  if (withValidQuotes.length === 0) return null;

  return withValidQuotes.sort((a, b) => {
    const aTs = a?.last_quote?.last_updated || a?.last_quote?.timeframe || 0;
    const bTs = b?.last_quote?.last_updated || b?.last_quote?.timeframe || 0;
    if (bTs !== aTs) return bTs - aTs;

    const aSpread = (a?.last_quote?.ask || 0) - (a?.last_quote?.bid || 0);
    const bSpread = (b?.last_quote?.ask || 0) - (b?.last_quote?.bid || 0);
    return aSpread - bSpread;
  })[0];
};

/**
 * Get option chain data from Polygon for a symbol.
 */
const getOptionChainData = async (symbol, optionSymbol, retries = 0) => {
  try {
    // Polygon option symbol format: C/LWLG170421C0700000
    // or we can search by underlying symbol
    
    // Try to get the latest option quote
    const url = `${POLYGON_BASE_URL}/snapshot/options/${symbol}`;
    
    console.log(`[Options] Fetching ${symbol} data...`);
    
    const response = await axios.get(url, {
      params: {
        apikey: POLYGON_API_KEY,
        limit: 100,
      },
      timeout: 10000,
    });

    if (response.data && response.data.status === 'OK' && response.data.results) {
      let contracts = response.data.results;

      if (optionSymbol) {
        const normalized = optionSymbol.trim().toUpperCase();
        contracts = contracts.filter((c) => {
          const ticker = c?.details?.ticker || c?.ticker;
          return typeof ticker === 'string' && ticker.toUpperCase() === normalized;
        });
      }

      console.log(`[Options] Got ${contracts.length} results for ${symbol}`);
      return contracts;
    }

    console.warn(`[Options] No data received for ${symbol}`);
    return [];
  } catch (error) {
    if (error.response?.status === 429 && retries < MAX_RETRIES) {
      // Rate limited - exponential backoff
      const delay = Math.pow(2, retries) * 1000;
      console.log(`[Options] Rate limited. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return getOptionChainData(symbol, optionSymbol, retries + 1);
    }

    console.error(`[Options] Error fetching ${symbol}:`, error.message);
    return [];
  }
};

/**
 * Get current option price from Polygon
 * underlyingSymbol: e.g., "LWLG"
 * optionSymbol: optional exact contract ticker to match
 */
const getOptionPrice = async (underlyingSymbol, optionSymbol) => {
  try {
    if (!POLYGON_API_KEY) {
      return null;
    }

    // Validate symbol
    if (!underlyingSymbol || typeof underlyingSymbol !== 'string') {
      throw new Error('Invalid symbol provided');
    }

    const symbol = underlyingSymbol.trim().toUpperCase();

    // Fetch option chain data
    const optionData = await getOptionChainData(symbol, optionSymbol);

    // If we got data, extract latest price info
    if (optionData && optionData.length > 0) {
      const contract = selectBestContract(optionData, optionSymbol);

      if (contract) {
        const bid = toFiniteNumber(contract?.last_quote?.bid);
        const ask = toFiniteNumber(contract?.last_quote?.ask);
        const lastTradePrice = toFiniteNumber(contract?.last_trade?.price);

        let price = null;
        if (bid !== null && ask !== null && ask >= bid) {
          price = (bid + ask) / 2;
        } else if (lastTradePrice !== null) {
          // Fallback to last traded price when quote is incomplete.
          price = lastTradePrice;
        }

        if (price !== null) {
          console.log(`[Options] ${symbol} selected price: $${price.toFixed(4)}`);

          return {
            symbol: symbol,
            price,
            bid,
            ask,
            optionSymbol: contract?.details?.ticker || contract?.ticker,
            timestamp:
              contract?.last_quote?.last_updated ||
              contract?.last_quote?.timeframe ||
              contract?.last_trade?.sip_timestamp,
            source: 'polygon',
          };
        }
      }
    }

    // Fallback: return null if no data
    console.warn(`[Options] Could not get price for ${symbol}`);
    return null;
  } catch (error) {
    console.error('[Options] Error in getOptionPrice:', error.message);
    throw error;
  }
};

/**
 * Get multiple option prices
 */
const getOptionPrices = async (symbols) => {
  try {
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return [];
    }

    const allResults = [];

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const chunk = symbols.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        chunk.map((symbol) => getOptionPrice(symbol))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          allResults.push(result.value);
          return;
        }
        console.warn(`[Options] Failed to fetch price for ${chunk[index]}`);
      });
    }

    return allResults;
  } catch (error) {
    console.error('[Options] Error in getOptionPrices:', error.message);
    throw error;
  }
};

module.exports = {
  getOptionPrice,
  getOptionPrices,
  getOptionChainData,
};
