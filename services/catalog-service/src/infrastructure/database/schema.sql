CREATE TABLE categories (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type ENUM('GLOBAL', 'VENDOR') NOT NULL DEFAULT 'GLOBAL',
  vendor_id VARCHAR(36) NULL,
  description TEXT,
  icon_url VARCHAR(500),
  color VARCHAR(16),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_type_vendor (type, vendor_id),
  CONSTRAINT chk_category_vendor CHECK (
    (type = 'GLOBAL' AND vendor_id IS NULL) OR
    (type = 'VENDOR' AND vendor_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE global_products (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  global_category_id VARCHAR(36) NOT NULL,
  measurement_type ENUM('UNIT', 'WEIGHT') NOT NULL DEFAULT 'UNIT',
  weight_unit ENUM('KG', 'GRAM') NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_global_category (global_category_id),
  FOREIGN KEY (global_category_id) REFERENCES categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE vendor_products (
  id VARCHAR(36) PRIMARY KEY,
  vendor_id VARCHAR(36) NOT NULL,
  global_product_id VARCHAR(36) NOT NULL,
  vendor_category_id VARCHAR(36) NULL,
  price DECIMAL(10, 2) NOT NULL,
  stock_quantity INT DEFAULT 0,
  stock_weight_grams INT DEFAULT 0,
  reserved_weight_grams INT DEFAULT 0,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vendor_id (vendor_id),
  INDEX idx_global_product (global_product_id),
  INDEX idx_vendor_category (vendor_category_id),
  INDEX idx_availability (is_available),
  FOREIGN KEY (global_product_id) REFERENCES global_products(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
