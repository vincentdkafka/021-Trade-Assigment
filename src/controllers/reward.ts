import { Request, Response, NextFunction } from 'express';
import rewardService from '@/services/reward';
import { 
  RewardRequest, 
  RewardResponse, 
  TodayStocksResponse, 
  HistoricalInrResponse, 
  StatsResponse, 
  PortfolioResponse,
  StockyError 
} from '@/types';
import logger from '@/utils/logger';


export class RewardController {


  public async createReward(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request: RewardRequest = req.body;
      
      
      rewardService.validateRewardRequest(request);
      
   
      const reward = await rewardService.createReward(request);
      
      const response: RewardResponse = {
        status: 'success',
        rewardId: reward.id,
        message: 'Reward recorded successfully'
      };

      logger.info('Reward API request processed successfully', {
        rewardId: reward.id,
        userId: request.userId,
        stockSymbol: request.stockSymbol,
        quantity: request.quantity,
        eventRef: request.eventRef
      });

      res.status(201).json(response);
    } catch (error) {
      logger.error('Error in createReward controller', {
        request: req.body,
        error: error instanceof Error ? error.message : error
      });
      next(error);
    }
  }

  
  public async getTodayStocks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      
      const rewards = await rewardService.getUserRewardsForToday(userId);
      
      const response: TodayStocksResponse = {
        userId,
        date: new Date().toISOString().split('T')[0], 
        rewards: rewards.map(reward => ({
          symbol: reward.symbol,
          quantity: parseFloat(reward.quantity),
          rewardedAt: reward.rewardedAt.toISOString()
        }))
      };

      logger.info('Today stocks API request processed successfully', {
        userId,
        rewardsCount: rewards.length
      });

      res.json(response);
    } catch (error) {
      logger.error('Error in getTodayStocks controller', {
        userId: req.params.userId,
        error: error instanceof Error ? error.message : error
      });
      next(error);
    }
  }


  public async getHistoricalInr(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      
      const history = await rewardService.getUserHistoricalValues(userId);
      
      const response: HistoricalInrResponse = {
        userId,
        history: history.map(item => ({
          date: item.date,
          totalValueINR: parseFloat(item.totalValueINR)
        }))
      };

      logger.info('Historical INR API request processed successfully', {
        userId,
        historyCount: history.length
      });

      res.json(response);
    } catch (error) {
      logger.error('Error in getHistoricalInr controller', {
        userId: req.params.userId,
        error: error instanceof Error ? error.message : error
      });
      next(error);
    }
  }


  public async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      
      const stats = await rewardService.getUserStats(userId);
      
      const response: StatsResponse = {
        todayTotals: stats.todayTotals,
        portfolioValueINR: stats.portfolioValueINR
      };

      logger.info('Stats API request processed successfully', {
        userId,
        todayTotalsCount: stats.todayTotals.length,
        portfolioValue: stats.portfolioValueINR
      });

      res.json(response);
    } catch (error) {
      logger.error('Error in getStats controller', {
        userId: req.params.userId,
        error: error instanceof Error ? error.message : error
      });
      next(error);
    }
  }

  public async getPortfolio(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      
      const portfolioData = await rewardService.getUserPortfolio(userId);
      
      const response: PortfolioResponse = {
        portfolio: portfolioData.portfolio
      };

      logger.info('Portfolio API request processed successfully', {
        userId,
        portfolioItemsCount: portfolioData.portfolio.length,
        totalValue: portfolioData.portfolio.reduce((sum, item) => sum + item.currentValueINR, 0)
      });

      res.json(response);
    } catch (error) {
      logger.error('Error in getPortfolio controller', {
        userId: req.params.userId,
        error: error instanceof Error ? error.message : error
      });
      next(error);
    }
  }
}

export default new RewardController();
