/* =========================================================================
   UTILITAIRES PARTAGÉS (site public + tableau de bord)
   =========================================================================
   esc()      : neutralise tout texte venant de Firestore avant de l'insérer
                dans la page. Indispensable pour le chat public : sans cela,
                un visiteur pourrait glisser du code dans un message et
                prendre le contrôle de la session de l'administrateur.
   safeUrl()  : n'accepte que les liens http(s) (bloque "javascript:...").
   ========================================================================= */

function esc(valeur) {
  return String(valeur ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url) {
  const u = String(url || '').trim();
  return /^https?:\/\//i.test(u) ? esc(u) : '';
}

function telLien(tel) {
  return String(tel || '').replace(/[^\d+]/g, '');
}

function formatDate(ms) {
  if (!ms) return '';
  try { return new Date(ms).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); }
  catch (e) { return ''; }
}

/* Petite notification temporaire en bas de l'écran */
function toast(message, type = 'ok') {
  let zone = document.getElementById('toastZone');
  if (!zone) {
    zone = document.createElement('div');
    zone.id = 'toastZone';
    zone.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;';
    document.body.appendChild(zone);
  }
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText = `pointer-events:auto;padding:10px 16px;border-radius:10px;font-size:14px;font-weight:600;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.2);max-width:90vw;background:${type === 'erreur' ? '#b42318' : '#0f7a3d'};`;
  zone.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
