const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CUSTOMER_TOKEN = process.env.CUSTOMER_TOKEN || 'test-customer-token';
const PROPOSAL_ID = process.env.TARGET_PROPOSAL_ID || '12345'; // Set this to a real pending proposal ID

async function testRaceCondition() {
    console.log(`🚀 Starting Concurrency Race Condition Test on Proposal ${PROPOSAL_ID}...`);

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CUSTOMER_TOKEN}`
    };

    // The payload assumes checking boolean or similar if needed. We just POST to accept.
    const url = `${BASE_URL}/orders/proposals/${PROPOSAL_ID}/accept`;

    // Fire 20 identical requests exactly at the same time to force a race condition
    const requests = Array.from({ length: 20 }).map(() =>
        axios.post(url, {}, { headers })
            .then(res => ({ status: res.status, data: res.data }))
            .catch(err => ({ status: err.response?.status, data: err.response?.data }))
    );

    const results = await Promise.all(requests);

    let successes = 0;
    let conflicts = 0;

    results.forEach((res, index) => {
        if (res.status === 200 || res.status === 201) successes++;
        else if (res.status === 400 || res.status === 409 || res.status === 500) conflicts++;
        console.log(`Request ${index + 1}: Status ${res.status}`);
    });

    console.log('\n--- Test Results ---');
    console.log(`✅ Successes (Accepted): ${successes}`);
    console.log(`❌ Conflicts/Errors: ${conflicts}`);

    if (successes > 1) {
        console.log('🚨 VULNERABILITY DETECTED: Race condition allowed double acceptance!');
    } else if (successes === 1) {
        console.log('🛡️ SYSTEM SAFE: Only one request succeeded. FOR UPDATE DB locks are working properly!');
    } else {
        console.log('⚠️ No successes. Ensure the proposal ID was valid and initially PENDING.');
    }
}

testRaceCondition();
