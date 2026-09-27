const feeForm = document.getElementById("feeForm");
const transactionTable = document.getElementById("transactionTable");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("transactionSearch");
const modeFilter = document.getElementById("modeFilter");
const termFilter = document.getElementById("termFilter");
const refreshButton = document.getElementById("refreshButton");
const exportButton = document.getElementById("exportButton");
const formMessage = document.getElementById("formMessage");
let transactionHistory = [];
let transactionCount = 0;

const formatCurrency = (amount) =>
    `₹${Number(amount || 0).toLocaleString("en-IN")}`;

function setApiStatus(connected) {
    const status = document.getElementById("apiStatus");
    status.textContent = connected ? "Connected" : "Unavailable";
    status.classList.toggle("green", connected);
    status.classList.toggle("status-error", !connected);
}

async function readJson(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || `Request failed (${response.status})`);
    }
    return data;
}

function filteredTransactions() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    const mode = modeFilter.value;
    const term = termFilter.value;

    return transactionHistory.filter((transaction) => {
        const searchable = [
            transaction.id,
            transaction.student_reg_number,
            transaction.amount_paid,
            transaction.expected_fee,
            transaction.outstanding_balance,
            transaction.payment_mode,
            transaction.academic_term,
            transaction.created_at,
            transaction.audit_status,
        ].join(" ").toLocaleLowerCase();

        return (!query || searchable.includes(query))
            && (!mode || transaction.payment_mode === mode)
            && (!term || transaction.academic_term === term);
    });
}

function formatDate(value) {
    if (typeof value !== "string") return "";
    const date = new Date(value.replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function renderTransactions() {
    const visibleTransactions = filteredTransactions();
    transactionTable.replaceChildren();
    emptyState.hidden = visibleTransactions.length > 0;
    emptyState.textContent = transactionHistory.length
        ? "No transactions match these filters."
        : "No transactions recorded yet.";
    document.getElementById("tableSummary").textContent =
        `Showing ${visibleTransactions.length.toLocaleString("en-IN")} of ${transactionCount.toLocaleString("en-IN")} latest transactions`;

    visibleTransactions.forEach((transaction) => {
        const row = document.createElement("tr");
        const balance = transaction.outstanding_balance;
        const hasArrears = balance !== null && Number(balance) > 0;
        row.classList.toggle("row-unverified", !transaction.is_verified);
        row.classList.toggle("row-arrears", hasArrears);

        const values = [
            { text: `#${transaction.id}`, className: "transaction-id" },
            { text: transaction.student_reg_number },
            { text: formatCurrency(transaction.amount_paid), className: "amount" },
            { text: transaction.expected_fee == null ? "Not set" : formatCurrency(transaction.expected_fee) },
            { text: balance == null ? "Not assessed" : formatCurrency(balance), className: hasArrears ? "arrears-amount" : "amount" },
            { text: transaction.payment_mode, className: "payment-badge" },
            { text: transaction.academic_term },
            { text: formatDate(transaction.created_at) },
        ];

        values.forEach((value) => {
            const cell = document.createElement("td");
            const content = document.createElement("span");
            content.textContent = value.text ?? "";
            if (value.className) content.className = value.className;
            cell.appendChild(content);
            row.appendChild(cell);
        });

        const auditCell = document.createElement("td");
        if (!transaction.is_verified) {
            auditCell.appendChild(createAuditBadge("Unverified", "audit-unverified"));
        }
        if (hasArrears) {
            auditCell.appendChild(createAuditBadge("Arrears", "audit-arrears"));
        }
        if (transaction.is_verified && !hasArrears) {
            auditCell.appendChild(createAuditBadge("Verified", "audit-verified"));
        }
        row.appendChild(auditCell);
        transactionTable.appendChild(row);
    });
}

function createAuditBadge(label, className) {
    const badge = document.createElement("span");
    badge.className = `audit-badge ${className}`;
    badge.textContent = label;
    return badge;
}

function populateTerms() {
    const selectedTerm = termFilter.value;
    const terms = [...new Set(transactionHistory.map((item) => item.academic_term))]
        .filter(Boolean)
        .sort((first, second) => second.localeCompare(first));
    termFilter.replaceChildren(new Option("All academic terms", ""));
    terms.forEach((term) => termFilter.add(new Option(term, term)));
    termFilter.value = terms.includes(selectedTerm) ? selectedTerm : "";
}

async function loadDashboard() {
    const response = await fetch("/api/finance/history", {
        headers: { Accept: "application/json" },
    });
    const data = await readJson(response);
    document.getElementById("totalCollected").textContent = formatCurrency(data.total_collected);
    document.getElementById("totalOutstanding").textContent = formatCurrency(data.total_outstanding);
    document.getElementById("unverifiedCount").textContent =
        Number(data.unverified_count || 0).toLocaleString("en-IN");
    document.getElementById("totalTransactions").textContent =
        Number(data.total_transactions || 0).toLocaleString("en-IN");

    const reviewCount = Number(data.unverified_count || 0);
    const arrears = Number(data.total_outstanding || 0);
    const unassessedCount = Number(data.unassessed_accounts || 0);
    document.getElementById("auditSummary").textContent =
        reviewCount || arrears || unassessedCount ? "Review required" : "Ledger current";
    document.getElementById("auditDescription").textContent =
        `${reviewCount} unverified payment${reviewCount === 1 ? "" : "s"}; ${formatCurrency(arrears)} outstanding; ${unassessedCount} account${unassessedCount === 1 ? "" : "s"} without a recorded term fee.`;
}

async function loadTransactions() {
    const response = await fetch("/api/logs", {
        headers: { Accept: "application/json" },
    });
    const data = await readJson(response);
    transactionHistory = Array.isArray(data.logs) ? data.logs.slice(0, 10) : [];
    transactionCount = Number(data.count ?? transactionHistory.length);
    populateTerms();
    renderTransactions();
    document.getElementById("lastSync").textContent =
        new Intl.DateTimeFormat("en-IN", { timeStyle: "short" }).format(new Date());
}

async function refreshLedger() {
    refreshButton.disabled = true;
    refreshButton.classList.add("is-loading");
    try {
        await Promise.all([loadDashboard(), loadTransactions()]);
        setApiStatus(true);
    } catch (error) {
        console.error("Unable to load the fee ledger:", error);
        setApiStatus(false);
        emptyState.hidden = false;
        emptyState.textContent = "Ledger data could not be loaded. Refresh to try again.";
        document.getElementById("tableSummary").textContent = "";
    } finally {
        refreshButton.disabled = false;
        refreshButton.classList.remove("is-loading");
    }
}

feeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = feeForm.querySelector("[type='submit']");
    const amount = Number(document.getElementById("amountPaid").value);
    const expectedFeeInput = document.getElementById("expectedFee").value;
    const expectedFee = expectedFeeInput ? Number(expectedFeeInput) : null;

    if (!Number.isSafeInteger(amount) || amount <= 0) {
        formMessage.textContent = "Enter a whole amount greater than zero.";
        formMessage.dataset.state = "error";
        document.getElementById("amountPaid").focus();
        return;
    }
    if (expectedFee !== null && (!Number.isSafeInteger(expectedFee) || expectedFee <= 0)) {
        formMessage.textContent = "Expected term fee must be a whole amount greater than zero.";
        formMessage.dataset.state = "error";
        document.getElementById("expectedFee").focus();
        return;
    }

    const payload = {
        student_reg_number: document.getElementById("studentRegNumber").value.trim(),
        amount_paid: amount,
        expected_fee: expectedFee,
        is_verified: document.getElementById("paymentVerified").checked,
        payment_mode: document.getElementById("paymentMode").value,
        academic_term: document.getElementById("academicTerm").value,
    };

    submitButton.disabled = true;
    submitButton.querySelector("span").textContent = "Recording...";
    formMessage.textContent = "";
    delete formMessage.dataset.state;

    try {
        const response = await fetch("/api/finance/collect", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(payload),
        });
        const data = await readJson(response);
        formMessage.textContent = data.message || "Payment recorded successfully.";
        formMessage.dataset.state = "success";
        feeForm.reset();
        await refreshLedger();
    } catch (error) {
        formMessage.textContent = error.message || "Unable to record payment. Please try again.";
        formMessage.dataset.state = "error";
    } finally {
        submitButton.disabled = false;
        submitButton.querySelector("span").textContent = "Record Payment";
    }
});

function exportCsv() {
    const rows = filteredTransactions();
    if (!rows.length) {
        document.getElementById("tableSummary").textContent = "There are no transactions to export.";
        return;
    }

    const columns = [
        ["Transaction", (item) => item.id],
        ["Registration Number", (item) => item.student_reg_number],
        ["Amount Paid", (item) => item.amount_paid],
        ["Expected Fee", (item) => item.expected_fee],
        ["Outstanding", (item) => item.outstanding_balance],
        ["Payment Mode", (item) => item.payment_mode],
        ["Academic Term", (item) => item.academic_term],
        ["Verification Status", (item) => item.audit_status],
        ["Date and Time", (item) => item.created_at],
    ];
    const escapeCsv = (value) => {
        const text = String(value ?? "");
        const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
        return `"${safeText.replaceAll('"', '""')}"`;
    };
    const csv = [
        columns.map(([heading]) => escapeCsv(heading)).join(","),
        ...rows.map((item) => columns.map(([, getValue]) => escapeCsv(getValue(item))).join(",")),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `fee-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

searchInput.addEventListener("input", renderTransactions);
modeFilter.addEventListener("change", renderTransactions);
termFilter.addEventListener("change", renderTransactions);
refreshButton.addEventListener("click", refreshLedger);
exportButton.addEventListener("click", exportCsv);

refreshLedger();