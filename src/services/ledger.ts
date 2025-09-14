import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { PoolClient } from 'pg';
import database from '@/database/connection';
import { Reward, Stock, TransactionType, AccountType, LedgerService } from '@/types';
import logger from '@/utils/logger';


class LedgerServiceImpl implements LedgerService {
  

  private readonly FEE_STRUCTURE = {
    BROKERAGE_RATE: new Decimal('0.0003'), // 0.03% of trade value
    STT_RATE: new Decimal('0.00025'), // 0.025% on delivery
    GST_RATE: new Decimal('0.18'), // 18% on brokerage + exchange charges
    SEBI_FEE_RATE: new Decimal('0.0000098'), // Rs 9.8 per crore
    STAMP_DUTY_RATE: new Decimal('0.00015') // 0.015% on buy side
  };

  
  public async recordReward(reward: Reward, stock: Stock, currentPrice: Decimal): Promise<void> {
    await database.transaction(async (client: PoolClient) => {
      try {
        
        const transactionId = await this.createTransaction(
          client, 
          TransactionType.REWARD, 
          `Stock reward: ${reward.quantity} shares of ${stock.symbol} to user ${reward.userId}`
        );

        
        const stockValue = reward.quantity.mul(currentPrice);
        const fees = this.calculateFees(stockValue);

        logger.info('Recording stock reward', {
          rewardId: reward.id,
          stockSymbol: stock.symbol,
          quantity: reward.quantity.toString(),
          stockPrice: currentPrice.toString(),
          stockValue: stockValue.toString(),
          totalCost: fees.totalCost.toString()
        });

      
        await this.createLedgerEntries(client, transactionId, reward, stock, currentPrice, fees);

      
        const isBalanced = await this.validateDoubleEntry(client, transactionId);
        if (!isBalanced) {
          throw new Error(`Double-entry validation failed for transaction ${transactionId}`);
        }

        logger.info('Stock reward recorded successfully', {
          transactionId,
          rewardId: reward.id,
          validated: true
        });

      } catch (error) {
        logger.error('Failed to record stock reward', {
          rewardId: reward.id,
          error: error instanceof Error ? error.message : error
        });
        throw error;
      }
    });
  }


  private calculateFees(stockValue: Decimal) {
    const brokerage = stockValue.mul(this.FEE_STRUCTURE.BROKERAGE_RATE);
    const stt = stockValue.mul(this.FEE_STRUCTURE.STT_RATE);
    const sebiFee = stockValue.mul(this.FEE_STRUCTURE.SEBI_FEE_RATE);
    const stampDuty = stockValue.mul(this.FEE_STRUCTURE.STAMP_DUTY_RATE);
        // GST is applied on brokerage + exchange charges (simplified)
    const gst = brokerage.mul(this.FEE_STRUCTURE.GST_RATE);
    
    const totalFees = brokerage.add(stt).add(gst).add(sebiFee).add(stampDuty);
    const totalCost = stockValue.add(totalFees);

    return {
      stockValue,
      brokerage,
      stt,
      gst,
      sebiFee,
      stampDuty,
      totalFees,
      totalCost
    };
  }

 
  private async createTransaction(
    client: PoolClient, 
    type: TransactionType, 
    description: string
  ): Promise<string> {
    const transactionId = uuidv4();
    
    await client.query(
      `INSERT INTO transactions (id, type, description) VALUES ($1, $2, $3)`,
      [transactionId, type, description]
    );

    return transactionId;
  }


  private async createLedgerEntries(
    client: PoolClient,
    transactionId: string,
    reward: Reward,
    stock: Stock,
    currentPrice: Decimal,
    fees: any
  ): Promise<void> {
    
    // 1. User receives stock (DEBIT: increases asset)
    await this.createLedgerEntry(client, {
      transactionId,
      account: AccountType.USER_STOCK,
      amountStock: reward.quantity,
      amountInr: null,
      stockId: stock.id
    });

    // 2. Company pays brokerage fee (CREDIT: expense)
    await this.createLedgerEntry(client, {
      transactionId,
      account: AccountType.BROKERAGE_FEE,
      amountStock: null,
      amountInr: fees.brokerage.neg(), // Negative = credit
      stockId: null
    });

    // 3. Company pays STT (CREDIT: expense)
    await this.createLedgerEntry(client, {
      transactionId,
      account: AccountType.STT,
      amountStock: null,
      amountInr: fees.stt.neg(),
      stockId: null
    });

    // 4. Company pays GST (CREDIT: expense)
    await this.createLedgerEntry(client, {
      transactionId,
      account: AccountType.GST,
      amountStock: null,
      amountInr: fees.gst.neg(),
      stockId: null
    });

    // 5. Company pays SEBI fee (CREDIT: expense)
    await this.createLedgerEntry(client, {
      transactionId,
      account: AccountType.SEBI_FEE,
      amountStock: null,
      amountInr: fees.sebiFee.neg(),
      stockId: null
    });

    // 6. Company pays stamp duty (CREDIT: expense)
    await this.createLedgerEntry(client, {
      transactionId,
      account: AccountType.STAMP_DUTY,
      amountStock: null,
      amountInr: fees.stampDuty.neg(),
      stockId: null
    });

    // 7. Cash outflow for stock purchase (CREDIT: reduces cash)
    await this.createLedgerEntry(client, {
      transactionId,
      account: AccountType.CASH_OUTFLOW,
      amountStock: reward.quantity.neg(), // Stock equivalent going out
      amountInr: fees.stockValue.neg(), // Cash for stocks
      stockId: stock.id
    });
  }

  /**
   * Create individual ledger entry
   */
  private async createLedgerEntry(
    client: PoolClient,
    entry: {
      transactionId: string;
      account: AccountType;
      amountStock: Decimal | null;
      amountInr: Decimal | null;
      stockId: string | null;
    }
  ): Promise<void> {
    const entryId = uuidv4();
    
    await client.query(
      `INSERT INTO ledger_entries 
       (id, transaction_id, account, amount_stock, amount_inr, stock_id) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entryId,
        entry.transactionId,
        entry.account,
        entry.amountStock?.toString() || null,
        entry.amountInr?.toString() || null,
        entry.stockId
      ]
    );
  }

  public async validateDoubleEntry(transactionId: string): Promise<boolean> {
    const result = await database.query(
      'SELECT validate_double_entry($1) as is_balanced',
      [transactionId]
    );

    return result.rows[0]?.is_balanced === true;
  }


  private async validateDoubleEntry(client: PoolClient, transactionId: string): Promise<boolean> {
    const result = await client.query(
      'SELECT validate_double_entry($1) as is_balanced',
      [transactionId]
    );

    return result.rows[0]?.is_balanced === true;
  }

  
  public async getTransactionEntries(transactionId: string) {
    const result = await database.query(
      `SELECT 
         le.id,
         le.account,
         le.amount_stock,
         le.amount_inr,
         s.symbol as stock_symbol,
         le.created_at
       FROM ledger_entries le
       LEFT JOIN stocks s ON le.stock_id = s.id
       WHERE le.transaction_id = $1
       ORDER BY le.created_at`,
      [transactionId]
    );

    return result.rows;
  }

  
  public async getUserLedgerSummary(userId: string) {
    const result = await database.query(
      `SELECT 
         s.symbol,
         SUM(CASE WHEN le.account = 'USER_STOCK' THEN le.amount_stock ELSE 0 END) as total_stock_balance,
         COUNT(DISTINCT t.id) as total_transactions
       FROM transactions t
       JOIN ledger_entries le ON t.id = le.transaction_id
       JOIN rewards r ON t.description LIKE '%user ' || r.user_id || '%'
       LEFT JOIN stocks s ON le.stock_id = s.id
       WHERE r.user_id = $1
       GROUP BY s.id, s.symbol
       ORDER BY s.symbol`,
      [userId]
    );

    return result.rows;
  }
}

export default new LedgerServiceImpl();
