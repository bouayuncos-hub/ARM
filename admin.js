firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

/* ===================== LOGO ===================== */
document.querySelectorAll('.arm-logo').forEach(img => { img.src = LOGO_DATA_URI; });

/* ===================== AUTHENTIFICATION (mot de passe unique) =====================
   L'admin ne saisit que le mot de passe. On l'envoie à Firebase Auth avec un
   email technique fixe (ADMIN_EMAIL_FIXE, défini dans data.js) — la sécurité
   réelle des données (règles Firestore/Storage) reste assurée par un vrai
   compte Firebase Authentication, pas par un simple mot de passe côté client. */
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('loginErr');
  err.classList.add('hidden');
  try {
    await auth.signInWithEmailAndPassword(ADMIN_EMAIL_FIXE, loginPass.value);
  } catch (ex) {
    err.textContent = "Mot de passe incorrect.";
    err.classList.remove('hidden');
  }
});
document.getElementById('logoutBtn').onclick = () => auth.signOut();

let listesActives = [];
auth.onAuthStateChanged(user => {
  if (user) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    demarrerTout();
  } else {
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    listesActives.forEach(l => l.arreter());
    listesActives = [];
  }
});

/* ===================== NAVIGATION ONGLETS ===================== */
let galerieInitialisee = false;
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.classList.add('bg-gray-200'); });
    btn.classList.add('active'); btn.classList.remove('bg-gray-200');
    document.querySelectorAll('.tab-content').forEach(s => s.classList.add('hidden'));
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
    if (btn.dataset.tab === 'galerie' && !galerieInitialisee) {
      galerieInitialisee = true;
      const g = initGalerieMedias({
        db, storage,
        inputEl: document.getElementById('galerieInput'),
        progressEl: document.getElementById('galerieProgress'),
        gridEl: document.getElementById('galerieGrid'),
        sentinelEl: document.getElementById('sentinelGalerie')
      });
      listesActives.push(g);
    }
  };
});

function demarrerTout() {
  demarrerCompteurs();
  demarrerAdhesions();
  demarrerDons();
  chargerActualitesAdmin();
  chargerMessages();
  demarrerChat();
}

/* ===================== COMPTEURS GLOBAUX (production-friendly) =====================
   Au lieu de télécharger toutes les adhésions/tous les dons pour les compter
   (coûteux et lent à grande échelle), un unique document `compteurs/global`
   est incrémenté de façon atomique (FieldValue.increment) à chaque nouvelle
   adhésion / don / message côté site public (voir app.js). Le tableau de
   bord se contente d'écouter ce petit document en temps réel : lecture
   quasi gratuite quel que soit le nombre total d'enregistrements. */
function demarrerCompteurs() {
  const off = db.collection('compteurs').doc('global').onSnapshot(doc => {
    const c = doc.data() || {};
    document.getElementById('statAdh').textContent = c.adhesions || 0;
    document.getElementById('statDons').textContent = (c.donsTotal || 0) + ' €';
    document.getElementById('statMsg').textContent = c.messages || 0;
    dessinerGraphique(c);
  });
  listesActives.push({ arreter: off });
}

/* ===================== ADHESIONS (défilement infini) ===================== */
function demarrerAdhesions() {
  const tbody = document.getElementById('tblAdhesions');
  const liste = creerDefilementInfini({
    collection: db.collection('adhesions'),
    orderBy: ['createdAt', 'desc'],
    pageSize: 25,
    sentinel: document.getElementById('sentinelAdhesions'),
    onPage: (docs, estPremierePage) => {
      if (estPremierePage) tbody.innerHTML = '';
      docs.forEach(doc => {
        const a = doc.data();
        tbody.insertAdjacentHTML('beforeend', `
          <tr>
            <td>${a.prenom || ''} ${a.nom || ''}<br><span class="text-gray-400">${a.email || ''}</span></td>
            <td><a class="text-[var(--vert)]" href="tel:${a.tel}">${a.tel || ''}</a></td>
            <td>${a.region || ''}</td>
            <td>${a.cercle || ''}</td>
            <td><span class="pill ${a.statut === 'validé' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${a.statut || 'en attente'}</span></td>
            <td class="whitespace-nowrap">
              <button class="text-green-600 font-bold mr-2" onclick="majAdhesion('${doc.id}','validé')">✔ Valider</button>
              <button class="text-red-600 font-bold" onclick="majAdhesion('${doc.id}','refusé')">✖ Refuser</button>
            </td>
          </tr>`);
      });
    }
  });
  liste.demarrer();
  listesActives.push(liste);
}
function majAdhesion(id, statut) {
  db.collection('adhesions').doc(id).update({ statut });
}

/* ===================== DONS (défilement infini) ===================== */
function demarrerDons() {
  const tbody = document.getElementById('tblDons');
  const liste = creerDefilementInfini({
    collection: db.collection('dons'),
    orderBy: ['createdAt', 'desc'],
    pageSize: 25,
    sentinel: document.getElementById('sentinelDons'),
    onPage: (docs, estPremierePage) => {
      if (estPremierePage) tbody.innerHTML = '';
      docs.forEach(doc => {
        const d = doc.data();
        tbody.insertAdjacentHTML('beforeend', `
          <tr>
            <td>${d.montant || 0} €</td>
            <td>${d.methode === 'carte' ? '💳 Carte' : '🏦 Virement BMS'}</td>
            <td>${d.nom || d.reference || ''}<br><span class="text-gray-400">${d.reference || ''}</span></td>
            <td><span class="pill ${d.statut === 'confirmé' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${d.statut || ''}</span></td>
            <td><button class="text-green-600 font-bold" onclick="confirmerDon('${doc.id}')">✔ Confirmer</button></td>
          </tr>`);
      });
    }
  });
  liste.demarrer();
  listesActives.push(liste);
}
function confirmerDon(id) {
  db.collection('dons').doc(id).update({ statut: 'confirmé' });
}

/* ===================== ACTUALITES / EVENEMENTS =====================
   Volume naturellement limité (publications de l'administrateur) : un
   simple onSnapshot reste ici le plus simple et le plus réactif. */
document.getElementById('formActu').addEventListener('submit', async (e) => {
  e.preventDefault();
  await db.collection('actualites').add({
    titre: actuTitre.value, date: actuDate.value, image: actuImage.value,
    lienVisio: actuLien.value, lieu: actuLieu.value, contenu: actuContenu.value,
    createdAt: Date.now()
  });
  e.target.reset();
});

function chargerActualitesAdmin() {
  const off = db.collection('actualites').orderBy('createdAt', 'desc').onSnapshot(snap => {
    const liste = document.getElementById('listeActu');
    const listeEv = document.getElementById('listeEv');
    liste.innerHTML = ''; listeEv.innerHTML = '';
    let aVenir = 0;
    const today = new Date().toISOString().slice(0, 10);
    snap.forEach(doc => {
      const a = doc.data();
      if (a.date && a.date >= today) aVenir++;
      const html = `
        <div class="card p-4 flex justify-between items-start gap-3">
          <div>
            <p class="font-bold">${a.titre}</p>
            <p class="text-xs text-gray-400">${a.date || ''} ${a.lieu ? '· ' + a.lieu : ''}</p>
            <p class="text-sm text-gray-600 mt-1">${(a.contenu || '').slice(0, 200)}</p>
            ${a.lienVisio ? `<a href="${a.lienVisio}" target="_blank" class="text-sm text-[var(--vert)] font-bold">🎥 Lien visio</a>` : ''}
          </div>
          <button class="text-red-600 font-bold" onclick="suppActu('${doc.id}')">🗑</button>
        </div>`;
      liste.insertAdjacentHTML('beforeend', html);
      if (a.date && a.date >= today) listeEv.insertAdjacentHTML('beforeend', html);
    });
    document.getElementById('statEv').textContent = aVenir;
  });
  listesActives.push({ arreter: off });
}
function suppActu(id) { db.collection('actualites').doc(id).delete(); }

/* ===================== MESSAGES CONTACT =====================
   Volume modéré : onSnapshot avec limite raisonnable suffit ici. */
function chargerMessages() {
  const off = db.collection('messages').orderBy('createdAt', 'desc').limit(200).onSnapshot(snap => {
    const tbody = document.getElementById('tblMessages');
    tbody.innerHTML = '';
    snap.forEach(doc => {
      const m = doc.data();
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${m.nom || ''}</td>
          <td>${m.email || ''}</td>
          <td>${m.sujet || ''}</td>
          <td>${m.message || ''}</td>
          <td>
            <button class="pill ${m.lu ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}" onclick="toggleLu('${doc.id}', ${!m.lu})">
              ${m.lu ? 'Lu' : 'Marquer lu'}
            </button>
          </td>
        </tr>`);
    });
  });
  listesActives.push({ arreter: off });
}
function toggleLu(id, val) { db.collection('messages').doc(id).update({ lu: val }); }

/* ===================== MODERATION CHAT (défilement infini) ===================== */
function demarrerChat() {
  const tbody = document.getElementById('tblChat');
  const liste = creerDefilementInfini({
    collection: db.collection('chat'),
    orderBy: ['createdAt', 'desc'],
    pageSize: 30,
    sentinel: document.getElementById('sentinelChat'),
    onPage: (docs, estPremierePage) => {
      if (estPremierePage) tbody.innerHTML = '';
      docs.forEach(doc => {
        const c = doc.data();
        tbody.insertAdjacentHTML('beforeend', `
          <tr>
            <td>${c.nom || ''}</td>
            <td>${c.message || ''}</td>
            <td>${new Date(c.createdAt).toLocaleString('fr-FR')}</td>
            <td><button class="text-red-600 font-bold" onclick="suppMsgChat('${doc.id}')">🗑</button></td>
          </tr>`);
      });
    }
  });
  liste.demarrer();
  listesActives.push(liste);
}
function suppMsgChat(id) { db.collection('chat').doc(id).delete(); }

/* ===================== GRAPHIQUE ANALYTIQUE ===================== */
let chartInst = null;
function dessinerGraphique(compteurs) {
  const ctx = document.getElementById('chartAdh');
  if (!ctx || typeof Chart === 'undefined') return;
  const labels = ['Adhésions', 'Dons confirmés (€)', 'Messages'];
  const data = [compteurs.adhesions || 0, compteurs.donsTotal || 0, compteurs.messages || 0];
  if (chartInst) chartInst.destroy();
  chartInst = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Activité globale', data, backgroundColor: ['#0f7a3d', '#f4b400', '#c1272d'] }] },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}
