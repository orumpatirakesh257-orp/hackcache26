const BASE_URL = 'http://localhost:5000';

async function testAuthAndStaffEndpoints() {
  console.log('--- STARTING E2E BACKEND AUTH & STAFF TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Health check
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    assert(data.status === 'ok', 'API Health Check returns ok');
  } catch (err) {
    assert(false, `Health check failed: ${err.message}`);
  }

  // 2. Staff login with incorrect password
  try {
    const res = await fetch(`${BASE_URL}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'doc-ortho-1', password: 'wrongpassword' }),
    });
    const data = await res.json();
    assert(res.status === 401 && !data.success, 'Staff login with wrong password rejected (401)');
  } catch (err) {
    assert(false, `Wrong password test failed: ${err.message}`);
  }

  // 3. Staff login with empty password
  try {
    const res = await fetch(`${BASE_URL}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'doc-ortho-1', password: '' }),
    });
    const data = await res.json();
    assert(res.status === 401 && !data.success, 'Staff login with empty password rejected (401)');
  } catch (err) {
    assert(false, `Empty password test failed: ${err.message}`);
  }

  // 4. Staff login with patient account (should be rejected from staff portal)
  try {
    const res = await fetch(`${BASE_URL}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'demo-patient-1', password: '1234' }),
    });
    const data = await res.json();
    assert(res.status === 403 && !data.success, 'Patient account rejected from staff login (403)');
  } catch (err) {
    assert(false, `Patient rejection test failed: ${err.message}`);
  }

  // 5. Staff login with correct password "1234" for all 4 staff roles
  const rolesToTest = [
    { id: 'demo-staff-1', role: 'counter_staff', name: 'Suresh Verma' },
    { id: 'doc-ortho-1', role: 'doctor', name: 'Dr. Priya Sharma' },
    { id: 'demo-nurse-1', role: 'triage_nurse', name: 'Sister Anjali Nair' },
    { id: 'demo-admin-1', role: 'admin', name: 'Dr. Arvind Mehta' },
  ];

  let adminToken = '';
  let counterToken = '';

  for (const acc of rolesToTest) {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/staff-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: acc.id, password: '1234' }),
      });
      const data = await res.json();
      assert(
        res.status === 200 && data.success && data.user && data.user.role === acc.role,
        `Staff login succeeded for ${acc.role} (${acc.name}) with token provided`
      );
      if (acc.role === 'admin') adminToken = data.token;
      if (acc.role === 'counter_staff') counterToken = data.token;
    } catch (err) {
      assert(false, `Staff login failed for ${acc.role}: ${err.message}`);
    }
  }

  // 6. Test Staff Registration (assisted walk-in OPD registration by counter staff)
  let generatedTokenNumber = '';
  try {
    const res = await fetch(`${BASE_URL}/api/registration/staff-register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${counterToken}`,
      },
      body: JSON.stringify({
        fullName: 'Test Patient Walkin',
        age: 48,
        gender: 'female',
        phone: '9876543210',
        departmentId: 'dept-ortho',
        priority: 'urgent',
        chiefComplaint: 'Acute knee injury from morning fall',
        staffNotes: 'Triaged by counter as urgent priority, wheel-chair assisted',
      }),
    });
    const data = await res.json();
    assert(
      res.status === 200 && data.success && data.token && data.token.tokenNumber,
      `Staff walk-in registration created token: ${data.token ? data.token.tokenNumber : 'none'}`
    );
    if (data.token) {
      generatedTokenNumber = data.token.tokenNumber;
    }
  } catch (err) {
    assert(false, `Staff registration failed: ${err.message}`);
  }

  // 7. Test Paper OPD Slip Verification
  try {
    const res = await fetch(`${BASE_URL}/api/registration/verify-slip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${counterToken}`,
      },
      body: JSON.stringify({
        identifier: generatedTokenNumber || 'OPD-1001',
      }),
    });
    const data = await res.json();
    assert(
      res.status === 200 && data.success && data.slip && data.slip.isVerified === true,
      `Paper OPD slip verified for token ${generatedTokenNumber || 'OPD-1001'}`
    );
  } catch (err) {
    assert(false, `Slip verification failed: ${err.message}`);
  }

  // 8. Test Admin Doctors Roster endpoint
  try {
    const res = await fetch(`${BASE_URL}/api/admin/doctors`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert(
      res.status === 200 && data.success && Array.isArray(data.doctors) && data.doctors.length > 0,
      `Admin doctor roster returned ${data.doctors ? data.doctors.length : 0} doctors with queues`
    );
  } catch (err) {
    assert(false, `Admin doctors fetch failed: ${err.message}`);
  }

  // 9. Test Admin Departments endpoint
  try {
    const res = await fetch(`${BASE_URL}/api/admin/departments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert(
      res.status === 200 && data.success && Array.isArray(data.departments) && data.departments.length > 0,
      `Admin departments returned ${data.departments ? data.departments.length : 0} departments`
    );
  } catch (err) {
    assert(false, `Admin departments fetch failed: ${err.message}`);
  }

  // 10. Test Admin Staff Directory endpoint
  try {
    const res = await fetch(`${BASE_URL}/api/admin/staff`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert(
      res.status === 200 && data.success && Array.isArray(data.staff) && data.staff.length > 0,
      `Admin staff roster returned ${data.staff ? data.staff.length : 0} personnel records`
    );
  } catch (err) {
    assert(false, `Admin staff fetch failed: ${err.message}`);
  }

  // 11. Test Role Switch with password '1234'
  try {
    const res = await fetch(`${BASE_URL}/api/auth/switch-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', accountId: 'demo-admin-1', password: '1234' }),
    });
    const data = await res.json();
    assert(res.status === 200 && data.success, 'Switch role to admin with password 1234 succeeded');
  } catch (err) {
    assert(false, `Role switch test failed: ${err.message}`);
  }

  // 12. Test Role Switch with wrong password
  try {
    const res = await fetch(`${BASE_URL}/api/auth/switch-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', accountId: 'demo-admin-1', password: '9999' }),
    });
    const data = await res.json();
    assert(res.status === 401 && !data.success, 'Switch role with wrong password rejected (401)');
  } catch (err) {
    assert(false, `Role switch wrong password failed: ${err.message}`);
  }

  console.log(`\n--- RESULTS: ${passed} PASSED, ${failed} FAILED ---`);
}

testAuthAndStaffEndpoints();
