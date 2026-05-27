CREATE TABLE delivery_offices (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE couriers (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) UNIQUE NOT NULL,
  delivery_office_id VARCHAR(36) NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  vehicle_type VARCHAR(50),
  license_plate VARCHAR(20),
  is_available BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  rating DECIMAL(3, 2) DEFAULT 5.00,
  total_deliveries INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_available (is_available),
  INDEX idx_delivery_office_id (delivery_office_id),
  FOREIGN KEY (delivery_office_id) REFERENCES delivery_offices(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE deliveries (
  id VARCHAR(36) PRIMARY KEY,
  customer_id VARCHAR(36) NOT NULL,
  customer_order_id VARCHAR(36) NOT NULL,
  vendor_order_id VARCHAR(36) NOT NULL DEFAULT 'GROUPED',
  courier_id VARCHAR(36),
  status ENUM('PENDING', 'ACCEPTED', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED', 'FAILED') DEFAULT 'PENDING',
  delivery_office_id VARCHAR(36) NULL DEFAULT NULL,
  delivery_fee DECIMAL(10, 2) DEFAULT 0.00,
  courier_fee_percentage DECIMAL(5, 2) NULL DEFAULT NULL,
  courier_fee_amount DECIMAL(10, 2) DEFAULT 0.00,
  office_fee_amount DECIMAL(10, 2) DEFAULT 0.00,
  delivery_address TEXT NOT NULL,
  delivery_latitude DECIMAL(10, 8),
  delivery_longitude DECIMAL(11, 8),
  total_price DECIMAL(10, 2) DEFAULT 0.00,
  items_count INT DEFAULT 0,
  assigned_at TIMESTAMP NULL,
  office_settlement_id VARCHAR(36) NULL DEFAULT NULL,
  courier_settlement_id VARCHAR(36) NULL DEFAULT NULL,
  picked_up_at TIMESTAMP NULL,
  delivered_at TIMESTAMP NULL,
  notes TEXT,
  acceptance_deadline TIMESTAMP NULL DEFAULT NULL,
  assignment_deadline TIMESTAMP NULL DEFAULT NULL,
  pickup_deadline TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customer_order_id (customer_order_id),
  INDEX idx_vendor_order_id (vendor_order_id),
  INDEX idx_courier_id (courier_id),
  INDEX idx_status (status),
  INDEX idx_acceptance_deadline (acceptance_deadline),
  INDEX idx_assignment_deadline (assignment_deadline),
  INDEX idx_pickup_deadline (pickup_deadline),
  FOREIGN KEY (courier_id) REFERENCES couriers(id) ON DELETE SET NULL,
  UNIQUE INDEX unique_delivery_per_vendor_order (customer_order_id, vendor_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE delivery_pickup_locations (
  id VARCHAR(36) PRIMARY KEY,
  delivery_id VARCHAR(36) NOT NULL,
  vendor_order_id VARCHAR(36) NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_delivery_id (delivery_id),
  INDEX idx_vendor_order_id (vendor_order_id),
  UNIQUE INDEX unique_delivery_pickup (delivery_id, vendor_order_id),
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS delivery_fee_tiers (
  id VARCHAR(36) PRIMARY KEY,
  min_amount DECIMAL(10, 2) NOT NULL,
  max_amount DECIMAL(10, 2) NULL,
  courier_percentage DECIMAL(5, 2) NOT NULL,
  office_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  platform_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX idx_min_amount (min_amount)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS delivery_office_settlements (
  id VARCHAR(36) PRIMARY KEY,
  delivery_office_id VARCHAR(36) NULL,
  status ENUM('PENDING', 'PAID') DEFAULT 'PENDING',
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  total_delivery_fees DECIMAL(10, 2) NOT NULL,
  net_payout DECIMAL(10, 2) NOT NULL,
  delivery_count INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settled_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_status (status),
  INDEX idx_delivery_office_id (delivery_office_id),
  FOREIGN KEY (delivery_office_id) REFERENCES delivery_offices(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS courier_settlements (
  id VARCHAR(36) PRIMARY KEY,
  courier_id VARCHAR(36) NOT NULL,
  status ENUM('PENDING', 'PAID') DEFAULT 'PENDING',
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  total_delivery_fees DECIMAL(10, 2) NOT NULL,
  net_payout DECIMAL(10, 2) NOT NULL,
  delivery_count INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settled_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_courier_id (courier_id),
  INDEX idx_status (status),
  FOREIGN KEY (courier_id) REFERENCES couriers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
