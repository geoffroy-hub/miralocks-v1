/**
 * Miralocks — admin-charts.js
 * Gestion des graphiques (Chart.js) et statistiques du Dashboard
 */

/* Helper : échappement HTML pour éviter les injections XSS */
const _escChart = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

let _charts = { stat: null, service: null, week: null };
let _weekRange = 8;

/**
 * Change la plage de semaines affichée et rafraîchit le graphique
 * @param {number} n - Nombre de semaines (4, 8, 12)
 */
function setWeekRange(n) {
    _weekRange = n;
    ['4', '8', '12'].forEach(v => {
        const btn = document.getElementById('btn-week-' + v);
        if (!btn) return;
        if (v == n) {
            btn.style.background = 'var(--vert)';
            btn.style.color = '#fff';
            btn.classList.remove('btn-outline');
        } else {
            btn.style.background = '';
            btn.style.color = '';
            btn.classList.add('btn-outline');
        }
    });
    // _allRdvs doit être accessible globalement ou passé via window
    if (window._allRdvs) renderWeekChart(window._allRdvs);
}

/**
 * Rendu du graphique hebdomadaire
 */
function renderWeekChart(rdvs) {
    const ctx = document.getElementById('rdvWeekChart');
    if (!ctx || !window.Chart) return;
    if (_charts.week) _charts.week.destroy();

    const now = new Date();
    const weeks = [];
    for (let i = _weekRange - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1) - i * 7);
        d.setHours(0, 0, 0, 0);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        weeks.push({ start: new Date(d), label: day + '/' + month, total: 0, confirme: 0 });
    }

    rdvs.forEach(r => {
        const rd = new Date(r.date_rdv);
        for (let w of weeks) {
            const end = new Date(w.start);
            end.setDate(end.getDate() + 7);
            if (rd >= w.start && rd < end) {
                w.total++;
                if (r.statut === 'confirme' || r.statut === 'termine') w.confirme++;
                break;
            }
        }
    });

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gc = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
    const tc = isDark ? '#a8c4b0' : '#555';

    _charts.week = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weeks.map(w => w.label),
            datasets: [
                { label: 'Total RDV', data: weeks.map(w => w.total), backgroundColor: 'rgba(12,51,32,0.15)', borderColor: '#0C3320', borderWidth: 1.5, borderRadius: 4 },
                { label: 'Confirmés', data: weeks.map(w => w.confirme), backgroundColor: 'rgba(201,168,76,0.7)', borderColor: '#C9A84C', borderWidth: 1, borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 10, font: { size: 11 }, color: tc } },
                tooltip: { callbacks: { title: (i) => 'Semaine du ' + i[0].label } }
            },
            scales: {
                x: { grid: { color: gc }, ticks: { color: tc, font: { size: 10 } } },
                y: { beginAtZero: true, ticks: { stepSize: 1, color: tc }, grid: { color: gc } }
            }
        }
    });
}

/**
 * Point d'entrée principal pour le rendu des graphiques et widgets du dashboard
 */
function renderDashboardCharts(counts, allRdvs) {
    if (!window.Chart) return;
    window._rdvCountsCache = counts;
    window._allRdvs = allRdvs || [];

    setTimeout(() => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const tc = isDark ? '#a8c4b0' : '#555';

        renderWeekChart(window._allRdvs);

        // 1. Graphique Statuts
        const statCtx = document.getElementById('rdvStatChart');
        if (statCtx) {
            if (_charts.stat) _charts.stat.destroy();
            _charts.stat = new Chart(statCtx, {
                type: 'bar',
                data: {
                    labels: ['En attente', 'Confirmé', 'Terminé', 'Annulé'],
                    datasets: [{
                        data: [counts.en_attente || 0, counts.confirme || 0, counts.termine || 0, counts.annule || 0],
                        backgroundColor: ['#f59e0b', '#16a34a', '#0C3320', '#ef4444'],
                        borderRadius: 6,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: tc, font: { size: 11 } }, grid: { display: false } },
                        y: { beginAtZero: true, ticks: { stepSize: 1, color: tc } }
                    }
                }
            });
        }

        // 2. Graphique Services
        const serviceCtx = document.getElementById('rdvServiceChart');
        if (serviceCtx) {
            if (_charts.service) _charts.service.destroy();
            const map = window._allRdvs.reduce((acc, r) => {
                if (r.service) acc[r.service] = (acc[r.service] || 0) + 1;
                return acc;
            }, {});
            const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
            if (!sorted.length) {
                serviceCtx.parentElement.innerHTML += '<p style="text-align:center;color:#aaa;margin-top:2rem">Aucun RDV encore</p>';
                return;
            }
            _charts.service = new Chart(serviceCtx, {
                type: 'doughnut',
                data: {
                    labels: sorted.map(s => s[0]),
                    datasets: [{
                        data: sorted.map(s => s[1]),
                        backgroundColor: ['#0C3320', '#C9A84C', '#16A34A', '#2563EB', '#D97706', '#7C3AED'],
                        hoverOffset: 8,
                        borderWidth: 2,
                        borderColor: isDark ? '#1a1a1a' : '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, color: tc, padding: 8 } }
                    },
                    cutout: '65%'
                }
            });
        }

        renderKPIs(window._allRdvs);
        renderTodayAgenda(window._allRdvs);
    }, 150);
}

/**
 * Rendu de l'agenda "Aujourd'hui"
 */
function renderTodayAgenda(rdvs) {
    const el = document.getElementById('dash-today');
    if (!el) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayRdvs = rdvs.filter(r => r.date_rdv === todayStr).sort((a, b) => (a.heure || '').localeCompare(b.heure || ''));

    if (todayRdvs.length === 0) {
        el.innerHTML = `
        <div class="dash-card" style="padding:1.5rem; border-left:4px solid #cbd5e1; cursor:default">
          <div style="display:flex; align-items:center; gap:.75rem">
            <i class="fas fa-calendar-day" style="font-size:1.5rem; color:#94a3b8"></i>
            <div>
              <h3 style="margin:0; font-size:1rem; color:var(--vert)">Aucun rendez-vous aujourd'hui</h3>
              <p style="margin:0; font-size:.8rem; color:#888">Profitez-en pour mettre à jour vos stocks ou votre blog !</p>
            </div>
          </div>
        </div>`;
        return;
    }

    let itemsHtml = todayRdvs.map(r => {
        const isPast = r.heure && new Date().getHours() > parseInt(r.heure.split(':')[0]);
        const tel = r.telephone ? r.telephone.replace(/\s/g, '') : '';
        const safeTel = _escChart(tel);
        const safeNom = _escChart(r.nom);
        const safeService = _escChart(r.service || 'Prestation');
        const safeHeure = _escChart(r.heure || '—');
        const waMsg = encodeURIComponent(`Bonjour ${r.nom}, c'est Miralocks. Je vous confirme votre RDV d'aujourd'hui à ${r.heure}.`);
        
        return `
        <div style="display:flex; align-items:center; gap:1rem; padding:1rem 0; border-bottom:1px solid #f0f0f0; opacity:${isPast ? '0.6' : '1'}">
          <div style="font-family:'Playfair Display'; font-weight:700; color:var(--or); font-size:1.1rem; min-width:60px">${safeHeure}</div>
          <div style="flex:1">
            <div style="font-weight:600; color:var(--vert)">${safeNom}</div>
            <div style="font-size:.75rem; color:#777">${safeService}</div>
          </div>
          <div style="display:flex; gap:.5rem">
            ${tel ? `<a href="tel:${safeTel}" class="btn btn-sm btn-outline" style="padding:.25rem .5rem"><i class="fas fa-phone"></i></a>` : ''}
            ${tel ? `<a href="https://wa.me/${safeTel}?text=${waMsg}" target="_blank" class="btn btn-sm btn-outline" style="border-color:#25D366; color:#25D366; padding:.25rem .5rem"><i class="fab fa-whatsapp"></i></a>` : ''}
          </div>
        </div>`;
    }).join('');

    el.innerHTML = `
    <div class="dash-card" style="padding:1.5rem; border-left:4px solid var(--or); cursor:default; background:linear-gradient(to right, #fffcf5, #fff)">
      <h3 style="margin:0 0 1.25rem 0; font-size:.9rem; text-transform:uppercase; letter-spacing:.05em; color:var(--or); display:flex; align-items:center; gap:.5rem">
        <i class="fas fa-bullseye"></i> 🔍 Agenda du Jour (${todayRdvs.length})
      </h3>
      <div style="max-height:300px; overflow-y:auto; padding-right:.5rem">
        ${itemsHtml}
      </div>
    </div>`;
}

/**
 * Rendu des badges et widgets KPI
 */
function renderKPIs(rdvs) {
    const kpiEl = document.getElementById('dash-kpi');
    if (!kpiEl || rdvs.length === 0) return;

    const total = rdvs.length;
    const confirmes = rdvs.filter(r => r.statut === 'confirme' || r.statut === 'termine').length;
    const taux = total > 0 ? Math.round(confirmes / total * 100) : 0;
    const jours = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const jourMap = rdvs.reduce((acc, r) => {
        const j = new Date(r.date_rdv).getDay();
        acc[j] = (acc[j] || 0) + 1;
        return acc;
    }, {});
    const bestJour = Object.entries(jourMap).sort((a, b) => b[1] - a[1])[0];
    const heureMap = rdvs.filter(r => r.heure).reduce((acc, r) => {
        const h = r.heure.split(':')[0] + 'h';
        acc[h] = (acc[h] || 0) + 1;
        return acc;
    }, {});
    const bestHeure = Object.entries(heureMap).sort((a, b) => b[1] - a[1])[0];

    // Widget Conversion
    let convHtml = '';
    if (window._visiteStatsCache && window._visiteStatsCache.mois > 0) {
        const txConv = ((total / window._visiteStatsCache.mois) * 100).toFixed(1);
        convHtml = `
      <div class="dash-card" style="cursor:default;text-align:center;padding:1.25rem">
        <div style="font-size:2rem;font-weight:700;color:var(--or)">${txConv}%</div>
        <div style="font-size:.8rem;color:#888;margin-top:.25rem">Conversion (Visites/RDV)</div>
        <div style="font-size:.75rem;color:var(--gris-d);margin-top:.5rem">${window._visiteStatsCache.mois} visites ce mois</div>
      </div>`;
    }

    kpiEl.innerHTML = `
    <div class="dash-card" style="cursor:default;text-align:center;padding:1.25rem">
      <div style="font-size:2rem;font-weight:700;color:var(--vert)">${taux}%</div>
      <div style="font-size:.8rem;color:#888;margin-top:.25rem">Taux de confirmation</div>
      <div style="height:4px;background:#eee;border-radius:2px;margin-top:.75rem">
        <div style="height:4px;background:var(--or);border-radius:2px;width:${taux}%"></div>
      </div>
    </div>
    ${convHtml}
    <div class="dash-card" style="cursor:default;text-align:center;padding:1.25rem">
      <div style="font-size:2rem;font-weight:700;color:var(--vert)">${bestJour ? jours[bestJour[0]] : '—'}</div>
      <div style="font-size:.8rem;color:#888;margin-top:.25rem">Jour le plus demandé</div>
      ${bestJour ? `<div style="font-size:.75rem;color:var(--or);margin-top:.5rem">${bestJour[1]} RDV</div>` : ''}
    </div>
    <div class="dash-card" style="cursor:default;text-align:center;padding:1.25rem">
      <div style="font-size:2rem;font-weight:700;color:var(--vert)">${total}</div>
      <div style="font-size:.8rem;color:#888;margin-top:.25rem">Total RDV</div>
    </div>`;
}
