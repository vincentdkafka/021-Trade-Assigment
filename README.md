# Stocky API - Stock Rewards Platform

A production-ready REST API for Stocky, a hypothetical company where users can earn shares of Indian stocks as incentives for actions like onboarding, referrals, or trading milestones.

## 🚀 Features

### Core Functionality
- **Stock Rewards**: Users receive full stock units (no deductions) for various actions
- **Double-Entry Ledger**: Complete accounting system tracking stock units, INR cash outflow, and company-incurred fees
- **Real-time Pricing**: Hourly stock price updates with mock pricing service
- **Portfolio Management**: Track user holdings and historical valuations

### API Endpoints
- `POST /reward` - Record stock rewards with idempotency
- `GET /today-stocks/{userId}` - Get today's rewards for a user
- `GET /historical-inr/{userId}` - Get historical portfolio values
- `GET /stats/{userId}` - Get user statistics and current portfolio value
- `GET /portfolio/{userId}` - Get detailed portfolio breakdown (bonus)

### Edge Cases Handled
- ✅ Duplicate reward events / replay attacks (idempotency via eventRef)
- ✅ Stock splits, mergers, or delisting (extensible schema)
- ✅ Rounding errors in INR valuation (Decimal.js precision)
- ✅ Price API downtime or stale data (fallback mechanisms)
- ✅ Adjustments/refunds of previously given rewards (transaction types)

## 🏗️ Architecture

### Database Schema
- **Users**: User management with validation
- **Stocks**: Indian stock symbols and metadata
- **Rewards**: Stock reward events with timestamps
- **Transactions**: Double-entry accounting transactions
- **Ledger Entries**: Detailed accounting entries
- **Stock Prices**: Historical price data

### Services
- **Reward Service**: Core reward management logic
- **Ledger Service**: Double-entry accounting implementation
- **Stock Price Service**: Mock pricing with realistic volatility
- **Database Service**: Connection pooling and transaction management

### Security Features
- Rate limiting (general + reward creation specific)
- Request sanitization and validation
- CORS configuration
- Security headers (Helmet)
- API key authentication (production)

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- PostgreSQL 12 or higher
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend-warp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your database credentials
   ```

4. **Set up PostgreSQL database**
   ```sql
   CREATE DATABASE stocky_db;
   CREATE USER stocky_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE stocky_db TO stocky_user;
   ```

5. **Run database migrations**
   ```bash
   npm run migrate
   ```

6. **Seed sample data**
   ```bash
   npm run seed
   ```

7. **Start the development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

## 🧪 Testing

### Manual Testing
1. **Start the server**: `npm run dev`
2. **Check health**: `GET http://localhost:3000/health`
3. **View API docs**: `GET http://localhost:3000/api-docs` (development only)

### Sample Test Data
After running `npm run seed`, you'll have:
- 5 sample users with realistic Indian names
- 20 major Indian stocks (RELIANCE, TCS, INFY, etc.)
- 7 days of sample rewards
- 30 days of historical price data

### Test Scenarios

#### 2. Test Idempotency
Run the same request twice - second should return conflict error.

#### 3. Test Rate Limiting
Make 11 requests in 1 minute to `/reward` - 11th should be rate limited.

## 🔧 Configuration

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `DATABASE_HOST` | PostgreSQL host | `localhost` |
| `DATABASE_PORT` | PostgreSQL port | `5432` |
| `DATABASE_NAME` | Database name | `stocky_db` |
| `DATABASE_USER` | Database user | `stocky_user` |
| `DATABASE_PASSWORD` | Database password | Required |
| `STOCK_PRICE_FETCH_INTERVAL_HOURS` | Price update frequency | `1` |
| `API_RATE_LIMIT_MAX_REQUESTS` | Rate limit per window | `1000` |

### Database Configuration
The system uses PostgreSQL with:
- Connection pooling (max 20 connections)
- Transaction support
- Prepared statements
- Automatic reconnection


### Security Considerations
- Change default JWT secret
- Use strong API keys
- Enable SSL for database
- Configure CORS origins
- Set up monitoring and alerting
- Regular security updates

## 📈 Monitoring & Logging

### Database Errors
- Unique constraint violations
- Foreign key violations
- Not null violations
- Check constraint violations



## 📄 License

MIT License - see LICENSE file for details

---

**Built with ❤️ for the Stocky internship assignment**
