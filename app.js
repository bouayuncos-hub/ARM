/* ===================== INIT FIREBASE ===================== */
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
document.getElementById('anneeFooter').textContent = new Date().getFullYear();

/* ===================== LOGO ===================== */
document.querySelectorAll('.arm-logo').forEach(img => { img.src = LOGO_DATA_URI; });

/* ===================== MENU MOBILE ===================== */
document.getElementById('menuBtn').onclick = () => {
  document.getElementById('mobileMenu').classList.toggle('hidden');
};
document.querySelectorAll('#mobileMenu a').forEach(a => a.onclick = () => {
  document.getElementById('mobileMenu').classList.add('hidden');
});

/* ===================== RENDU PROGRAMME ===================== */
function renderProgramme(liste) {
  const grid = document.getElementById('programmeGrid');
  grid.innerHTML = (liste || PROGRAMME).map(p => `
    <div class="card p-5 text-center fade-in">
      <div class="text-4xl mb-3">${p.icone}</div>
      <h3 class="font-bold mb-2">${p.titre}</h3>
      <p class="text-sm text-gray-500">${p.texte}</p>
    </div>`).join('');
}

/* ===================== RENDU BUREAU ===================== */
function renderBureau(liste) {
  const membres = liste || BUREAU;
  const grid = document.getElementById('bureauGrid');
  grid.innerHTML = membres.map(m => `
    <div class="card p-5 fade-in">
      <p class="text-xs font-bold text-[var(--or)] uppercase mb-1">${m.role}</p>
      <p class="font-bold text-lg mb-1">${m.nom}</p>
      ${m.profession ? `<p class="text-sm text-gray-500 mb-1">${m.profession}</p>` : ''}
      ${m.lieu ? `<p class="text-sm text-gray-500 mb-2">📍 ${m.lieu}</p>` : ''}
      ${m.tel ? `<a href="tel:${m.tel}" class="text-sm text-[var(--vert)] font-semibold">☎ ${m.tel}</a>` : ''}
    </div>`).join('');

  // Contact section — dirigeants
  const cd = document.getElementById('contactDirigeants');
  cd.innerHTML = membres.filter(m => m.tel).map(m => `
    <p><b>${m.role} — ${m.nom} :</b> <a href="tel:${m.tel}" class="text-[var(--vert)]">${m.tel}</a></p>`).join('');
}

/* ===================== CONTENU DU SITE (piloté par l'admin) =====================
   Le bureau exécutif, le programme et les infos générales (devise, siège,
   coordonnées bancaires) sont d'abord affichés depuis data.js (valeurs par
   défaut), puis remplacés en temps réel si l'administrateur les a modifiés
   depuis le tableau de bord (collection Firestore `contenu`). Ainsi le site
   fonctionne même avant toute configuration côté admin. */
function chargerContenuDynamique() {
  try {
    db.collection('contenu').doc('bureau').onSnapshot(doc => {
      const d = doc.data();
      if (d && Array.isArray(d.membres) && d.membres.length) renderBureau(d.membres);
    });
    db.collection('contenu').doc('programme').onSnapshot(doc => {
      const d = doc.data();
      if (d && Array.isArray(d.items) && d.items.length) renderProgramme(d.items);
    });
    db.collection('contenu').doc('info').onSnapshot(doc => {
      const d = doc.data();
      if (!d) return;
      if (d.devise) {
        document.getElementById('deviseNav').textContent = d.devise;
        document.getElementById('deviseHero').textContent = d.devise.toUpperCase();
        document.getElementById('deviseFooter').textContent = d.devise;
      }
      if (d.siege) {
        document.getElementById('siegeContact').textContent = d.siege;
        document.getElementById('siegeFooter').textContent = d.siege;
      }
      if (d.iban) document.getElementById('ibanVirement').textContent = d.iban;
    });
  } catch (err) { console.error('Contenu dynamique :', err); }
}
/* ===================== REGIONS / CERCLES ===================== */
function renderRegions() {
  const rSel = document.getElementById('aRegion');
  Object.keys(REGIONS_MALI).forEach(r => {
    rSel.insertAdjacentHTML('beforeend', `<option value="${r}">${r}</option>`);
  });
  rSel.onchange = () => {
    const cSel = document.getElementById('aCercle');
    cSel.innerHTML = '<option value="">Cercle / Commune</option>';
    (REGIONS_MALI[rSel.value] || []).forEach(c => {
      cSel.insertAdjacentHTML('beforeend', `<option value="${c}">${c}</option>`);
    });
  };
}

/* ===================== DONS ===================== */
let montantChoisi = 5;
document.querySelectorAll('.montant-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.montant-btn').forEach(b => b.classList.remove('ring-2', 'ring-[var(--vert)]'));
    btn.classList.add('ring-2', 'ring-[var(--vert)]');
    montantChoisi = parseInt(btn.dataset.m);
    document.getElementById('montantLibre').value = '';
    majAffichage();
  };
});
document.getElementById('montantLibre').oninput = (e) => {
  if (e.target.value) montantChoisi = parseFloat(e.target.value);
  majAffichage();
};
function majAffichage() {
  document.getElementById('montantAffiche').textContent = `de ${montantChoisi} €`;
}

document.querySelectorAll('.donTab').forEach(t => {
  t.onclick = () => {
    document.querySelectorAll('.donTab').forEach(x => x.className = 'donTab flex-1 py-2 rounded-lg font-bold bg-gray-100');
    t.className = 'donTab flex-1 py-2 rounded-lg font-bold btn-primary';
    document.getElementById('formCarte').classList.toggle('hidden', t.dataset.tab !== 'carte');
    document.getElementById('formVirement').classList.toggle('hidden', t.dataset.tab !== 'virement');
    if (t.dataset.tab === 'virement') {
      document.getElementById('refVirement').textContent = Date.now().toString().slice(-8);
    }
  };
});

function genererReference() {
  return 'ARM-' + Date.now().toString(36).toUpperCase();
}

document.getElementById('formCarte').addEventListener('submit', async (e) => {
  e.preventDefault();
  const ref = genererReference();
  const don = {
    montant: montantChoisi,
    methode: 'carte',
    nom: document.getElementById('donNom').value,
    email: document.getElementById('donEmail').value,
    reference: ref,
    statut: 'simulé - à confirmer', // aucun vrai encaissement n'est effectué ici
    createdAt: Date.now()
  };
  try {
    await db.collection('dons').add(don);
    await db.collection('compteurs').doc('global').set(
      { donsTotal: firebase.firestore.FieldValue.increment(don.montant) }, { merge: true }
    );
  } catch (err) { console.error(err); }
  afficherConfirmationDon(ref, don.montant);
  e.target.reset();
});

document.getElementById('btnVirementFait').addEventListener('click', async () => {
  const ref = 'DON-ARM-' + document.getElementById('refVirement').textContent;
  try {
    await db.collection('dons').add({
      montant: montantChoisi, methode: 'virement_bms', reference: ref,
      statut: 'en attente de confirmation', createdAt: Date.now()
    });
    await db.collection('compteurs').doc('global').set(
      { donsTotal: firebase.firestore.FieldValue.increment(montantChoisi) }, { merge: true }
    );
  } catch (err) { console.error(err); }
  afficherConfirmationDon(ref, montantChoisi);
});

function afficherConfirmationDon(ref, montant) {
  const box = document.getElementById('donConfirm');
  box.classList.remove('hidden');
  box.innerHTML = `✅ Merci pour votre don de <b>${montant} €</b> ! Référence : <b>${ref}</b>. Un reçu vous sera envoyé après confirmation par l'administrateur.`;
}

/* ===================== ADHESION ===================== */
document.getElementById('formAdhesion').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    nom: aNom.value, prenom: aPrenom.value, tel: aTel.value, email: aEmail.value,
    profession: aProfession.value, pays: aPays.value, region: aRegion.value,
    cercle: aCercle.value, quartier: aQuartier.value, message: aMessage.value,
    statut: 'en attente', createdAt: Date.now()
  };
  try {
    await db.collection('adhesions').add(data);
    await db.collection('compteurs').doc('global').set(
      { adhesions: firebase.firestore.FieldValue.increment(1) }, { merge: true }
    );
  } catch (err) { console.error(err); }
  document.getElementById('adhesionConfirm').classList.remove('hidden');
  document.getElementById('adhesionConfirm').innerHTML = `✅ Merci ${data.prenom} ! Votre demande d'adhésion a bien été reçue et sera validée par l'administration du parti.`;
  e.target.reset();
});

/* ===================== ACTUALITES & EVENEMENTS ===================== */
async function chargerActualites() {
  const grid = document.getElementById('actualitesGrid');
  try {
    const snap = await db.collection('actualites').orderBy('createdAt', 'desc').limit(12).get();
    if (snap.empty) { grid.innerHTML = '<p class="text-gray-400 text-sm">Aucune actualité pour le moment.</p>'; return; }
    grid.innerHTML = '';
    snap.forEach(doc => {
      const a = doc.data();
      grid.insertAdjacentHTML('beforeend', `
        <div class="card overflow-hidden fade-in">
          ${a.image ? `<img src="${a.image}" class="w-full h-40 object-cover">` : ''}
          <div class="p-4">
            <p class="text-xs text-gray-400 mb-1">${a.date || ''}</p>
            <h3 class="font-bold mb-2">${a.titre || ''}</h3>
            <p class="text-sm text-gray-500 mb-2">${(a.contenu || '').slice(0, 140)}${(a.contenu || '').length > 140 ? '…' : ''}</p>
            ${a.lienVisio ? `<a href="${a.lienVisio}" target="_blank" class="text-sm font-bold text-[var(--vert)]">🎥 Rejoindre la visioconférence</a>` : ''}
            ${a.lieu ? `<p class="text-xs text-gray-400 mt-1">📍 ${a.lieu}</p>` : ''}
          </div>
        </div>`);
    });
  } catch (err) {
    grid.innerHTML = '<p class="text-gray-400 text-sm">Connecte Firebase pour afficher les actualités.</p>';
  }
}

/* ===================== CHAT PUBLIC ===================== */
function initChat() {
  const box = document.getElementById('chatBox');
  try {
    db.collection('chat').orderBy('createdAt', 'asc').limitToLast(50).onSnapshot(snap => {
      box.innerHTML = '';
      snap.forEach(doc => {
        const m = doc.data();
        box.insertAdjacentHTML('beforeend', `
          <div class="text-sm bg-gray-50 rounded-lg px-3 py-2">
            <span class="font-bold text-[var(--vert)]">${m.nom} :</span> ${m.message}
          </div>`);
      });
      box.scrollTop = box.scrollHeight;
    });
  } catch (err) { console.error(err); }
}

document.getElementById('chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nom = chatNom.value.trim(), message = chatMsg.value.trim();
  if (!nom || !message) return;
  try {
    await db.collection('chat').add({ nom, message, createdAt: Date.now() });
  } catch (err) { console.error(err); }
  chatMsg.value = '';
});

/* ===================== CONTACT ===================== */
document.getElementById('formContact').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    nom: cNom.value, email: cEmail.value, sujet: cSujet.value,
    message: cMessage.value, lu: false, createdAt: Date.now()
  };
  try {
    await db.collection('messages').add(data);
    await db.collection('compteurs').doc('global').set(
      { messages: firebase.firestore.FieldValue.increment(1) }, { merge: true }
    );
  } catch (err) { console.error(err); }
  document.getElementById('contactConfirm').classList.remove('hidden');
  document.getElementById('contactConfirm').textContent = '✅ Message envoyé. Nous vous répondrons rapidement.';
  e.target.reset();
});

/* ===================== INSTALLATION PWA ===================== */
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBtn').classList.remove('hidden');
});
document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('installBtn').classList.add('hidden');
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

/* ===================== ANIMATIONS AU SCROLL ===================== */
const obs = new IntersectionObserver(entries => {
  entries.forEach(en => { if (en.isIntersecting) en.target.classList.add('show'); });
}, { threshold: .15 });
function observerFadeIn() { document.querySelectorAll('.fade-in').forEach(el => obs.observe(el)); }

/* ===================== INIT ===================== */
renderProgramme();
renderBureau();
chargerContenuDynamique();
renderRegions();
chargerActualites();
initChat();
setTimeout(observerFadeIn, 300);
