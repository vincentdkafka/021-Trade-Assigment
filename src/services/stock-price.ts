import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import cron from 'node-cron';
import database from '@/database/connection';
import { StockPriceService } from '@/types';
import logger from '@/utils/logger';
import config from '@/utils/config';


class StockPriceServiceImpl implements StockPriceService {
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;


  private readonly BASE_PRICES: Record<string, number> = {
    'RELIANCE': 2500.00,
    'TCS': 3200.00,
    'INFY': 1450.00,  // Infosys
    'HDFC': 1650.00,
    'HDFCBANK': 1580.00,
    'ICICIBANK': 950.00,
    'ITC': 420.00,
    'BHARTIARTL': 850.00, // Bharti Airtel
    'KOTAKBANK': 1750.00,
    'LT': 2800.00,    // Larsen & Toubro
    'AXISBANK': 1100.00,
    'MARUTI': 10500.00,
    'ASIANPAINT': 3200.00,
    'WIPRO': 400.00,
    'TITAN': 3100.00,
    'ULTRACEMCO': 8500.00,
    'NESTLEIND': 22000.00,
    'BAJFINANCE': 6800.00,
    'POWERGRID': 220.00,
    'NTPC': 180.00
  };


  public start(): void {
    if (this.isRunning) {
      logger.warn('Stock price service is already running');
      return;
    }

    logger.info('Starting stock price service', {
      intervalHours: config.stockPriceFetchIntervalHours
    });

    // Fetch prices immediately on startup
    this.fetchLatestPrices().catch(error => {
      logger.error('Failed to fetch initial stock prices:', error);
    });

    // Schedule periodic price updates
    const cronExpression = `0 */${config.stockPriceFetchIntervalHours} * * *`; // Every N hours
    this.cronJob = cron.schedule(cronExpression, () => {
      this.fetchLatestPrices().catch(error => {
        logger.error('Failed to fetch scheduled stock prices:', error);
      });
    });

    this.isRunning = true;
    logger.info('Stock price service started successfully');
  }

  public stop(): void {
    if (!this.isRunning) {
      logger.warn('Stock price service is not running');
      return;
    }

    if (this.cronJob) {
      this.cronJob.destroy();
      this.cronJob = null;
    }

    this.isRunning = false;
    logger.info('Stock price service stopped');
  }

  public async fetchLatestPrices(): Promise<void> {
    try {
      logger.info('Fetching latest stock prices');
      
     
      const stocksResult = await database.query(
        'SELECT id, symbol FROM stocks ORDER BY symbol'
      );

      if (stocksResult.rows.length === 0) {
        logger.warn('No stocks found in database');
        return;
      }

      const fetchedAt = new Date();
      const prices: Array<{ stockId: string, symbol: string, price: Decimal }> = [];

      for (const stock of stocksResult.rows) {
        const price = await this.generateMockPrice(stock.symbol, stock.id);
        prices.push({
          stockId: stock.id,
          symbol: stock.symbol,
          price
        });
      }


      await database.transaction(async (client) => {
        for (const { stockId, symbol, price } of prices) {
          await client.query(
            `INSERT INTO stock_prices (id, stock_id, price_inr, fetched_at)
             VALUES ($1, $2, $3, $4)`,
            [uuidv4(), stockId, price.toString(), fetchedAt]
          );
        }
      });

      logger.info('Stock prices fetched and stored successfully', {
        count: prices.length,
        fetchedAt: fetchedAt.toISOString(),
        prices: prices.map(p => ({ symbol: p.symbol, price: p.price.toString() }))
      });

    } catch (error) {
      logger.error('Failed to fetch latest stock prices:', error);
      throw error;
    }
  }


  public async getLatestPrice(stockId: string): Promise<Decimal> {
    try {
      const result = await database.query(
        `SELECT price_inr FROM stock_prices 
         WHERE stock_id = $1 
         ORDER BY fetched_at DESC 
         LIMIT 1`,
        [stockId]
      );

      if (result.rows.length === 0) {
        throw new Error(`No price found for stock ${stockId}`);
      }

      return new Decimal(result.rows[0].price_inr);
    } catch (error) {
      logger.error(`Failed to get latest price for stock ${stockId}:`, error);
      throw error;
    }
  }

 
  public async getPriceAtDate(stockId: string, date: Date): Promise<Decimal> {
    try {
      const result = await database.query(
        `SELECT price_inr FROM stock_prices 
         WHERE stock_id = $1 AND fetched_at <= $2
         ORDER BY fetched_at DESC 
         LIMIT 1`,
        [stockId, date]
      );

      if (result.rows.length === 0) {
      // If no historical price, return latest available price
        logger.warn(`No historical price found for stock ${stockId} at ${date.toISOString()}, using latest price`);
        return await this.getLatestPrice(stockId);
      }

      return new Decimal(result.rows[0].price_inr);
    } catch (error) {
      logger.error(`Failed to get price for stock ${stockId} at date ${date.toISOString()}:`, error);
      throw error;
    }
  }


  private async generateMockPrice(symbol: string, stockId: string): Promise<Decimal> {
    const basePrice = this.BASE_PRICES[symbol] || 1000; // Default fallback price
    
    
    const lastPriceResult = await database.query(
      `SELECT price_inr FROM stock_prices 
       WHERE stock_id = $1 
       ORDER BY fetched_at DESC 
       LIMIT 1`,
      [stockId]
    );

    let currentBase = basePrice;
    if (lastPriceResult.rows.length > 0) {
      currentBase = parseFloat(lastPriceResult.rows[0].price_inr);
    }

    // Generate realistic price movement
    // Indian stock market typically has volatility between 1-5% per day
    const volatility = 0.02; // 2% standard volatility
    const randomFactor = this.generateRandomWalk();
    const priceChange = currentBase * volatility * randomFactor;
    
    const newPrice = Math.max(currentBase + priceChange, basePrice * 0.5); // Prevent price going below 50% of base
    const finalPrice = Math.min(newPrice, basePrice * 2.0); // Prevent price going above 200% of base

    return new Decimal(finalPrice.toFixed(4));
  }

  /**
   * Generate random walk factor for price movement
   * Uses normal distribution for more realistic price movements
   */
  private generateRandomWalk(): number {
    // Box-Muller transformation to generate normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    
    // Clamp to reasonable range (-3 to 3 standard deviations)
    return Math.max(-3, Math.min(3, z0));
  }

  /**
   * Get price history for a stock
   */
  public async getPriceHistory(stockId: string, days: number = 30): Promise<Array<{date: Date, price: Decimal}>> {
    const result = await database.query(
      `SELECT fetched_at, price_inr 
       FROM stock_prices 
       WHERE stock_id = $1 AND fetched_at >= NOW() - INTERVAL '${days} days'
       ORDER BY fetched_at ASC`,
      [stockId]
    );

    return result.rows.map(row => ({
      date: row.fetched_at,
      price: new Decimal(row.price_inr)
    }));
  }

  /**
   * Get latest prices for all stocks
   */
  public async getAllLatestPrices(): Promise<Array<{stockId: string, symbol: string, price: Decimal, fetchedAt: Date}>> {
    const result = await database.query(`
      SELECT DISTINCT ON (s.id) 
        s.id as stock_id,
        s.symbol,
        sp.price_inr,
        sp.fetched_at
      FROM stocks s
      LEFT JOIN stock_prices sp ON s.id = sp.stock_id
      ORDER BY s.id, sp.fetched_at DESC
    `);

    return result.rows.map(row => ({
      stockId: row.stock_id,
      symbol: row.symbol,
      price: row.price_inr ? new Decimal(row.price_inr) : new Decimal(0),
      fetchedAt: row.fetched_at || new Date()
    }));
  }

  /**
   * Health check for the service
   */
  public getStatus() {
    return {
      isRunning: this.isRunning,
      intervalHours: config.stockPriceFetchIntervalHours,
      nextScheduledRun: this.cronJob ? 'Active' : 'Inactive'
    };
  }
}

export default new StockPriceServiceImpl();
