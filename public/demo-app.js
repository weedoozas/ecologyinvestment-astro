const STORAGE_KEYS = {
  users: 'eco-demo-users',
  session: 'eco-demo-session',
  transactions: 'eco-demo-transactions'
};

const defaultUsers = [
  {
    id: 'user-1',
    name: 'Inversor Demo',
    email: 'user@eco.demo',
    password: 'user123',
    role: 'investor'
  },
  {
    id: 'admin-1',
    name: 'Admin Demo',
    email: 'admin@eco.demo',
    password: 'admin123',
    role: 'admin'
  }
];

const defaultTransactions = [
  {
    id: crypto.randomUUID(),
    userId: 'user-1',
    type: 'deposit',
    amount: 750,
    detail: 'Capital inicial aprobado',
    status: 'approved',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: crypto.randomUUID(),
    userId: 'user-1',
    type: 'withdrawal',
    amount: 120,
    detail: 'Retiro semanal',
    status: 'paid',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: crypto.randomUUID(),
    userId: 'user-1',
    type: 'deposit',
    amount: 220,
    detail: 'Transferencia bancaria',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

function seedDemoData() {
  if (!localStorage.getItem(STORAGE_KEYS.users)) {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(defaultUsers));
  }

  if (!localStorage.getItem(STORAGE_KEYS.transactions)) {
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(defaultTransactions));
  }
}

function getUsers() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.users) || '[]');
}

function getTransactions() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions) || '[]');
}

function saveTransactions(transactions) {
  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
}

function getSession() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || 'null');
}

function setSession(userId) {
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ userId }));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.session);
}

function getCurrentUser() {
  const session = getSession();
  if (!session) return null;
  return getUsers().find((user) => user.id === session.userId) || null;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
}

function getUserBalance(userId) {
  return getTransactions().reduce((total, item) => {
    if (item.userId !== userId) return total;
    if (item.type === 'deposit' && item.status === 'approved') return total + item.amount;
    if (item.type === 'withdrawal' && item.status === 'paid') return total - item.amount;
    return total;
  }, 0);
}

function loginAs(role) {
  const target = getUsers().find((user) => user.role === role);
  if (!target) return;
  setSession(target.id);
  window.location.href = '/dashboard';
}

function handleLoginPage() {
  const session = getSession();
  if (session) {
    window.location.replace('/dashboard');
    return;
  }

  const form = document.querySelector('#loginForm');
  const message = document.querySelector('#loginMessage');
  const quickButtons = document.querySelectorAll('[data-demo-login]');

  quickButtons.forEach((button) => {
    button.addEventListener('click', () => loginAs(button.dataset.demoLogin));
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '').trim();
    const user = getUsers().find((item) => item.email === email && item.password === password);

    if (!user) {
      message.textContent = 'Correo o contrasena incorrectos.';
      message.dataset.state = 'error';
      return;
    }

    setSession(user.id);
    message.textContent = 'Acceso correcto. Redirigiendo...';
    message.dataset.state = 'success';
    window.setTimeout(() => {
      window.location.href = '/dashboard';
    }, 300);
  });
}

function renderSummaryCard({ label, value, hint, tone = 'neutral' }) {
  return `
    <article class="summary-card ${tone}">
      <p class="label">${label}</p>
      <strong>${value}</strong>
      <span>${hint}</span>
    </article>
  `;
}

function renderTransactionRow(item, isAdmin = false) {
  const badgeClass = item.status;
  const typeLabel = item.type === 'deposit' ? 'Deposito' : 'Retiro';
  const actions = [];

  if (isAdmin && item.type === 'deposit' && item.status === 'pending') {
    actions.push(`<button class="mini-button success" data-action="approve" data-id="${item.id}">Aprobar</button>`);
    actions.push(`<button class="mini-button danger" data-action="reject" data-id="${item.id}">Rechazar</button>`);
  }

  if (isAdmin && item.type === 'withdrawal' && item.status === 'pending') {
    actions.push(`<button class="mini-button success" data-action="pay" data-id="${item.id}">Pagar</button>`);
    actions.push(`<button class="mini-button danger" data-action="reject" data-id="${item.id}">Rechazar</button>`);
  }

  return `
    <article class="item-row">
      <div>
        <div class="item-title-row">
          <strong>${typeLabel}</strong>
          <span class="status-badge ${badgeClass}">${item.status}</span>
        </div>
        <p>${item.detail}</p>
        <span>${formatDate(item.createdAt)}</span>
      </div>
      <div class="item-side">
        <strong>${formatCurrency(item.amount)}</strong>
        ${actions.length ? `<div class="item-actions">${actions.join('')}</div>` : ''}
      </div>
    </article>
  `;
}

function updateTransactionStatus(id, status) {
  const transactions = getTransactions().map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      status,
      updatedAt: new Date().toISOString()
    };
  });
  saveTransactions(transactions);
}

function handleDashboardPage() {
  const user = getCurrentUser();
  if (!user) {
    window.location.replace('/login');
    return;
  }

  const dashboardEyebrow = document.querySelector('#dashboardEyebrow');
  const summaryGrid = document.querySelector('.summary-grid');
  const investorTransactions = document.querySelector('#investorTransactions');
  const adminDeposits = document.querySelector('#adminDeposits');
  const adminWithdrawals = document.querySelector('#adminWithdrawals');
  const investorPanel = document.querySelector('#investorPanel');
  const adminPanel = document.querySelector('#adminPanel');
  const investorStatus = document.querySelector('#investorStatus');

  const depositForm = document.querySelector('#depositForm');
  const withdrawForm = document.querySelector('#withdrawForm');
  const logoutButton = document.querySelector('#logoutButton');
  const switchInvestor = document.querySelector('#switchInvestor');
  const switchAdmin = document.querySelector('#switchAdmin');

  if (dashboardEyebrow) dashboardEyebrow.textContent = user.name;
  investorStatus.textContent = user.role === 'admin' ? 'Vista global' : 'Cuenta propia';

  function render() {
    const transactions = getTransactions();
    const ownTransactions = transactions
      .filter((item) => item.userId === user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const pendingDeposits = transactions.filter((item) => item.type === 'deposit' && item.status === 'pending');
    const pendingWithdrawals = transactions.filter((item) => item.type === 'withdrawal' && item.status === 'pending');
    const approvedDeposits = transactions.filter((item) => item.type === 'deposit' && item.status === 'approved');
    const paidWithdrawals = transactions.filter((item) => item.type === 'withdrawal' && item.status === 'paid');

    const availableBalance = getUserBalance(user.id);
    const investorCards = [
      {
        label: 'Balance disponible',
        value: formatCurrency(availableBalance),
        hint: 'Capital aprobado menos retiros pagados.',
        tone: 'positive'
      },
      {
        label: 'Depositos pendientes',
        value: String(ownTransactions.filter((item) => item.type === 'deposit' && item.status === 'pending').length),
        hint: 'Solicitudes esperando revision.',
        tone: ownTransactions.some((item) => item.type === 'deposit' && item.status === 'pending') ? 'attention' : 'neutral'
      },
      {
        label: 'Retiros pendientes',
        value: String(ownTransactions.filter((item) => item.type === 'withdrawal' && item.status === 'pending').length),
        hint: 'Solicitudes por pagar.',
        tone: ownTransactions.some((item) => item.type === 'withdrawal' && item.status === 'pending') ? 'attention' : 'blue'
      }
    ];

    const adminCards = [
      {
        label: 'Depositos por revisar',
        value: String(pendingDeposits.length),
        hint: 'Entradas esperando aprobacion.',
        tone: pendingDeposits.length ? 'attention' : 'neutral'
      },
      {
        label: 'Retiros por pagar',
        value: String(pendingWithdrawals.length),
        hint: 'Solicitudes listas para procesar.',
        tone: pendingWithdrawals.length ? 'attention' : 'blue'
      },
      {
        label: 'Capital aprobado',
        value: formatCurrency(approvedDeposits.reduce((sum, item) => sum + item.amount, 0)),
        hint: 'Depositos ya validados.',
        tone: 'positive'
      },
      {
        label: 'Cash retirado',
        value: formatCurrency(paidWithdrawals.reduce((sum, item) => sum + item.amount, 0)),
        hint: 'Retiros marcados como pagados.',
        tone: 'neutral'
      }
    ];

    summaryGrid.innerHTML = (user.role === 'admin' ? adminCards : investorCards)
      .map(renderSummaryCard)
      .join('');

    investorTransactions.innerHTML = ownTransactions.length
      ? ownTransactions.map((item) => renderTransactionRow(item)).join('')
      : '<div class="empty-state">Todavia no hay movimientos para esta cuenta.</div>';

    adminDeposits.innerHTML = pendingDeposits.length
      ? pendingDeposits.map((item) => renderTransactionRow(item, true)).join('')
      : '<div class="empty-state">No hay depositos pendientes.</div>';

    adminWithdrawals.innerHTML = pendingWithdrawals.length
      ? pendingWithdrawals.map((item) => renderTransactionRow(item, true)).join('')
      : '<div class="empty-state">No hay retiros pendientes.</div>';

    adminPanel.style.display = user.role === 'admin' ? 'block' : 'none';
    investorPanel.style.display = user.role === 'admin' ? 'none' : 'block';
  }

  depositForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(depositForm);
    const amount = Number(formData.get('amount'));
    const reference = String(formData.get('reference') || '').trim();

    if (!amount || amount <= 0 || !reference) return;

    const transactions = getTransactions();
    transactions.push({
      id: crypto.randomUUID(),
      userId: user.id,
      type: 'deposit',
      amount,
      detail: reference,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    saveTransactions(transactions);
    depositForm.reset();
    render();
  });

  withdrawForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(withdrawForm);
    const amount = Number(formData.get('amount'));
    const destination = String(formData.get('destination') || '').trim();
    const availableBalance = getUserBalance(user.id);

    if (!amount || amount <= 0 || !destination) return;

    if (amount > availableBalance) {
      window.alert('El retiro supera el balance disponible en la demo.');
      return;
    }

    const transactions = getTransactions();
    transactions.push({
      id: crypto.randomUUID(),
      userId: user.id,
      type: 'withdrawal',
      amount,
      detail: destination,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    saveTransactions(transactions);
    withdrawForm.reset();
    render();
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.dataset.action;
    const id = target.dataset.id;
    if (!action || !id) return;

    if (action === 'approve') updateTransactionStatus(id, 'approved');
    if (action === 'pay') updateTransactionStatus(id, 'paid');
    if (action === 'reject') updateTransactionStatus(id, 'rejected');
    render();
  });

  logoutButton?.addEventListener('click', () => {
    clearSession();
    window.location.href = '/login';
  });

  switchInvestor?.addEventListener('click', () => loginAs('investor'));
  switchAdmin?.addEventListener('click', () => loginAs('admin'));

  render();
}

seedDemoData();

if (document.body.dataset.page === 'login') {
  handleLoginPage();
}

if (document.body.dataset.page === 'dashboard') {
  handleDashboardPage();
}
