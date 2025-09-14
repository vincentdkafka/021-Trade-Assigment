import fs from 'fs';
import path from 'path';
import database from '@/database/connection';
import config from '@/utils/config';
import logger from '@/utils/logger';

/**
 * Database migration script
 * Applies the database schema from schema.sql
 */
async function runMigrations(): Promise<void> {
  try {
    logger.info('Starting database migrations...');

    // Initialize database connection
    await database.initialize(config.database);

    // Read the schema file
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    logger.info('Applying database schema...');
    
    // Execute the schema SQL
    // Note: We need to split on semicolons and execute each statement separately
    // because pg doesn't support multiple statements in a single query
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await database.query(statement);
          logger.debug('Executed SQL statement:', { statement: statement.substring(0, 100) + '...' });
        } catch (error) {
          // Some statements might fail if they already exist (like CREATE TYPE)
          // We'll log warnings for these but continue
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('already exists')) {
            logger.warn('SQL statement skipped (already exists):', { 
              statement: statement.substring(0, 100) + '...',
              error: errorMessage
            });
          } else {
            throw error;
          }
        }
      }
    }

    logger.info('Database migrations completed successfully');

    // Verify key tables exist
    const tables = ['users', 'stocks', 'rewards', 'transactions', 'ledger_entries', 'stock_prices', 'stock_corporate_actions'];
    
    for (const table of tables) {
      const result = await database.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [table]
      );
      
      if (result.rows[0].exists) {
        logger.info(`✓ Table ${table} exists`);
      } else {
        throw new Error(`Table ${table} was not created`);
      }
    }

    // Verify functions exist
    const functions = ['validate_double_entry', 'get_user_stock_holdings', 'get_latest_stock_price', 'apply_stock_split', 'delist_stock'];
    
    for (const func of functions) {
      const result = await database.query(
        `SELECT EXISTS (
          SELECT FROM pg_proc 
          WHERE proname = $1
        )`,
        [func]
      );
      
      if (result.rows[0].exists) {
        logger.info(`✓ Function ${func} exists`);
      } else {
        logger.warn(`Function ${func} was not created`);
      }
    }

    logger.info('Database migration verification completed');

  } catch (error) {
    logger.error('Database migration failed:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  } finally {
    await database.close();
  }
}

/**
 * Run migrations if this script is executed directly
 */
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { runMigrations };
