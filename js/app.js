'use strict';

// Include fragments + charts
(function () {
    // Utils
    const $id = (id) => document.getElementById(id);
    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
    const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

    // Async include
    async function includeInto(el) {
        const path = el?.getAttribute('data-include');
        if (!path) return;
        try {
            const resp = await fetch(path, { cache: 'no-cache' });
            if (!resp.ok) throw new Error(`Failed to load ${path} (${resp.status})`);
            const html = await resp.text();

            const tmp = document.createElement('div');
            tmp.innerHTML = html;

            // extract scripts (preserve order)
            const scripts = Array.from(tmp.querySelectorAll('script'));
            scripts.forEach(s => s.remove());

            el.innerHTML = '';
            while (tmp.firstChild) el.appendChild(tmp.firstChild);

            // load scripts sequentially to preserve order
            for (const oldScript of scripts) {
                const s = document.createElement('script');
                for (let i = 0; i < oldScript.attributes.length; i++) {
                    const { name, value } = oldScript.attributes[i];
                    s.setAttribute(name, value);
                }
                if (oldScript.src) {
                    await new Promise((res) => {
                        s.onload = s.onerror = res;
                        s.src = oldScript.src;
                        document.body.appendChild(s);
                    });
                } else {
                    s.text = oldScript.textContent || '';
                    document.body.appendChild(s);
                }
            }
        } catch (err) {
            try {
                el.innerHTML = `<div class="alert alert-warning p-2 mb-0">Could not load ${path}: ${err && err.message ? err.message : err}</div>`;
            } catch (_) { /* noop */ }
        }
    }

    // Load includes
    const formContainer = $id('monthly-form-container');
    const chartContainer = $id('monthly-chart-container');
    const includes = [];
    if (formContainer) includes.push(includeInto(formContainer));
    if (chartContainer) includes.push(includeInto(chartContainer));

    // Chart state
    let barChart = null;
    let pieChart = null;

    const monthKeys = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const monthLabels = monthKeys.map(m => m[0].toUpperCase() + m.slice(1));

    const readFormValues = () => {
        const form = $id('monthlyForm');
        const income = [];
        const expense = [];
        for (const m of monthKeys) {
            const inc = form?.querySelector(`#income-${m}`);
            const exp = form?.querySelector(`#expense-${m}`);
            const incVal = parseFloat(inc?.value || '0');
            const expVal = parseFloat(exp?.value || '0');
            income.push(isFinite(incVal) ? clamp(incVal, 0, 50000) : 0);
            expense.push(isFinite(expVal) ? clamp(expVal, 0, 50000) : 0);
        }
        return { income, expense };
    };

    function ensureBarChart() {
        const canvas = $id('monthlyChart');
        if (!canvas || !window.Chart) return;
        const { income, expense } = readFormValues();
        if (barChart) {
            barChart.data.datasets[0].data = income;
            barChart.data.datasets[1].data = expense;
            barChart.update();
            return;
        }
        barChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: monthLabels,
                datasets: [
                    { label: 'Income', data: income, backgroundColor: 'rgba(13,110,253,0.6)' },
                    { label: 'Expense', data: expense, backgroundColor: 'rgba(220,53,69,0.6)' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, suggestedMax: 50000 } },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${nf.format(ctx.parsed.y)}`
                        }
                    }
                }
            }
        });
    }

    function ensureTotalsPieChart() {
        const canvas = $id('totalsPieChart');
        if (!canvas || !window.Chart) return;
        const { income, expense } = readFormValues();
        const totalIncome = income.reduce((a, b) => a + b, 0);
        const totalExpense = expense.reduce((a, b) => a + b, 0);
        const dataset = [totalIncome, totalExpense];

        if (pieChart) {
            pieChart.data.datasets[0].data = dataset;
            pieChart.update();
            return;
        }
        pieChart = new Chart(canvas, {
            type: 'pie',
            data: {
                labels: ['Income', 'Expense'],
                datasets: [{
                    data: dataset,
                    backgroundColor: ['rgba(13,110,253,0.6)', 'rgba(220,53,69,0.6)'],
                    borderColor: ['#0d6efd', '#dc3545'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const v = ctx.parsed || 0;
                                const total = dataset.reduce((a, b) => a + b, 0) || 1;
                                const pct = (v / total) * 100;
                                return `${ctx.label}: ${nf.format(v)} (${pct.toFixed(1)}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // RAF-batched updates
    let rafId = 0;
    const scheduleChartsUpdate = () => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            rafId = 0;
            ensureBarChart();
            ensureTotalsPieChart();
        });
    };

    function bindFormListeners() {
        const form = $id('monthlyForm');
        if (!form) return;
        form.addEventListener('input', (e) => {
            if (!(e.target instanceof HTMLInputElement)) return;
            scheduleChartsUpdate();
        });
    }

    Promise.all(includes).then(() => {
        bindFormListeners();
        scheduleChartsUpdate();

        const chartTabEl = document.querySelector('#chart-tab');
        if (chartTabEl) {
            chartTabEl.addEventListener('shown.bs.tab', () => {
                scheduleChartsUpdate();
                if (barChart) barChart.resize();
                if (pieChart) pieChart.resize();
            });
        }

        // Email charts form handler
        const emailForm = document.getElementById('emailChartsForm');
        const emailInput = document.getElementById('chartsEmail');
        const emailMsg = document.getElementById('emailChartsMsg');
        // If page not served from Node server (port 3001), target the Node API explicitly
        const DEFAULT_API_BASE = `${location.protocol}//${location.hostname}:3001`;
        const API_BASE = (location.port === '3001') ? '' : DEFAULT_API_BASE;
        if (emailForm && emailInput) {
            emailForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                emailMsg && (emailMsg.textContent = '');
                if (!emailInput.checkValidity()) {
                    emailInput.classList.add('is-invalid');
                    return;
                }
                emailInput.classList.remove('is-invalid');

                try {
                    // Ensure charts are up-to-date before capture
                    scheduleChartsUpdate();
                    if (barChart) barChart.update();
                    if (pieChart) pieChart.update();

                    const monthlyCanvas = document.getElementById('monthlyChart');
                    const totalsCanvas = document.getElementById('totalsPieChart');
                    const monthlyPng = monthlyCanvas?.toDataURL('image/png');
                    const totalsPng = totalsCanvas?.toDataURL('image/png');
                    if (!monthlyPng || !totalsPng) {
                        throw new Error('Charts are not ready to export');
                    }

                    const res = await fetch(`${API_BASE}/api/send-charts`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: emailInput.value.trim(),
                            monthlyChart: monthlyPng,
                            totalsPieChart: totalsPng,
                        }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok || !data.ok) {
                        throw new Error(data?.error || 'Failed to send email');
                    }
                    emailMsg && (emailMsg.textContent = data.previewUrl
                        ? `Email sent (preview: ${data.previewUrl})`
                        : 'Email sent successfully.');
                    emailMsg && emailMsg.classList.remove('text-danger');
                    emailMsg && emailMsg.classList.add('text-success');
                } catch (err) {
                    if (emailMsg) {
                        emailMsg.textContent = `Error: ${err?.message || err}`;
                        emailMsg.classList.remove('text-success');
                        emailMsg.classList.add('text-danger');
                    }
                }
            });
        }
    }).catch((err) => {
        console.error('Include error:', err);
    });
})();

// Username validation
(function () {
    const input = document.getElementById('usernameInput');
    const feedback = document.getElementById('usernameFeedback');
    const submitBtn = document.getElementById('submitBtn');
    const form = document.getElementById('username-form');
    if (!input || !feedback || !submitBtn || !form) return;

    const R_UP = /[A-Z]/;
    const R_LO = /[a-z]/;
    const R_SP = /[^A-Za-z0-9]/;

    function validateUsername(value) {
        if (!value || value.length < 8) return { ok: false, reason: 'Minimum 8 characters' };
        if (!R_UP.test(value)) return { ok: false, reason: 'Must contain at least one uppercase letter' };
        if (!R_LO.test(value)) return { ok: false, reason: 'Must contain at least one lowercase letter' };
        if (!R_SP.test(value)) return { ok: false, reason: 'Must contain at least one special character' };
        return { ok: true };
    }

    function applyState(result, val) {
        input.classList.remove('username-valid', 'username-invalid', 'is-valid', 'is-invalid');
        if (result.ok) {
            input.classList.add('username-valid', 'is-valid');
            feedback.textContent = 'Username looks good.';
            feedback.classList.remove('text-danger');
            feedback.classList.add('text-success');
            submitBtn.disabled = false;
        } else {
            if (!val) {
                feedback.textContent = '';
                submitBtn.disabled = true;
            } else {
                input.classList.add('username-invalid', 'is-invalid');
                feedback.textContent = result.reason;
                feedback.classList.remove('text-success');
                feedback.classList.add('text-danger');
                submitBtn.disabled = true;
            }
        }
    }

    input.addEventListener('input', () => {
        const val = input.value || '';
        applyState(validateUsername(val), val);
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (validateUsername(input.value).ok) alert('Username accepted.');
    });

    form.addEventListener('reset', () => {
        setTimeout(() => {
            input.classList.remove('username-valid', 'username-invalid', 'is-valid', 'is-invalid');
            feedback.textContent = '';
            submitBtn.disabled = true;
        }, 0);
    });
})();
