# Stocky API - Edge Cases & Advanced Features Implementation

## Overview

This document explains how the Stocky API handles all the bonus edge cases and advanced features mentioned in the internship assignment requirements.

## ✅ Edge Cases Handled

### 1. Duplicate Reward Events / Replay Attacks

**Implementation**: Idempotency via `eventRef` field
- Each reward request must include a unique `eventRef` string
- Database enforces uniqueness with `UNIQUE` constraint on `event_ref` column
- Duplicate requests with same `eventRef` return `409 Conflict` error
- Prevents accidental double-rewards and malicious replay attacks

**Code Location**: 
- `src/database/schema.sql` - Line 60: `CREATE UNIQUE INDEX idx_rewards_event_ref ON rewards(event_ref);`
- `src/services/reward.ts` - Lines 51-58: Duplicate check logic

### 2. Stock Splits, Mergers, and Delisting

**Implementation**: Corporate Actions System
- New `stock_corporate_actions` table tracks all corporate events
- `stocks` table includes `is_active` and `delisted_at` fields
- Database functions handle split adjustments automatically
- Portfolio queries exclude delisted stocks

**Features**:
- **Stock Splits**: `apply_stock_split()` function adjusts all user holdings
- **Delisting**: `delist_stock()` function marks stocks inactive and sets final price
- **Mergers**: Schema supports exchange ratios and new stock references
- **Bonus/Rights Issues**: Extensible action types

**Code Location**:
- `src/database/schema.sql` - Lines 46-62: Corporate actions table
- `src/database/schema.sql` - Lines 251-329: Split and delisting functions
- `src/services/reward.ts` - Line 356: Active stock filtering

### 3. Rounding Errors in INR Valuation

**Implementation**: Decimal.js precision handling
- All monetary calculations use `Decimal.js` library
- Database uses `NUMERIC(18,6)` for stock quantities and `NUMERIC(18,4)` for INR amounts
- Validation ensures max 6 decimal places for quantities
- Consistent rounding across all calculations

**Code Location**:
- `src/types/index.ts` - Decimal imports and usage
- `src/services/reward.ts` - Lines 417-422: Precision validation
- `src/services/ledger.ts` - Decimal calculations throughout

### 4. Price API Downtime or Stale Data

**Implementation**: Fallback mechanisms and historical pricing
- `getPriceAtDate()` function uses closest available historical price
- Graceful degradation when no recent prices available
- Comprehensive error handling in price service
- Logging for monitoring price fetch failures

**Code Location**:
- `src/services/stock-price.ts` - Lines 176-197: Historical price fallback
- `src/services/stock-price.ts` - Lines 187-189: Fallback to latest price

### 5. Adjustments/Refunds of Previously Given Rewards

**Implementation**: Transaction type system with double-entry accounting
- `TransactionType` enum includes `ADJUSTMENT` and `REFUND` types
- All adjustments create proper ledger entries
- Double-entry validation ensures accounting integrity
- Audit trail maintained for all modifications

**Code Location**:
- `src/types/index.ts` - Lines 59-63: TransactionType enum
- `src/database/schema.sql` - Lines 8-17: Transaction and account types
- `src/services/ledger.ts` - Complete double-entry implementation

## 🏗️ Advanced Architecture Features

### Double-Entry Accounting System

**Complete Implementation**:
- Every reward creates multiple ledger entries that balance to zero
- Separate accounts for different cost components (brokerage, STT, GST, etc.)
- Database function validates double-entry balance
- Comprehensive audit trail

**Accounts**:
- `USER_STOCK`: User's stock holdings (asset)
- `BROKERAGE_FEE`: Brokerage expenses
- `STT`: Securities Transaction Tax
- `GST`: Goods and Services Tax
- `SEBI_FEE`: SEBI charges
- `STAMP_DUTY`: Stamp duty
- `CASH_OUTFLOW`: Cash spent on purchases

### Indian Market Compliance

**Fee Structure** (configurable):
- Brokerage: 0.03% of trade value
- STT: 0.025% on delivery
- GST: 18% on brokerage + exchange charges
- SEBI Fee: Rs 9.8 per crore
- Stamp Duty: 0.015% on buy side

### Production-Ready Features

**Security**:
- Rate limiting (general + reward-specific)
- Request sanitization
- CORS configuration
- Security headers (Helmet)
- API key authentication
- Input validation with Joi

**Monitoring & Logging**:
- Winston logging with multiple levels
- Request/response logging
- Error tracking with stack traces
- Health check endpoint
- Performance metrics

**Scalability**:
- Connection pooling
- Database indexing
- Efficient queries
- Transaction management
- Graceful shutdown handling

## 📊 Database Schema Highlights

### Precision Handling
```sql
-- Stock quantities: up to 6 decimal places
quantity NUMERIC(18,6) NOT NULL CHECK (quantity > 0)

-- INR amounts: up to 4 decimal places  
price_inr NUMERIC(18,4) NOT NULL CHECK (price_inr > 0)
```

### Corporate Actions Support
```sql
-- Track stock splits, mergers, delisting
CREATE TABLE stock_corporate_actions (
    action_type VARCHAR(20) CHECK (action_type IN ('SPLIT', 'MERGER', 'DELISTING', 'BONUS', 'RIGHTS')),
    ratio NUMERIC(18,6) NULL, -- For splits: 1:2 split = 0.5
    new_stock_id UUID NULL -- For mergers
);
```

### Double-Entry Validation
```sql
-- Ensure all transactions balance
CREATE OR REPLACE FUNCTION validate_double_entry(transaction_uuid UUID)
RETURNS BOOLEAN AS $$
-- Validates stock and INR balances sum to zero
```

## 🔧 Service Layer Architecture

### Reward Service
- Core reward management
- Idempotency enforcement
- User/stock validation
- Portfolio calculations

### Ledger Service  
- Double-entry accounting
- Fee calculations
- Transaction recording
- Balance validation

### Stock Price Service
- Mock pricing with realistic volatility
- Historical price storage
- Scheduled updates
- Fallback mechanisms

## 🧪 Testing Coverage

### Comprehensive Test Suite
- All API endpoints tested
- Edge case validation
- Error handling verification
- Rate limiting tests
- Precision handling tests
- Idempotency verification

### Test Categories
1. **Functional Tests**: All endpoints working correctly
2. **Validation Tests**: Input validation and error responses
3. **Edge Case Tests**: Idempotency, precision, rate limiting
4. **Integration Tests**: End-to-end workflows
5. **Error Handling Tests**: Graceful failure scenarios

## 🚀 Production Deployment Considerations

### Environment Configuration
- Database connection pooling
- SSL configuration
- API key management
- Log level configuration
- Rate limiting parameters

### Monitoring Requirements
- Database health checks
- Stock price service status
- Error rate monitoring
- Performance metrics
- Audit log analysis

### Security Considerations
- API key rotation
- Database access controls
- Input sanitization
- Rate limiting enforcement
- Audit trail maintenance

## 📈 Performance Optimizations

### Database Optimizations
- Strategic indexing on frequently queried columns
- Efficient query patterns
- Connection pooling
- Transaction optimization

### API Optimizations
- Request validation early in pipeline
- Efficient data serialization
- Caching strategies for price data
- Parallel processing where possible

## 🔍 Audit & Compliance

### Complete Audit Trail
- All transactions logged with timestamps
- User action tracking
- Price change history
- Corporate action records
- Error and exception logging

### Data Integrity
- Foreign key constraints
- Check constraints
- Unique constraints
- Double-entry validation
- Transaction atomicity

---

## Summary

The Stocky API implementation comprehensively handles all required edge cases and bonus features:

✅ **Duplicate Prevention**: Idempotency via eventRef  
✅ **Corporate Actions**: Complete split/merger/delisting support  
✅ **Precision Handling**: Decimal.js with proper validation  
✅ **Price Resilience**: Fallback mechanisms for API failures  
✅ **Adjustments/Refunds**: Full transaction type system  
✅ **Double-Entry Accounting**: Complete ledger implementation  
✅ **Indian Market Compliance**: Proper fee structure  
✅ **Production Ready**: Security, monitoring, scalability  

The system is designed to be robust, scalable, and maintainable while handling all the complex edge cases that can occur in a real-world stock rewards platform.
