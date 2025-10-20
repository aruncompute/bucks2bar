(function () {
    // helper to include external fragments
    function includeInto(el) {
        const path = el.getAttribute('data-include');
        if (!path) return Promise.resolve();
        return fetch(path, { cache: 'no-cache' })
            .then(function (resp) {
                if (!resp.ok) throw new Error('Failed to load ' + path + ' (' + resp.status + ')');
                return resp.text();
            })
            .then(function (html) {
                const tmp = document.createElement('div');
                tmp.innerHTML = html;

                // Extract scripts first
                const scriptEls = Array.from(tmp.querySelectorAll('script'));
                scriptEls.forEach(s => s.parentNode && s.parentNode.removeChild(s));

                // Clear existing placeholder content then append remaining nodes into target element
                el.innerHTML = '';
                while (tmp.firstChild) el.appendChild(tmp.firstChild);

                // If no scripts, resolve immediately
                if (scriptEls.length === 0) return Promise.resolve();

                // Helper to append and wait for external scripts
                return new Promise(function (resolve, reject) {
                    let remaining = scriptEls.length;
                    function checkDone() { if (--remaining === 0) resolve(); }

                    scriptEls.forEach(function (oldScript) {
                        const newScript = document.createElement('script');
                        // copy attributes
                        for (let i = 0; i < oldScript.attributes.length; i++) {
                            const attr = oldScript.attributes[i];
                            newScript.setAttribute(attr.name, attr.value);
                        }
                        if (oldScript.src) {
                            newScript.onload = function () { checkDone(); };
                            newScript.onerror = function () { checkDone(); };
                            // set src then append to body to begin loading
                            newScript.src = oldScript.src;
                            document.body.appendChild(newScript);
                        } else {
                            newScript.text = oldScript.textContent;
                            document.body.appendChild(newScript);
                            // inline scripts run immediately
                            checkDone();
                        }
                    });
                });
            })
            .catch(function (err) {
                // show a user-facing error in the container instead of the stale placeholder
                try { el.innerHTML = '<div class="alert alert-warning p-2 mb-0">Could not load ' + path + ': ' + (err && err.message ? err.message : err) + '</div>'; } catch (e) { }
                // resolve so callers don't hang on a rejected promise
                return;
            });
    }

    const formContainer = document.getElementById('monthly-form-container');
    const chartContainer = document.getElementById('monthly-chart-container');

    // load both includes
    const includes = [];
    if (formContainer) includes.push(includeInto(formContainer));
    if (chartContainer) includes.push(includeInto(chartContainer));

    // chart refs
    let chart; // bar chart
    let pieChart; // totals pie chart
    const monthKeys = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const labels = monthKeys.map(function (m) { return m.charAt(0).toUpperCase() + m.slice(1); });

    function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

    function readFormValues() {
        const income = [];
        const expense = [];
        const form = document.getElementById('monthlyForm');
        monthKeys.forEach(function (m) {
            const inc = form?.querySelector('#income-' + m);
            const exp = form?.querySelector('#expense-' + m);
            const incVal = inc && inc.value ? parseFloat(inc.value) : 0;
            const expVal = exp && exp.value ? parseFloat(exp.value) : 0;
            income.push(isFinite(incVal) ? clamp(incVal, 0, 50000) : 0);
            expense.push(isFinite(expVal) ? clamp(expVal, 0, 50000) : 0);
        });
        return { income, expense };
    }

    function ensureChart() {
        const canvas = document.getElementById('monthlyChart');
        if (!canvas || !window.Chart) return;
        const data = readFormValues();
        if (chart) {
            chart.data.datasets[0].data = data.income;
            chart.data.datasets[1].data = data.expense;
            chart.update();
        } else {
            const barConfig = {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Income', data: data.income, backgroundColor: 'rgba(13,110,253,0.6)' },
                        { label: 'Expense', data: data.expense, backgroundColor: 'rgba(220,53,69,0.6)' }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, suggestedMax: 50000 } },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function (ctx) {
                                    const v = ctx.parsed.y;
                                    return ctx.dataset.label + ': ' + new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v);
                                }
                            }
                        }
                    }
                }
            };
            chart = new Chart(canvas, barConfig);
        }
    }

    function ensurePieChart() {
        const canvas = document.getElementById('totalsPieChart');
        if (!canvas || !window.Chart) return;
        const data = readFormValues();
        const totalIncome = data.income.reduce(function (a, b) { return a + b; }, 0);
        const totalExpense = data.expense.reduce(function (a, b) { return a + b; }, 0);
        const dataset = [totalIncome, totalExpense];
        if (pieChart) {
            pieChart.data.datasets[0].data = dataset;
            pieChart.update();
        } else {
            const pieConfig = {
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
                        tooltip: {
                            callbacks: {
                                label: function (ctx) {
                                    const v = ctx.parsed; // number for pie
                                    const total = dataset.reduce(function (a, b) { return a + b; }, 0) || 1;
                                    const pct = (v / total) * 100;
                                    return ctx.label + ': ' + new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v) + ' (' + pct.toFixed(1) + '%)';
                                }
                            }
                        },
                        legend: { position: 'bottom' }
                    }
                }
            };
            pieChart = new Chart(canvas, pieConfig);
        }
    }

    function bindFormListeners() {
        const form = document.getElementById('monthlyForm');
        if (!form) return;
        form.addEventListener('input', function (e) {
            if (!(e.target instanceof HTMLInputElement)) return;
            ensureChart();
            ensurePieChart();
        });
    }

    Promise.all(includes)
        .then(function () {
            bindFormListeners();
            // init charts on first load
            ensureChart();
            ensurePieChart();

            // refresh when chart tab becomes visible
            const chartTabEl = document.querySelector('#chart-tab');
            if (chartTabEl) {
                chartTabEl.addEventListener('shown.bs.tab', function () {
                    ensureChart();
                    ensurePieChart();
                    if (chart) chart.resize();
                    if (pieChart) pieChart.resize();
                });
            }
        })
        .catch(function (err) {
            console.error('Include error:', err);
        });

})();


(function () {
    const input = document.getElementById('usernameInput');
    const feedback = document.getElementById('usernameFeedback');
    const submitBtn = document.getElementById('submitBtn');
    const form = document.getElementById('username-form');

    function validateUsername(value) {
        if (!value || value.length < 8) return { ok: false, reason: 'Minimum 8 characters' };
        if (!/[A-Z]/.test(value)) return { ok: false, reason: 'Must contain at least one uppercase letter' };
        if (!/[a-z]/.test(value)) return { ok: false, reason: 'Must contain at least one lowercase letter' };
        if (!/[^A-Za-z0-9]/.test(value)) return { ok: false, reason: 'Must contain at least one special character' };
        return { ok: true };
    }

    input.addEventListener('input', function () {
        const val = input.value;
        const result = validateUsername(val);

        // Manage background classes
        input.classList.remove('username-valid', 'username-invalid');
        input.classList.remove('is-valid', 'is-invalid');

        if (result.ok) {
            input.classList.add('username-valid', 'is-valid');
            feedback.textContent = 'Username looks good.';
            feedback.classList.remove('text-danger');
            feedback.classList.add('text-success');
            submitBtn.disabled = false;
        } else {
            if (val.length === 0) {
                // neutral state when empty
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
    });

    // Prevent actual submission for demo purposes
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const result = validateUsername(input.value);
        if (result.ok) {
            alert('Username accepted.');
        }
    });

    // Clear styles on reset
    form.addEventListener('reset', function () {
        setTimeout(() => {
            input.classList.remove('username-valid', 'username-invalid', 'is-valid', 'is-invalid');
            feedback.textContent = '';
            submitBtn.disabled = true;
        }, 0);
    });
    
})();