CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('CUSTOMER', 'VENDOR', 'COURIER', 'DELIVERY_MANAGER', 'ADMIN') NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(255) NOT NULL,
  platform VARCHAR(20) NULL,
  browser VARCHAR(100) NULL,
  os VARCHAR(100) NULL,
  device_name VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  refresh_token_hash CHAR(64) NOT NULL,
  previous_token_hash CHAR(64) NULL,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_reason VARCHAR(50) NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX idx_sessions_refresh_token_hash (refresh_token_hash),
  INDEX idx_sessions_user_id (user_id),
  INDEX idx_sessions_previous_token_hash (previous_token_hash),
  INDEX idx_sessions_user_revoked (user_id, revoked),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
