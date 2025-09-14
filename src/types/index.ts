import { Decimal } from 'decimal.js';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Stock {
  id: string;
  symbol: string;
  name: string;
  isActive: boolean;
  delistedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockCorporateAction {
  id: string;
  stockId: string;
  actionType: CorporateActionType;
  actionDate: Date;
  ratio: Decimal | null;
  newStockId: string | null;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reward {
  id: string;
  userId: string;
  stockId: string;
  quantity: Decimal;
  rewardedAt: Date;
  eventRef: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LedgerEntry {
  id: string;
  transactionId: string;
  account: AccountType;
  amountStock: Decimal | null;
  amountInr: Decimal | null;
  stockId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockPrice {
  id: string;
  stockId: string;
  priceInr: Decimal;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Enums
export enum TransactionType {
  REWARD = 'REWARD',
  ADJUSTMENT = 'ADJUSTMENT',
  REFUND = 'REFUND'
}

export enum AccountType {
  USER_STOCK = 'USER_STOCK',
  BROKERAGE_FEE = 'BROKERAGE_FEE',
  STT = 'STT', // Securities Transaction Tax
  GST = 'GST',
  CASH_OUTFLOW = 'CASH_OUTFLOW',
  SEBI_FEE = 'SEBI_FEE',
  STAMP_DUTY = 'STAMP_DUTY'
}

export enum CorporateActionType {
  SPLIT = 'SPLIT',
  MERGER = 'MERGER',
  DELISTING = 'DELISTING',
  BONUS = 'BONUS',
  RIGHTS = 'RIGHTS'
}

// API Request/Response Types
export interface RewardRequest {
  userId: string;
  stockSymbol: string;
  quantity: number;
  timestamp: string;
  eventRef: string;
}

export interface RewardResponse {
  status: 'success' | 'error';
  rewardId?: string;
  message: string;
}

export interface TodayStocksResponse {
  userId: string;
  date: string;
  rewards: Array<{
    symbol: string;
    quantity: number;
    rewardedAt: string;
  }>;
}

export interface HistoricalInrResponse {
  userId: string;
  history: Array<{
    date: string;
    totalValueINR: number;
  }>;
}

export interface StatsResponse {
  todayTotals: Array<{
    symbol: string;
    quantity: number;
  }>;
  portfolioValueINR: number;
}

export interface PortfolioResponse {
  portfolio: Array<{
    symbol: string;
    totalShares: number;
    currentValueINR: number;
  }>;
}

// Database Query Result Types
export interface UserRewardsResult {
  symbol: string;
  quantity: string;
  rewardedAt: Date;
}

export interface UserStockHolding {
  symbol: string;
  totalShares: string;
  currentPrice: string;
}

export interface DailyPortfolioValue {
  date: string;
  totalValueINR: string;
}

// Error Types
export class StockyError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'StockyError';
  }
}

export class ValidationError extends StockyError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends StockyError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends StockyError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

// Configuration Types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: DatabaseConfig;
  jwtSecret: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  stockPriceFetchIntervalHours: number;
  logLevel: string;
  logFilePath: string;
}

// Service Interfaces
export interface StockPriceService {
  fetchLatestPrices(): Promise<void>;
  getLatestPrice(stockId: string): Promise<Decimal>;
  getPriceAtDate(stockId: string, date: Date): Promise<Decimal>;
}

export interface LedgerService {
  recordReward(reward: Reward, stock: Stock, currentPrice: Decimal): Promise<void>;
  validateDoubleEntry(transactionId: string): Promise<boolean>;
}

export interface RewardService {
  createReward(request: RewardRequest): Promise<Reward>;
  getUserRewardsForToday(userId: string): Promise<UserRewardsResult[]>;
  getUserHistoricalValues(userId: string): Promise<DailyPortfolioValue[]>;
  getUserStats(userId: string): Promise<StatsResponse>;
  getUserPortfolio(userId: string): Promise<PortfolioResponse>;
}
