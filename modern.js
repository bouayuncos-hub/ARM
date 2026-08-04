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

/* ===================== ASSISTANT D'ADHÉSION EN 3 ÉTAPES =====================
   Les champs gardent leurs IDs d'origine (aNom, aPrenom, …) : la soumission
   du formulaire dans app.js n'a pas besoin d'être modifiée. Ce module ne
   gère que la navigation entre étapes, leur validation et le récapitulatif. */
function initAdhesionWizard() {
  const form = document.getElementById('formAdhesion');
  if (!form) return;
  const panels = Array.from(form.querySelectorAll('.step-panel'));
  const dots = Array.from(document.querySelectorAll('#stepIndicator .step-dot'));
  const btnPrev = document.getElementById('stepPrev');
  const btnNext = document.getElementById('stepNext');
  const btnSubmit = document.getElementById('stepSubmit');
  let etape = 1;
  const total = panels.length;

  function majAffichageEtape() {
    panels.forEach(p => p.classList.toggle('active', Number(p.dataset.step) === etape));
    dots.forEach(d => {
      const n = Number(d.dataset.step);
      d.classList.toggle('active', n === etape);
      d.classList.toggle('done', n < etape);
    });
    btnPrev.classList.toggle('hidden', etape === 1);
    btnNext.classList.toggle('hidden', etape === total);
    btnSubmit.classList.toggle('hidden', etape !== total);
    if (etape === total) remplirRecap();
  }

  function etapeValide() {
    const champs = panels.find(p => Number(p.dataset.step) === etape).querySelectorAll('[required]');
    for (const champ of champs) { if (!champ.reportValidity()) return false; }
    return true;
  }

  function remplirRecap() {
    const box = document.getElementById('adhesionRecap');
    if (!box) return;
    const val = (id) => (document.getElementById(id) || {}).value || '—';
    box.innerHTML = `
      <p><b>Nom :</b> ${val('aNom')} ${val('aPrenom')}</p>
      <p><b>Téléphone :</b> ${val('aTel')}</p>
      <p><b>Email :</b> ${val('aEmail')}</p>
      <p><b>Localisation :</b> ${val('aQuartier')}, ${val('aCercle')}, ${val('aRegion')}, ${val('aPays')}</p>`;
  }

  btnNext.addEventListener('click', () => {
    if (!etapeValide()) return;
    etape = Math.min(total, etape + 1);
    majAffichageEtape();
  });
  btnPrev.addEventListener('click', () => {
    etape = Math.max(1, etape - 1);
    majAffichageEtape();
  });
  // Empêche la validation "Entrée" de sauter directement à l'envoi avant la dernière étape
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && etape < total) { e.preventDefault(); btnNext.click(); }
  });

  majAffichageEtape();
}

/* ===================== ONGLET DE DON — MOBILE MONEY =====================
   Complète la logique existante des onglets (app.js) pour le 3e onglet
   sans la modifier : cache/affiche simplement le panneau Mobile Money. */
function initDonMobileMoney() {
  const tabs = document.querySelectorAll('.donTab');
  if (!tabs.length) return;
  tabs.forEach(t => {
    t.addEventListener('click', () => {
      document.getElementById('formMobileMoney').classList.toggle('hidden', t.dataset.tab !== 'mobile');
      if (t.dataset.tab === 'mobile') {
        document.getElementById('refMobile').textContent = Date.now().toString().slice(-8);
      }
    });
  });
  const btn = document.getElementById('btnMobileFait');
  if (btn) {
    btn.addEventListener('click', async () => {
      const ref = 'DON-ARM-' + document.getElementById('refMobile').textContent;
      try {
        await db.collection('dons').add({
          montant: window.montantChoisi || 0, methode: 'mobile_money', reference: ref,
          statut: 'en attente de confirmation', createdAt: Date.now()
        });
        await db.collection('compteurs').doc('global').set(
          { donsTotal: firebase.firestore.FieldValue.increment(window.montantChoisi || 0) }, { merge: true }
        );
      } catch (err) { console.error(err); }
      const box = document.getElementById('donConfirm');
      box.classList.remove('hidden');
      box.innerHTML = `✅ Merci pour votre don de <b>${window.montantChoisi || 0} €</b> ! Référence : <b>${ref}</b>. Un reçu vous sera envoyé après confirmation par l'administrateur.`;
    });
  }
}

/* ===================== INIT ===================== */
document.addEventListener('DOMContentLoaded', () => {
  initStats();
  initRechercheBureau();
  initRechercheActualites();
  initNotifications();
  initAdhesionWizard();
  initDonMobileMoney();
});
