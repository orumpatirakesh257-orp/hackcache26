import { testQueueLogic } from './queue.test';
import { testNavigationLogic } from './navigation.test';
import { testEmergencyLogic } from './emergency.test';
import { testVoiceRegistrationLogic } from './voiceRegistration.test';

async function run() {
  console.log(`===============================================`);
  console.log(`  🏥 SAHAI SETU TEST SUITE`);
  console.log(`===============================================`);

  try {
    testQueueLogic();
    testNavigationLogic();
    testEmergencyLogic();
    await testVoiceRegistrationLogic();

    console.log(`===============================================`);
    console.log(`  ✅ ALL TESTS PASSED SUCCESSFULLY!`);
    console.log(`===============================================`);
    process.exit(0);
  } catch (err: any) {
    console.error(`❌ TEST FAILED:`, err?.message || err);
    process.exit(1);
  }
}

run();
