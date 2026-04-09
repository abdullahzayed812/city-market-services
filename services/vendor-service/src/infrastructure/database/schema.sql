CREATE TABLE vendors (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) UNIQUE NOT NULL,
  shop_name VARCHAR(255) NOT NULL,
  shop_description TEXT,
  phone VARCHAR(20) NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  store_image VARCHAR(255),
  type VARCHAR(50),
  status ENUM('OPEN', 'CLOSED', 'SUSPENDED') DEFAULT 'CLOSED',
  average_rating DECIMAL(2, 1) DEFAULT 0.0,
  total_ratings INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE working_hours (
  id VARCHAR(36) PRIMARY KEY,
  vendor_id VARCHAR(36) NOT NULL,
  day_of_week TINYINT NOT NULL,
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_open BOOLEAN DEFAULT TRUE,
  INDEX idx_vendor_id (vendor_id),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;