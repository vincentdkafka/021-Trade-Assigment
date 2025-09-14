import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import database from '@/database/connection';
import stockPriceService from './stock-price';
import ledgerService from './ledger';
import { 
  RewardService, 
  RewardRequest, 
  Reward, 
  Stock, 
  UserRewardsResult, 
  DailyPortfolioValue, 
  StatsResponse, 
  PortfolioResponse,
  NotFoundError,
  ConflictError,
  ValidationError
} from '@/types';
import logger from '@/utils/logger';

class RewardServiceImpl implements RewardService {

 
  public async createReward(request: RewardRequest): Promise<Reward> {
    try {
      return await database.transaction(async (client) => {
        // Validate and get stock
        const stock = await this.getStockBySymbol(request.stockSymbol);
        if (!stock) {
          throw new NotFoundError(`Stock with symbol ${request.stockSymbol} not found`);
        }

        
        const user = await this.getUserById(request.userId);
        if (!user) {
          throw new NotFoundError(`User with ID ${request.userId} not found`);
        }

        
        const existingReward = await client.query(
          'SELECT id FROM rewards WHERE event_ref = $1',
          [request.eventRef]
        );

        if (existingReward.rows.length > 0) {
          throw new ConflictError(`Reward with event reference ${request.eventRef} already exists`);
        }

       
        const rewardId = uuidv4();
        const quantity = new Decimal(request.quantity);
        const rewardedAt = new Date(request.timestamp);

        const reward: Reward = {
          id: rewardId,
          userId: request.userId,
          stockId: stock.id,
          quantity,
          rewardedAt,
          eventRef: request.eventRef,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        
        await client.query(
          `INSERT INTO rewards (id, user_id, stock_id, quantity, rewarded_at, event_ref) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            reward.id,
            reward.userId,
            reward.stockId,
            reward.quantity.toString(),
            reward.rewardedAt,
            reward.eventRef
          ]
        );

        logger.info('Reward created successfully', {
          rewardId: reward.id,
          userId: request.userId,
          stockSymbol: stock.symbol,
          quantity: quantity.toString(),
          eventRef: request.eventRef
        });

      // Record ledger entries (outside of the current transaction since ledger has its own)
        
        setImmediate(async () => {
          try {
            const currentPrice = await stockPriceService.getLatestPrice(stock.id);
            await ledgerService.recordReward(reward, stock, currentPrice);
            logger.info('Ledger entries recorded for reward', { rewardId: reward.id });
          } catch (error) {
            logger.error('Failed to record ledger entries for reward', {
              rewardId: reward.id,
              error: error instanceof Error ? error.message : error
            });
            
          }
        });

        return reward;
      });
    } catch (error) {
      logger.error('Failed to create reward', {
        request,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

 
  public async getUserRewardsForToday(userId: string): Promise<UserRewardsResult[]> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const result = await database.query(
        `SELECT 
           s.symbol,
           r.quantity,
           r.rewarded_at
         FROM rewards r
         JOIN stocks s ON r.stock_id = s.id
         WHERE r.user_id = $1 
           AND r.rewarded_at >= $2 
           AND r.rewarded_at < $3
         ORDER BY r.rewarded_at ASC`,
        [userId, startOfDay, endOfDay]
      );

      return result.rows.map(row => ({
        symbol: row.symbol,
        quantity: row.quantity,
        rewardedAt: row.rewarded_at
      }));
    } catch (error) {
      logger.error('Failed to get user rewards for today', {
        userId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

 
  public async getUserHistoricalValues(userId: string): Promise<DailyPortfolioValue[]> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); 

      
      const datesResult = await database.query(
        `SELECT DISTINCT DATE(rewarded_at) as reward_date
         FROM rewards 
         WHERE user_id = $1 AND DATE(rewarded_at) < DATE($2)
         ORDER BY reward_date DESC
         LIMIT 100`, 
        [userId, today]
      );

      const historicalValues: DailyPortfolioValue[] = [];

      for (const dateRow of datesResult.rows) {
        const date = new Date(dateRow.reward_date);
        const endOfDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);

        
        const rewardsResult = await database.query(
          `SELECT 
             r.stock_id,
             SUM(r.quantity) as total_quantity
           FROM rewards r
           WHERE r.user_id = $1 AND r.rewarded_at < $2
           GROUP BY r.stock_id
           HAVING SUM(r.quantity) > 0`,
          [userId, endOfDay]
        );

        let totalValue = new Decimal(0);

        for (const reward of rewardsResult.rows) {
          const stockPrice = await stockPriceService.getPriceAtDate(reward.stock_id, endOfDay);
          const quantity = new Decimal(reward.total_quantity);
          const value = quantity.mul(stockPrice);
          totalValue = totalValue.add(value);
        }

        historicalValues.push({
          date: date.toISOString().split('T')[0],
          totalValueINR: totalValue.toString()
        });
      }

      return historicalValues;
    } catch (error) {
      logger.error('Failed to get user historical values', {
        userId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * 
   */
  public async getUserStats(userId: string): Promise<StatsResponse> {
    try {
      const [todayTotals, portfolioValue] = await Promise.all([
        this.getUserTodayTotals(userId),
        this.getUserCurrentPortfolioValue(userId)
      ]);

      return {
        todayTotals,
        portfolioValueINR: parseFloat(portfolioValue.toString())
      };
    } catch (error) {
      logger.error('Failed to get user stats', {
        userId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * 
   */
  public async getUserPortfolio(userId: string): Promise<PortfolioResponse> {
    try {
      const result = await database.query(
        `SELECT 
           s.symbol,
           SUM(r.quantity) as total_shares
         FROM rewards r
         JOIN stocks s ON r.stock_id = s.id
         WHERE r.user_id = $1 AND s.is_active = TRUE
         GROUP BY s.id, s.symbol
         HAVING SUM(r.quantity) > 0
         ORDER BY s.symbol`,
        [userId]
      );

      const portfolio = [];

      for (const holding of result.rows) {
        const stockResult = await database.query(
          'SELECT id FROM stocks WHERE symbol = $1',
          [holding.symbol]
        );

        if (stockResult.rows.length > 0) {
          const stockId = stockResult.rows[0].id;
          const currentPrice = await stockPriceService.getLatestPrice(stockId);
          const totalShares = new Decimal(holding.total_shares);
          const currentValue = totalShares.mul(currentPrice);

          portfolio.push({
            symbol: holding.symbol,
            totalShares: parseFloat(totalShares.toString()),
            currentValueINR: parseFloat(currentValue.toString())
          });
        }
      }

      return { portfolio };
    } catch (error) {
      logger.error('Failed to get user portfolio', {
        userId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * 
   */
  private async getUserTodayTotals(userId: string) {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const result = await database.query(
      `SELECT 
         s.symbol,
         SUM(r.quantity) as total_quantity
       FROM rewards r
       JOIN stocks s ON r.stock_id = s.id
       WHERE r.user_id = $1 
         AND r.rewarded_at >= $2 
         AND r.rewarded_at < $3
       GROUP BY s.symbol
       ORDER BY s.symbol`,
      [userId, startOfDay, endOfDay]
    );

    return result.rows.map(row => ({
      symbol: row.symbol,
      quantity: parseFloat(row.total_quantity)
    }));
  }


  private async getUserCurrentPortfolioValue(userId: string): Promise<Decimal> {
    const result = await database.query(
      `SELECT 
         r.stock_id,
         SUM(r.quantity) as total_quantity
       FROM rewards r
       WHERE r.user_id = $1
       GROUP BY r.stock_id
       HAVING SUM(r.quantity) > 0`,
      [userId]
    );

    let totalValue = new Decimal(0);

    for (const holding of result.rows) {
      const currentPrice = await stockPriceService.getLatestPrice(holding.stock_id);
      const quantity = new Decimal(holding.total_quantity);
      const value = quantity.mul(currentPrice);
      totalValue = totalValue.add(value);
    }

    return totalValue;
  }


   * Get stock by symbol
   */
  private async getStockBySymbol(symbol: string): Promise<Stock | null> {
    const result = await database.query(
      'SELECT * FROM stocks WHERE symbol = $1 AND is_active = TRUE',
      [symbol.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      isActive: row.is_active,
      delistedAt: row.delisted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

 
  private async getUserById(userId: string): Promise<any | null> {
    const result = await database.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

 
  public validateRewardRequest(request: RewardRequest): void {
    if (!request.userId || typeof request.userId !== 'string') {
      throw new ValidationError('Valid userId is required');
    }

    if (!request.stockSymbol || typeof request.stockSymbol !== 'string') {
      throw new ValidationError('Valid stockSymbol is required');
    }

    if (!request.quantity || request.quantity <= 0) {
      throw new ValidationError('Quantity must be a positive number');
    }

    if (!request.timestamp) {
      throw new ValidationError('Valid timestamp is required');
    }

    if (!request.eventRef || typeof request.eventRef !== 'string') {
      throw new ValidationError('Valid eventRef is required');
    }

  
    const requestTime = new Date(request.timestamp);
    const now = new Date();
    if (requestTime > now) {
      throw new ValidationError('Timestamp cannot be in the future');
    }

    
    const quantityStr = request.quantity.toString();
    const decimalIndex = quantityStr.indexOf('.');
    if (decimalIndex !== -1 && quantityStr.length - decimalIndex - 1 > 6) {
      throw new ValidationError('Quantity can have at most 6 decimal places');
    }
  }
}

export default new RewardServiceImpl();
