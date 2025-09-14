import { v4 as uuidv4 } from 'uuid';
import { Decimal } from 'decimal.js';
import database from '@/database/connection';
import config from '@/utils/config';
import logger from '@/utils/logger';
import stockPriceService from '@/services/stock-price';

/**
 * Database seeding script
 * Populates the database with sample data for testing
 */
async function seedDatabase(): Promise<void> {
  try {
    logger.info('Starting database seeding...');

    // Initialize database connection
    await database.initialize(config.database);

    // Check if data already exists
    const usersCount = await database.query('SELECT COUNT(*) as count FROM users');
    const stocksCount = await database.query('SELECT COUNT(*) as count FROM stocks');
    
    if (parseInt(usersCount.rows[0].count) > 0 || parseInt(stocksCount.rows[0].count) > 0) {
      logger.info('Database already contains data. Skipping seeding.');
      return;
    }

    // Seed data in transaction
    await database.transaction(async (client) => {
      logger.info('Seeding users...');
      
      // Sample users
      const users = [
        {
          id: uuidv4(),
          name: 'John Doe',
          email: 'john.doe@example.com'
        },
        {
          id: uuidv4(),
          name: 'Jane Smith',
          email: 'jane.smith@example.com'
        },
        {
          id: uuidv4(),
          name: 'Rajesh Kumar',
          email: 'rajesh.kumar@example.com'
        },
        {
          id: uuidv4(),
          name: 'Priya Sharma',
          email: 'priya.sharma@example.com'
        },
        {
          id: uuidv4(),
          name: 'David Wilson',
          email: 'david.wilson@example.com'
        }
      ];

      for (const user of users) {
        await client.query(
          'INSERT INTO users (id, name, email) VALUES ($1, $2, $3)',
          [user.id, user.name, user.email]
        );
      }

      logger.info(`✓ Seeded ${users.length} users`);

      // Sample Indian stocks
      const stocks = [
        { symbol: 'RELIANCE', name: 'Reliance Industries Limited' },
        { symbol: 'TCS', name: 'Tata Consultancy Services Limited' },
        { symbol: 'INFY', name: 'Infosys Limited' },
        { symbol: 'HDFC', name: 'Housing Development Finance Corporation Limited' },
        { symbol: 'HDFCBANK', name: 'HDFC Bank Limited' },
        { symbol: 'ICICIBANK', name: 'ICICI Bank Limited' },
        { symbol: 'ITC', name: 'ITC Limited' },
        { symbol: 'BHARTIARTL', name: 'Bharti Airtel Limited' },
        { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Limited' },
        { symbol: 'LT', name: 'Larsen & Toubro Limited' },
        { symbol: 'AXISBANK', name: 'Axis Bank Limited' },
        { symbol: 'MARUTI', name: 'Maruti Suzuki India Limited' },
        { symbol: 'ASIANPAINT', name: 'Asian Paints Limited' },
        { symbol: 'WIPRO', name: 'Wipro Limited' },
        { symbol: 'TITAN', name: 'Titan Company Limited' },
        { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Limited' },
        { symbol: 'NESTLEIND', name: 'Nestlé India Limited' },
        { symbol: 'BAJFINANCE', name: 'Bajaj Finance Limited' },
        { symbol: 'POWERGRID', name: 'Power Grid Corporation of India Limited' },
        { symbol: 'NTPC', name: 'NTPC Limited' }
      ];

      const stockIds: string[] = [];

      for (const stock of stocks) {
        const stockId = uuidv4();
        stockIds.push(stockId);
        
        await client.query(
          'INSERT INTO stocks (id, symbol, name, is_active) VALUES ($1, $2, $3, $4)',
          [stockId, stock.symbol, stock.name, true]
        );
      }

      logger.info(`✓ Seeded ${stocks.length} stocks`);

      // Sample rewards (last 7 days)
      const rewards = [];
      const today = new Date();
      
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const rewardDate = new Date(today);
        rewardDate.setDate(today.getDate() - dayOffset);
        rewardDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));

        // Create 3-8 rewards per day
        const rewardsPerDay = Math.floor(Math.random() * 6) + 3;
        
        for (let i = 0; i < rewardsPerDay; i++) {
          const userId = users[Math.floor(Math.random() * users.length)].id;
          const stockId = stockIds[Math.floor(Math.random() * stockIds.length)];
          const quantity = new Decimal((Math.random() * 10 + 0.1).toFixed(6)); // 0.1 to 10.1 shares
          
          const reward = {
            id: uuidv4(),
            userId,
            stockId,
            quantity: quantity.toString(),
            rewardedAt: new Date(rewardDate.getTime() + (i * 1000 * 60 * 15)), // Spread throughout day
            eventRef: `seed-reward-${dayOffset}-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          };

          rewards.push(reward);
        }
      }

      logger.info(`Seeding ${rewards.length} sample rewards...`);

      for (const reward of rewards) {
        await client.query(
          'INSERT INTO rewards (id, user_id, stock_id, quantity, rewarded_at, event_ref) VALUES ($1, $2, $3, $4, $5, $6)',
          [reward.id, reward.userId, reward.stockId, reward.quantity, reward.rewardedAt, reward.eventRef]
        );
      }

      logger.info(`✓ Seeded ${rewards.length} rewards`);
    });

    logger.info('Generating initial stock prices...');
    
    // Generate initial stock prices
    await stockPriceService.fetchLatestPrices();
    
    // Generate some historical prices for the last 30 days
    const stocksResult = await database.query('SELECT id, symbol FROM stocks');
    const now = new Date();
    
    for (let day = 1; day <= 30; day++) {
      const priceDate = new Date(now);
      priceDate.setDate(now.getDate() - day);
      priceDate.setHours(15, 30, 0, 0); // Market close time

      for (const stock of stocksResult.rows) {
        // Generate realistic historical price
        const basePrice = stockPriceService['BASE_PRICES'][stock.symbol] || 1000;
        const volatility = 0.02; // 2% daily volatility
        const randomChange = (Math.random() - 0.5) * 2 * volatility;
        const price = new Decimal(basePrice * (1 + randomChange * day * 0.1)).toDecimalPlaces(4);

        await database.query(
          'INSERT INTO stock_prices (id, stock_id, price_inr, fetched_at) VALUES ($1, $2, $3, $4)',
          [uuidv4(), stock.id, price.toString(), priceDate]
        );
      }
    }

    logger.info('✓ Generated historical stock prices for 30 days');

    // Display summary
    const finalCounts = await Promise.all([
      database.query('SELECT COUNT(*) as count FROM users'),
      database.query('SELECT COUNT(*) as count FROM stocks'),
      database.query('SELECT COUNT(*) as count FROM rewards'),
      database.query('SELECT COUNT(*) as count FROM stock_prices')
    ]);

    logger.info('Database seeding completed successfully!', {
      users: finalCounts[0].rows[0].count,
      stocks: finalCounts[1].rows[0].count,
      rewards: finalCounts[2].rows[0].count,
      stockPrices: finalCounts[3].rows[0].count
    });

    // Display sample user IDs for testing
    const sampleUsers = await database.query('SELECT id, name FROM users LIMIT 3');
    logger.info('Sample user IDs for testing:');
    sampleUsers.rows.forEach(user => {
      logger.info(`- ${user.name}: ${user.id}`);
    });

  } catch (error) {
    logger.error('Database seeding failed:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  } finally {
    await database.close();
  }
}

/**
 * Run seeding if this script is executed directly
 */
if (require.main === module) {
  seedDatabase()
    .then(() => {
      logger.info('Seeding script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seeding script failed:', error);
      process.exit(1);
    });
}

export { seedDatabase };
