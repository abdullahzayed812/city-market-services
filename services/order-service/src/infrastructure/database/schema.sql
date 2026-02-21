CREATE TABLE customer_orders (
  id VARCHAR(36) PRIMARY KEY,
  customer_id VARCHAR(36) NOT NULL,
  status ENUM('PENDING_VENDOR_CONFIRMATION','WAITING_CUSTOMER_DECISION','READY','PICKED_UP', 'IN_DELIVERY','COMPLETED','CANCELLED') DEFAULT 'PENDING_VENDOR_CONFIRMATION',
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
  status ENUM('PENDING', 'PROPOSAL_SENT', 'CONFIRMED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED') DEFAULT 'PENDING',
  subtotal DECIMAL(10, 2) NOT NULL,
  commission_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  delivery_id VARCHAR(36),
  cancellation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customer_order_id (customer_order_id),
  INDEX idx_vendor_id (vendor_id),
  INDEX idx_status (status),
  FOREIGN KEY (customer_order_id) REFERENCES customer_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE vendor_order_items (
  id VARCHAR(36) PRIMARY KEY,
  vendor_order_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  INDEX idx_vendor_order_id (vendor_order_id),
  INDEX idx_product_id (product_id),
  FOREIGN KEY (vendor_order_id) REFERENCES vendor_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_item_proposals (
  id VARCHAR(36) PRIMARY KEY,
  vendor_order_item_id VARCHAR(36) NOT NULL,
  type ENUM('QUANTITY_REDUCTION', 'UNAVAILABLE') NOT NULL,
  proposed_quantity INT,
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
  INDEX idx_vendor_order_id (vendor_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;