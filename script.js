
const STORAGE_KEY = "pennywise-expenses-v1";

const form = document.getElementById("expense-form");
const nameInput = document.getElementById("name");
const amountInput = document.getElementById("amount");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("date");
const searchInput = document.getElementById("search");
const filterInput = document.getElementById("filter-category");
const expenseList = document.getElementById("expense-list");
const emptyState = document.getElementById("empty-state");
const formMessage = document.getElementById("form-message");

const allowedCategories = [
  "Food", "Transport", "Shopping", "Bills",
  "Health", "Education", "Other"
];

const today = new Date();
const localToday = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0")
].join("-");

dateInput.value = localToday;
dateInput.max = localToday;

document.getElementById("today").textContent =
  today.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
}

function loadExpenses() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const data = JSON.parse(saved);
    if (!Array.isArray(data)) return [];

    return data.filter(item =>
      item &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      item.name.trim().length > 0 &&
      item.name.length <= 80 &&
      Number.isFinite(item.amount) &&
      item.amount > 0 &&
      item.amount <= 1000000000 &&
      allowedCategories.includes(item.category) &&
      validDate(item.date) &&
      item.date <= localToday
    );
  } catch {
    return [];
  }
}

let expenses = loadExpenses();

function saveExpenses() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    return true;
  } catch {
    formMessage.textContent =
      "Unable to save data. Check your browser storage settings.";
    return false;
  }
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedCategory = filterInput.value;

  const filtered = expenses
    .filter(item =>
      item.name.toLowerCase().includes(query)
    )
    .filter(item =>
      selectedCategory === "All" ||
      item.category === selectedCategory
    )
    .sort((a, b) =>
      b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
    );

  const total = expenses.reduce((sum, item) => sum + item.amount, 0);

  const monthly = expenses
    .filter(item => item.date.startsWith(localToday.slice(0, 7)))
    .reduce((sum, item) => sum + item.amount, 0);

  document.getElementById("total").textContent = money.format(total);
  document.getElementById("monthly").textContent = money.format(monthly);
  document.getElementById("count").textContent = expenses.length;

  expenseList.replaceChildren();

  for (const item of filtered) {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    nameCell.textContent = item.name;

    const categoryCell = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = "category-pill";
    pill.textContent = item.category;
    categoryCell.appendChild(pill);

    const dateCell = document.createElement("td");
    const [year, month, day] = item.date.split("-");
    dateCell.textContent = `${day}/${month}/${year}`;

    const amountCell = document.createElement("td");
    amountCell.className = "amount";
    amountCell.textContent = money.format(item.amount);

    const actionCell = document.createElement("td");
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-btn";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute(
      "aria-label", `Delete expense ${item.name}`
    );

    deleteButton.addEventListener("click", () => {
      const confirmed = window.confirm(
        `Delete "${item.name}"?`
      );

      if (!confirmed) return;

      const previous = expenses;
      expenses = expenses.filter(expense => expense.id !== item.id);

      if (!saveExpenses()) {
        expenses = previous;
        return;
      }

      formMessage.textContent = "Expense deleted.";
      render();
    });

    actionCell.appendChild(deleteButton);

    row.append(
      nameCell, categoryCell, dateCell, amountCell, actionCell
    );

    expenseList.appendChild(row);
  }

  emptyState.hidden = filtered.length > 0;
  emptyState.textContent = expenses.length === 0
    ? "No expenses yet. Add your first expense above!"
    : "No matching expenses. Try a different search or filter.";
}

form.addEventListener("submit", event => {
  event.preventDefault();
  formMessage.textContent = "";

  const name = nameInput.value.trim();
  const amount = Number(amountInput.value);
  const category = categoryInput.value;
  const date = dateInput.value;

  if (!name || name.length > 80) {
    formMessage.textContent =
      "Enter an expense name with up to 80 characters.";
    return;
  }

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1000000000
  ) {
    formMessage.textContent = "Enter a valid positive amount.";
    return;
  }

  if (!allowedCategories.includes(category)) {
    formMessage.textContent = "Select a valid category.";
    return;
  }

  if (!validDate(date) || date > localToday) {
    formMessage.textContent =
      "Choose a valid date that is not in the future.";
    return;
  }

  const expense = {
    id: createId(),
    name,
    amount: Math.round(amount * 100) / 100,
    category,
    date
  };

  expenses.push(expense);

  if (!saveExpenses()) {
    expenses.pop();
    return;
  }

  form.reset();
  dateInput.value = localToday;
  formMessage.textContent = "Expense added successfully!";
  render();
});

searchInput.addEventListener("input", render);
filterInput.addEventListener("change", render);

document.getElementById("export-btn").addEventListener("click", () => {
  const headers = ["Name", "Amount (INR)", "Category", "Date"];

  // Escape CSV cells to prevent spreadsheet formula execution.
  function csvCell(value) {
    let text = String(value);

    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) {
      text = "'" + text;
    }

    return '"' + text.replace(/"/g, '""') + '"';
  }

  const rows = expenses.map(item => [
    item.name,
    item.amount.toFixed(2),
    item.category,
    item.date
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(csvCell).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "pennywise-expenses.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

render();
