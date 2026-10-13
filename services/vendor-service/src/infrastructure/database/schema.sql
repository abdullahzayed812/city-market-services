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
  -- Merchant onboarding. Self-registered merchants start PENDING_REVIEW and can't run
  -- their shop (open it, add/edit products) until an admin approves them. Vendors created
  -- by admins / seeds are APPROVED. REJECTED merchants may correct and resubmit.
  approval_status ENUM('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'APPROVED',
  owner_name VARCHAR(255) NULL,
  -- Registration documents (media-service URLs, vendor-documents folder)
  owner_national_id_url VARCHAR(512) NULL,
  commercial_register_url VARCHAR(512) NULL,
  tax_card_url VARCHAR(512) NULL,
  -- Admin's reason for the last rejection / suspension, shown to the merchant
  review_note TEXT NULL,
  submitted_at TIMESTAMP NULL DEFAULT NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_approval_status (approval_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Audit trail of a merchant's application: every submission, resubmission and admin decision
CREATE TABLE vendor_approval_history (
  id VARCHAR(36) PRIMARY KEY,
  vendor_id VARCHAR(36) NOT NULL,
  approval_status ENUM('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL,
  note TEXT NULL,
  -- The admin who decided, or the merchant's own user id for (re)submissions
  actor_user_id VARCHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vendor_id (vendor_id, created_at),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
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