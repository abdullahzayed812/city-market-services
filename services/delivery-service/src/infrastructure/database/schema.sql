CREATE TABLE delivery_offices (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  -- Self-registered offices start in PENDING_REVIEW until an admin approves them
  -- offices created by admins/seeds are APPROVED.
  approval_status ENUM('PENDING_REVIEW', 'APPROVED', 'SUSPENDED') NOT NULL DEFAULT 'APPROVED',
  -- Signup documents (media-service URLs, office-documents folder)
  owner_national_id_url VARCHAR(512) NULL,
  commercial_register_url VARCHAR(512) NULL,
  -- Average of customer ratings on deliveries this office handled (NULL until rated)
  rating DECIMAL(3, 2) NULL DEFAULT NULL,
  rating_count INT NOT NULL DEFAULT 0,
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
  -- Explicit, never inferred from delivery_office_id (which ON DELETE SET NULL can clear)
  courier_type ENUM('OFFICE', 'FREELANCE') NOT NULL DEFAULT 'OFFICE',
  -- Freelance self-signups and manager-added office couriers start PENDING_REVIEW
  approval_status ENUM('PENDING_REVIEW', 'APPROVED', 'SUSPENDED', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
  national_id_url VARCHAR(512) NULL,
  license_url VARCHAR(512) NULL,
  last_latitude DECIMAL(10, 8) NULL,
  last_longitude DECIMAL(11, 8) NULL,
  last_seen_at TIMESTAMP NULL,
  cancellation_count INT NOT NULL DEFAULT 0,
  is_available BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  rating DECIMAL(3, 2) DEFAULT 5.00,
  rating_count INT NOT NULL DEFAULT 0,
  total_deliveries INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_available (is_available),
  INDEX idx_delivery_office_id (delivery_office_id),
  INDEX idx_type_available (courier_type, is_available, is_active, approval_status),
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
  -- Set on office accept / freelance claim; NULL while unclaimed
  fulfillment_type ENUM('OFFICE', 'FREELANCE') NULL DEFAULT NULL,
  delivery_fee DECIMAL(10, 2) DEFAULT 0.00,
  -- Tier snapshot at creation; the split itself is computed on accept/claim
  fee_tier_id VARCHAR(36) NULL DEFAULT NULL,
  courier_fee_percentage DECIMAL(5, 2) NULL DEFAULT NULL,
  courier_fee_amount DECIMAL(10, 2) DEFAULT 0.00,
  office_fee_amount DECIMAL(10, 2) DEFAULT 0.00,
  platform_fee_amount DECIMAL(10, 2) DEFAULT 0.00,
  -- Cash the courier collected from the customer (order total) on DELIVERED
  cash_collected_amount DECIMAL(10, 2) DEFAULT 0.00,
  -- End of the office-priority window; NULL means open to freelancers now
  open_to_freelance_at TIMESTAMP NULL DEFAULT NULL,
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
  INDEX idx_freelance_pool (status, delivery_office_id, courier_id, open_to_freelance_at),
  INDEX idx_delivery_office_id (delivery_office_id),
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
  -- Split for freelance deliveries; both NULL means courier gets courier% + office%
  freelance_courier_percentage DECIMAL(5, 2) NULL DEFAULT NULL,
  freelance_platform_percentage DECIMAL(5, 2) NULL DEFAULT NULL,
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
  -- net_payout = total_delivery_fees - total_cash_collected; negative means the courier owes the platform
  total_cash_collected DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  net_payout DECIMAL(10, 2) NOT NULL,
  delivery_count INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settled_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_courier_id (courier_id),
  INDEX idx_status (status),
  -- Financial history: couriers are deactivated, never deleted
  FOREIGN KEY (courier_id) REFERENCES couriers(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One customer rating per delivered delivery. It counts toward the courier, and toward
-- the office too when an office handled it (delivery_office_id set).
CREATE TABLE IF NOT EXISTS delivery_ratings (
  id VARCHAR(36) PRIMARY KEY,
  delivery_id VARCHAR(36) NOT NULL,
  customer_order_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36) NOT NULL,
  courier_id VARCHAR(36) NOT NULL,
  delivery_office_id VARCHAR(36) NULL,
  stars TINYINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX unique_delivery_rating (delivery_id),
  INDEX idx_courier_id (courier_id),
  INDEX idx_delivery_office_id (delivery_office_id),
  INDEX idx_customer_order_id (customer_order_id),
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
