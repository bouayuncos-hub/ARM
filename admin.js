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
  demarrerArmtv();
  demarrerContenu();
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
              <button class="text-red-600 font-bold mr-2" onclick="majAdhesion('${doc.id}','refusé')">✖ Refuser</button>
              <button class="text-gray-500 font-bold" onclick="supprAdhesion('${doc.id}')">🗑</button>
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
function supprAdhesion(id) { db.collection('adhesions').doc(id).delete(); }

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
            <td><button class="text-green-600 font-bold" onclick="confirmerDon('${doc.id}')">✔ Confirmer</button> <button class="text-gray-500 font-bold" onclick="supprDon('${doc.id}')">🗑</button></td>
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
function supprDon(id) { db.collection('dons').doc(id).delete(); }

/* ===================== ACTUALITES / EVENEMENTS =====================
   Volume naturellement limité (publications de l'administrateur) : un
   simple onSnapshot reste ici le plus simple et le plus réactif. */
let actuEnEdition = null;
document.getElementById('formActu').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    titre: actuTitre.value, date: actuDate.value, image: actuImage.value,
    lienVisio: actuLien.value, lieu: actuLieu.value, contenu: actuContenu.value
  };
  if (actuEnEdition) {
    await db.collection('actualites').doc(actuEnEdition).update(data);
    actuEnEdition = null;
    document.getElementById('actuBtnSubmit').textContent = 'Publier';
  } else {
    await db.collection('actualites').add({ ...data, createdAt: Date.now() });
  }
  e.target.reset();
});
function actuModifier(id, titre, date, image, lienVisio, lieu, contenu) {
  actuEnEdition = id;
  actuTitre.value = titre; actuDate.value = date || ''; actuImage.value = image || '';
  actuLien.value = lienVisio || ''; actuLieu.value = lieu || ''; actuContenu.value = contenu || '';
  document.getElementById('actuBtnSubmit').textContent = 'Enregistrer la modification';
  document.getElementById('formActu').scrollIntoView({ behavior: 'smooth' });
}

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
          <div class="flex flex-col gap-1 text-sm whitespace-nowrap">
            <button class="text-[var(--vert)] font-bold" onclick='actuModifier(${JSON.stringify(doc.id)}, ${JSON.stringify(a.titre||"")}, ${JSON.stringify(a.date||"")}, ${JSON.stringify(a.image||"")}, ${JSON.stringify(a.lienVisio||"")}, ${JSON.stringify(a.lieu||"")}, ${JSON.stringify(a.contenu||"")})'>✎ Modifier</button>
            <button class="text-red-600 font-bold" onclick="suppActu('${doc.id}')">🗑 Supprimer</button>
          </div>
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
            <button class="text-gray-500 font-bold ml-2" onclick="supprMessage('${doc.id}')">🗑</button>
          </td>
        </tr>`);
    });
  });
  listesActives.push({ arreter: off });
}
function toggleLu(id, val) { db.collection('messages').doc(id).update({ lu: val }); }
function supprMessage(id) { db.collection('messages').doc(id).delete(); }

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

/* ===================== ARM TV ===================== */
function demarrerArmtv() {
  // Options de thème
  const sel = document.getElementById('tvTheme');
  if (sel && !sel.children.length) {
    sel.innerHTML = THEMES_ARMTV.map(t => `<option value="${t}">${t}</option>`).join('');
  }

  // Ajout d'une vidéo
  document.getElementById('formArmtv').addEventListener('submit', async (e) => {
    e.preventDefault();
    await db.collection('armtv_videos').add({
      titre: tvTitre.value, theme: tvTheme.value, ordre: parseInt(tvOrdre.value) || 0,
      urlVideo: tvUrlVideo.value, miniature: tvMiniature.value, description: tvDescription.value,
      statut: 'en attente', createdAt: Date.now()
    });
    e.target.reset();
  });

  // Direct
  document.getElementById('formDirect').addEventListener('submit', async (e) => {
    e.preventDefault();
    const activer = e.submitter && e.submitter.dataset.on === 'true';
    await db.collection('armtv_config').doc('direct').set({
      enDirect: activer,
      urlDirect: activer ? directUrl.value : '',
      titreDirect: activer ? directTitre.value : ''
    }, { merge: true });
  });

  // Liste des vidéos (défilement infini)
  const conteneur = document.getElementById('listeArmtv');
  const liste = creerDefilementInfini({
    collection: db.collection('armtv_videos'),
    orderBy: ['createdAt', 'desc'],
    pageSize: 20,
    sentinel: document.getElementById('sentinelArmtv'),
    onPage: (docs, estPremierePage) => {
      if (estPremierePage) conteneur.innerHTML = '';
      docs.forEach(doc => {
        const v = doc.data();
        const pillClasse = v.statut === 'approuvé' ? 'bg-green-100 text-green-700' : v.statut === 'refusé' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';
        conteneur.insertAdjacentHTML('beforeend', `
          <div class="card p-4 flex justify-between items-start gap-3">
            <div>
              <p class="font-bold">${v.titre}</p>
              <p class="text-xs text-gray-400">${v.theme || ''} · ordre ${v.ordre ?? 0}</p>
              <p class="text-sm text-gray-600 mt-1">${v.description || ''}</p>
              <span class="pill ${pillClasse}">${v.statut}</span>
            </div>
            <div class="flex flex-col gap-1 text-sm whitespace-nowrap">
              <button class="text-green-600 font-bold" onclick="armtvMaj('${doc.id}','approuvé')">✔ Approuver</button>
              <button class="text-red-600 font-bold" onclick="armtvMaj('${doc.id}','refusé')">✖ Refuser</button>
              <button class="text-gray-500 font-bold" onclick="armtvSupp('${doc.id}')">🗑 Supprimer</button>
            </div>
          </div>`);
      });
    }
  });
  liste.demarrer();
  listesActives.push(liste);
}
function armtvMaj(id, statut) { db.collection('armtv_videos').doc(id).update({ statut }); }
function armtvSupp(id) { db.collection('armtv_videos').doc(id).delete(); }
/* ===================== CONTENU DU SITE (contrôle total admin) =====================
   L'administrateur peut modifier ou supprimer : les infos générales (devise,
   siège, IBAN), chaque membre du bureau exécutif, et chaque point du
   programme politique. Tout est stocké dans la collection `contenu` et
   reflété en direct sur le site public (voir chargerContenuDynamique dans
   app.js). Les valeurs de data.js ne servent plus que de valeurs de
   démarrage si l'administrateur n'a encore rien personnalisé. */
let bureauActuel = [];
let programmeActuel = [];

function demarrerContenu() {
  // Infos générales
  const offInfo = db.collection('contenu').doc('info').onSnapshot(doc => {
    const d = doc.data() || {};
    infoDevise.value = d.devise || PARTY_INFO.devise;
    infoSiege.value = d.siege || PARTY_INFO.siege;
    infoIban.value = d.iban || '';
  });
  listesActives.push({ arreter: offInfo });

  document.getElementById('formInfo').addEventListener('submit', async (e) => {
    e.preventDefault();
    await db.collection('contenu').doc('info').set({
      devise: infoDevise.value, siege: infoSiege.value, iban: infoIban.value
    }, { merge: true });
  });

  // Bureau exécutif
  const offBureau = db.collection('contenu').doc('bureau').onSnapshot(doc => {
    const d = doc.data();
    bureauActuel = (d && Array.isArray(d.membres) && d.membres.length) ? d.membres : BUREAU.slice();
    renderListeBureau();
  });
  listesActives.push({ arreter: offBureau });

  document.getElementById('formBureauMembre').addEventListener('submit', async (e) => {
    e.preventDefault();
    const membre = { role: bmRole.value, nom: bmNom.value, profession: bmProfession.value, lieu: bmLieu.value, tel: bmTel.value };
    const idx = parseInt(bmIndex.value);
    if (idx >= 0) bureauActuel[idx] = membre; else bureauActuel.push(membre);
    await db.collection('contenu').doc('bureau').set({ membres: bureauActuel }, { merge: true });
    resetFormBureau();
  });
  document.getElementById('bmBtnAnnuler').onclick = resetFormBureau;

  // Programme politique
  const offProg = db.collection('contenu').doc('programme').onSnapshot(doc => {
    const d = doc.data();
    programmeActuel = (d && Array.isArray(d.items) && d.items.length) ? d.items : PROGRAMME.slice();
    renderListeProgramme();
  });
  listesActives.push({ arreter: offProg });

  document.getElementById('formProgrammeItem').addEventListener('submit', async (e) => {
    e.preventDefault();
    const item = { icone: piIcone.value, titre: piTitre.value, texte: piTexte.value };
    const idx = parseInt(piIndex.value);
    if (idx >= 0) programmeActuel[idx] = item; else programmeActuel.push(item);
    await db.collection('contenu').doc('programme').set({ items: programmeActuel }, { merge: true });
    resetFormProgramme();
  });
  document.getElementById('piBtnAnnuler').onclick = resetFormProgramme;
}

function renderListeBureau() {
  document.getElementById('listeBureau').innerHTML = bureauActuel.map((m, i) => `
    <div class="flex justify-between items-center border-b py-2 text-sm">
      <div><b>${m.role}</b> — ${m.nom} ${m.tel ? '· ' + m.tel : ''}</div>
      <div class="whitespace-nowrap">
        <button class="text-[var(--vert)] font-bold mr-2" onclick="bureauEditer(${i})">✎ Modifier</button>
        <button class="text-red-600 font-bold" onclick="bureauSupprimer(${i})">🗑 Supprimer</button>
      </div>
    </div>`).join('');
}
function bureauEditer(i) {
  const m = bureauActuel[i];
  bmIndex.value = i; bmRole.value = m.role; bmNom.value = m.nom;
  bmProfession.value = m.profession || ''; bmLieu.value = m.lieu || ''; bmTel.value = m.tel || '';
  document.getElementById('bmBtnSubmit').textContent = 'Enregistrer la modification';
  document.getElementById('bmBtnAnnuler').classList.remove('hidden');
}
async function bureauSupprimer(i) {
  bureauActuel.splice(i, 1);
  await db.collection('contenu').doc('bureau').set({ membres: bureauActuel }, { merge: true });
}
function resetFormBureau() {
  document.getElementById('formBureauMembre').reset();
  bmIndex.value = -1;
  document.getElementById('bmBtnSubmit').textContent = 'Ajouter au bureau';
  document.getElementById('bmBtnAnnuler').classList.add('hidden');
}

function renderListeProgramme() {
  document.getElementById('listeProgramme').innerHTML = programmeActuel.map((p, i) => `
    <div class="flex justify-between items-center border-b py-2 text-sm">
      <div>${p.icone} <b>${p.titre}</b> — ${p.texte}</div>
      <div class="whitespace-nowrap">
        <button class="text-[var(--vert)] font-bold mr-2" onclick="programmeEditer(${i})">✎ Modifier</button>
        <button class="text-red-600 font-bold" onclick="programmeSupprimer(${i})">🗑 Supprimer</button>
      </div>
    </div>`).join('');
}
function programmeEditer(i) {
  const p = programmeActuel[i];
  piIndex.value = i; piIcone.value = p.icone; piTitre.value = p.titre; piTexte.value = p.texte;
  document.getElementById('piBtnSubmit').textContent = 'Enregistrer la modification';
  document.getElementById('piBtnAnnuler').classList.remove('hidden');
}
async function programmeSupprimer(i) {
  programmeActuel.splice(i, 1);
  await db.collection('contenu').doc('programme').set({ items: programmeActuel }, { merge: true });
}
function resetFormProgramme() {
  document.getElementById('formProgrammeItem').reset();
  piIndex.value = -1;
  document.getElementById('piBtnSubmit').textContent = 'Ajouter au programme';
  document.getElementById('piBtnAnnuler').classList.add('hidden');
}

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
