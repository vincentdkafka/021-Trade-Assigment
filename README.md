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

## 📚 API Documentation

### Authentication
In production, include the API key in headers:
```
X-API-Key: your-api-key
```

### Endpoints

#### 1. Create Reward
```http
POST /reward
Content-Type: application/json

{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "stockSymbol": "RELIANCE",
  "quantity": 2.5,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "eventRef": "onboarding-bonus-2024-01-15-001"
}
```

**Response:**
```json
{
  "status": "success",
  "rewardId": "660e8400-e29b-41d4-a716-446655440001",
  "message": "Reward recorded successfully"
}
```

#### 2. Get Today's Stocks
```http
GET /today-stocks/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "date": "2024-01-15",
  "rewards": [
    {
      "symbol": "RELIANCE",
      "quantity": 2.5,
      "rewardedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "symbol": "TCS",
      "quantity": 1.0,
      "rewardedAt": "2024-01-15T14:20:00.000Z"
    }
  ]
}
```

#### 3. Get Historical INR Values
```http
GET /historical-inr/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "history": [
    {
      "date": "2024-01-14",
      "totalValueINR": 12500.75
    },
    {
      "date": "2024-01-13",
      "totalValueINR": 11800.50
    }
  ]
}
```

#### 4. Get User Statistics
```http
GET /stats/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "todayTotals": [
    {
      "symbol": "RELIANCE",
      "quantity": 2.5
    },
    {
      "symbol": "TCS",
      "quantity": 1.0
    }
  ],
  "portfolioValueINR": 12500.75
}
```

#### 5. Get Portfolio (Bonus)
```http
GET /portfolio/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "portfolio": [
    {
      "symbol": "RELIANCE",
      "totalShares": 5.5,
      "currentValueINR": 13750.00
    },
    {
      "symbol": "TCS",
      "totalShares": 2.0,
      "currentValueINR": 6400.00
    }
  ]
}
```

### Error Responses
All endpoints return consistent error responses:
```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Valid userId is required"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req_1705312200000_abc123def"
}
```

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

#### 1. Create a Reward
```bash
curl -X POST http://localhost:3000/reward \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID_FROM_SEED",
    "stockSymbol": "RELIANCE",
    "quantity": 1.5,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "eventRef": "test-reward-001"
  }'
```

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

## 📊 Database Schema Details

### Double-Entry Accounting
Every reward creates multiple ledger entries:
1. **USER_STOCK** (Debit): User receives stock
2. **BROKERAGE_FEE** (Credit): Company pays brokerage
3. **STT** (Credit): Securities Transaction Tax
4. **GST** (Credit): Goods and Services Tax
5. **SEBI_FEE** (Credit): SEBI charges
6. **STAMP_DUTY** (Credit): Stamp duty
7. **CASH_OUTFLOW** (Credit): Cash spent on stock purchase

### Fee Structure (Indian Market)
- Brokerage: 0.03% of trade value
- STT: 0.025% on delivery
- GST: 18% on brokerage + exchange charges
- SEBI Fee: Rs 9.8 per crore
- Stamp Duty: 0.015% on buy side

## 🚀 Production Deployment

### Prerequisites
- PostgreSQL 12+ with SSL
- Node.js 18+ with PM2 or similar
- Reverse proxy (nginx)
- SSL certificate

### Environment Setup
```bash
NODE_ENV=production
DATABASE_SSL=true
API_KEY=your-secure-api-key
JWT_SECRET=your-secure-jwt-secret
LOG_LEVEL=warn
```

### Security Considerations
- Change default JWT secret
- Use strong API keys
- Enable SSL for database
- Configure CORS origins
- Set up monitoring and alerting
- Regular security updates

## 📈 Monitoring & Logging

### Log Levels
- `error`: System errors and exceptions
- `warn`: Warning conditions
- `info`: General information
- `http`: HTTP request/response logs
- `debug`: Detailed debugging information

### Log Files
- `logs/error.log`: Error-level logs only
- `logs/combined.log`: All log levels
- Console output with colorized formatting

### Health Checks
- Database connectivity
- Stock price service status
- Memory usage
- Uptime tracking

## 🔄 Stock Price Service

### Mock Pricing Features
- Realistic base prices for Indian stocks
- 2% daily volatility simulation
- Price bounds (50%-200% of base price)
- Historical price generation
- Hourly price updates (configurable)

### Supported Stocks
Major Indian stocks including RELIANCE, TCS, INFY, HDFC, ICICIBANK, ITC, BHARTIARTL, KOTAKBANK, LT, AXISBANK, MARUTI, ASIANPAINT, WIPRO, TITAN, ULTRACEMCO, NESTLEIND, BAJFINANCE, POWERGRID, NTPC.

## 🛡️ Error Handling

### Error Types
- `ValidationError`: Input validation failures
- `NotFoundError`: Resource not found
- `ConflictError`: Duplicate resources
- `StockyError`: Custom application errors

### Database Errors
- Unique constraint violations
- Foreign key violations
- Not null violations
- Check constraint violations

## 📝 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run dev:watch` | Start with file watching |
| `npm run build` | Build TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm run migrate` | Run database migrations |
| `npm run seed` | Seed sample data |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For questions or issues:
1. Check the API documentation at `/api-docs`
2. Review the logs in `logs/` directory
3. Check database connectivity
4. Verify environment variables

---

**Built with ❤️ for the Stocky internship assignment**