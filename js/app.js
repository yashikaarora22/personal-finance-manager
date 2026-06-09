/**
 * FinFlow - Personal Finance & Budget Tracker
 * Core JavaScript Logic
 */

// --- UTILITIES & STORAGE ---
class StorageManager {
  static KEY = 'finflow_tx_data';

  static getTransactions() {
    const data = localStorage.getItem(this.KEY);
    return data ? JSON.parse(data) : [];
  }

  static saveTransactions(transactions) {
    localStorage.setItem(this.KEY, JSON.stringify(transactions));
  }

  static exportPDF(transactions) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("PDF library is still loading. Please try again in a moment.");
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42); // Dark slate
    doc.text('FinFlow - Transaction History', 14, 22);
    
    // Subtitle / Date
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139); // Slate gray
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

    // Summary calculations
    let totalIncome = 0;
    let totalExpense = 0;
    transactions.forEach(tx => {
      if (tx.type === 'income') totalIncome += tx.amount;
      else if (tx.type === 'expense') totalExpense += tx.amount;
    });
    const netBalance = totalIncome - totalExpense;

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`Total Income: Rs. ${totalIncome.toFixed(2)}`, 14, 40);
    doc.text(`Total Expense: Rs. ${totalExpense.toFixed(2)}`, 80, 40);
    doc.text(`Net Balance: Rs. ${netBalance.toFixed(2)}`, 150, 40);

    // Table data
    const tableColumn = ["Date", "Description", "Category", "Type", "Amount (Rs.)"];
    const tableRows = [];

    // Sort transactions by date (newest first)
    const sortedTx = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedTx.forEach(tx => {
      const txData = [
        new Date(tx.date).toLocaleDateString(),
        tx.description,
        tx.category,
        tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
        (tx.type === 'income' ? '+' : '-') + tx.amount.toFixed(2)
      ];
      tableRows.push(txData);
    });

    // Generate table
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 50,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }, // matches var(--primary)
      styles: { fontSize: 10, textColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`finflow_transactions_${new Date().toISOString().split('T')[0]}.pdf`);
  }
}

// --- BUSINESS LOGIC ---
class FinanceManager {
  constructor() {
    this.transactions = StorageManager.getTransactions();
    this.colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
  }

  addTransaction(tx) {
    this.transactions.push(tx);
    StorageManager.saveTransactions(this.transactions);
  }

  deleteTransaction(id) {
    this.transactions = this.transactions.filter(tx => tx.id !== id);
    StorageManager.saveTransactions(this.transactions);
  }

  editTransaction(id, updatedData) {
    this.transactions = this.transactions.map(tx => {
      if (tx.id === id) {
        return { ...tx, ...updatedData };
      }
      return tx;
    });
    StorageManager.saveTransactions(this.transactions);
  }

  getTotals() {
    let income = 0;
    let expense = 0;

    this.transactions.forEach(tx => {
      if (tx.type === 'income') income += tx.amount;
      else if (tx.type === 'expense') expense += tx.amount;
    });

    const balance = income - expense;
    let rate = 0;
    if (income > 0) {
      rate = ((balance / income) * 100).toFixed(1);
    }

    return { income, expense, balance, rate: parseFloat(rate) };
  }

  getCategoryBreakdown() {
    const expenses = this.transactions.filter(tx => tx.type === 'expense');
    
    // Using reduce to group by category
    const breakdown = expenses.reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
      return acc;
    }, {});

    const totalExpense = expenses.reduce((sum, tx) => sum + tx.amount, 0);

    return Object.entries(breakdown).map(([category, amount], index) => {
      const percentage = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
      return {
        category,
        amount,
        percentage: percentage.toFixed(1),
        color: this.colors[index % this.colors.length]
      };
    }).sort((a, b) => b.amount - a.amount);
  }
}

class SalaryCalculator {
  static calculate(ctc, pfPercent, taxRegime, bonus) {
    const ctcNum = Number(ctc);
    const pfNum = Number(pfPercent);
    const bonusNum = Number(bonus);

    if (isNaN(ctcNum) || ctcNum <= 0) return null;

    const baseSalary = ctcNum - bonusNum;
    const monthlyGross = baseSalary / 12;
    
    // PF Calculation
    const pfMonthly = (monthlyGross * pfNum) / 100;
    
    // Simplistic Tax Calculation for demonstration
    let annualTax = 0;
    let taxable = baseSalary - (pfMonthly * 12);
    
    if (taxRegime === 'new') {
      if (taxable > 700000) {
        annualTax = taxable * 0.1; // flat 10% demo
      }
    } else {
      taxable = taxable - 50000; // standard deduction
      if (taxable > 500000) {
        annualTax = taxable * 0.2; // flat 20% demo
      }
    }

    const monthlyTax = annualTax / 12;
    const monthlyNet = monthlyGross - pfMonthly - monthlyTax;

    return {
      monthlyGross: monthlyGross.toFixed(2),
      pfMonthly: pfMonthly.toFixed(2),
      monthlyTax: monthlyTax.toFixed(2),
      monthlyNet: monthlyNet.toFixed(2)
    };
  }
}

// --- UI MANAGER ---
class UIManager {
  constructor() {
    this.finance = new FinanceManager();
    this.initSelectors();
    this.initEventListeners();
    this.startClock();
    this.renderDashboard();
    
    // Default to Dashboard
    this.switchView('dashboard');
  }

  initSelectors() {
    // Navigation
    this.navBtns = document.querySelectorAll('.nav-btn');
    this.views = document.querySelectorAll('.view');
    this.exportBtn = document.getElementById('exportBtn');
    
    // Dashboard
    this.liveClock = document.getElementById('liveClock');
    this.statBalance = document.getElementById('statBalance');
    this.statIncome = document.getElementById('statIncome');
    this.statExpense = document.getElementById('statExpense');
    this.statRate = document.getElementById('statRate');
    this.statMonth = document.getElementById('statMonth');
    this.catChart = document.getElementById('catChart');
    this.catLegend = document.getElementById('catLegend');
    this.recentList = document.getElementById('recentList');
    
    // Add Tx Form
    this.typeBtns = document.querySelectorAll('.type-btn');
    this.txDesc = document.getElementById('txDesc');
    this.txAmount = document.getElementById('txAmount');
    this.txCategory = document.getElementById('txCategory');
    this.txDate = document.getElementById('txDate');
    this.txNote = document.getElementById('txNote');
    this.submitBtn = document.getElementById('submitBtn');
    this.resetBtn = document.getElementById('resetBtn');
    this.formMsg = document.getElementById('formMsg');

    // Default Date to today
    this.txDate.valueAsDate = new Date();

    // History
    this.filterCat = document.getElementById('filterCat');
    this.filterType = document.getElementById('filterType');
    this.searchTx = document.getElementById('searchTx');
    this.historyBody = document.getElementById('historyBody');

    // Salary Planner
    this.sCtc = document.getElementById('sCtc');
    this.sPf = document.getElementById('sPf');
    this.sTax = document.getElementById('sTax');
    this.sBonus = document.getElementById('sBonus');
    this.calcSalary = document.getElementById('calcSalary');
    this.salaryResult = document.getElementById('salaryResult');
    this.salaryGrid = document.getElementById('salaryGrid');
    this.savingsTip = document.getElementById('savingsTip');
    
    // Edit Modal
    this.modalOverlay = document.getElementById('modalOverlay');
    this.editId = document.getElementById('editId');
    this.editDesc = document.getElementById('editDesc');
    this.editAmount = document.getElementById('editAmount');
    this.editCat = document.getElementById('editCat');
    this.cancelEdit = document.getElementById('cancelEdit');
    this.saveEdit = document.getElementById('saveEdit');
  }

  initEventListeners() {
    // Navigation
    this.navBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.navBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.switchView(e.currentTarget.dataset.view);
      });
    });

    this.exportBtn.addEventListener('click', () => {
      StorageManager.exportPDF(this.finance.transactions);
    });

    // Form - Type Toggle
    this.typeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.typeBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    // Form - Submit
    this.submitBtn.addEventListener('click', () => this.handleAddTransaction());
    this.resetBtn.addEventListener('click', () => this.clearForm());

    // History Filters
    this.filterCat.addEventListener('change', () => this.renderHistory());
    this.filterType.addEventListener('change', () => this.renderHistory());
    this.searchTx.addEventListener('input', () => this.renderHistory());

    // Edit Modal
    this.cancelEdit.addEventListener('click', () => {
      this.modalOverlay.style.display = 'none';
    });
    this.saveEdit.addEventListener('click', () => this.handleSaveEdit());

    // Salary Calculator
    this.calcSalary.addEventListener('click', () => this.handleSalaryCalc());
  }

  switchView(viewId) {
    this.views.forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');

    if (viewId === 'dashboard') this.renderDashboard();
    if (viewId === 'history') this.renderHistory();
  }

  startClock() {
    const updateTime = () => {
      const now = new Date();
      this.liveClock.innerText = now.toLocaleString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    };
    updateTime();
    setInterval(updateTime, 60000);
  }

  formatCurrency(num) {
    return `₹${Number(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  handleAddTransaction() {
    const type = document.querySelector('.type-btn.active').dataset.type;
    const desc = this.txDesc.value.trim();
    const amount = parseFloat(this.txAmount.value);
    const cat = this.txCategory.value;
    const date = this.txDate.value;
    const note = this.txNote.value.trim();

    if (!desc || isNaN(amount) || amount <= 0 || !cat || !date) {
      this.showFormMsg('Please fill all required fields correctly.', 'error');
      return;
    }

    const tx = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      description: desc,
      amount,
      category: cat,
      date,
      note,
      createdAt: new Date().toISOString()
    };

    this.finance.addTransaction(tx);
    this.showFormMsg('Transaction added successfully!', 'success');
    this.clearForm();
    this.renderDashboard();
  }

  showFormMsg(msg, type) {
    this.formMsg.innerText = msg;
    this.formMsg.style.color = type === 'error' ? 'var(--expense)' : 'var(--income)';
    setTimeout(() => { this.formMsg.innerText = ''; }, 3000);
  }

  clearForm() {
    this.txDesc.value = '';
    this.txAmount.value = '';
    this.txCategory.value = '';
    this.txNote.value = '';
    this.txDate.valueAsDate = new Date();
  }

  renderDashboard() {
    const totals = this.finance.getTotals();
    this.statBalance.innerText = this.formatCurrency(totals.balance);
    this.statIncome.innerText = this.formatCurrency(totals.income);
    this.statExpense.innerText = this.formatCurrency(totals.expense);
    
    this.statRate.innerText = `${totals.rate}%`;
    this.statRate.style.color = totals.rate > 20 ? 'var(--income)' : (totals.rate < 0 ? 'var(--expense)' : 'var(--text-main)');

    const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    this.statMonth.innerText = currentMonth;

    this.renderCategoryChart();
    this.renderRecentTransactions();
  }

  renderCategoryChart() {
    const breakdown = this.finance.getCategoryBreakdown();
    
    this.catChart.innerHTML = '';
    this.catLegend.innerHTML = '';

    if (breakdown.length === 0) {
      this.catChart.innerHTML = `<div class="empty-state">No expense data for charts.</div>`;
      return;
    }

    breakdown.forEach(item => {
      // Bar
      const barWrap = document.createElement('div');
      barWrap.className = 'bar-wrap';
      barWrap.title = `${item.category}: ${this.formatCurrency(item.amount)} (${item.percentage}%)`;
      
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.backgroundColor = item.color;
      // timeout for animation
      setTimeout(() => {
        bar.style.height = `${item.percentage}%`;
      }, 50);

      barWrap.appendChild(bar);
      this.catChart.appendChild(barWrap);

      // Legend
      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      legendItem.innerHTML = `
        <div class="legend-color" style="background-color: ${item.color}"></div>
        <span>${item.category} (${item.percentage}%)</span>
      `;
      this.catLegend.appendChild(legendItem);
    });
  }

  renderRecentTransactions() {
    const sorted = [...this.finance.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = sorted.slice(0, 5);

    if (recent.length === 0) {
      this.recentList.innerHTML = `<div class="empty-state">No transactions yet.<br/>Add your first one!</div>`;
      return;
    }

    this.recentList.innerHTML = '';
    recent.forEach(tx => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.padding = '12px 0';
      item.style.borderBottom = '1px solid var(--border)';
      
      const isIncome = tx.type === 'income';
      const sign = isIncome ? '+' : '-';
      const color = isIncome ? 'var(--income)' : 'var(--expense)';

      item.innerHTML = `
        <div>
          <div style="font-weight: 500">${tx.description}</div>
          <div style="font-size: 12px; color: var(--text-muted)">${new Date(tx.date).toLocaleDateString()} &bull; ${tx.category}</div>
        </div>
        <div style="color: ${color}; font-family: 'DM Mono', monospace; font-weight: 500;">
          ${sign}${this.formatCurrency(tx.amount)}
        </div>
      `;
      this.recentList.appendChild(item);
    });
  }

  renderHistory() {
    const catFilter = this.filterCat.value;
    const typeFilter = this.filterType.value;
    const search = this.searchTx.value.toLowerCase();

    const filtered = this.finance.transactions.filter(tx => {
      const matchCat = catFilter ? tx.category === catFilter : true;
      const matchType = typeFilter ? tx.type === typeFilter : true;
      const matchSearch = tx.description.toLowerCase().includes(search) || tx.note.toLowerCase().includes(search);
      return matchCat && matchType && matchSearch;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    this.historyBody.innerHTML = '';

    if (filtered.length === 0) {
      this.historyBody.innerHTML = `<tr><td colspan="6" class="empty-state">No transactions found.</td></tr>`;
      return;
    }

    filtered.forEach(tx => {
      const isIncome = tx.type === 'income';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="white-space: nowrap">${new Date(tx.date).toLocaleDateString()}</td>
        <td>
          <div style="font-weight: 500">${tx.description}</div>
          ${tx.note ? `<div style="font-size: 12px; color: var(--text-muted)">${tx.note}</div>` : ''}
        </td>
        <td>${tx.category}</td>
        <td><span class="badge ${tx.type}">${tx.type}</span></td>
        <td class="tx-amount" style="color: ${isIncome ? 'var(--income)' : 'var(--expense)'}">
          ${isIncome ? '+' : '-'}${this.formatCurrency(tx.amount)}
        </td>
        <td>
          <button class="action-btn edit" data-id="${tx.id}">✎</button>
          <button class="action-btn delete" data-id="${tx.id}">✕</button>
        </td>
      `;
      this.historyBody.appendChild(tr);
    });

    // Add listeners for dynamically created buttons
    document.querySelectorAll('.action-btn.delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (confirm('Are you sure you want to delete this transaction?')) {
          this.finance.deleteTransaction(e.currentTarget.dataset.id);
          this.renderHistory();
          this.renderDashboard();
        }
      });
    });

    document.querySelectorAll('.action-btn.edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.openEditModal(e.currentTarget.dataset.id);
      });
    });
  }

  openEditModal(id) {
    const tx = this.finance.transactions.find(t => t.id === id);
    if (!tx) return;

    this.editId.value = tx.id;
    this.editDesc.value = tx.description;
    this.editAmount.value = tx.amount;
    this.editCat.value = tx.category;
    
    this.modalOverlay.style.display = 'flex';
  }

  handleSaveEdit() {
    const id = this.editId.value;
    const desc = this.editDesc.value.trim();
    const amount = parseFloat(this.editAmount.value);
    const cat = this.editCat.value;

    if (!desc || isNaN(amount) || amount <= 0 || !cat) {
      alert('Please enter valid data.');
      return;
    }

    this.finance.editTransaction(id, { description: desc, amount, category: cat });
    this.modalOverlay.style.display = 'none';
    this.renderHistory();
    this.renderDashboard();
  }

  handleSalaryCalc() {
    const ctc = this.sCtc.value;
    const pf = this.sPf.value;
    const tax = this.sTax.value;
    const bonus = this.sBonus.value;

    const result = SalaryCalculator.calculate(ctc, pf, tax, bonus);

    if (!result) {
      alert('Please enter a valid CTC.');
      return;
    }

    this.salaryResult.style.display = 'block';
    
    this.salaryGrid.innerHTML = `
      <div class="salary-item">
        <div class="label">Monthly Gross</div>
        <div class="val">${this.formatCurrency(result.monthlyGross)}</div>
      </div>
      <div class="salary-item">
        <div class="label">PF Deduction</div>
        <div class="val" style="color: var(--expense)">-${this.formatCurrency(result.pfMonthly)}</div>
      </div>
      <div class="salary-item">
        <div class="label">Est. Monthly Tax</div>
        <div class="val" style="color: var(--expense)">-${this.formatCurrency(result.monthlyTax)}</div>
      </div>
      <div class="salary-item">
        <div class="label">Net In-Hand Salary</div>
        <div class="val" style="color: var(--income)">${this.formatCurrency(result.monthlyNet)}</div>
      </div>
    `;

    this.savingsTip.innerHTML = `<strong>Pro Tip:</strong> Aim to save at least 20% of your Net In-Hand Salary (${this.formatCurrency(result.monthlyNet * 0.2)}) each month for a secure financial future.`;
  }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  window.app = new UIManager();
});
