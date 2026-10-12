/* =========================================================================
   A.R.M — TABLEAU DE BORD ADMINISTRATEUR
   - Connexion par mot de passe unique (email technique fixe ADMIN_EMAIL_FIXE
     dans data.js). La vraie protection des données est assurée par les
     règles Firestore/Storage qui exigent un compte connecté.
   - Tous les écouteurs de formulaires sont attachés UNE seule fois au
     chargement (corrige les publications en double après reconnexion).
   - Tout contenu affiché passe par esc() (protection contre l'injection
     de code depuis le chat ou les formulaires publics).
   ========================================================================= */

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();
const inc = (n) => firebase.firestore.FieldValue.increment(n);
const $ = (id) => document.getElementById(id);

document.querySelectorAll('.arm-logo').forEach(img => { img.src = LOGO_DATA_URI; });

/* ===================== AUTHENTIFICATION ===================== */
let tableauDemarre = false;
let listesActives = [];

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('loginErr');
  const bouton = e.target.querySelector('button');
  err.classList.add('hidden');
  bouton.disabled = true;
  try {
    await auth.signInWithEmailAndPassword(ADMIN_EMAIL_FIXE, $('loginPass').value);
    $('loginPass').value = '';
  } catch (ex) {
    err.textContent = (ex && ex.code === 'auth/too-many-requests')
      ? 'Trop de tentatives. Patiente quelques minutes avant de réessayer.'
      : 'Mot de passe incorrect.';
    err.classList.remove('hidden');
  }
  bouton.disabled = false;
});

$('logoutBtn').onclick = async () => {
  await auth.signOut();
  location.reload();   // repart d'une page propre
};

auth.onAuthStateChanged(user => {
  if (user) {
    $('loginScreen').classList.add('hidden');
    $('dashboard').classList.remove('hidden');
    if (!tableauDemarre) { tableauDemarre = true; demarrerTout(); }
  } else if (tableauDemarre) {
    location.reload();   // session expirée en cours d'utilisation
  } else {
    $('dashboard').classList.add('hidden');
    $('loginScreen').classList.remove('hidden');
  }
});

/* ===================== ONGLETS ===================== */
let galerieInitialisee = false;
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.classList.add('bg-gray-200'); });
    btn.classList.add('active'); btn.classList.remove('bg-gray-200');
    document.querySelectorAll('.tab-content').forEach(s => s.classList.add('hidden'));
    $('tab-' + btn.dataset.tab).classList.remove('hidden');
    if (btn.dataset.tab === 'galerie' && !galerieInitialisee) {
      galerieInitialisee = true;
      listesActives.push(initGalerieMedias({
        db, storage,
        inputEl: $('galerieInput'), progressEl: $('galerieProgress'),
        gridEl: $('galerieGrid'), sentinelEl: $('sentinelGalerie')
      }));
    }
  };
});

function demarrerTout() {
  demarrerCompteurs();
  demarrerAdhesions();
  demarrerDons();
  demarrerActualites();
  demarrerMessages();
  demarrerChat();
  demarrerArmtv();
  demarrerContenu();
}

function pill(statut) {
  const ok = ['validé', 'confirmé', 'approuvé'].includes(statut);
  const ko = ['refusé'].includes(statut);
  const cls = ok ? 'bg-green-100 text-green-700' : ko ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';
  return `<span class="pill ${cls}">${esc(statut || 'en attente')}</span>`;
}

async function action(promesse, messageOk) {
  try { await promesse; if (messageOk) toast(messageOk); return true; }
  catch (err) { console.error(err); toast('Action impossible : ' + (err.message || err), 'erreur'); return false; }
}

/* ===================== STATISTIQUES ===================== */
function demarrerCompteurs() {
  const off = db.collection('compteurs').doc('global').onSnapshot(doc => {
    const c = doc.data() || {};
    $('statAdh').textContent = (c.adhesions || 0).toLocaleString('fr-FR');
    $('statDons').textContent = (c.donsTotal || 0).toLocaleString('fr-FR') + ' €';
    $('statMsg').textContent = (c.messages || 0).toLocaleString('fr-FR');
    dessinerGraphique(c);
  }, err => console.warn(err.message));
  listesActives.push({ arreter: off });
}

let chartInst = null;
function dessinerGraphique(c) {
  const ctx = $('chartAdh');
  if (!ctx || typeof Chart === 'undefined') return;
  const data = [c.adhesions || 0, c.donsTotal || 0, c.messages || 0];
  if (chartInst) { chartInst.data.datasets[0].data = data; chartInst.update(); return; }
  chartInst = new Chart(ctx, {
    type: 'bar',
    data: { labels: ['Adhésions', 'Dons confirmés (€)', 'Messages'],
            datasets: [{ data, backgroundColor: ['#0f7a3d', '#e9a800', '#c1272d'], borderRadius: 6 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

/* ===================== ADHÉSIONS ===================== */
let listeAdhesions;
function demarrerAdhesions() {
  const tbody = $('tblAdhesions');
  listeAdhesions = creerDefilementInfini({
    collection: db.collection('adhesions'), orderBy: ['createdAt', 'desc'], pageSize: 25,
    sentinel: $('sentinelAdhesions'),
    onPage: (docs, premiere) => {
      if (premiere) tbody.innerHTML = '';
      docs.forEach(doc => {
        const a = doc.data();
        tbody.insertAdjacentHTML('beforeend', `
          <tr data-id="${doc.id}">
            <td><b>${esc(a.prenom)} ${esc(a.nom)}</b><br><span class="text-gray-400">${esc(a.email)}</span>
              ${a.profession ? `<br><span class="text-gray-400">${esc(a.profession)}</span>` : ''}
              ${a.message ? `<br><i class="text-gray-500">« ${esc(a.message)} »</i>` : ''}</td>
            <td><a class="text-green-700" href="tel:${esc(telLien(a.tel))}">${esc(a.tel)}</a></td>
            <td>${esc(a.region)}${a.pays ? '<br><span class="text-gray-400">' + esc(a.pays) + '</span>' : ''}</td>
            <td>${esc(a.cercle)}${a.quartier ? '<br><span class="text-gray-400">' + esc(a.quartier) + '</span>' : ''}</td>
            <td class="whitespace-nowrap text-gray-500">${esc(formatDate(a.createdAt))}</td>
            <td>${pill(a.statut)}</td>
            <td class="whitespace-nowrap">
              <button class="text-green-700 font-bold mr-2" data-act="valider">✔ Valider</button>
              <button class="text-red-600 font-bold mr-2" data-act="refuser">✖ Refuser</button>
              <button class="text-gray-500 font-bold" data-act="supprimer" title="Supprimer">🗑</button>
            </td>
          </tr>`);
      });
    }
  });
  listeAdhesions.demarrer();
  listesActives.push(listeAdhesions);
}
$('tblAdhesions').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.closest('tr').dataset.id;
  const ref = db.collection('adhesions').doc(id);
  if (b.dataset.act === 'supprimer') {
    if (!confirm('Supprimer définitivement cette adhésion ?')) return;
    const batch = db.batch();
    batch.delete(ref);
    batch.set(db.collection('compteurs').doc('global'), { adhesions: inc(-1) }, { merge: true });
    if (await action(batch.commit(), 'Adhésion supprimée')) b.closest('tr').remove();
  } else {
    const statut = b.dataset.act === 'valider' ? 'validé' : 'refusé';
    if (await action(ref.update({ statut }), 'Adhésion ' + statut + 'e')) b.closest('tr').children[5].innerHTML = pill(statut);
  }
});

/* ===================== DONS =====================
   Le total "Dons confirmés" n'augmente que lorsque l'admin confirme un don
   (argent réellement reçu), et diminue si la confirmation est annulée ou
   si un don confirmé est supprimé. */
const donsCache = {};
let listeDons;
function ligneDon(id, d) {
  const methodes = { carte: '💳 Carte', mobile_money: '📱 Mobile Money', virement_bms: '🏦 Virement BMS' };
  const confirme = d.statut === 'confirmé';
  return `
    <tr data-id="${id}">
      <td><b>${esc(d.montant)} €</b></td>
      <td>${methodes[d.methode] || esc(d.methode)}</td>
      <td>${esc(d.nom)}${d.contact ? '<br><span class="text-gray-400">' + esc(d.contact) + '</span>' : ''}</td>
      <td class="text-gray-500">${esc(d.reference)}</td>
      <td class="whitespace-nowrap text-gray-500">${esc(formatDate(d.createdAt))}</td>
      <td>${pill(d.statut)}</td>
      <td class="whitespace-nowrap">
        ${confirme
          ? '<button class="text-yellow-700 font-bold mr-2" data-act="annuler">↺ Annuler</button>'
          : '<button class="text-green-700 font-bold mr-2" data-act="confirmer">✔ Confirmer</button>'}
        <button class="text-gray-500 font-bold" data-act="supprimer" title="Supprimer">🗑</button>
      </td>
    </tr>`;
}
function demarrerDons() {
  const tbody = $('tblDons');
  listeDons = creerDefilementInfini({
    collection: db.collection('dons'), orderBy: ['createdAt', 'desc'], pageSize: 25,
    sentinel: $('sentinelDons'),
    onPage: (docs, premiere) => {
      if (premiere) tbody.innerHTML = '';
      docs.forEach(doc => { donsCache[doc.id] = doc.data(); tbody.insertAdjacentHTML('beforeend', ligneDon(doc.id, doc.data())); });
    }
  });
  listeDons.demarrer();
  listesActives.push(listeDons);
}
$('tblDons').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const tr = b.closest('tr');
  const id = tr.dataset.id;
  const d = donsCache[id]; if (!d) return;
  const ref = db.collection('dons').doc(id);
  const compteur = db.collection('compteurs').doc('global');
  const montant = Number(d.montant) || 0;
  const batch = db.batch();

  if (b.dataset.act === 'confirmer') {
    batch.update(ref, { statut: 'confirmé', confirmeLe: Date.now() });
    batch.set(compteur, { donsTotal: inc(montant) }, { merge: true });
    if (await action(batch.commit(), 'Don confirmé')) { d.statut = 'confirmé'; tr.outerHTML = ligneDon(id, d); }
  } else if (b.dataset.act === 'annuler') {
    batch.update(ref, { statut: 'en attente' });
    batch.set(compteur, { donsTotal: inc(-montant) }, { merge: true });
    if (await action(batch.commit(), 'Confirmation annulée')) { d.statut = 'en attente'; tr.outerHTML = ligneDon(id, d); }
  } else if (b.dataset.act === 'supprimer') {
    if (!confirm('Supprimer définitivement ce don ?')) return;
    batch.delete(ref);
    if (d.statut === 'confirmé') batch.set(compteur, { donsTotal: inc(-montant) }, { merge: true });
    if (await action(batch.commit(), 'Don supprimé')) { delete donsCache[id]; tr.remove(); }
  }
});

/* ===================== ACTUALITÉS / ÉVÉNEMENTS ===================== */
const actusCache = {};
let actuEnEdition = null;

$('formActu').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    titre: $('actuTitre').value.trim(), date: $('actuDate').value, image: $('actuImage').value.trim(),
    lienVisio: $('actuLien').value.trim(), lieu: $('actuLieu').value.trim(), contenu: $('actuContenu').value.trim()
  };
  for (const champ of ['image', 'lienVisio']) {
    if (data[champ] && !/^https?:\/\//i.test(data[champ])) { toast('Les liens doivent commencer par https://', 'erreur'); return; }
  }
  const bouton = $('actuBtnSubmit');
  bouton.disabled = true;
  const ok = actuEnEdition
    ? await action(db.collection('actualites').doc(actuEnEdition).update(data), 'Actualité modifiée')
    : await action(db.collection('actualites').add({ ...data, createdAt: Date.now() }), 'Actualité publiée');
  bouton.disabled = false;
  if (ok) { actuEnEdition = null; bouton.textContent = 'Publier'; e.target.reset(); }
});

function carteActuAdmin(id, a) {
  return `
    <div class="card p-4 flex justify-between items-start gap-3" data-id="${id}">
      <div class="min-w-0">
        <p class="font-bold">${esc(a.titre)}</p>
        <p class="text-xs text-gray-400">${esc(a.date)} ${a.lieu ? '· ' + esc(a.lieu) : ''}</p>
        <p class="text-sm text-gray-600 mt-1">${esc(String(a.contenu || '').slice(0, 220))}</p>
        ${safeUrl(a.lienVisio) ? `<a href="${safeUrl(a.lienVisio)}" target="_blank" rel="noopener" class="text-sm text-green-700 font-bold">🎥 Lien visio</a>` : ''}
      </div>
      <div class="flex flex-col gap-1 text-sm whitespace-nowrap">
        <button class="text-green-700 font-bold" data-act="modifier">✎ Modifier</button>
        <button class="text-red-600 font-bold" data-act="supprimer">🗑 Supprimer</button>
      </div>
    </div>`;
}
function demarrerActualites() {
  const off = db.collection('actualites').orderBy('createdAt', 'desc').limit(200).onSnapshot(snap => {
    const today = new Date().toISOString().slice(0, 10);
    let html = '', htmlEv = '', aVenir = 0;
    snap.forEach(doc => {
      const a = doc.data();
      actusCache[doc.id] = a;
      const carte = carteActuAdmin(doc.id, a);
      html += carte;
      if (a.date && a.date >= today) { aVenir++; htmlEv += carte; }
    });
    $('listeActu').innerHTML = html || '<p class="text-sm text-gray-400">Aucune actualité publiée.</p>';
    $('listeEv').innerHTML = htmlEv || '<p class="text-sm text-gray-400">Aucun événement à venir.</p>';
    $('statEv').textContent = aVenir;
  }, err => console.warn(err.message));
  listesActives.push({ arreter: off });
}
function gererClicActu(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.closest('[data-id]').dataset.id;
  if (b.dataset.act === 'supprimer') {
    if (confirm('Supprimer cette actualité ?')) action(db.collection('actualites').doc(id).delete(), 'Actualité supprimée');
    return;
  }
  const a = actusCache[id]; if (!a) return;
  actuEnEdition = id;
  $('actuTitre').value = a.titre || ''; $('actuDate').value = a.date || ''; $('actuImage').value = a.image || '';
  $('actuLien').value = a.lienVisio || ''; $('actuLieu').value = a.lieu || ''; $('actuContenu').value = a.contenu || '';
  $('actuBtnSubmit').textContent = 'Enregistrer la modification';
  document.querySelector('[data-tab="actualites"]').click();
  $('formActu').scrollIntoView({ behavior: 'smooth' });
}
$('listeActu').addEventListener('click', gererClicActu);
$('listeEv').addEventListener('click', gererClicActu);

/* ===================== MESSAGES DE CONTACT ===================== */
function demarrerMessages() {
  const off = db.collection('messages').orderBy('createdAt', 'desc').limit(200).onSnapshot(snap => {
    $('tblMessages').innerHTML = snap.docs.map(doc => {
      const m = doc.data();
      return `
        <tr data-id="${doc.id}" class="${m.lu ? '' : 'font-semibold'}">
          <td>${esc(m.nom)}</td>
          <td>${m.email ? `<a class="text-green-700" href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : ''}</td>
          <td>${esc(m.sujet)}</td>
          <td class="font-normal">${esc(m.message)}</td>
          <td class="whitespace-nowrap text-gray-500 font-normal">${esc(formatDate(m.createdAt))}</td>
          <td class="whitespace-nowrap">
            <button class="pill ${m.lu ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}" data-act="lu" data-lu="${m.lu ? '1' : '0'}">${m.lu ? 'Lu' : 'Marquer lu'}</button>
            <button class="text-gray-500 font-bold ml-2" data-act="supprimer">🗑</button>
          </td>
        </tr>`;
    }).join('') || '<tr><td colspan="6" class="text-gray-400">Aucun message.</td></tr>';
  }, err => console.warn(err.message));
  listesActives.push({ arreter: off });
}
$('tblMessages').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.closest('tr').dataset.id;
  const ref = db.collection('messages').doc(id);
  if (b.dataset.act === 'lu') {
    action(ref.update({ lu: b.dataset.lu !== '1' }));
  } else if (confirm('Supprimer ce message ?')) {
    const batch = db.batch();
    batch.delete(ref);
    batch.set(db.collection('compteurs').doc('global'), { messages: inc(-1) }, { merge: true });
    action(batch.commit(), 'Message supprimé');
  }
});

/* ===================== MODÉRATION DU CHAT ===================== */
function demarrerChat() {
  const tbody = $('tblChat');
  const liste = creerDefilementInfini({
    collection: db.collection('chat'), orderBy: ['createdAt', 'desc'], pageSize: 30,
    sentinel: $('sentinelChat'),
    onPage: (docs, premiere) => {
      if (premiere) tbody.innerHTML = '';
      docs.forEach(doc => {
        const c = doc.data();
        tbody.insertAdjacentHTML('beforeend', `
          <tr data-id="${doc.id}">
            <td><b>${esc(c.nom)}</b></td>
            <td>${esc(c.message)}</td>
            <td class="whitespace-nowrap text-gray-500">${esc(formatDate(c.createdAt))}</td>
            <td><button class="text-red-600 font-bold" data-act="supprimer">🗑</button></td>
          </tr>`);
      });
    }
  });
  liste.demarrer();
  listesActives.push(liste);
}
$('tblChat').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const tr = b.closest('tr');
  if (await action(db.collection('chat').doc(tr.dataset.id).delete(), 'Message du chat supprimé')) tr.remove();
});

/* ===================== VIDÉOS & ARM TV =====================
   L'admin colle un lien (YouTube, Facebook, Instagram, TikTok, X ou fichier).
   La plateforme est reconnue, un aperçu s'affiche, puis la vidéo est publiée
   dans la Vidéothèque du site et/ou sur ARM TV (cases à cocher).
   statut : 'approuvé' = publiée · 'en attente' = brouillon · 'refusé' = retirée */
const tvCache = {};
let listeTv;
let tvFiltre = 'toutes';
$('tvTheme').innerHTML = THEMES_ARMTV.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');

const STATUT_TV = {
  'approuvé':   ['Publiée', 'bg-green-100 text-green-700'],
  'en attente': ['Brouillon', 'bg-yellow-100 text-yellow-700'],
  'refusé':     ['Retirée', 'bg-red-100 text-red-700']
};
const pillTv = (s) => { const [t, c] = STATUT_TV[s] || STATUT_TV['en attente']; return `<span class="pill ${c}">${t}</span>`; };

/* Détection en direct pendant la saisie + aperçu */
let tvMinuterie = null;
let tvDernierLien = '';
function majDetection() {
  const lien = $('tvUrlVideo').value.trim();
  const zone = $('tvApercuZone');
  const msg = $('tvDetection');
  if (!lien) { msg.innerHTML = ''; zone.classList.add('hidden'); demonterLecteur($('tvApercu')); tvDernierLien = ''; return; }
  const info = analyserVideo(lien);
  if (info.erreur) {
    msg.innerHTML = `<span class="text-red-600 font-semibold">⚠ ${esc(info.erreur)}</span>`;
    zone.classList.add('hidden'); demonterLecteur($('tvApercu')); tvDernierLien = '';
    return;
  }
  msg.innerHTML = `${badgePlateforme(info.plateforme)} <span class="text-green-700 font-semibold ml-1">✔ Vidéo reconnue</span>`
    + (info.avertissement ? `<br><span class="text-yellow-700">${esc(info.avertissement)}</span>` : '')
    + (info.plateforme === 'x' ? '<br><span class="text-gray-500">X affiche le post complet (texte + vidéo).</span>' : '');
  if (lien !== tvDernierLien) {
    tvDernierLien = lien;
    zone.classList.remove('hidden');
    monterLecteur($('tvApercu'), info, { autoplay: false, poster: miniatureVideo({ miniature: $('tvMiniature').value }, info) });
  }
}
$('tvUrlVideo').addEventListener('input', () => { clearTimeout(tvMinuterie); tvMinuterie = setTimeout(majDetection, 350); });
$('tvUrlVideo').addEventListener('paste', () => setTimeout(majDetection, 50));

function resetFormTv() {
  $('formArmtv').reset();
  $('tvId').value = '';
  $('tvOrdre').value = 0;
  $('tvGalerie').checked = true; $('tvArmtv').checked = true;
  $('tvFormTitre').textContent = 'Publier une vidéo';
  $('tvBtnPublier').classList.remove('hidden'); $('tvBtnBrouillon').classList.remove('hidden');
  $('tvBtnModifier').classList.add('hidden'); $('tvBtnAnnuler').classList.add('hidden');
  majDetection();
}
$('tvBtnAnnuler').onclick = resetFormTv;

$('formArmtv').addEventListener('submit', async (e) => {
  e.preventDefault();
  const info = analyserVideo($('tvUrlVideo').value);
  if (info.erreur) { toast(info.erreur, 'erreur'); return; }
  const miniature = $('tvMiniature').value.trim();
  if (miniature && !/^https?:\/\//i.test(miniature)) { toast('La miniature doit être un lien https://', 'erreur'); return; }
  const galerie = $('tvGalerie').checked, armtv = $('tvArmtv').checked;
  if (!galerie && !armtv) { toast('Coche au moins une destination : Vidéothèque ou ARM TV.', 'erreur'); return; }

  const data = {
    titre: $('tvTitre').value.trim(), theme: $('tvTheme').value,
    ordre: Math.max(0, parseInt($('tvOrdre').value, 10) || 0),
    duree: Math.max(0, parseFloat($('tvDuree').value) || 0),
    urlVideo: info.url, plateforme: info.plateforme, miniature,
    description: $('tvDescription').value.trim(), galerie, armtv
  };
  const id = $('tvId').value;
  const statut = e.submitter && e.submitter.dataset.statut;
  const boutons = e.target.querySelectorAll('button');
  boutons.forEach(b => b.disabled = true);
  const ok = id
    ? await action(db.collection('armtv_videos').doc(id).update(data), 'Vidéo modifiée')
    : await action(db.collection('armtv_videos').add({ ...data, statut: statut || 'approuvé', createdAt: Date.now() }),
        statut === 'en attente' ? 'Vidéo enregistrée en brouillon' : '🚀 Vidéo publiée sur le site');
  boutons.forEach(b => b.disabled = false);
  if (ok) { resetFormTv(); listeTv.rafraichir(); }
});

/* Direct : YouTube Live, Facebook Live ou flux .m3u8 */
$('formDirect').addEventListener('submit', async (e) => {
  e.preventDefault();
  const activer = e.submitter && e.submitter.dataset.on === 'true';
  const url = $('directUrl').value.trim();
  if (activer) {
    const info = analyserVideo(url);
    if (info.erreur) { toast(info.erreur, 'erreur'); return; }
  }
  action(db.collection('armtv_config').doc('direct').set({
    enDirect: activer, urlDirect: activer ? url : '', titreDirect: activer ? $('directTitre').value.trim() : ''
  }, { merge: true }), activer ? '🔴 Direct lancé sur ARM TV' : 'Direct arrêté');
});

/* Filtres par plateforme dans la liste */
$('tvFiltres').innerHTML = [['toutes', 'Toutes'], ...Object.entries(PLATEFORMES).map(([k, p]) => [k, p.nom])]
  .map(([k, n]) => `<button type="button" data-f="${k}" class="px-3 py-1 rounded-full font-bold ${k === 'toutes' ? 'bg-gray-800 text-white' : 'bg-gray-200'}">${esc(n)}</button>`).join('');
$('tvFiltres').addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]'); if (!b) return;
  tvFiltre = b.dataset.f;
  $('tvFiltres').querySelectorAll('button').forEach(x => x.className = 'px-3 py-1 rounded-full font-bold ' + (x === b ? 'bg-gray-800 text-white' : 'bg-gray-200'));
  appliquerFiltreTv();
});
function appliquerFiltreTv() {
  $('listeArmtv').querySelectorAll('[data-id]').forEach(c => c.classList.toggle('hidden', tvFiltre !== 'toutes' && c.dataset.pf !== tvFiltre));
}

function carteTvAdmin(id, v) {
  const info = analyserVideo(v.urlVideo);
  const pf = info.plateforme || 'fichier';
  const mini = miniatureVideo(v, info);
  const dest = [v.galerie === true ? '🎬 Vidéothèque' : '', v.armtv !== false ? '📺 ARM TV' : ''].filter(Boolean).join(' · ');
  const lienOrig = safeUrl(v.urlVideo);
  return `
    <div class="card p-3 flex gap-3 items-start" data-id="${id}" data-pf="${pf}">
      <div class="w-32 sm:w-40 shrink-0 aspect-video rounded-lg overflow-hidden flex items-center justify-center text-2xl text-white" style="background:${(PLATEFORMES[pf] || PLATEFORMES.fichier).couleur}">
        ${mini ? `<img src="${esc(mini)}" alt="" loading="lazy" class="w-full h-full object-cover">` : (PLATEFORMES[pf] || PLATEFORMES.fichier).icone}
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2 mb-1">${badgePlateforme(pf)} <span class="statut-tv">${pillTv(v.statut)}</span></div>
        <p class="font-bold leading-snug">${esc(v.titre)}</p>
        <p class="text-xs text-gray-500">${esc(v.theme)} · ordre ${esc(v.ordre ?? 0)}${v.duree ? ' · ' + esc(v.duree) + ' min' : ''}</p>
        <p class="text-xs text-gray-500">${dest || '<span class="text-red-600">Aucune destination</span>'}</p>
        ${info.erreur ? `<p class="text-xs text-red-600">⚠ ${esc(info.erreur)}</p>` : ''}
        ${lienOrig ? `<a href="${lienOrig}" target="_blank" rel="noopener" class="text-xs text-green-700 font-semibold">Ouvrir le lien d'origine ↗</a>` : ''}
      </div>
      <div class="flex flex-col gap-1 text-sm whitespace-nowrap">
        <button class="text-green-700 font-bold text-left" data-act="approuvé">✔ Publier</button>
        <button class="text-yellow-700 font-bold text-left" data-act="refusé">⏸ Retirer</button>
        <button class="text-gray-700 font-bold text-left" data-act="modifier">✎ Modifier</button>
        <button class="text-gray-500 font-bold text-left" data-act="supprimer">🗑 Supprimer</button>
      </div>
    </div>`;
}

function demarrerArmtv() {
  const conteneur = $('listeArmtv');
  listeTv = creerDefilementInfini({
    collection: db.collection('armtv_videos'), orderBy: ['createdAt', 'desc'], pageSize: 20,
    sentinel: $('sentinelArmtv'), texteVide: 'Aucune vidéo pour le moment : colle un premier lien ci-dessus.',
    onPage: (docs, premiere) => {
      if (premiere) conteneur.innerHTML = '';
      docs.forEach(doc => { tvCache[doc.id] = doc.data(); conteneur.insertAdjacentHTML('beforeend', carteTvAdmin(doc.id, doc.data())); });
      appliquerFiltreTv();
    }
  });
  listeTv.demarrer();
  listesActives.push(listeTv);
}

$('listeArmtv').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const carte = b.closest('[data-id]');
  const id = carte.dataset.id;
  const ref = db.collection('armtv_videos').doc(id);
  const act = b.dataset.act;
  if (act === 'supprimer') {
    if (confirm('Supprimer définitivement cette vidéo ?') && await action(ref.delete(), 'Vidéo supprimée')) carte.remove();
  } else if (act === 'modifier') {
    const v = tvCache[id]; if (!v) return;
    $('tvId').value = id;
    $('tvUrlVideo').value = v.urlVideo || ''; $('tvTitre').value = v.titre || '';
    $('tvTheme').value = THEMES_ARMTV.includes(v.theme) ? v.theme : THEMES_ARMTV[0];
    $('tvOrdre').value = v.ordre ?? 0; $('tvDuree').value = v.duree || '';
    $('tvMiniature').value = v.miniature || ''; $('tvDescription').value = v.description || '';
    $('tvGalerie').checked = v.galerie === true; $('tvArmtv').checked = v.armtv !== false;
    $('tvFormTitre').textContent = 'Modifier la vidéo';
    $('tvBtnPublier').classList.add('hidden'); $('tvBtnBrouillon').classList.add('hidden');
    $('tvBtnModifier').classList.remove('hidden'); $('tvBtnAnnuler').classList.remove('hidden');
    tvDernierLien = ''; majDetection();
    $('formArmtv').scrollIntoView({ behavior: 'smooth' });
  } else if (await action(ref.update({ statut: act }), act === 'approuvé' ? 'Vidéo publiée' : 'Vidéo retirée du site')) {
    tvCache[id].statut = act;
    carte.querySelector('.statut-tv').innerHTML = pillTv(act);
  }
});

/* ===================== CONTENU DU SITE ===================== */
let bureauActuel = [];
let programmeActuel = [];

$('formInfo').addEventListener('submit', (e) => {
  e.preventDefault();
  const lien = $('infoLienCarte').value.trim();
  if (lien && !/^https:\/\//i.test(lien)) { toast('Le lien de paiement doit commencer par https://', 'erreur'); return; }
  action(db.collection('contenu').doc('info').set({
    devise: $('infoDevise').value.trim(), siege: $('infoSiege').value.trim(), iban: $('infoIban').value.trim(),
    orangeMoney: $('infoOrange').value.trim(), moovMoney: $('infoMoov').value.trim(), wave: $('infoWave').value.trim(),
    lienPaiementCarte: lien
  }, { merge: true }), 'Infos enregistrées — visibles sur le site');
});

function enregistrerBureau() { return action(db.collection('contenu').doc('bureau').set({ membres: bureauActuel }), 'Bureau mis à jour'); }
function enregistrerProgramme() { return action(db.collection('contenu').doc('programme').set({ items: programmeActuel }), 'Programme mis à jour'); }

$('formBureauMembre').addEventListener('submit', async (e) => {
  e.preventDefault();
  const membre = { role: $('bmRole').value.trim(), nom: $('bmNom').value.trim(), profession: $('bmProfession').value.trim(), lieu: $('bmLieu').value.trim(), tel: $('bmTel').value.trim() };
  const idx = parseInt($('bmIndex').value, 10);
  if (idx >= 0) bureauActuel[idx] = membre; else bureauActuel.push(membre);
  if (await enregistrerBureau()) resetFormBureau();
});
$('bmBtnAnnuler').onclick = resetFormBureau;
function resetFormBureau() {
  $('formBureauMembre').reset(); $('bmIndex').value = -1;
  $('bmBtnSubmit').textContent = 'Ajouter au bureau'; $('bmBtnAnnuler').classList.add('hidden');
}

$('formProgrammeItem').addEventListener('submit', async (e) => {
  e.preventDefault();
  const item = { icone: $('piIcone').value.trim(), titre: $('piTitre').value.trim(), texte: $('piTexte').value.trim() };
  const idx = parseInt($('piIndex').value, 10);
  if (idx >= 0) programmeActuel[idx] = item; else programmeActuel.push(item);
  if (await enregistrerProgramme()) resetFormProgramme();
});
$('piBtnAnnuler').onclick = resetFormProgramme;
function resetFormProgramme() {
  $('formProgrammeItem').reset(); $('piIndex').value = -1;
  $('piBtnSubmit').textContent = 'Ajouter au programme'; $('piBtnAnnuler').classList.add('hidden');
}

function boutonsListe(i, total) {
  return `
    <button class="text-gray-500 font-bold px-1 ${i === 0 ? 'invisible' : ''}" data-act="monter" title="Monter">↑</button>
    <button class="text-gray-500 font-bold px-1 mr-2 ${i === total - 1 ? 'invisible' : ''}" data-act="descendre" title="Descendre">↓</button>
    <button class="text-green-700 font-bold mr-2" data-act="modifier">✎ Modifier</button>
    <button class="text-red-600 font-bold" data-act="supprimer">🗑</button>`;
}
function renderListeBureau() {
  $('listeBureau').innerHTML = bureauActuel.map((m, i) => `
    <div class="flex justify-between items-center gap-3 border-b py-2 text-sm" data-i="${i}">
      <div><b>${esc(m.role)}</b> — ${esc(m.nom)} ${m.tel ? '· ' + esc(m.tel) : ''}</div>
      <div class="whitespace-nowrap">${boutonsListe(i, bureauActuel.length)}</div>
    </div>`).join('');
}
function renderListeProgramme() {
  $('listeProgramme').innerHTML = programmeActuel.map((p, i) => `
    <div class="flex justify-between items-center gap-3 border-b py-2 text-sm" data-i="${i}">
      <div>${esc(p.icone)} <b>${esc(p.titre)}</b> — ${esc(p.texte)}</div>
      <div class="whitespace-nowrap">${boutonsListe(i, programmeActuel.length)}</div>
    </div>`).join('');
}

function gererListe(tableau, enregistrer, editer) {
  return (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const i = +b.closest('[data-i]').dataset.i;
    const act = b.dataset.act;
    if (act === 'modifier') return editer(i);
    if (act === 'supprimer') { if (!confirm('Supprimer cet élément ?')) return; tableau().splice(i, 1); }
    if (act === 'monter' && i > 0) { const t = tableau(); [t[i - 1], t[i]] = [t[i], t[i - 1]]; }
    if (act === 'descendre' && i < tableau().length - 1) { const t = tableau(); [t[i + 1], t[i]] = [t[i], t[i + 1]]; }
    enregistrer();
  };
}
$('listeBureau').addEventListener('click', gererListe(() => bureauActuel, enregistrerBureau, (i) => {
  const m = bureauActuel[i];
  $('bmIndex').value = i; $('bmRole').value = m.role || ''; $('bmNom').value = m.nom || '';
  $('bmProfession').value = m.profession || ''; $('bmLieu').value = m.lieu || ''; $('bmTel').value = m.tel || '';
  $('bmBtnSubmit').textContent = 'Enregistrer la modification'; $('bmBtnAnnuler').classList.remove('hidden');
  $('formBureauMembre').scrollIntoView({ behavior: 'smooth' });
}));
$('listeProgramme').addEventListener('click', gererListe(() => programmeActuel, enregistrerProgramme, (i) => {
  const p = programmeActuel[i];
  $('piIndex').value = i; $('piIcone').value = p.icone || ''; $('piTitre').value = p.titre || ''; $('piTexte').value = p.texte || '';
  $('piBtnSubmit').textContent = 'Enregistrer la modification'; $('piBtnAnnuler').classList.remove('hidden');
  $('formProgrammeItem').scrollIntoView({ behavior: 'smooth' });
}));

function demarrerContenu() {
  const offInfo = db.collection('contenu').doc('info').onSnapshot(doc => {
    const d = doc.data() || {};
    $('infoDevise').value = d.devise || PARTY_INFO.devise;
    $('infoSiege').value = d.siege || PARTY_INFO.siege;
    $('infoIban').value = d.iban || '';
    $('infoOrange').value = d.orangeMoney || '';
    $('infoMoov').value = d.moovMoney || '';
    $('infoWave').value = d.wave || '';
    $('infoLienCarte').value = d.lienPaiementCarte || '';
  }, err => console.warn(err.message));

  const offBureau = db.collection('contenu').doc('bureau').onSnapshot(doc => {
    const d = doc.data();
    bureauActuel = (d && Array.isArray(d.membres)) ? d.membres.slice() : BUREAU.map(m => ({ ...m }));
    renderListeBureau();
  }, err => console.warn(err.message));

  const offProg = db.collection('contenu').doc('programme').onSnapshot(doc => {
    const d = doc.data();
    programmeActuel = (d && Array.isArray(d.items)) ? d.items.slice() : PROGRAMME.map(p => ({ ...p }));
    renderListeProgramme();
  }, err => console.warn(err.message));

  listesActives.push({ arreter: offInfo }, { arreter: offBureau }, { arreter: offProg });
}
