# Performance Testing Module

A unified, extensible performance testing suite for the City Market microservices architecture.

## Overview

This module simulates real-world load and concurrency scenarios by interacting with the system via the API Gateway. It uses dynamic data from the `catalog_db` and shared constants to ensure tests are always in sync with the environment.

## Architecture

- **`src/index.ts`**: The main test runner that orchestrates scenario execution.
- **`src/core/`**: Contains the base `Scenario` class, `ApiClient` (Axios wrapper), and `DbClient` (MySQL connector).
- **`src/utils/DataPool.ts`**: Manages authentication tokens and dynamic product data fetched from the DB.
- **`src/scenarios/`**: Individual test implementations (Browsing, Ordering, Delivery, Race Conditions).

## Scenarios

1.  **Vendor Proposal Race Condition**: Simultaneously fires multiple proposals for the same order to test locking and idempotency.
2.  **Customer Full Journey**: A single-user flow from browsing to order placement.
3.  **Vendor Flow**: Simulates a vendor accepting orders and updating statuses.
4.  **Courier Flow**: Simulates a courier delivering assigned orders.
5.  **Full Order Lifecycle**: An end-to-end orchestration of an order from placement to delivery.

## Prerequisites

- Node.js & NPM
- Docker services up (`docker-compose up -d`)
- Backend databases seeded (`npm run db:seed`)

## Usage

Run the suite from the project root:
```bash
npm run test:performance
```

Or from the module directory:
```bash
cd tests/performance-module
npm start
```

## Interpreting Results

- **Success**: Scenario completed without errors.
- **Failures**:
    - **401/403**: Authentication or token issues.
    - **400/404**: Data mismatch (e.g., product not found in vendor's catalog).
    - **500 (Deadlock)**: System-level concurrency issues. The suite is designed to catch these!
