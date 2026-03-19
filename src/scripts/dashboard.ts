import Chart from 'chart.js/auto';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '../lib/firebase/client';
import {
  createDepositTransaction,
  createWithdrawalTransaction,
  ensureUserProfile,
  type TransactionRecord,
  type TransactionStatus,
  updateTransactionStatus,
  updateUserProfile,
  type UserProfile,
  watchAllTransactions,
  watchBeneficiaries,
  watchUserTransactions,
} from '../lib/firebase/data';

type DashboardSection = 'overview' | 'deposits' | 'withdrawals' | 'profile' | 'admin';

const currencyFormatter = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('es-EC', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatDate(value: Date | null) {
  if (!value) return 'Ahora';
  return dateFormatter.format(value);
}

function getStatusLabel(status: TransactionStatus) {
  switch (status) {
    case 'approved':
      return { label: 'Aprobado', className: 'bg-green-100 text-green-700' };
    case 'paid':
      return { label: 'Pagado', className: 'bg-sky-100 text-sky-700' };
    case 'rejected':
      return { label: 'Rechazado', className: 'bg-red-100 text-red-700' };
    default:
      return { label: 'Pendiente', className: 'bg-amber-100 text-amber-700' };
  }
}

function getRoleLabel(profile: UserProfile) {
  return profile.role === 'admin' ? 'Administrador' : 'Beneficiario';
}

function getVisibleBalance(items: TransactionRecord[]) {
  return items.reduce((total, item) => {
    if (item.type === 'deposit' && item.status === 'approved') return total + item.amount;
    if (item.type === 'withdrawal' && item.status === 'paid') return total - item.amount;
    if (item.type === 'earning' && item.status === 'approved') return total + item.amount;
    return total;
  }, 0);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getFirebaseErrorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    if (error.code === 'storage/unauthorized') return 'No tienes permisos para subir archivos a Storage.';
    if (error.code === 'permission-denied' || error.code === 'firestore/permission-denied') return 'No tienes permisos para completar esta accion.';
    if (error.code === 'storage/canceled') return 'La carga del archivo fue cancelada.';
    if (error.code === 'storage/invalid-format') return 'El archivo no tiene un formato valido.';
    return error.message;
  }

  if (error instanceof Error) return error.message;
  return 'Ocurrio un error inesperado.';
}

export function initDashboardPage() {
  const body = document.body;
  const overlay = document.querySelector<HTMLElement>('#dashxOverlay');
  const sidebar = document.querySelector<HTMLElement>('#dashxSidebar');
  const sidebarToggle = document.querySelector<HTMLElement>('#sidebarToggle');
  const mobileMenuBtn = document.querySelector<HTMLElement>('#mobileMenuBtn');
  const userButton = document.querySelector<HTMLElement>('#userButton');
  const userDropdown = document.querySelector<HTMLElement>('#userDropdown');
  const toastContainer = document.querySelector<HTMLElement>('#toastContainer');
  const confirmModal = document.querySelector<HTMLElement>('#confirmModal');
  const modalTitle = document.querySelector<HTMLElement>('#modalTitle');
  const modalMessage = document.querySelector<HTMLElement>('#modalMessage');
  const modalClose = document.querySelector<HTMLElement>('#modalClose');
  const modalCancel = document.querySelector<HTMLElement>('#modalCancel');
  const modalConfirm = document.querySelector<HTMLElement>('#modalConfirm');
  const dashboardTitle = document.querySelector<HTMLElement>('#dashboardTitle');
  const investorNav = document.querySelector<HTMLElement>('#investorNav');
  const adminNav = document.querySelector<HTMLElement>('#adminNav');
  const roleBadge = document.querySelector<HTMLElement>('#roleBadge');
  const userName = document.querySelector<HTMLElement>('#userName');
  const userEmail = document.querySelector<HTMLElement>('#userEmail');
  const sidebarUserName = document.querySelector<HTMLElement>('#sidebarUserName');
  const sidebarUserRole = document.querySelector<HTMLElement>('#sidebarUserRole');
  const profileShortcut = document.querySelector<HTMLElement>('#profileShortcut');
  const goProfile = document.querySelector<HTMLElement>('#goProfile');
  const logoutButton = document.querySelector<HTMLElement>('#logoutButton');
  const dropdownLogoutButton = document.querySelector<HTMLElement>('#dropdownLogoutButton');
  const filterType = document.querySelector<HTMLSelectElement>('#filterType');
  const filterStatus = document.querySelector<HTMLSelectElement>('#filterStatus');
  const adminStatusFilter = document.querySelector<HTMLSelectElement>('#adminStatusFilter');
  const depositForm = document.querySelector<HTMLFormElement>('#depositForm');
  const withdrawForm = document.querySelector<HTMLFormElement>('#withdrawForm');
  const profileForm = document.querySelector<HTMLFormElement>('#profileForm');
  const transactionsTableBody = document.querySelector<HTMLElement>('#transactionsTableBody');
  const transactionsSummary = document.querySelector<HTMLElement>('#transactionsSummary');
  const adminTransactionsBody = document.querySelector<HTMLElement>('#adminTransactionsBody');
  const beneficiariesTableBody = document.querySelector<HTMLElement>('#beneficiariesTableBody');
  const depositFileInput = document.querySelector<HTMLInputElement>('#depositFile');
  const depositFileName = document.querySelector<HTMLElement>('#depositFileName');
  const depositPreview = document.querySelector<HTMLElement>('#depositPreview');
  const depositPreviewImg = document.querySelector<HTMLImageElement>('#depositPreviewImg');
  const depositPreviewDoc = document.querySelector<HTMLElement>('#depositPreviewDoc');
  const depositRemoveImg = document.querySelector<HTMLElement>('#depositRemoveImg');
  const currentBalance = document.querySelector<HTMLElement>('#currentBalance');
  const totalEarnings = document.querySelector<HTMLElement>('#totalEarnings');
  const pendingDeposits = document.querySelector<HTMLElement>('#pendingDeposits');
  const pendingWithdrawals = document.querySelector<HTMLElement>('#pendingWithdrawals');
  const pendingDepositsHint = document.querySelector<HTMLElement>('#pendingDepositsHint');
  const pendingWithdrawalsHint = document.querySelector<HTMLElement>('#pendingWithdrawalsHint');
  const adminDepositsTotal = document.querySelector<HTMLElement>('#adminDepositsTotal');
  const adminWithdrawalsTotal = document.querySelector<HTMLElement>('#adminWithdrawalsTotal');
  const adminActiveUsers = document.querySelector<HTMLElement>('#adminActiveUsers');
  const pageButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-page-number]'));
  const pageActions = Array.from(document.querySelectorAll<HTMLElement>('[data-page-action]'));
  const investorLinks = Array.from(document.querySelectorAll<HTMLElement>('#investorNav [data-target]'));
  const adminTabButtons = Array.from(document.querySelectorAll<HTMLElement>('#adminNav [data-admin-tab]'));
  const dashboardSections = Array.from(document.querySelectorAll<HTMLElement>('.dashboard-section'));
  const adminTabSections = Array.from(document.querySelectorAll<HTMLElement>('.admin-tab-content'));
  const currentBalanceHint = document.querySelector<HTMLElement>('#currentBalanceHint');

  let modalResolver: ((value: boolean) => void) | null = null;
  let unsubscribeTransactions: (() => void) | null = null;
  let unsubscribeBeneficiaries: (() => void) | null = null;
  let currentProfile: UserProfile | null = null;
  let currentTransactions: TransactionRecord[] = [];
  let currentBeneficiaries: UserProfile[] = [];
  let currentPage = 1;
  let performanceChart: Chart | null = null;
  let adminChart: Chart | null = null;
  const itemsPerPage = 5;

  const showToast = (message: string, tone: 'info' | 'success' | 'error' = 'info') => {
    if (!toastContainer) return;
    const icon = tone === 'success' ? 'check-circle text-green-500' : tone === 'error' ? 'x-circle text-red-500' : 'info-circle text-green-700';
    const toast = document.createElement('div');
    toast.className = 'px-4 py-3 rounded-xl bg-white shadow-xl flex items-center gap-2 border border-green-100';
    toast.innerHTML = `<i class="bi bi-${icon}"></i><span class="text-green-900 text-sm">${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3200);
  };

  const openConfirm = (title: string, message: string) => {
    if (!confirmModal || !modalTitle || !modalMessage) return Promise.resolve(false);
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    confirmModal.classList.remove('hidden');
    confirmModal.classList.add('flex');
    return new Promise<boolean>((resolve) => {
      modalResolver = resolve;
    });
  };

  const closeConfirm = (result: boolean) => {
    if (!confirmModal) return;
    confirmModal.classList.add('hidden');
    confirmModal.classList.remove('flex');
    if (modalResolver) {
      modalResolver(result);
      modalResolver = null;
    }
  };

  const closeSidebar = () => {
    body.classList.remove('sidebar-open');
    overlay?.classList.add('hidden');
    overlay?.classList.remove('flex');
  };

  const toggleSidebar = () => {
    body.classList.toggle('sidebar-open');
    overlay?.classList.toggle('hidden');
    overlay?.classList.toggle('flex');
  };

  const setActiveInvestorNav = (section: Exclude<DashboardSection, 'admin'>) => {
    investorLinks.forEach((link) => {
      const isActive = link.dataset.target === section;
      link.classList.toggle('active', isActive);
    });
  };

  const setActiveAdminTab = (tab: 'transactions' | 'graphics' | 'beneficiaries') => {
    adminTabButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.adminTab === tab);
    });

    adminTabSections.forEach((section) => section.classList.add('hidden'));
    document.querySelector<HTMLElement>(`#admin${tab.charAt(0).toUpperCase()}${tab.slice(1)}`)?.classList.remove('hidden');
    if (dashboardTitle) {
      const label = tab === 'transactions' ? 'Admin - Transacciones' : tab === 'graphics' ? 'Admin - Graficos' : 'Admin - Beneficiarios';
      dashboardTitle.textContent = label;
    }
  };

  const showSection = (section: DashboardSection) => {
    dashboardSections.forEach((item) => item.classList.add('hidden'));

    if (section === 'admin') {
      document.querySelector<HTMLElement>('#adminPanel')?.classList.remove('hidden');
      setActiveAdminTab('transactions');
      return;
    }

    document.querySelector<HTMLElement>(`#${section}`)?.classList.remove('hidden');
    setActiveInvestorNav(section);

    if (dashboardTitle) {
      dashboardTitle.textContent = section === 'overview' ? 'Resumen' : section === 'deposits' ? 'Nuevo deposito' : section === 'withdrawals' ? 'Nuevo retiro' : 'Mi perfil';
    }
  };

  const setPageButtons = (pageCount: number) => {
    pageButtons.forEach((button, index) => {
      const page = index + 1;
      const visible = page <= Math.max(pageCount, 1);
      button.classList.toggle('hidden', !visible);
      if (!visible) return;
      button.dataset.pageNumber = String(page);
      button.textContent = String(page);
      button.classList.toggle('bg-green-700', page === currentPage);
      button.classList.toggle('text-white', page === currentPage);
      button.classList.toggle('bg-green-50', page !== currentPage);
      button.classList.toggle('text-green-600', page !== currentPage);
    });
  };

  const renderPerformanceChart = (items: TransactionRecord[]) => {
    const canvas = document.querySelector<HTMLCanvasElement>('#performanceChart');
    if (!canvas) return;

    const ordered = [...items]
      .filter((item) => item.status === 'approved' || item.status === 'paid')
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));

    let rollingBalance = 0;
    const labels: string[] = [];
    const values: number[] = [];
    const pointColors: string[] = [];

    ordered.forEach((item) => {
      if (item.type === 'deposit' || item.type === 'earning') rollingBalance += item.amount;
      if (item.type === 'withdrawal') rollingBalance -= item.amount;
      labels.push(formatDate(item.createdAt));
      values.push(rollingBalance);
      pointColors.push(item.type === 'withdrawal' ? '#dc2626' : '#22c55e');
    });

    if (!labels.length) {
      labels.push('Sin datos');
      values.push(0);
      pointColors.push('#94a3b8');
    }

    performanceChart?.destroy();
    performanceChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Saldo',
          data: values,
          borderColor: '#4b8b5f',
          backgroundColor: 'rgba(75, 139, 95, 0.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: pointColors,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    });
  };

  const renderAdminChart = (items: TransactionRecord[]) => {
    const canvas = document.querySelector<HTMLCanvasElement>('#adminChart');
    if (!canvas) return;

    const grouped = new Map<string, { deposits: number; withdrawals: number }>();

    items.forEach((item) => {
      const date = item.createdAt ?? new Date();
      const label = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      const bucket = grouped.get(label) ?? { deposits: 0, withdrawals: 0 };
      if (item.type === 'deposit' && item.status === 'approved') bucket.deposits += item.amount;
      if (item.type === 'withdrawal' && item.status === 'paid') bucket.withdrawals += item.amount;
      grouped.set(label, bucket);
    });

    const labels = Array.from(grouped.keys());
    const deposits = labels.map((label) => grouped.get(label)?.deposits ?? 0);
    const withdrawals = labels.map((label) => grouped.get(label)?.withdrawals ?? 0);

    adminChart?.destroy();
    adminChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['Sin datos'],
        datasets: [
          {
            label: 'Depositos aprobados',
            data: labels.length ? deposits : [0],
            backgroundColor: '#22c55e',
            borderRadius: 8,
          },
          {
            label: 'Retiros pagados',
            data: labels.length ? withdrawals : [0],
            backgroundColor: '#0f766e',
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  };

  const renderInvestorTransactions = () => {
    if (!transactionsTableBody || !transactionsSummary) return;

    const filteredItems = currentTransactions.filter((item) => {
      const matchesType = !filterType?.value || item.type === filterType.value;
      const matchesStatus = !filterStatus?.value || item.status === filterStatus.value;
      return matchesType && matchesStatus;
    });

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
    currentPage = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginated = filteredItems.slice(start, end);

    let rollingBalance = 0;
    const balanceMap = new Map<string, number>();
    [...currentTransactions]
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
      .forEach((item) => {
        if (item.type === 'deposit' && item.status === 'approved') rollingBalance += item.amount;
        if (item.type === 'earning' && item.status === 'approved') rollingBalance += item.amount;
        if (item.type === 'withdrawal' && item.status === 'paid') rollingBalance -= item.amount;
        balanceMap.set(item.id, rollingBalance);
      });

    transactionsTableBody.innerHTML = paginated.length
      ? paginated.map((item) => {
        const status = getStatusLabel(item.status);
        const signedAmount = item.type === 'withdrawal' ? -item.amount : item.amount;
        return `
          <tr class="border-t border-green-100 h-12">
            <td class="py-2 text-sm">${escapeHtml(formatDate(item.createdAt))}</td>
            <td class="py-2 text-sm text-green-700">${escapeHtml(item.reference || '-') }</td>
            <td class="py-2"><span class="px-1.5 py-0.5 rounded ${status.className} text-xs font-medium">${status.label}</span></td>
            <td class="py-2 text-right ${signedAmount >= 0 ? 'text-green-600' : 'text-red-600'} font-semibold text-sm">${escapeHtml(formatCurrency(Math.abs(signedAmount)).replace('$', signedAmount >= 0 ? '+$' : '-$'))}</td>
            <td class="py-2 text-right text-green-700 font-medium text-sm">${escapeHtml(formatCurrency(balanceMap.get(item.id) ?? 0))}</td>
            <td class="py-2 text-right text-sm">${item.proofUrl ? `<a href="${escapeHtml(item.proofUrl)}" class="text-green-700 font-semibold" target="_blank" rel="noreferrer">Ver</a>` : '<span class="text-gray-400">-</span>'}</td>
          </tr>
        `;
      }).join('')
      : '<tr><td colspan="6" class="py-6 text-center text-sm text-green-600">Todavia no hay movimientos para este filtro.</td></tr>';

    const initial = filteredItems.length ? start + 1 : 0;
    const final = Math.min(end, filteredItems.length);
    transactionsSummary.textContent = `Mostrando ${initial}-${final} de ${filteredItems.length}`;
    setPageButtons(totalPages);
    renderPerformanceChart(currentTransactions);
  };

  const renderInvestorSummary = () => {
    const approvedDeposits = currentTransactions.filter((item) => item.type === 'deposit' && item.status === 'approved');
    const paidWithdrawals = currentTransactions.filter((item) => item.type === 'withdrawal' && item.status === 'paid');
    const pendingDepositItems = currentTransactions.filter((item) => item.type === 'deposit' && item.status === 'pending');
    const pendingWithdrawalItems = currentTransactions.filter((item) => item.type === 'withdrawal' && item.status === 'pending');
    const earnings = currentTransactions.filter((item) => item.type === 'earning' && item.status === 'approved');

    if (currentBalance) currentBalance.textContent = formatCurrency(getVisibleBalance(currentTransactions));
    if (currentBalanceHint) currentBalanceHint.textContent = `${approvedDeposits.length} depositos aprobados y ${paidWithdrawals.length} retiros pagados.`;
    if (totalEarnings) totalEarnings.textContent = formatCurrency(earnings.reduce((sum, item) => sum + item.amount, 0));
    if (pendingDeposits) pendingDeposits.textContent = formatCurrency(pendingDepositItems.reduce((sum, item) => sum + item.amount, 0));
    if (pendingWithdrawals) pendingWithdrawals.textContent = formatCurrency(pendingWithdrawalItems.reduce((sum, item) => sum + item.amount, 0));
    if (pendingDepositsHint) pendingDepositsHint.textContent = `${pendingDepositItems.length} solicitudes`;
    if (pendingWithdrawalsHint) pendingWithdrawalsHint.textContent = `${pendingWithdrawalItems.length} solicitudes`;
  };

  const renderAdminTransactions = () => {
    if (!adminTransactionsBody) return;
    const filtered = currentTransactions.filter((item) => !adminStatusFilter?.value || item.status === adminStatusFilter.value);

    adminTransactionsBody.innerHTML = filtered.length
      ? filtered.map((item) => {
        const status = getStatusLabel(item.status);
        const typeLabel = item.type === 'deposit' ? 'Deposito' : item.type === 'withdrawal' ? 'Retiro' : 'Ganancia';
        const amountClass = item.type === 'withdrawal' ? 'text-red-600' : 'text-green-600';
        const actions: string[] = [];
        if (item.type === 'deposit' && item.status === 'pending') {
          actions.push(`<button type="button" class="px-2 py-1 rounded bg-green-500 text-white text-xs hover:bg-green-600" data-action="approve" data-id="${item.id}"><i class="bi bi-check"></i></button>`);
          actions.push(`<button type="button" class="px-2 py-1 rounded bg-red-500 text-white text-xs hover:bg-red-600" data-action="reject" data-id="${item.id}"><i class="bi bi-x"></i></button>`);
        }
        if (item.type === 'withdrawal' && item.status === 'pending') {
          actions.push(`<button type="button" class="px-2 py-1 rounded bg-sky-600 text-white text-xs hover:bg-sky-700" data-action="pay" data-id="${item.id}"><i class="bi bi-cash"></i></button>`);
          actions.push(`<button type="button" class="px-2 py-1 rounded bg-red-500 text-white text-xs hover:bg-red-600" data-action="reject" data-id="${item.id}"><i class="bi bi-x"></i></button>`);
        }
        return `
          <tr class="border-b border-gray-100 h-12">
            <td class="py-2 text-sm">${escapeHtml(formatDate(item.createdAt))}</td>
            <td class="py-2 text-sm">${escapeHtml(item.userName)}</td>
            <td class="py-2 text-sm text-gray-700">${escapeHtml(item.reference || '-')}</td>
            <td class="py-2"><span class="px-1.5 py-0.5 rounded ${status.className} text-xs font-medium">${status.label}</span></td>
            <td class="py-2 text-right ${amountClass} font-semibold text-sm">${escapeHtml(formatCurrency(item.amount))}</td>
            <td class="py-2 text-sm text-gray-600">${typeLabel}</td>
            <td class="py-2 text-center">${item.proofUrl ? `<a href="${escapeHtml(item.proofUrl)}" class="text-green-700 text-sm font-semibold" target="_blank" rel="noreferrer">Abrir</a>` : '<span class="text-gray-400">-</span>'}</td>
            <td class="py-2"><div class="flex justify-end gap-1">${actions.join('') || '<span class="text-gray-400 text-xs">Sin accion</span>'}</div></td>
          </tr>
        `;
      }).join('')
      : '<tr><td colspan="8" class="py-6 text-center text-sm text-gray-500">No hay transacciones para el filtro actual.</td></tr>';
  };

  const renderBeneficiaries = () => {
    if (!beneficiariesTableBody) return;
    beneficiariesTableBody.innerHTML = currentBeneficiaries.length
      ? currentBeneficiaries.map((item) => {
        const isActive = (item.status || 'active') === 'active';
        return `
          <tr class="border-b border-gray-100 h-12">
            <td class="py-2 text-sm">${escapeHtml(item.name)}</td>
            <td class="py-2 text-sm">${escapeHtml(item.cedula || '-')}</td>
            <td class="py-2 text-sm">${escapeHtml(item.bankName || '-')}</td>
            <td class="py-2 text-sm">${escapeHtml(item.accountNumber || '-')}</td>
            <td class="py-2 text-sm">${escapeHtml(item.phone || '-')}</td>
            <td class="py-2"><span class="px-1.5 py-0.5 rounded ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} text-xs font-medium">${isActive ? 'Activo' : 'Inactivo'}</span></td>
          </tr>
        `;
      }).join('')
      : '<tr><td colspan="6" class="py-6 text-center text-sm text-gray-500">No hay beneficiarios registrados.</td></tr>';
  };

  const renderAdminMetrics = () => {
    const approvedDeposits = currentTransactions.filter((item) => item.type === 'deposit' && item.status === 'approved');
    const paidWithdrawals = currentTransactions.filter((item) => item.type === 'withdrawal' && item.status === 'paid');

    if (adminDepositsTotal) adminDepositsTotal.textContent = formatCurrency(approvedDeposits.reduce((sum, item) => sum + item.amount, 0));
    if (adminWithdrawalsTotal) adminWithdrawalsTotal.textContent = formatCurrency(paidWithdrawals.reduce((sum, item) => sum + item.amount, 0));
    if (adminActiveUsers) adminActiveUsers.textContent = String(currentBeneficiaries.filter((item) => (item.status || 'active') === 'active').length);
    renderAdminChart(currentTransactions);
  };

  const fillProfileForm = (profile: UserProfile) => {
    if (!profileForm) return;
    const setValue = (name: string, value: string) => {
      const field = profileForm.elements.namedItem(name);
      if (field instanceof HTMLInputElement) field.value = value;
    };

    setValue('name', profile.name);
    setValue('email', profile.email);
    setValue('phone', profile.phone || '');
    setValue('cedula', profile.cedula || '');
    setValue('bankName', profile.bankName || '');
    setValue('accountNumber', profile.accountNumber || '');
    setValue('status', profile.status || 'active');
    setValue('uid', profile.uid);
  };

  const syncProfileUi = (profile: UserProfile) => {
    currentProfile = profile;
    if (userName) userName.textContent = profile.name;
    if (userEmail) userEmail.textContent = profile.email;
    if (sidebarUserName) sidebarUserName.textContent = profile.name;
    if (sidebarUserRole) sidebarUserRole.textContent = getRoleLabel(profile);
    if (roleBadge) roleBadge.textContent = getRoleLabel(profile);
    fillProfileForm(profile);

    if (profile.role === 'admin') {
      sidebar?.classList.remove('from-green-950', 'to-green-900');
      sidebar?.classList.add('from-gray-900', 'to-gray-950');
      adminNav?.classList.remove('hidden');
      investorNav?.classList.add('hidden');
      showSection('admin');
    } else {
      sidebar?.classList.remove('from-gray-900', 'to-gray-950');
      sidebar?.classList.add('from-green-950', 'to-green-900');
      investorNav?.classList.remove('hidden');
      adminNav?.classList.add('hidden');
      showSection('overview');
    }
  };

  const attachTransactionsListener = (profile: UserProfile) => {
    unsubscribeTransactions?.();
    unsubscribeTransactions = profile.role === 'admin'
      ? watchAllTransactions((items) => {
          currentTransactions = items;
          renderAdminTransactions();
          renderAdminMetrics();
        })
      : watchUserTransactions(profile.uid, (items) => {
          currentTransactions = items;
          renderInvestorSummary();
          renderInvestorTransactions();
        });
  };

  const attachBeneficiariesListener = (profile: UserProfile) => {
    unsubscribeBeneficiaries?.();
    if (profile.role !== 'admin') return;
    unsubscribeBeneficiaries = watchBeneficiaries((items) => {
      currentBeneficiaries = items;
      renderBeneficiaries();
      renderAdminMetrics();
    });
  };

  depositFileInput?.addEventListener('change', () => {
    const file = depositFileInput.files?.[0];
    if (!file || !depositFileName || !depositPreview || !depositPreviewImg || !depositPreviewDoc) return;
    depositFileName.textContent = file.name;
    depositPreview.classList.remove('hidden');
    depositPreviewImg.classList.add('hidden');
    depositPreviewDoc.classList.add('hidden');
    depositPreviewImg.src = '';
    depositPreviewDoc.textContent = '';
    depositRemoveImg?.classList.remove('hidden');
    depositRemoveImg?.classList.add('flex');

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        depositPreviewImg.src = String(reader.result ?? '');
        depositPreviewImg.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
      return;
    }

    depositPreviewDoc.textContent = file.name;
    depositPreviewDoc.classList.remove('hidden');
  });

  depositRemoveImg?.addEventListener('click', () => {
    if (depositFileInput) depositFileInput.value = '';
    if (depositFileName) depositFileName.textContent = 'Subir imagen o PDF';
    depositPreview?.classList.add('hidden');
    depositRemoveImg.classList.add('hidden');
    depositRemoveImg.classList.remove('flex');
    depositPreviewImg?.classList.add('hidden');
    if (depositPreviewImg) depositPreviewImg.src = '';
    depositPreviewDoc?.classList.add('hidden');
    if (depositPreviewDoc) depositPreviewDoc.textContent = '';
  });

  depositForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentProfile) return;
    const formData = new FormData(depositForm);
    const amount = Number(formData.get('amount') ?? 0);
    const reference = String(formData.get('reference') ?? '').trim();
    const file = depositFileInput?.files?.[0];
    const submitButton = depositForm.querySelector<HTMLButtonElement>('button[type="submit"]');

    if (!amount || !reference || !file) {
      showToast('Completa monto, referencia y comprobante.', 'error');
      return;
    }

    const confirmed = await openConfirm('Confirmar deposito', 'Se cargara el soporte en Firebase Storage y la solicitud ira a Firestore.');
    if (!confirmed) return;

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Enviando...';
    }

    try {
      await createDepositTransaction({
        profile: currentProfile,
        amount,
        reference,
        file,
      });
      depositForm.reset();
      depositRemoveImg?.dispatchEvent(new Event('click'));
      showToast('Deposito enviado correctamente.', 'success');
      showSection('overview');
    } catch (error) {
      showToast(getFirebaseErrorMessage(error), 'error');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar deposito';
      }
    }
  });

  withdrawForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentProfile) return;
    const formData = new FormData(withdrawForm);
    const amount = Number(formData.get('amount') ?? 0);
    const bankName = String(formData.get('bank') ?? '').trim();
    const accountNumber = String(formData.get('account') ?? '').trim();
    const cedula = String(formData.get('cedula') ?? '').trim();
    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim();
    const submitButton = withdrawForm.querySelector<HTMLButtonElement>('button[type="submit"]');

    if (!amount || !bankName || !accountNumber || !cedula || !name || !email || !phone) {
      showToast('Completa todos los datos del retiro.', 'error');
      return;
    }

    const reference = `${bankName} - ${accountNumber}`;
    const confirmed = await openConfirm('Confirmar retiro', 'Se registrara la solicitud en Firestore para revision administrativa.');
    if (!confirmed) return;

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Enviando...';
    }

    try {
      await createWithdrawalTransaction({
        profile: {
          ...currentProfile,
          name,
          email,
        },
        amount,
        bankName,
        accountNumber,
        cedula,
        phone,
        reference,
      });

      await updateUserProfile(currentProfile.uid, {
        ...currentProfile,
        name,
        email,
        bankName,
        accountNumber,
        cedula,
        phone,
      });

      withdrawForm.reset();
      showToast('Retiro solicitado correctamente.', 'success');
      showSection('overview');
    } catch (error) {
      showToast(getFirebaseErrorMessage(error), 'error');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Solicitar retiro';
      }
    }
  });

  profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentProfile) return;
    const formData = new FormData(profileForm);
    const payload = {
      name: String(formData.get('name') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim(),
      cedula: String(formData.get('cedula') ?? '').trim(),
      bankName: String(formData.get('bankName') ?? '').trim(),
      accountNumber: String(formData.get('accountNumber') ?? '').trim(),
    };

    try {
      await updateUserProfile(currentProfile.uid, payload);
      syncProfileUi({ ...currentProfile, ...payload });
      showToast('Perfil actualizado correctamente.', 'success');
    } catch (error) {
      showToast(getFirebaseErrorMessage(error), 'error');
    }
  });

  adminTransactionsBody?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest<HTMLElement>('[data-action][data-id]');
    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;
    if (!id || !action) return;

    const status: TransactionStatus = action === 'approve' ? 'approved' : action === 'pay' ? 'paid' : 'rejected';
    const message = action === 'approve'
      ? 'Esta accion aprobara el deposito.'
      : action === 'pay'
        ? 'Esta accion marcara el retiro como pagado.'
        : 'Esta accion rechazara la solicitud.';

    const confirmed = await openConfirm('Actualizar transaccion', message);
    if (!confirmed) return;

    try {
      await updateTransactionStatus(id, status);
      showToast('Transaccion actualizada.', 'success');
    } catch (error) {
      showToast(getFirebaseErrorMessage(error), 'error');
    }
  });

  pageButtons.forEach((button) => {
    button.addEventListener('click', () => {
      currentPage = Number(button.dataset.pageNumber ?? '1');
      renderInvestorTransactions();
    });
  });

  pageActions.forEach((button) => {
    button.addEventListener('click', () => {
      const filteredCount = currentTransactions.filter((item) => {
        const matchesType = !filterType?.value || item.type === filterType.value;
        const matchesStatus = !filterStatus?.value || item.status === filterStatus.value;
        return matchesType && matchesStatus;
      }).length;
      const maxPage = Math.max(1, Math.ceil(filteredCount / itemsPerPage));
      currentPage = button.dataset.pageAction === 'prev' ? Math.max(1, currentPage - 1) : Math.min(maxPage, currentPage + 1);
      renderInvestorTransactions();
    });
  });

  filterType?.addEventListener('change', () => {
    currentPage = 1;
    renderInvestorTransactions();
  });

  filterStatus?.addEventListener('change', () => {
    currentPage = 1;
    renderInvestorTransactions();
  });

  adminStatusFilter?.addEventListener('change', renderAdminTransactions);

  investorLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const target = (link.dataset.target as DashboardSection | undefined) ?? 'overview';
      showSection(target);
      closeSidebar();
    });
  });

  adminTabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.adminTab as 'transactions' | 'graphics' | 'beneficiaries';
      setActiveAdminTab(tab);
      closeSidebar();
    });
  });

  const goToProfile = () => {
    userDropdown?.classList.add('hidden');
    if (currentProfile?.role === 'admin') {
      dashboardSections.forEach((item) => item.classList.add('hidden'));
      document.querySelector<HTMLElement>('#profile')?.classList.remove('hidden');
      if (dashboardTitle) dashboardTitle.textContent = 'Mi perfil';
      return;
    }
    showSection('profile');
  };

  profileShortcut?.addEventListener('click', goToProfile);
  goProfile?.addEventListener('click', goToProfile);

  const logout = async (event?: Event) => {
    event?.preventDefault();
    event?.stopPropagation();
    userDropdown?.classList.add('hidden');
    closeSidebar();

    try {
      await signOut(auth);
    } catch (error) {
      showToast(getFirebaseErrorMessage(error), 'error');
      return;
    }

    window.location.replace('/login');
  };

  logoutButton?.addEventListener('click', logout);
  dropdownLogoutButton?.addEventListener('click', logout);

  userButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    userDropdown?.classList.toggle('hidden');
  });

  document.addEventListener('click', () => userDropdown?.classList.add('hidden'));
  sidebarToggle?.addEventListener('click', toggleSidebar);
  mobileMenuBtn?.addEventListener('click', toggleSidebar);
  overlay?.addEventListener('click', closeSidebar);
  modalClose?.addEventListener('click', () => closeConfirm(false));
  modalCancel?.addEventListener('click', () => closeConfirm(false));
  modalConfirm?.addEventListener('click', () => closeConfirm(true));
  confirmModal?.addEventListener('click', (event) => {
    if (event.target === confirmModal) closeConfirm(false);
  });

  onAuthStateChanged(auth, async (user) => {
    unsubscribeTransactions?.();
    unsubscribeBeneficiaries?.();

    if (!user) {
      window.location.replace('/login');
      return;
    }

    try {
      const profile = await ensureUserProfile(user);
      syncProfileUi(profile);
      attachTransactionsListener(profile);
      attachBeneficiariesListener(profile);
    } catch (error) {
      showToast(getFirebaseErrorMessage(error), 'error');
      window.setTimeout(() => {
        window.location.replace('/login');
      }, 1200);
    }
  });
}
