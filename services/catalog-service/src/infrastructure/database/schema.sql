CREATE TABLE categories (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type ENUM('GLOBAL', 'VENDOR') NOT NULL DEFAULT 'GLOBAL',
  vendor_id VARCHAR(36) NULL,
  description TEXT,
  icon_url VARCHAR(500),
  color VARCHAR(16),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
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
  deleted_at TIMESTAMP NULL,
  INDEX idx_name (name),
  INDEX idx_deleted_at (deleted_at),
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
  reserved_quantity INT DEFAULT 0,
  reserved_weight_grams INT DEFAULT 0,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX idx_vendor_id (vendor_id),
  INDEX idx_global_product (global_product_id),
  INDEX idx_vendor_category (vendor_category_id),
  INDEX idx_availability (is_available),
  INDEX idx_deleted_at (deleted_at),
  -- One live (not deleted) link per store and catalog product, so retried or concurrent
  -- adds / approvals can't create a second sellable copy. Deleted rows don't count.
  active_global_product_id VARCHAR(36) GENERATED ALWAYS AS (IF(deleted_at IS NULL, global_product_id, NULL)) VIRTUAL,
  UNIQUE KEY uq_vendor_active_global_product (vendor_id, active_global_product_id),
  FOREIGN KEY (global_product_id) REFERENCES global_products(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- A merchant's proposal for a new catalog product. Nothing here is visible to customers or
-- sellable: an admin approval creates the global product (or links an existing one) and the
-- store's vendor_products row through the usual add-from-catalog logic. Price and stock are
-- never part of a proposal; the merchant sets them on the vendor product afterwards.
CREATE TABLE product_submissions (
  id VARCHAR(36) PRIMARY KEY,
  vendor_id VARCHAR(36) NOT NULL,
  submitted_by_user_id VARCHAR(36) NOT NULL,
  status ENUM('PENDING_REVIEW', 'NEEDS_CHANGES', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_REVIEW',
  name VARCHAR(255) NOT NULL,
  -- Lower-cased, Arabic letter variants unified, punctuation removed: for duplicate checks
  normalized_name VARCHAR(255) NOT NULL,
  description TEXT,
  global_category_id VARCHAR(36) NOT NULL,
  measurement_type ENUM('UNIT', 'WEIGHT') NOT NULL DEFAULT 'UNIT',
  weight_unit ENUM('KG', 'GRAM') NULL,
  -- Private storage key (media-service, bucket without public access)
  image_key VARCHAR(255) NOT NULL,
  image_width INT NULL,
  image_height INT NULL,
  -- Bumped on every merchant edit; admin decisions must name the revision they reviewed
  revision INT NOT NULL DEFAULT 1,
  vendor_acknowledged_duplicates BOOLEAN NOT NULL DEFAULT FALSE,
  review_note TEXT NULL,
  reviewed_by VARCHAR(36) NULL,
  reviewed_at TIMESTAMP NULL,
  resolution ENUM('CREATED', 'LINKED_EXISTING') NULL,
  -- Id reserved for the global product on the first approval attempt, reused by retries
  -- (the public image is written under it before the database commit)
  reserved_global_product_id VARCHAR(36) NULL,
  global_product_id VARCHAR(36) NULL,
  vendor_product_id VARCHAR(36) NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- 1 while the proposal is open, NULL once final: a store can have only one open proposal
  -- per normalized name and category (NULLs don't collide in a unique key)
  open_flag TINYINT GENERATED ALWAYS AS (IF(status IN ('PENDING_REVIEW', 'NEEDS_CHANGES'), 1, NULL)) VIRTUAL,
  UNIQUE KEY uq_submission_image (image_key),
  UNIQUE KEY uq_submission_open_name (vendor_id, global_category_id, normalized_name, open_flag),
  INDEX idx_submission_vendor_status (vendor_id, status, submitted_at),
  INDEX idx_submission_status (status, submitted_at),
  INDEX idx_submission_normalized_name (normalized_name),
  FOREIGN KEY (global_category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (global_product_id) REFERENCES global_products(id) ON DELETE SET NULL,
  CONSTRAINT chk_submission_weight_unit CHECK (
    (measurement_type = 'UNIT' AND weight_unit IS NULL) OR
    (measurement_type = 'WEIGHT' AND weight_unit IS NOT NULL)
  ),
  -- (global_product_id can't be part of a CHECK: it has an ON DELETE action)
  CONSTRAINT chk_submission_approved CHECK (
    status <> 'APPROVED' OR (resolution IS NOT NULL AND reviewed_by IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Every state change and edit, with who made it and the note the merchant saw
CREATE TABLE product_submission_history (
  id VARCHAR(36) PRIMARY KEY,
  submission_id VARCHAR(36) NOT NULL,
  action ENUM('SUBMITTED', 'UPDATED', 'RESUBMITTED', 'CHANGES_REQUESTED', 'APPROVED', 'LINKED_EXISTING', 'REJECTED', 'CANCELLED') NOT NULL,
  status ENUM('PENDING_REVIEW', 'NEEDS_CHANGES', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL,
  revision INT NOT NULL,
  note TEXT NULL,
  actor_user_id VARCHAR(36) NULL,
  actor_role VARCHAR(32) NULL,
  -- The proposal's fields at this point (name, category, image key, ...)
  snapshot JSON NULL,
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_submission_history (submission_id, created_at),
  FOREIGN KEY (submission_id) REFERENCES product_submissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
