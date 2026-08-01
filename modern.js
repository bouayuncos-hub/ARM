/* =========================================================================
   MODERN.JS — Fonctions modernes du site public A.R.M
   =========================================================================
   - Mode sombre (persisté dans localStorage, respecte la préférence système)
   - Statistiques publiques en temps réel (adhérents, dons, messages)
   - Recherche/filtre côté client sur le Bureau exécutif
   - Recherche/filtre sur les actualités déjà chargées (voir app.js)
   - Partage social (API Web Share native + repli presse-papiers/WhatsApp)
   - Notifications push (Firebase Cloud Messaging), activées seulement
     si une clé VAPID a été renseignée dans data.js
   Ce fichier ne modifie aucune fonction existante : il vient en complément
   d'app.js et armtv.js, chargé après eux.
   ========================================================================= */

/* ===================== MODE SOMBRE — bouton ===================== */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const majIcone = () => {
    btn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
  };
  majIcone();
  btn.addEventListener('click', () => {
    const estSombre = document.documentElement.getAttribute('data-theme') === 'dark';
    if (estSombre) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('arm-theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('arm-theme', 'dark');
    }
    majIcone();
  });
});

/* ===================== STATISTIQUES PUBLIQUES EN TEMPS RÉEL ===================== */
function animerCompteur(el, valeurFinale, suffixe) {
  if (!el) return;
  suffixe = suffixe || '';
  const depart = parseInt(el.dataset.val || '0', 10);
  const duree = 900;
  const t0 = performance.now();
  function step(t) {
    const p = Math.min(1, (t - t0) / duree);
    const val = Math.round(depart + (valeurFinale - depart) * p);
    el.textContent = val.toLocaleString('fr-FR') + suffixe;
    if (p < 1) requestAnimationFrame(step); else el.dataset.val = String(valeurFinale);
  }
  requestAnimationFrame(step);
}
function initStats() {
  if (typeof db === 'undefined') return;
  try {
    db.collection('compteurs').doc('global').onSnapshot(doc => {
      const d = doc.data() || {};
      animerCompteur(document.getElementById('statAdherents'), d.adhesions || 0);
      animerCompteur(document.getElementById('statDons'), d.donsTotal || 0, ' €');
      animerCompteur(document.getElementById('statMessages'), d.messages || 0);
    });
  } catch (err) { console.error('Statistiques publiques :', err); }
}

/* ===================== RECHERCHE — BUREAU EXÉCUTIF (instantanée, côté client) ===================== */
function initRechercheBureau() {
  const input = document.getElementById('rechercheBureau');
  if (!input) return;
  input.addEventListener('input', () => {
    const terme = input.value.trim().toLowerCase();
    document.querySelectorAll('.bureau-card').forEach(carte => {
      carte.classList.toggle('hidden', !!terme && !carte.textContent.toLowerCase().includes(terme));
    });
  });
}

/* ===================== RECHERCHE — ACTUALITÉS =====================
   Filtre les cartes déjà chargées par le défilement infini (app.js).
   Le défilement continue de charger d'autres pages pendant la recherche ;
   filtrerActualites() est rappelée après chaque nouvelle page (voir app.js). */
function filtrerActualites() {
  const input = document.getElementById('rechercheActu');
  if (!input) return;
  const terme = input.value.trim().toLowerCase();
  document.querySelectorAll('.actu-card').forEach(carte => {
    carte.classList.toggle('hidden', !!terme && !carte.textContent.toLowerCase().includes(terme));
  });
}
function initRechercheActualites() {
  const input = document.getElementById('rechercheActu');
  if (!input) return;
  input.addEventListener('input', filtrerActualites);
}

/* ===================== PARTAGE SOCIAL ===================== */
async function partager(titre, url) {
  const texte = `${titre} — Alliance pour le Rassemblement Malien`;
  if (navigator.share) {
    try { await navigator.share({ title: titre, text: texte, url }); } catch (err) { /* annulé par l'utilisateur, rien à faire */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    alert('Lien copié dans le presse-papiers !');
  } catch (err) {
    window.open(`https://wa.me/?text=${encodeURIComponent(texte + ' ' + url)}`, '_blank');
  }
}
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.share-btn');
  if (!btn) return;
  partager(btn.dataset.titre || 'A.R.M', btn.dataset.url || location.href);
});

/* ===================== NOTIFICATIONS PUSH (Firebase Cloud Messaging) =====================
   Le bouton 🔔 reste masqué tant que VAPID_KEY (dans data.js) est vide.
   Une fois la clé renseignée par l'administrateur :
   - clic → demande la permission navigateur → récupère un token FCM
   - le token est enregistré dans la collection Firestore `abonnes_push`
   - sw.js gère déjà la réception des notifications en arrière-plan. */
function initNotifications() {
  const btn = document.getElementById('notifBtn');
  if (!btn) return;
  if (!('Notification' in window) || typeof firebase === 'undefined' || !firebase.messaging) return;
  if (typeof VAPID_KEY === 'undefined' || !VAPID_KEY) return;
  btn.classList.remove('hidden');
  btn.addEventListener('click', async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      const messaging = firebase.messaging();
      const token = await messaging.getToken({ vapidKey: VAPID_KEY });
      if (token) {
        await db.collection('abonnes_push').doc(token).set({ token, createdAt: Date.now() });
        btn.textContent = '🔔✅';
        btn.title = 'Notifications activées';
      }
    } catch (err) { console.error('Notifications push :', err); }
  });
}

/* ===================== INIT ===================== */
document.addEventListener('DOMContentLoaded', () => {
  initStats();
  initRechercheBureau();
  initRechercheActualites();
  initNotifications();
});
