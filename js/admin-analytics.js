/* ============================================================
   Miralocks Admin — admin-analytics.js  v1.0
   Analytics avancés :
   10. Rapport mensuel automatique par email
   11. Heatmap des jours les plus chargés
   12. Score de satisfaction moyen (public + admin)
   ============================================================ */

/* Helper : échappement HTML pour éviter les injections XSS */
const _escAnalytics = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');


/* ══════════════════════════════════════════════════════════
   11. HEATMAP DES JOURS LES PLUS CHARGÉS
   Calendrier visuel dans le dashboard admin
   (en complément du FullCalendar existant dans Planning)
══════════════════════════════════════════════════════════ */

window.renderHeatmap = async function(containerId, months = 3) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `<div style="display:flex;align-items:center;gap:.5rem;padding:.5rem 0;color:var(--gris-d)">
    <div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Chargement heatmap…
  </div>`;

  try {
    const all = await sb.rdv.list(null);
    if (!all.length) { el.innerHTML = '<p style="color:var(--gris-d);font-size:.85rem">Aucune donnée pour la heatmap.</p>'; return; }

    /* Compter les RDV par date (seulement confirmés + en_attente + terminés) */
    const counts = {};
    const maxByDay = {};

    all.forEach(r => {
      if (!r.date_rdv || r.statut === 'annule') return;
      counts[r.date_rdv] = (counts[r.date_rdv] || 0) + 1;
    });

    const max = Math.max(...Object.values(counts), 1);

    /* Générer les N derniers mois */
    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - months + 1);
    startDate.setDate(1);

    /* Couleurs selon intensité */
    function heatColor(count) {
      if (!count) return 'var(--bg,#f4f4f4)';
      const ratio = count / max;
      if (ratio <= 0.25) return '#dcfce7';
      if (ratio <= 0.5)  return '#86efac';
      if (ratio <= 0.75) return '#22c55e';
      return '#15803d';
    }
    function heatTextColor(count) {
      if (!count) return 'var(--gris-d,#aaa)';
      const ratio = count / max;
      return ratio > 0.5 ? '#fff' : '#166534';
    }

    const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const MOIS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

    /* Construire le HTML mois par mois */
    let html = `
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
          <h4 style="margin:0;font-size:.9rem;color:var(--gris-d);text-transform:uppercase;letter-spacing:.05em">
            <i class="fas fa-fire" style="margin-right:.4rem;color:var(--or,#C9A84C)"></i>
            Jours les plus chargés (${months} derniers mois)
          </h4>
          <div style="display:flex;align-items:center;gap:.35rem;font-size:.7rem;color:var(--gris-d)">
            <span>Moins</span>
            ${['#f4f4f4','#dcfce7','#86efac','#22c55e','#15803d'].map(c =>
              `<div style="width:12px;height:12px;border-radius:3px;background:${c}"></div>`
            ).join('')}
            <span>Plus</span>
          </div>
        </div>
        <div style="display:flex;gap:1.5rem;flex-wrap:wrap;">
    `;

    for (let m = 0; m < months; m++) {
      const monthDate = new Date(startDate);
      monthDate.setMonth(startDate.getMonth() + m);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay(); // 0=dim
      const firstDayMon = firstDay === 0 ? 6 : firstDay - 1; // Lundi=0

      html += `
        <div style="min-width:200px">
          <div style="font-weight:700;color:var(--vert,#0C3320);margin-bottom:.5rem;font-size:.88rem">
            ${MOIS_FR[month]} ${year}
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:.25rem">
            ${JOURS.map(j => `<div style="text-align:center;font-size:.65rem;color:var(--gris-d);font-weight:600;padding:2px 0">${j}</div>`).join('')}
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">
            ${Array(firstDayMon).fill('<div></div>').join('')}
            ${Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const count = counts[dateStr] || 0;
              const isToday = dateStr === today.toISOString().slice(0, 10);
              return `<div title="${dateStr}: ${count} RDV" style="
                aspect-ratio:1;
                background:${heatColor(count)};
                border-radius:4px;
                display:flex;align-items:center;justify-content:center;
                font-size:.62rem;font-weight:600;
                color:${heatTextColor(count)};
                ${isToday ? 'outline:2px solid var(--or,#C9A84C);outline-offset:1px;' : ''}
                cursor:${count ? 'pointer' : 'default'};
              " onclick="${count ? `document.querySelector('.nav-item[data-panel=\\'rdv-planning\\']')?.click()` : ''}">
                ${count || day}
              </div>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    html += '</div></div>';
    el.innerHTML = html;

  } catch (e) {
    el.innerHTML = `<p style="color:var(--danger);font-size:.85rem">Erreur heatmap : ${_escAnalytics(e.message)}</p>`;
  }
};

/* Injecter la heatmap dans le dashboard après chargement */
document.addEventListener('DOMContentLoaded', () => {
  const patchHeatmap = () => {
    if (typeof loadDashboard !== 'function') { setTimeout(patchHeatmap, 300); return; }

    const _origDash = window.loadDashboard;
    window.loadDashboard = async function() {
      const result = await _origDash.apply(this, arguments);

      /* Injecter le conteneur heatmap si absent */
      const panel = document.getElementById('panel-dashboard');
      if (panel && !document.getElementById('dash-heatmap')) {
        const container = document.createElement('div');
        container.id = 'dash-heatmap';
        container.style.cssText = 'background:var(--bg-card,#fff);border-radius:var(--rayon-lg,16px);padding:1.25rem 1.5rem;border:1px solid var(--border,#e5e7eb);margin-top:1.5rem;';

        /* Trouver dash-service-stats pour insérer avant */
        const serviceStats = document.getElementById('dash-service-stats');
        if (serviceStats) serviceStats.before(container);
        else {
          const pending = document.getElementById('dash-pending');
          if (pending) pending.after(container);
        }
      }

      setTimeout(() => renderHeatmap('dash-heatmap', 3), 500);
      return result;
    };
  };
  patchHeatmap();
});


/* ══════════════════════════════════════════════════════════
   12. SCORE DE SATISFACTION MOYEN
   Affiché dans le dashboard admin + widget page publique
══════════════════════════════════════════════════════════ */

window.renderSatisfactionScore = async function(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    const avis = await sb.avis.list(true); // seulement approuvés

    if (!avis.length) {
      el.innerHTML = '<p style="color:var(--gris-d);font-size:.85rem">Aucun avis approuvé.</p>';
      return;
    }

    const total = avis.reduce((acc, a) => acc + (a.etoiles || 5), 0);
    const avg = (total / avis.length).toFixed(1);
    const pct = Math.round((avg / 5) * 100);

    /* Dernière période : avis du dernier mois */
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const recent = avis.filter(a => new Date(a.created_at) >= lastMonth);
    const recentAvg = recent.length
      ? (recent.reduce((acc, a) => acc + (a.etoiles || 5), 0) / recent.length).toFixed(1)
      : null;

    const stars = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
    const trend = recentAvg
      ? parseFloat(recentAvg) >= parseFloat(avg)
        ? `<span style="color:#10b981;font-size:.8rem"><i class="fas fa-arrow-up"></i> ${recentAvg} ce mois</span>`
        : `<span style="color:#ef4444;font-size:.8rem"><i class="fas fa-arrow-down"></i> ${recentAvg} ce mois</span>`
      : '';

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap">
        <div style="text-align:center">
          <div style="font-size:2.8rem;font-weight:800;color:var(--vert,#0C3320);line-height:1">${avg}</div>
          <div style="font-size:1.1rem;color:var(--or,#C9A84C);letter-spacing:.05em">${stars(avg)}</div>
          <div style="font-size:.75rem;color:var(--gris-d);margin-top:2px">${avis.length} avis</div>
        </div>
        <div style="flex:1;min-width:140px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.35rem">
            <span style="font-size:.8rem;color:var(--gris-d)">Score global</span>
            <span style="font-size:.8rem;font-weight:700;color:var(--vert)">${pct}%</span>
          </div>
          <div style="background:#f3f4f6;border-radius:20px;height:10px;overflow:hidden">
            <div style="background:linear-gradient(90deg,var(--vert,#0C3320),var(--or,#C9A84C));width:${pct}%;height:100%;border-radius:20px;transition:width .8s ease"></div>
          </div>
          <div style="margin-top:.5rem">${trend}</div>
        </div>
        <div>
          ${[5,4,3,2,1].map(n => {
            const c = avis.filter(a => Math.round(a.etoiles) === n).length;
            const p = Math.round((c / avis.length) * 100);
            return `<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:3px">
              <span style="font-size:.7rem;color:var(--or,#C9A84C);width:28px;text-align:right">${'★'.repeat(n)}</span>
              <div style="width:70px;background:#f3f4f6;border-radius:10px;height:6px;overflow:hidden">
                <div style="background:var(--or,#C9A84C);width:${p}%;height:100%;border-radius:10px"></div>
              </div>
              <span style="font-size:.7rem;color:var(--gris-d)">${c}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  } catch (e) {
    el.innerHTML = `<p style="color:var(--danger);font-size:.85rem">Erreur : ${_escAnalytics(e.message)}</p>`;
  }
};

/* Injecter dans le dashboard */
document.addEventListener('DOMContentLoaded', () => {
  const patchSatisfaction = () => {
    if (typeof loadDashboard !== 'function') { setTimeout(patchSatisfaction, 400); return; }

    const _origDash2 = window.loadDashboard;
    window.loadDashboard = async function() {
      const result = await _origDash2.apply(this, arguments);

      if (!document.getElementById('dash-satisfaction')) {
        const container = document.createElement('div');
        container.id = 'dash-satisfaction';
        container.style.cssText = 'background:var(--bg-card,#fff);border-radius:var(--rayon-lg,16px);padding:1.25rem 1.5rem;border:1px solid var(--border,#e5e7eb);margin-top:1.5rem;';
        container.innerHTML = `
          <h4 style="margin:0 0 1rem;font-size:.9rem;color:var(--gris-d);text-transform:uppercase;letter-spacing:.05em">
            <i class="fas fa-star" style="margin-right:.4rem;color:var(--or,#C9A84C)"></i>
            Score de satisfaction
          </h4>
          <div id="dash-satisfaction-inner"></div>`;

        const heatmap = document.getElementById('dash-heatmap');
        if (heatmap) heatmap.after(container);
        else {
          const serviceStats = document.getElementById('dash-service-stats');
          if (serviceStats) serviceStats.after(container);
        }
      }

      setTimeout(() => renderSatisfactionScore('dash-satisfaction-inner'), 600);
      return result;
    };
  };
  patchSatisfaction();
});


/* ══════════════════════════════════════════════════════════
   10. RAPPORT MENSUEL AUTOMATIQUE
   Déclenché depuis l'admin — envoie un résumé complet
══════════════════════════════════════════════════════════ */

window.generateMonthlyReport = async function() {
  const toast = window.toast || window.showToast;
  try {
    if (toast) toast('Génération du rapport…', 'info');

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const monthName = monthStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const [allRdvs, avis, visiteStats] = await Promise.all([
      sb.rdv.list(null),
      sb.avis.list(true),
      sb.visites.stats().catch(() => ({ mois: 0, total: 0 })),
    ]);

    /* Filtrer le mois précédent */
    const monthRdvs = allRdvs.filter(r => {
      if (!r.date_rdv) return false;
      const d = new Date(r.date_rdv);
      return d >= monthStart && d <= monthEnd;
    });

    const confirmes = monthRdvs.filter(r => r.statut === 'confirme' || r.statut === 'termine').length;
    const annules = monthRdvs.filter(r => r.statut === 'annule').length;
    const tauxConv = visiteStats.mois > 0 ? ((monthRdvs.length / visiteStats.mois) * 100).toFixed(1) : 0;
    const avgStars = avis.length ? (avis.reduce((a, v) => a + (v.etoiles || 5), 0) / avis.length).toFixed(1) : 'N/A';

    /* Top services du mois */
    const svcCount = {};
    monthRdvs.forEach(r => { if (r.service) svcCount[r.service] = (svcCount[r.service] || 0) + 1; });
    const topSvc = Object.entries(svcCount).sort((a, b) => b[1] - a[1]).slice(0, 3);

    /* Générer le rapport HTML imprimable */
    const win = window.open('', '_blank');
    if (!win) { if (toast) toast("Autoriser les popups pour générer le rapport", 'error'); return; }

    win.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Rapport Mensuel Miralocks — ${monthName}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 2rem; color: #1a1a1a; background: #fff; }
          header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 1.5rem; border-bottom: 3px solid #0C3320; margin-bottom: 2rem; }
          h1 { color: #0C3320; font-size: 1.6rem; }
          .subtitle { color: #C9A84C; font-size: .95rem; margin-top: .25rem; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
          .card { background: #f8f9fa; border-radius: 10px; padding: 1.25rem; border-left: 4px solid #0C3320; }
          .card-num { font-size: 2rem; font-weight: 800; color: #0C3320; }
          .card-label { font-size: .8rem; color: #666; margin-top: .2rem; }
          .section { margin-bottom: 1.5rem; }
          .section h2 { font-size: 1rem; color: #0C3320; border-bottom: 1px solid #eee; padding-bottom: .5rem; margin-bottom: 1rem; }
          table { width: 100%; border-collapse: collapse; font-size: .85rem; }
          th { background: #0C3320; color: #fff; padding: .6rem 1rem; text-align: left; }
          td { padding: .5rem 1rem; border-bottom: 1px solid #f0f0f0; }
          tr:hover td { background: #f8f9fa; }
          .badge-vert { background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 20px; font-size: .75rem; }
          .badge-rouge { background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 20px; font-size: .75rem; }
          .stars { color: #C9A84C; font-size: 1.1rem; }
          footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #eee; font-size: .75rem; color: #999; text-align: center; }
          @media print { body { padding: 1rem; } }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>🌿 Institut MiraLocks</h1>
            <div class="subtitle">Rapport mensuel — ${monthName}</div>
          </div>
          <div style="text-align:right;font-size:.8rem;color:#666">
            Généré le ${now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}<br>
            par le système Admin Miralocks
          </div>
        </header>

        <div class="grid">
          <div class="card">
            <div class="card-num">${monthRdvs.length}</div>
            <div class="card-label">Rendez-vous ce mois</div>
          </div>
          <div class="card">
            <div class="card-num">${confirmes}</div>
            <div class="card-label">Confirmés / Terminés</div>
          </div>
          <div class="card">
            <div class="card-num">${visiteStats.mois}</div>
            <div class="card-label">Visites sur le site</div>
          </div>
          <div class="card" style="border-left-color:#C9A84C">
            <div class="card-num">${tauxConv}%</div>
            <div class="card-label">Taux de conversion</div>
          </div>
          <div class="card" style="border-left-color:#C9A84C">
            <div class="card-num">${avgStars} ★</div>
            <div class="card-label">Satisfaction moyenne</div>
          </div>
          <div class="card" style="border-left-color:#ef4444">
            <div class="card-num">${annules}</div>
            <div class="card-label">RDV annulés</div>
          </div>
        </div>

        ${topSvc.length ? `
        <div class="section">
          <h2>📊 Services les plus demandés</h2>
          <table>
            <thead><tr><th>Service</th><th>Demandes</th><th>Part</th></tr></thead>
            <tbody>
              ${topSvc.map(([s, c]) => `
                <tr>
                  <td>${s}</td>
                  <td>${c}</td>
                  <td>${Math.round((c / monthRdvs.length) * 100)}%</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}

        <div class="section">
          <h2>📅 Liste des rendez-vous du mois</h2>
          <table>
            <thead><tr><th>Date</th><th>Client</th><th>Service</th><th>Statut</th></tr></thead>
            <tbody>
              ${monthRdvs.sort((a,b) => a.date_rdv.localeCompare(b.date_rdv)).map(r => `
                <tr>
                  <td>${new Date(r.date_rdv+'T12:00:00').toLocaleDateString('fr-FR')} ${r.heure || ''}</td>
                  <td>${r.nom}<br><small style="color:#666">${r.tel}</small></td>
                  <td>${r.service}</td>
                  <td><span class="${r.statut === 'annule' ? 'badge-rouge' : 'badge-vert'}">${r.statut}</span></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <footer>Institut MiraLocks · Rapport généré automatiquement · Confidentiel</footer>
        <script>window.onload = () => window.print();<\/script>
      </body>
      </html>
    `);
    win.document.close();

    if (toast) toast('Rapport généré !', 'success');
    await histLog('autre', 'Rapport mensuel généré', monthName);
  } catch (e) {
    const toast = window.toast || window.showToast;
    if (toast) toast('Erreur rapport : ' + e.message, 'error');
    console.error('[generateMonthlyReport]', e);
  }
};

/* Injecter le bouton Rapport dans le header admin */
document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.admin-header-right, .admin-header');
  if (!header) return;

  const btn = document.createElement('button');
  btn.id = 'btn-rapport-mensuel';
  btn.className = 'btn btn-outline btn-sm';
  btn.style.cssText = 'font-size:.78rem;display:flex;align-items:center;gap:.35rem;';
  btn.innerHTML = '<i class="fas fa-file-chart-line"></i> Rapport';
  btn.onclick = () => generateMonthlyReport();

  /* Injecter avant le bouton logout */
  const logout = document.getElementById('logout-btn');
  if (logout) logout.before(btn);
  else header.appendChild(btn);
});
