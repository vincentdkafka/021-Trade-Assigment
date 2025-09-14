# Stocky API Documentation

## Overview

The Stocky API is a production-ready REST API for managing stock rewards. Users can earn shares of Indian stocks as incentives for various actions like onboarding, referrals, or trading milestones.

## Base URL
- Development: `http://localhost:3000`
- Production: `https://api.stocky.com` (example)

## Authentication

### API Key Authentication
Include your API key in the request headers:

```http
X-API-Key: your-api-key-here
```

**Note**: In development mode, authentication is optional. In production, it's required.

## Rate Limiting

- **General API**: 1000 requests per 15 minutes per IP
- **Reward Creation**: 10 requests per minute per IP+userId combination

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req_1705312200000_abc123def"
}
```

### Common Error Codes
- `VALIDATION_ERROR`: Input validation failed
- `NOT_FOUND`: Resource not found
- `CONFLICT`: Duplicate resource or constraint violation
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `UNAUTHORIZED`: Invalid or missing API key
- `DATABASE_ERROR`: Database operation failed

---

## Endpoints

### 1. Create Reward

Record that a user has been rewarded X shares of a stock.

```http
POST /reward
```

#### Request Body
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "stockSymbol": "RELIANCE",
  "quantity": 2.5,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "eventRef": "onboarding-bonus-2024-01-15-001"
}
```

#### Field Descriptions
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | UUID | Yes | Unique identifier for the user |
| `stockSymbol` | String | Yes | Stock symbol (uppercase, alphanumeric, 1-20 chars) |
| `quantity` | Number | Yes | Number of shares (positive, max 6 decimal places) |
| `timestamp` | ISO Date | Yes | When the reward was issued (not in future) |
| `eventRef` | String | Yes | Unique event reference for idempotency (1-255 chars) |

#### Success Response (201)
```json
{
  "status": "success",
  "rewardId": "660e8400-e29b-41d4-a716-446655440001",
  "message": "Reward recorded successfully"
}
```

#### Error Responses
- **400**: Validation error (invalid input)
- **404**: User or stock not found
- **409**: Duplicate event reference
- **429**: Rate limit exceeded

#### Example cURL
```bash
curl -X POST http://localhost:3000/reward \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "stockSymbol": "RELIANCE",
    "quantity": 2.5,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "eventRef": "onboarding-bonus-001"
  }'
```

---

### 2. Get Today's Stocks

Fetch all stock rewards for a user today.

```http
GET /today-stocks/{userId}
```

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | UUID | Yes | User identifier |

#### Success Response (200)
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

#### Error Responses
- **400**: Invalid UUID format
- **404**: User not found
- **401**: Unauthorized (production)

#### Example cURL
```bash
curl -X GET http://localhost:3000/today-stocks/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-API-Key: your-api-key"
```

---

### 3. Get Historical INR Values

Fetch INR valuations of stock rewards for all past days (up to yesterday).

```http
GET /historical-inr/{userId}
```

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | UUID | Yes | User identifier |

#### Success Response (200)
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
    },
    {
      "date": "2024-01-12",
      "totalValueINR": 12200.25
    }
  ]
}
```

#### Notes
- Returns up to 100 most recent days
- Excludes today's data
- Values calculated using historical stock prices
- Empty array if user has no historical rewards

#### Example cURL
```bash
curl -X GET http://localhost:3000/historical-inr/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-API-Key: your-api-key"
```

---

### 4. Get User Statistics

Get user statistics including today's totals and current portfolio value.

```http
GET /stats/{userId}
```

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | UUID | Yes | User identifier |

#### Success Response (200)
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

#### Field Descriptions
- `todayTotals`: Array of stock symbols and quantities rewarded today
- `portfolioValueINR`: Current total value of all user holdings

#### Example cURL
```bash
curl -X GET http://localhost:3000/stats/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-API-Key: your-api-key"
```

---

### 5. Get Portfolio (Bonus Endpoint)

Get detailed portfolio breakdown with current INR values per stock.

```http
GET /portfolio/{userId}
```

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | UUID | Yes | User identifier |

#### Success Response (200)
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
    },
    {
      "symbol": "INFY",
      "totalShares": 3.25,
      "currentValueINR": 4712.50
    }
  ]
}
```

#### Field Descriptions
- `symbol`: Stock symbol
- `totalShares`: Total shares held by user
- `currentValueINR`: Current INR value of holdings

#### Example cURL
```bash
curl -X GET http://localhost:3000/portfolio/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-API-Key: your-api-key"
```

---

## Health Check

### Get System Health

```http
GET /health
```

#### Success Response (200)
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.5,
  "memory": {
    "rss": 45678592,
    "heapTotal": 20971520,
    "heapUsed": 15728640,
    "external": 1024000
  },
  "version": "1.0.0"
}
```

**Note**: No authentication required for health checks.

---

## API Documentation (Development Only)

### Get API Documentation

```http
GET /api-docs
```

Returns complete API documentation in JSON format. Only available in development mode.

---

## Data Types

### Stock Symbols
Supported Indian stock symbols include:
- RELIANCE (Reliance Industries)
- TCS (Tata Consultancy Services)
- INFY (Infosys)
- HDFC (Housing Development Finance Corporation)
- HDFCBANK (HDFC Bank)
- ICICIBANK (ICICI Bank)
- ITC (ITC Limited)
- BHARTIARTL (Bharti Airtel)
- KOTAKBANK (Kotak Mahindra Bank)
- LT (Larsen & Toubro)
- AXISBANK (Axis Bank)
- MARUTI (Maruti Suzuki)
- ASIANPAINT (Asian Paints)
- WIPRO (Wipro)
- TITAN (Titan Company)
- ULTRACEMCO (UltraTech Cement)
- NESTLEIND (Nestlé India)
- BAJFINANCE (Bajaj Finance)
- POWERGRID (Power Grid Corporation)
- NTPC (NTPC Limited)

### Precision
- **Stock Quantities**: Up to 6 decimal places (NUMERIC(18,6))
- **INR Amounts**: Up to 4 decimal places (NUMERIC(18,4))
- **Timestamps**: ISO 8601 format with timezone

---

## Testing Examples

### Complete Workflow Test

1. **Create a reward**:
```bash
curl -X POST http://localhost:3000/reward \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "stockSymbol": "RELIANCE",
    "quantity": 1.5,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "eventRef": "test-workflow-001"
  }'
```

2. **Check today's stocks**:
```bash
curl -X GET http://localhost:3000/today-stocks/550e8400-e29b-41d4-a716-446655440000
```

3. **Get user statistics**:
```bash
curl -X GET http://localhost:3000/stats/550e8400-e29b-41d4-a716-446655440000
```

4. **View portfolio**:
```bash
curl -X GET http://localhost:3000/portfolio/550e8400-e29b-41d4-a716-446655440000
```

### Error Testing

1. **Test validation**:
```bash
curl -X POST http://localhost:3000/reward \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "invalid-uuid",
    "stockSymbol": "INVALID",
    "quantity": -1,
    "timestamp": "2025-01-15T10:30:00.000Z",
    "eventRef": ""
  }'
```

2. **Test idempotency**:
```bash
# Run the same reward creation twice
curl -X POST http://localhost:3000/reward \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "stockSymbol": "TCS",
    "quantity": 1.0,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "eventRef": "duplicate-test-001"
  }'
```

---

## Response Headers

All responses include standard headers:

```http
Content-Type: application/json
X-Request-ID: req_1705312200000_abc123def
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

---

## Support

For questions or issues:
1. Check the health endpoint: `GET /health`
2. Review server logs
3. Verify database connectivity
4. Check environment configuration

**API Version**: 1.0.0  
**Last Updated**: January 15, 2024
