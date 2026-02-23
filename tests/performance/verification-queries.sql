-- Database Integrity Verification Queries --

-- 1. Check for Duplicate Pending Proposals (Should be 0 due to unique constraint logic)
SELECT vendor_order_item_id, COUNT(*) as pending_count
FROM order_item_proposals
WHERE status = 'PENDING'
GROUP BY vendor_order_item_id
HAVING count(*) > 1;

-- 2. Check for Duplicate Accepted Proposals (Should be 0 due to FOR UPDATE row locks)
SELECT vendor_order_item_id, COUNT(*) as accepted_count
FROM order_item_proposals
WHERE status = 'ACCEPTED'
GROUP BY vendor_order_item_id
HAVING count(*) > 1;

-- 3. Check for Duplicate Deliveries per Order (Should be 0 due to UNIQUE NOT NULL DEFAULT GROUPED)
SELECT customer_order_id, vendor_order_id, COUNT(*) as delivery_count
FROM deliveries
GROUP BY customer_order_id, vendor_order_id
HAVING COUNT(*) > 1;

-- 4. Check for Orphaned Order History (Should be 0 due to adding FOREIGN KEY CASCADE)
SELECT h.id 
FROM order_status_history h
LEFT JOIN customer_orders co ON h.customer_order_id = co.id
LEFT JOIN vendor_orders vo ON h.vendor_order_id = vo.id
WHERE h.customer_order_id IS NOT NULL AND co.id IS NULL
   OR h.vendor_order_id IS NOT NULL AND vo.id IS NULL;

-- 5. Check for Event Consumers Ghost/Duplicates
-- Count of vendor_orders with PROPOSAL_SENT vs actual PENDING proposals. 
-- Ensures RabbitMQ ACK bug didn't ghost message processing.
SELECT vo.id, vo.status, COUNT(p.id) as pending_proposals
FROM vendor_orders vo
LEFT JOIN vendor_order_items voi ON voi.vendor_order_id = vo.id
LEFT JOIN order_item_proposals p ON p.vendor_order_item_id = voi.id AND p.status = 'PENDING'
WHERE vo.status = 'PROPOSAL_SENT'
GROUP BY vo.id
HAVING pending_proposals = 0;
