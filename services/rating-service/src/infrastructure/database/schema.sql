CREATE TABLE IF NOT EXISTS ratings (
    id CHAR(36) PRIMARY KEY,
    order_id CHAR(36) NOT NULL,
    vendor_id CHAR(36) NOT NULL,
    customer_id CHAR(36) NOT NULL,
    stars INT NOT NULL CHECK (stars >= 1 AND stars <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (order_id, vendor_id)
);

CREATE TABLE IF NOT EXISTS vendor_rating_summary (
    vendor_id CHAR(36) PRIMARY KEY,
    total_ratings INT DEFAULT 0,
    total_stars INT DEFAULT 0,
    average_rating DECIMAL(2,1) DEFAULT 0.0
);
