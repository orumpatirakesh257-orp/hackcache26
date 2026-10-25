import { Router, Request, Response } from 'express';
import { DEMO_ACCOUNTS } from '../../../shared/constants';
import { db } from '../db';

const router = Router();

// Send simulated OTP
router.post('/otp/send', (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone || phone.length < 10) {
    return res.status(400).json({ error: 'Valid 10-digit mobile number required' });
  }

  // Simulated OTP is 123456
  res.json({
    success: true,
    message: 'OTP sent successfully to ' + phone,
    demoOtp: '123456',
  });
});

// Verify simulated OTP
router.post('/otp/verify', (req: Request, res: Response) => {
  const { phone, otp } = req.body;

  if (otp !== '123456' && otp !== '000000') {
    return res.status(400).json({ error: 'Invalid OTP. Please enter the demo OTP: 123456' });
  }

  const store = db.getStore();
  const existingPatient = store.patients.find((p) => p.phone === phone);

  res.json({
    success: true,
    user: {
      role: 'patient',
      phone,
      patientId: existingPatient?.id,
      patientName: existingPatient?.name || 'Patient',
    },
    token: 'jwt-patient-token-' + Date.now(),
  });
});

// Password-protected Staff Portal Login
router.post('/staff-login', (req: Request, res: Response) => {
  const { accountId, role, password } = req.body;

  // Validate Demo Password
  if (!password || password.trim() !== '1234') {
    db.logAudit(
      'AUTH_FAILED',
      accountId || role || 'Unknown Staff',
      (role as any) || 'counter_staff',
      'Failed staff login attempt: Invalid password'
    );
    return res.status(401).json({
      success: false,
      error: 'Invalid password. For demo evaluation, enter password: 1234',
    });
  }

  // Reject patient accounts from Staff Portal with 403 Forbidden
  const isPatient = (accountId && accountId === 'demo-patient-1') || role === 'patient';
  const patientAccount = DEMO_ACCOUNTS.find(
    (a) => (a.id === accountId || a.role === role) && a.role === 'patient'
  );
  if (isPatient || patientAccount) {
    db.logAudit(
      'AUTH_BLOCKED',
      patientAccount?.name || 'Patient Account',
      'patient',
      'Patient account denied access to Staff Portal'
    );
    return res.status(403).json({
      success: false,
      error: 'Patient accounts cannot access the Hospital Staff Portal. Public patient services are available on the home page.',
    });
  }

  // Find staff account
  const account = DEMO_ACCOUNTS.find(
    (a) => (a.id === accountId || a.role === role) && a.role !== 'patient'
  );

  if (!account) {
    return res.status(404).json({
      success: false,
      error: 'Staff account not found',
    });
  }

  // Audit successful login
  db.logAudit(
    'STAFF_LOGIN',
    account.name,
    account.role,
    `Authenticated into Staff Portal as ${account.label} (Room/Counter: ${account.details})`
  );

  const token = `jwt-staff-${account.role}-${Date.now()}`;

  res.json({
    success: true,
    user: account,
    token,
  });
});

// Role Switcher / Demo login with password validation for staff
router.post('/switch-role', (req: Request, res: Response) => {
  const { role, accountId, password } = req.body;

  const account = DEMO_ACCOUNTS.find((a) => a.id === accountId || a.role === role);
  if (!account) {
    return res.status(404).json({ success: false, error: 'Role account not found' });
  }

  // If selecting a staff role, enforce password '1234'
  if (account.role !== 'patient') {
    if (!password || password.trim() !== '1234') {
      db.logAudit(
        'AUTH_FAILED',
        account.name,
        account.role,
        `Unauthorized role switch attempt to ${account.label}`
      );
      return res.status(401).json({
        success: false,
        error: 'Staff access requires password: 1234',
      });
    }
  }

  db.logAudit(
    'ROLE_SWITCH',
    account.name,
    account.role,
    `Switched role to ${account.label}`
  );

  res.json({
    success: true,
    user: account,
    token: `jwt-${account.role}-${Date.now()}`,
  });
});

// Verify active token
router.post('/verify', (req: Request, res: Response) => {
  const { token, role } = req.body;
  if (!token) {
    return res.status(401).json({ success: false, valid: false });
  }

  const isStaffToken = token.startsWith('jwt-staff-') || token.startsWith('jwt-doctor-') || token.startsWith('jwt-admin-') || token.startsWith('jwt-counter_staff-') || token.startsWith('jwt-triage_nurse-');
  res.json({
    success: true,
    valid: true,
    isStaff: isStaffToken,
    role: role || (isStaffToken ? token.split('-')[2] : 'patient'),
  });
});

// List demo accounts
router.get('/demo-accounts', (req: Request, res: Response) => {
  res.json(DEMO_ACCOUNTS);
});

export default router;
