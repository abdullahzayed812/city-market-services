import { ApiClient } from './core/ApiClient';
import { DataPool } from './utils/DataPool';
import { VendorProposalRace } from './scenarios/VendorProposalRace';
import { CustomerFlow } from './scenarios/CustomerFlow';
import { VendorFlow } from './scenarios/VendorFlow';
import { DeliveryFlow } from './scenarios/DeliveryFlow';
import { FullLifecycle } from './scenarios/FullLifecycle';
import * as dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function main() {
    console.log('🚀 Starting Performance Test Suite');
    console.log(`📍 Targeting: ${BASE_URL}`);

    const dataPool = new DataPool(BASE_URL);

    console.log('🔐 Authenticating users...');
    await dataPool.authenticateAll();

    console.log('📔 Loading test data...');
    await dataPool.fetchDynamicData();

    const apiClient = new ApiClient(BASE_URL);

    const scenarios = [
        new VendorProposalRace(),
        new CustomerFlow(),
        new VendorFlow(),
        new DeliveryFlow(),
        new FullLifecycle(),
    ];

    console.log('\n🏃 Running scenarios...');

    for (const scenario of scenarios) {
        console.log(`\n--- Scenario: ${scenario.getName()} ---`);
        try {
            const result = await scenario.run(apiClient, dataPool);
            console.log('✅ Result:', JSON.stringify(result, null, 2));
        } catch (error) {
            console.error(`❌ Scenario ${scenario.getName()} failed:`, (error as any).message);
        }
    }

    await dataPool.cleanup();
    console.log('\n🏁 Performance Test Suite Finished');
}

main().catch(console.error);
