CREATE TABLE customers (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) UNIQUE,
  device_id VARCHAR(255) NULL,
  device_platform VARCHAR(20) NULL,
  device_model VARCHAR(255) NULL,
  device_app_version VARCHAR(50) NULL,
  device_ip VARCHAR(45) NULL,
  device_updated_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE customer_penalties (
  id VARCHAR(36) PRIMARY KEY,
  customer_id VARCHAR(36) NOT NULL,
  customer_order_id VARCHAR(36) NOT NULL,
  delivery_id VARCHAR(36) NULL,
  reason TEXT NOT NULL,
  device_id VARCHAR(255) NULL,
  device_platform VARCHAR(20) NULL,
  device_model VARCHAR(255) NULL,
  device_app_version VARCHAR(50) NULL,
  device_ip VARCHAR(45) NULL,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customer_id (customer_id),
  INDEX idx_active_penalty (customer_id, is_active),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE addresses (
  id VARCHAR(36) PRIMARY KEY,
  customer_id VARCHAR(36) NOT NULL,
  label VARCHAR(50),
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customer_id (customer_id),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;