CREATE TABLE notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  metadata JSON,
  -- Source event id (or entity key): a redelivered event creates no second notification
  dedupe_key VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read),
  INDEX idx_user_created (user_id, created_at),
  UNIQUE KEY uq_user_dedupe (user_id, dedupe_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notification_preferences (
  user_id VARCHAR(36) PRIMARY KEY,
  push_enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT FALSE,
  sms_enabled BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE device_tokens (
  user_id VARCHAR(36) NOT NULL,
  token VARCHAR(500) NOT NULL,
  language VARCHAR(10) NOT NULL,
  platform ENUM('ANDROID', 'IOS', 'WEB') NOT NULL,
  app_type ENUM('CUSTOMER', 'VENDOR', 'COURIER', 'DELIVERY_MANAGER', 'ADMIN') NOT NULL,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
