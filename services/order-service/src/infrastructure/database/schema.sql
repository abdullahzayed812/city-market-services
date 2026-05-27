CREATE TABLE customer_orders (
  id VARCHAR(36) PRIMARY KEY,
  customer_id VARCHAR(36) NOT NULL,
  status ENUM('DRAFT','AWAITING_CUSTOMER_CONFIRMATION','PENDING_VENDOR_CONFIRMATION','PREPARING','WAITING_CUSTOMER_DECISION','READY','PICKED_UP', 'IN_DELIVERY','COMPLETED','CANCELLED','CANCELLED_BY_CUSTOMER') DEFAULT 'DRAFT',
  subtotal DECIMAL(10, 2) NOT NULL,
  delivery_fee DECIMAL(10, 2) DEFAULT 0,
  commission_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_latitude DECIMAL(10, 8),
  delivery_longitude DECIMAL(11, 8),
  customer_notes TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customer_id (customer_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE vendor_orders (
  id VARCHAR(36) PRIMARY KEY,
  customer_order_id VARCHAR(36) NOT NULL,
  vendor_id VARCHAR(36) NOT NULL,
  status ENUM('DRAFT', 'PENDING', 'PREPARING', 'PROPOSAL_SENT', 'CONFIRMED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED') DEFAULT 'DRAFT',
  subtotal DECIMAL(10, 2) NOT NULL,
  commission_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  commission_percentage DECIMAL(5, 2) DEFAULT NULL,
  delivery_id VARCHAR(36),
  settlement_id VARCHAR(36) DEFAULT NULL,
  cancellation_reason TEXT,
  vendor_confirmation_deadline TIMESTAMP NULL DEFAULT NULL,
  customer_decision_deadline TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customer_order_id (customer_order_id),
  INDEX idx_vendor_id (vendor_id),
  INDEX idx_status (status),
  INDEX idx_settlement_id (settlement_id),
  INDEX idx_vendor_confirmation_deadline (vendor_confirmation_deadline),
  INDEX idx_customer_decision_deadline (customer_decision_deadline),
  FOREIGN KEY (customer_order_id) REFERENCES customer_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE settlements (
  id VARCHAR(36) PRIMARY KEY,
  vendor_id VARCHAR(36) NOT NULL,
  status ENUM('PENDING', 'PAID') DEFAULT 'PENDING',
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  total_vendor_revenue DECIMAL(10, 2) NOT NULL,
  total_commission DECIMAL(10, 2) NOT NULL,
  net_payout DECIMAL(10, 2) NOT NULL,
  order_count INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settled_at TIMESTAMP DEFAULT NULL,
  INDEX idx_vendor_id (vendor_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE vendor_order_items (
  id VARCHAR(36) PRIMARY KEY,
  vendor_order_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NULL,
  requested_weight_grams INT NULL,
  actual_weight_grams INT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  proposed_quantity INT NULL,
  INDEX idx_vendor_order_id (vendor_order_id),
  INDEX idx_product_id (product_id),
  UNIQUE INDEX unique_vendor_order_product (vendor_order_id, product_id),
  FOREIGN KEY (vendor_order_id) REFERENCES vendor_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_item_proposals (
  id VARCHAR(36) PRIMARY KEY,
  vendor_order_item_id VARCHAR(36) NOT NULL,
  type ENUM('QUANTITY_REDUCTION', 'WEIGHT_ADJUSTMENT', 'UNAVAILABLE') NOT NULL,
  proposed_quantity INT NULL,
  requested_weight_grams INT NULL,
  proposed_weight_grams INT NULL,
  actual_quantity INT NULL,
  status ENUM('PENDING', 'ACCEPTED', 'REJECTED') DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vendor_order_item_id (vendor_order_item_id),
  FOREIGN KEY (vendor_order_item_id) REFERENCES vendor_order_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_status_history (
  id VARCHAR(36) PRIMARY KEY,
  customer_order_id VARCHAR(36),
  vendor_order_id VARCHAR(36),
  status VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customer_order_id (customer_order_id),
  INDEX idx_vendor_order_id (vendor_order_id),
  FOREIGN KEY (customer_order_id) REFERENCES customer_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_order_id) REFERENCES vendor_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE customer_penalties (
  id VARCHAR(36) PRIMARY KEY,
  customer_id VARCHAR(36) NOT NULL,
  customer_order_id VARCHAR(36) NOT NULL,
  delivery_id VARCHAR(36),
  reason TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customer_id (customer_id),
  INDEX idx_active_penalty (customer_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE commission_tiers (
  id VARCHAR(36) PRIMARY KEY,
  vendor_id VARCHAR(36) DEFAULT NULL,
  vendor_type VARCHAR(50) DEFAULT NULL,
  min_amount DECIMAL(10, 2) NOT NULL,
  max_amount DECIMAL(10, 2),
  percentage DECIMAL(5, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vendor_id (vendor_id),
  INDEX idx_vendor_type (vendor_type),
  UNIQUE INDEX idx_tier_scope (vendor_id, vendor_type, min_amount)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
