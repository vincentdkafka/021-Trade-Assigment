
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


CREATE TYPE transaction_type AS ENUM ('REWARD', 'ADJUSTMENT', 'REFUND');
CREATE TYPE account_type AS ENUM (
    'USER_STOCK', 
    'BROKERAGE_FEE', 
    'STT', 
    'GST', 
    'CASH_OUTFLOW', 
    'SEBI_FEE', 
    'STAMP_DUTY'
);


CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 255),
    email TEXT NOT NULL UNIQUE CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX idx_users_email ON users(email);


CREATE TABLE stocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL UNIQUE CHECK (length(symbol) >= 1 AND symbol = UPPER(symbol)),
    name TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    delisted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_stocks_symbol ON stocks(symbol);
CREATE INDEX idx_stocks_is_active ON stocks(is_active);


CREATE TABLE stock_corporate_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE RESTRICT,
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('SPLIT', 'MERGER', 'DELISTING', 'BONUS', 'RIGHTS')),
    action_date TIMESTAMPTZ NOT NULL,
    ratio NUMERIC(18,6) NULL, -- For splits: 1:2 split = 0.5, for mergers: exchange ratio
    new_stock_id UUID NULL REFERENCES stocks(id) ON DELETE RESTRICT, -- For mergers
    description TEXT NOT NULL CHECK (length(description) >= 1 AND length(description) <= 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX idx_corporate_actions_stock_id ON stock_corporate_actions(stock_id);
CREATE INDEX idx_corporate_actions_action_date ON stock_corporate_actions(action_date);
CREATE INDEX idx_corporate_actions_action_type ON stock_corporate_actions(action_type);


CREATE TABLE rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE RESTRICT,
    quantity NUMERIC(18,6) NOT NULL CHECK (quantity > 0),
    rewarded_at TIMESTAMPTZ NOT NULL,
    event_ref TEXT NOT NULL UNIQUE CHECK (length(event_ref) >= 1 AND length(event_ref) <= 255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX idx_rewards_user_id ON rewards(user_id);
CREATE INDEX idx_rewards_stock_id ON rewards(stock_id);
CREATE INDEX idx_rewards_rewarded_at ON rewards(rewarded_at);
CREATE INDEX idx_rewards_user_rewarded_at ON rewards(user_id, rewarded_at);
CREATE UNIQUE INDEX idx_rewards_event_ref ON rewards(event_ref);


CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type transaction_type NOT NULL,
    description TEXT NOT NULL CHECK (length(description) >= 1 AND length(description) <= 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);


CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
    account account_type NOT NULL,
    amount_stock NUMERIC(18,6) NULL CHECK (amount_stock IS NULL OR amount_stock != 0),
    amount_inr NUMERIC(18,4) NULL CHECK (amount_inr IS NULL OR amount_inr != 0),
    stock_id UUID NULL REFERENCES stocks(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure at least one amount is specified
    CHECK (amount_stock IS NOT NULL OR amount_inr IS NOT NULL),
    
    -- Stock-related entries must have stock_id
    CHECK (
        (account = 'USER_STOCK' AND stock_id IS NOT NULL AND amount_stock IS NOT NULL) OR
        (account != 'USER_STOCK' AND (stock_id IS NULL OR stock_id IS NOT NULL))
    )
);

-- Create indexes for efficient ledger queries
CREATE INDEX idx_ledger_entries_transaction_id ON ledger_entries(transaction_id);
CREATE INDEX idx_ledger_entries_account ON ledger_entries(account);
CREATE INDEX idx_ledger_entries_stock_id ON ledger_entries(stock_id);
CREATE INDEX idx_ledger_entries_created_at ON ledger_entries(created_at);

-- Stock prices table (for historical pricing and portfolio valuation)
CREATE TABLE stock_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE RESTRICT,
    price_inr NUMERIC(18,4) NOT NULL CHECK (price_inr > 0),
    fetched_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient price queries
CREATE INDEX idx_stock_prices_stock_id ON stock_prices(stock_id);
CREATE INDEX idx_stock_prices_fetched_at ON stock_prices(fetched_at);
CREATE INDEX idx_stock_prices_stock_fetched ON stock_prices(stock_id, fetched_at DESC);

-- Ensure no duplicate prices for same stock at exact same time
CREATE UNIQUE INDEX idx_stock_prices_unique ON stock_prices(stock_id, fetched_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stocks_updated_at BEFORE UPDATE ON stocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rewards_updated_at BEFORE UPDATE ON rewards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ledger_entries_updated_at BEFORE UPDATE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_prices_updated_at BEFORE UPDATE ON stock_prices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_corporate_actions_updated_at BEFORE UPDATE ON stock_corporate_actions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to validate double-entry accounting
CREATE OR REPLACE FUNCTION validate_double_entry(transaction_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    stock_balance NUMERIC(18,6);
    inr_balance NUMERIC(18,4);
BEGIN
    -- Calculate stock balance for the transaction
    SELECT COALESCE(SUM(amount_stock), 0)
    INTO stock_balance
    FROM ledger_entries
    WHERE transaction_id = transaction_uuid;
    
    -- Calculate INR balance for the transaction
    SELECT COALESCE(SUM(amount_inr), 0)
    INTO inr_balance
    FROM ledger_entries
    WHERE transaction_id = transaction_uuid;
    
    -- Both balances should be zero for proper double-entry
    RETURN (stock_balance = 0 AND inr_balance = 0);
END;
$$ LANGUAGE plpgsql;

-- Create function to get user's stock holdings
CREATE OR REPLACE FUNCTION get_user_stock_holdings(user_uuid UUID)
RETURNS TABLE(
    stock_symbol VARCHAR(20),
    total_shares NUMERIC(18,6)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.symbol,
        COALESCE(SUM(r.quantity), 0) as total_shares
    FROM stocks s
    LEFT JOIN rewards r ON s.id = r.stock_id AND r.user_id = user_uuid
    WHERE r.quantity IS NOT NULL
    GROUP BY s.id, s.symbol
    HAVING SUM(r.quantity) > 0
    ORDER BY s.symbol;
END;
$$ LANGUAGE plpgsql;

-- Create function to get latest stock price
CREATE OR REPLACE FUNCTION get_latest_stock_price(stock_uuid UUID)
RETURNS NUMERIC(18,4) AS $$
DECLARE
    latest_price NUMERIC(18,4);
BEGIN
    SELECT price_inr
    INTO latest_price
    FROM stock_prices
    WHERE stock_id = stock_uuid
    ORDER BY fetched_at DESC
    LIMIT 1;
    
    RETURN COALESCE(latest_price, 0);
END;
$$ LANGUAGE plpgsql;

-- Create function to get stock price at specific date
CREATE OR REPLACE FUNCTION get_stock_price_at_date(stock_uuid UUID, target_date TIMESTAMPTZ)
RETURNS NUMERIC(18,4) AS $$
DECLARE
    price_at_date NUMERIC(18,4);
BEGIN
    SELECT price_inr
    INTO price_at_date
    FROM stock_prices
    WHERE stock_id = stock_uuid 
    AND fetched_at <= target_date
    ORDER BY fetched_at DESC
    LIMIT 1;
    
    RETURN COALESCE(price_at_date, 0);
END;
$$ LANGUAGE plpgsql;

-- Create function to apply stock split to user holdings
CREATE OR REPLACE FUNCTION apply_stock_split(
    stock_uuid UUID,
    split_ratio NUMERIC(18,6),
    split_date TIMESTAMPTZ
)
RETURNS VOID AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Update all user holdings for this stock
    FOR user_record IN 
        SELECT DISTINCT user_id, SUM(quantity) as total_quantity
        FROM rewards 
        WHERE stock_id = stock_uuid AND rewarded_at < split_date
        GROUP BY user_id
        HAVING SUM(quantity) > 0
    LOOP
        -- Create adjustment transaction for split
        INSERT INTO transactions (id, type, description)
        VALUES (
            uuid_generate_v4(),
            'ADJUSTMENT',
            'Stock split adjustment: ' || split_ratio || ' ratio for user ' || user_record.user_id
        );
        
        -- Create ledger entry to adjust user holdings
        INSERT INTO ledger_entries (id, transaction_id, account, amount_stock, amount_inr, stock_id)
        VALUES (
            uuid_generate_v4(),
            (SELECT id FROM transactions ORDER BY created_at DESC LIMIT 1),
            'USER_STOCK',
            user_record.total_quantity * (split_ratio - 1), -- Additional shares from split
            NULL,
            stock_uuid
        );
    END LOOP;
    
    -- Record the corporate action
    INSERT INTO stock_corporate_actions (id, stock_id, action_type, action_date, ratio, description)
    VALUES (
        uuid_generate_v4(),
        stock_uuid,
        'SPLIT',
        split_date,
        split_ratio,
        'Stock split with ratio ' || split_ratio
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to handle stock delisting
CREATE OR REPLACE FUNCTION delist_stock(
    stock_uuid UUID,
    delisting_date TIMESTAMPTZ,
    final_price NUMERIC(18,4)
)
RETURNS VOID AS $$
BEGIN
    -- Mark stock as delisted
    UPDATE stocks 
    SET is_active = FALSE, delisted_at = delisting_date
    WHERE id = stock_uuid;
    
    -- Record the corporate action
    INSERT INTO stock_corporate_actions (id, stock_id, action_type, action_date, description)
    VALUES (
        uuid_generate_v4(),
        stock_uuid,
        'DELISTING',
        delisting_date,
        'Stock delisted at final price ' || final_price
    );
    
    -- Update final price
    INSERT INTO stock_prices (id, stock_id, price_inr, fetched_at)
    VALUES (uuid_generate_v4(), stock_uuid, final_price, delisting_date);
END;
$$ LANGUAGE plpgsql;

-- Create view for user portfolio with current values (excluding delisted stocks)
CREATE OR REPLACE VIEW user_portfolio_current AS
SELECT 
    r.user_id,
    u.name as user_name,
    s.symbol as stock_symbol,
    s.name as stock_name,
    SUM(r.quantity) as total_shares,
    get_latest_stock_price(s.id) as current_price_inr,
    (SUM(r.quantity) * get_latest_stock_price(s.id)) as current_value_inr
FROM rewards r
JOIN users u ON r.user_id = u.id
JOIN stocks s ON r.stock_id = s.id
WHERE s.is_active = TRUE
GROUP BY r.user_id, u.name, s.id, s.symbol, s.name
HAVING SUM(r.quantity) > 0
ORDER BY r.user_id, s.symbol;

-- Grant appropriate permissions (adjust as needed for your user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO stocky_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO stocky_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO stocky_user;
