// Seed data — simulated banking CRM customers
const customers = [
  {
    id: 'C001',
    name: 'Aisha Patel',
    phone: '071 234 5678',
    email: 'aisha.patel@email.com',
    account: 'CHQ-100-001',
    segment: 'Retail',
    status: 'Active',
    branch: 'Sandton',
    notes: 'Prefers SMS communications. High-value client.'
  },
  {
    id: 'C002',
    name: 'David Nkosi',
    phone: '082 987 6543',
    email: 'd.nkosi@business.co.za',
    account: 'SME-200-002',
    segment: 'SME',
    status: 'Active',
    branch: 'Cape Town CBD',
    notes: 'Business account. Monthly overdraft review due.'
  },
  {
    id: 'C003',
    name: 'Fatima Moosa',
    phone: '083 456 7890',
    email: 'fatima.m@personal.net',
    account: 'CHQ-100-003',
    segment: 'Retail',
    status: 'Inactive',
    branch: 'Durban North',
    notes: 'Account dormant since Q3 2024.'
  },
  {
    id: 'C004',
    name: 'James Okafor',
    phone: '076 111 2233',
    email: 'james.okafor@corp.io',
    account: 'SME-200-004',
    segment: 'SME',
    status: 'Active',
    branch: 'Johannesburg East',
    notes: 'Loan application pending credit review.'
  },
  {
    id: 'C005',
    name: 'Lerato Dlamini',
    phone: '064 555 9900',
    email: 'lerato.d@gmail.com',
    account: 'CHQ-100-005',
    segment: 'Retail',
    status: 'Active',
    branch: 'Pretoria Central',
    notes: 'Recently upgraded to premium tier.'
  }
];

const activityLogs = {
  C001: [
    { date: '2026-03-10', type: 'Call', agent: 'B. Mokoena', notes: 'Discussed savings product.' },
    { date: '2026-02-28', type: 'Email', agent: 'System', notes: 'Statement sent.' },
    { date: '2026-02-15', type: 'Branch Visit', agent: 'T. Khumalo', notes: 'KYC documents updated.' },
    { date: '2026-01-20', type: 'Call', agent: 'B. Mokoena', notes: 'Complaint resolved — ATM fee waived.' },
    { date: '2025-12-05', type: 'Email', agent: 'System', notes: 'Year-end statement sent.' },
    { date: '2025-11-14', type: 'Call', agent: 'L. Sithole', notes: 'Account limit increase approved.' },
    { date: '2025-10-30', type: 'Branch Visit', agent: 'T. Khumalo', notes: 'New debit card issued.' },
    { date: '2025-09-12', type: 'Email', agent: 'System', notes: 'Product offer sent.' },
    { date: '2025-08-04', type: 'Call', agent: 'L. Sithole', notes: 'Address change processed.' },
    { date: '2025-07-01', type: 'Branch Visit', agent: 'B. Mokoena', notes: 'Account opened.' }
  ],
  C002: [
    { date: '2026-03-12', type: 'Call', agent: 'R. Pillay', notes: 'Overdraft limit discussion.' },
    { date: '2026-02-20', type: 'Email', agent: 'System', notes: 'Statement sent.' },
    { date: '2026-01-15', type: 'Call', agent: 'R. Pillay', notes: 'Quarterly review completed.' },
    { date: '2025-12-18', type: 'Branch Visit', agent: 'M. Naidoo', notes: 'Business documentation updated.' },
    { date: '2025-11-05', type: 'Call', agent: 'R. Pillay', notes: 'Invoice financing query.' },
    { date: '2025-10-14', type: 'Email', agent: 'System', notes: 'Rate change notification sent.' }
  ],
  C003: [
    { date: '2025-07-10', type: 'Call', agent: 'S. Zulu', notes: 'Reactivation attempt — no response.' },
    { date: '2025-06-01', type: 'Email', agent: 'System', notes: 'Dormancy warning sent.' }
  ],
  C004: [
    { date: '2026-03-13', type: 'Call', agent: 'P. Ferreira', notes: 'Loan application status update.' },
    { date: '2026-03-05', type: 'Email', agent: 'System', notes: 'Credit documents requested.' },
    { date: '2026-02-28', type: 'Branch Visit', agent: 'P. Ferreira', notes: 'Application submitted.' }
  ],
  C005: [
    { date: '2026-03-08', type: 'Call', agent: 'A. van der Berg', notes: 'Premium tier welcome call.' },
    { date: '2026-02-14', type: 'Email', agent: 'System', notes: 'Upgrade confirmation sent.' },
    { date: '2026-01-30', type: 'Branch Visit', agent: 'A. van der Berg', notes: 'Premium card issued.' },
    { date: '2025-12-22', type: 'Call', agent: 'A. van der Berg', notes: 'Year-end financial review.' }
  ]
};

module.exports = { customers, activityLogs };
