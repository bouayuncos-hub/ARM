firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Initialiser les gestionnaires avancés
const analyticsManager = new ARM.AnalyticsManager(db);
const roleManager = new ARM.RoleManager(db);
const rateLimiter = new ARM.RateLimiter(10, 60000);
const cacheManager = new ARM.CacheManager();

/* ===================== LOGO ===================== */
document.querySelectorAll('.arm-logo').forEach(img => { img.src = LOGO_DATA_URI; });

/* ===================== AUTHENTIFICATION ===================== */
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('loginErr');
  err.classList.remove('show');
  
  if (!rateLimiter.peutFaire()) {
    err.textContent = "Trop de tentatives. Attendez quelques secondes.";
    err.classList.add('show');
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(ADMIN_EMAIL_FIXE, loginPass.value);
  } catch (ex) {
    err.textContent = "Mot de passe incorrect.";
    err.classList.add('show');
  }
});

document.getElementById('logoutBtn').onclick = () => auth.signOut();

let listesActives = [];
auth.onAuthStateChanged(async user => {
  if (user) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    roleManager.définirRôle('admin');
    await demarrerTout();
  } else {
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    listesActives.forEach(l => l.arreter?.());
    listesActives = [];
    roleManager.définirRôle('viewer');
  }
});

/* ===================== NAVIGATION ONGLETS ===================== */
let galerieInitialisee = false;
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    // Désactiver les autres onglets
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Masquer tous les contenu
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    
    // Afficher le bon contenu
    const tabId = 'tab-' + btn.dataset.tab;
    const tabContent = document.getElementById(tabId);
    if (tabContent) {
      tabContent.classList.add('active');
      
      // Initialiser la galerie à la première visite
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
    }
  };
});

async function demarrerTout() {
  demarrerCompteurs();
  demarrerAdhesions();
  demarrerDons();
  chargerActualitesAdmin();
  chargerMessages();
  demarrerChat();
  demarrerArmtv();
  demarrerContenu();
  configurerExport();
}

/* ===================== COMPTEURS GLOBAUX ===================== */
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

/* ===================== ADHÉSIONS (défilement infini) ===================== */
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
        const pill = a.statut === 'validé' ? 'pill-success' : a.statut === 'refusé' ? 'pill-danger' : 'pill-warning';
        tbody.insertAdjacentHTML('beforeend', `
          <tr>
            <td>
              <strong>${a.prenom || ''} ${a.nom || ''}</strong><br>
              <span style="color: var(--text-soft); font-size: 0.9rem;">${a.email || 'N/A'}</span>
            </td>
            <td><a href="tel:${a.tel}" style="color: var(--vert); text-decoration: none;">☎ ${a.tel || 'N/A'}</a></td>
            <td>${a.region || 'N/A'}</td>
            <td>${a.cercle || 'N/A'}</td>
            <td><span class="pill ${pill}">${a.statut || 'en attente'}</span></td>
            <td>
              <button class="btn btn-primary btn-small" onclick="majAdhesion('${doc.id}','validé')">✔ Valider</button>
              <button class="btn btn-danger btn-small" onclick="majAdhesion('${doc.id}','refusé')">✖ Refuser</button>
              <button class="btn btn-secondary btn-small" onclick="supprAdhesion('${doc.id}')">🗑 Supprimer</button>
            </td>
          </tr>`);
      });
    }
  });
  liste.demarrer();
  listesActives.push(liste);
}

function majAdhesion(id, statut) {
  db.collection('adhesions').doc(id).update({ statut }).catch(err => console.error(err));
}

function supprAdhesion(id) {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette adhésion ?')) {
    db.collection('adhesions').doc(id).delete().catch(err => console.error(err));
  }
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
        const pill = d.statut === 'confirmé' ? 'pill-success' : 'pill-warning';
        tbody.insertAdjacentHTML('beforeend', `
          <tr>
            <td><strong>${d.montant || 0} €</strong></td>
            <td>${d.methode === 'carte' ? '💳 Carte' : '🏦 Virement BMS'}</td>
            <td>
              <strong>${d.nom || d.reference || 'N/A'}</strong><br>
              <span style="color: var(--text-soft); font-size: 0.9rem;">Ref: ${d.reference || 'N/A'}</span>
            </td>
            <td><span class="pill ${pill}">${d.statut || 'en attente'}</span></td>
            <td>
              <button class="btn btn-primary btn-small" onclick="confirmerDon('${doc.id}')">✔ Confirmer</button>
              <button class="btn btn-secondary btn-small" onclick="supprDon('${doc.id}')">🗑 Supprimer</button>
            </td>
          </tr>`);
      });
    }
  });
  liste.demarrer();
  listesActives.push(liste);
}

function confirmerDon(id) {
  db.collection('dons').doc(id).update({ statut: 'confirmé' }).catch(err => console.error(err));
}

function supprDon(id) {
  if (confirm('Êtes-vous sûr de vouloir supprimer ce don ?')) {
    db.collection('dons').doc(id).delete().catch(err => console.error(err));
  }
}

/* ===================== ACTUALITÉS / ÉVÉNEMENTS ===================== */
let actuEnEdition = null;

document.getElementById('formActu').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!roleManager.possèdePermission('écrire')) {
    alert('Vous n\'avez pas la permission d\'écrire.');
    return;
  }

  const data = {
    titre: document.getElementById('actuTitre').value,
    date: document.getElementById('actuDate').value,
    image: document.getElementById('actuImage').value,
    lienVisio: document.getElementById('actuLien').value,
    lieu: document.getElementById('actuLieu').value,
    contenu: document.getElementById('actuContenu').value
  };

  try {
    if (actuEnEdition) {
      await db.collection('actualites').doc(actuEnEdition).update(data);
      actuEnEdition = null;
      document.getElementById('actuBtnSubmit').textContent = 'Publier l\'Actualité';
    } else {
      await db.collection('actualites').add({ ...data, createdAt: Date.now() });
    }
    e.target.reset();
    ARM.Utils.debounce(() => chargerActualitesAdmin(), 500)();
  } catch (err) {
    console.error('Erreur publication actualité:', err);
    alert('Erreur lors de la publication.');
  }
});

function actuModifier(id, titre, date, image, lienVisio, lieu, contenu) {
  actuEnEdition = id;
  document.getElementById('actuTitre').value = titre;
  document.getElementById('actuDate').value = date || '';
  document.getElementById('actuImage').value = image || '';
  document.getElementById('actuLien').value = lienVisio || '';
  document.getElementById('actuLieu').value = lieu || '';
  document.getElementById('actuContenu').value = contenu || '';
  document.getElementById('actuBtnSubmit').textContent = 'Enregistrer la Modification';
  document.getElementById('formActu').scrollIntoView({ behavior: 'smooth' });
}

function chargerActualitesAdmin() {
  const off = db.collection('actualites').orderBy('createdAt', 'desc').onSnapshot(snap => {
    const liste = document.getElementById('listeActu');
    const listeEv = document.getElementById('listeEv');
    liste.innerHTML = '';
    listeEv.innerHTML = '';
    let aVenir = 0;
    const today = new Date().toISOString().slice(0, 10);
    
    snap.forEach(doc => {
      const a = doc.data();
      if (a.date && a.date >= today) aVenir++;
      
      const html = `
        <div class="card" style="padding: 1rem;">
          <div style="display: flex; justify-content: space-between; gap: 1rem;">
            <div style="flex: 1;">
              <p style="font-weight: bold; margin-bottom: 0.5rem;">${a.titre || ''}</p>
              <p style="font-size: 0.85rem; color: var(--text-soft); margin-bottom: 0.5rem;">
                ${a.date || ''} ${a.lieu ? '📍 ' + a.lieu : ''}
              </p>
              <p style="font-size: 0.95rem; color: var(--text); margin-bottom: 0.5rem;">
                ${(a.contenu || '').substring(0, 150)}${(a.contenu || '').length > 150 ? '...' : ''}
              </p>
              ${a.lienVisio ? `<a href="${a.lienVisio}" target="_blank" style="color: var(--vert); font-weight: bold; text-decoration: none;">🎥 Lien visio</a>` : ''}
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; white-space: nowrap;">
              <button class="btn btn-primary btn-small" onclick='actuModifier(${JSON.stringify(doc.id)}, ${JSON.stringify(a.titre||"")}, ${JSON.stringify(a.date||"")}, ${JSON.stringify(a.image||"")}, ${JSON.stringify(a.lienVisio||"")}, ${JSON.stringify(a.lieu||"")}, ${JSON.stringify(a.contenu||"")})'>✎ Modifier</button>
              <button class="btn btn-danger btn-small" onclick="suppActu('${doc.id}')">🗑 Supprimer</button>
            </div>
          </div>
        </div>`;
      
      liste.insertAdjacentHTML('beforeend', html);
      if (a.date && a.date >= today) listeEv.insertAdjacentHTML('beforeend', html);
    });
    
    document.getElementById('statEv').textContent = aVenir;
  });
  
  listesActives.push({ arreter: off });
}

function suppActu(id) {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette actualité ?')) {
    db.collection('actualites').doc(id).delete().catch(err => console.error(err));
  }
}

/* ===================== MESSAGES CONTACT ===================== */
function chargerMessages() {
  const off = db.collection('messages').orderBy('createdAt', 'desc').limit(200).onSnapshot(snap => {
    const tbody = document.getElementById('tblMessages');
    tbody.innerHTML = '';
    
    snap.forEach(doc => {
      const m = doc.data();
      const pill = m.lu ? 'pill-success' : 'pill-warning';
      
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td><strong>${m.nom || 'N/A'}</strong></td>
          <td>${m.email || 'N/A'}</td>
          <td>${m.sujet || 'N/A'}</td>
          <td style="max-width: 300px; word-break: break-word;">${(m.message || '').substring(0, 100)}${(m.message || '').length > 100 ? '...' : ''}</td>
          <td><span class="pill ${pill}">${m.lu ? '✓ Lu' : 'Non lu'}</span></td>
          <td>
            <button class="btn btn-secondary btn-small" onclick="toggleLu('${doc.id}', ${!m.lu})">${m.lu ? 'Marquer non lu' : 'Marquer lu'}</button>
            <button class="btn btn-danger btn-small" onclick="supprMessage('${doc.id}')">🗑</button>
          </td>
        </tr>`);
    });
  });
  
  listesActives.push({ arreter: off });
}

function toggleLu(id, val) {
  db.collection('messages').doc(id).update({ lu: val }).catch(err => console.error(err));
}

function supprMessage(id) {
  if (confirm('Êtes-vous sûr ?')) {
    db.collection('messages').doc(id).delete().catch(err => console.error(err));
  }
}

/* ===================== MODÉRATION CHAT ===================== */
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
            <td><strong>${c.nom || 'Anonyme'}</strong></td>
            <td style="max-width: 400px; word-break: break-word;">${c.message || ''}</td>
            <td style="white-space: nowrap;">${ARM.Utils.formatDate(c.createdAt)}</td>
            <td>
              <button class="btn btn-danger btn-small" onclick="suppMsgChat('${doc.id}')">🗑 Supprimer</button>
            </td>
          </tr>`);
      });
    }
  });
  
  liste.demarrer();
  listesActives.push(liste);
}

function suppMsgChat(id) {
  if (confirm('Supprimer ce message du chat ?')) {
    db.collection('chat').doc(id).delete().catch(err => console.error(err));
  }
}

/* ===================== ARM TV ===================== */
function demarrerArmtv() {
  // Options de thème
  const sel = document.getElementById('tvTheme');
  if (sel && !sel.children.length) {
    sel.innerHTML = '<option value="">-- Choisir un thème --</option>' + 
      THEMES_ARMTV.map(t => `<option value="${t}">${t}</option>`).join('');
  }

  // Ajout d'une vidéo
  document.getElementById('formArmtv').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!roleManager.possèdePermission('écrire')) {
      alert('Vous n\'avez pas la permission d\'ajouter des vidéos.');
      return;
    }

    try {
      await db.collection('armtv_videos').add({
        titre: document.getElementById('tvTitre').value,
        theme: document.getElementById('tvTheme').value,
        ordre: parseInt(document.getElementById('tvOrdre').value) || 0,
        urlVideo: document.getElementById('tvUrlVideo').value,
        miniature: document.getElementById('tvMiniature').value,
        description: document.getElementById('tvDescription').value,
        statut: 'en attente',
        createdAt: Date.now()
      });
      e.target.reset();
      alert('Vidéo ajoutée (en attente d\'approbation).');
    } catch (err) {
      console.error('Erreur ajout vidéo:', err);
      alert('Erreur lors de l\'ajout de la vidéo.');
    }
  });

  // Direct
  document.getElementById('formDirect').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!roleManager.possèdePermission('écrire')) {
      alert('Vous n\'avez pas la permission de modifier le direct.');
      return;
    }

    try {
      const activer = e.submitter && e.submitter.dataset.on === 'true';
      await db.collection('armtv_config').doc('direct').set({
        enDirect: activer,
        urlDirect: activer ? document.getElementById('directUrl').value : '',
        titreDirect: activer ? document.getElementById('directTitre').value : ''
      }, { merge: true });
      alert(activer ? '🔴 Direct démarré' : '⏹️ Direct arrêté');
    } catch (err) {
      console.error('Erreur direct:', err);
      alert('Erreur lors de la mise à jour du direct.');
    }
  });

  // Liste des vidéos
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
        const pillClasse = v.statut === 'approuvé' ? 'pill-success' : v.statut === 'refusé' ? 'pill-danger' : 'pill-warning';
        
        conteneur.insertAdjacentHTML('beforeend', `
          <div class="card" style="padding: 1rem; display: flex; justify-content: space-between; gap: 1rem;">
            <div style="flex: 1;">
              <p style="font-weight: bold; margin-bottom: 0.25rem;">${v.titre || ''}</p>
              <p style="font-size: 0.85rem; color: var(--text-soft); margin-bottom: 0.5rem;">
                ${v.theme || 'Sans thème'} • Ordre: ${v.ordre ?? 0}
              </p>
              <p style="font-size: 0.95rem; margin-bottom: 0.5rem;">${v.description || ''}</p>
              <span class="pill ${pillClasse}">${v.statut}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; white-space: nowrap;">
              <button class="btn btn-primary btn-small" onclick="armtvMaj('${doc.id}','approuvé')">✔ Approuver</button>
              <button class="btn btn-danger btn-small" onclick="armtvMaj('${doc.id}','refusé')">✖ Refuser</button>
              <button class="btn btn-secondary btn-small" onclick="armtvSupp('${doc.id}')">🗑 Supprimer</button>
            </div>
          </div>`);
      });
    }
  });
  
  liste.demarrer();
  listesActives.push(liste);
}

function armtvMaj(id, statut) {
  db.collection('armtv_videos').doc(id).update({ statut }).catch(err => console.error(err));
}

function armtvSupp(id) {
  if (confirm('Supprimer cette vidéo ?')) {
    db.collection('armtv_videos').doc(id).delete().catch(err => console.error(err));
  }
}

/* ===================== CONTENU DU SITE ===================== */
let bureauActuel = [];
let programmeActuel = [];

function demarrerContenu() {
  // Infos générales
  const offInfo = db.collection('contenu').doc('info').onSnapshot(doc => {
    const d = doc.data() || {};
    document.getElementById('infoDevise').value = d.devise || PARTY_INFO.devise;
    document.getElementById('infoSiege').value = d.siege || PARTY_INFO.siege;
    document.getElementById('infoIban').value = d.iban || '';
  });
  
  listesActives.push({ arreter: offInfo });

  document.getElementById('formInfo').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!roleManager.possèdePermission('écrire')) {
      alert('Vous n\'avez pas la permission de modifier le contenu.');
      return;
    }

    try {
      await db.collection('contenu').doc('info').set({
        devise: document.getElementById('infoDevise').value,
        siege: document.getElementById('infoSiege').value,
        iban: document.getElementById('infoIban').value
      }, { merge: true });
      alert('✓ Infos générales mises à jour.');
    } catch (err) {
      console.error('Erreur mise à jour info:', err);
      alert('Erreur lors de la mise à jour.');
    }
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
    
    if (!roleManager.possèdePermission('écrire')) {
      alert('Vous n\'avez pas la permission de modifier le bureau.');
      return;
    }

    try {
      const membre = {
        role: document.getElementById('bmRole').value,
        nom: document.getElementById('bmNom').value,
        profession: document.getElementById('bmProfession').value,
        lieu: document.getElementById('bmLieu').value,
        tel: document.getElementById('bmTel').value
      };
      
      const idx = parseInt(document.getElementById('bmIndex').value);
      if (idx >= 0) {
        bureauActuel[idx] = membre;
      } else {
        bureauActuel.push(membre);
      }
      
      await db.collection('contenu').doc('bureau').set({ membres: bureauActuel }, { merge: true });
      resetFormBureau();
      alert('✓ Bureau exécutif mis à jour.');
    } catch (err) {
      console.error('Erreur mise à jour bureau:', err);
      alert('Erreur lors de la mise à jour.');
    }
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
    
    if (!roleManager.possèdePermission('écrire')) {
      alert('Vous n\'avez pas la permission de modifier le programme.');
      return;
    }

    try {
      const item = {
        icone: document.getElementById('piIcone').value,
        titre: document.getElementById('piTitre').value,
        texte: document.getElementById('piTexte').value
      };
      
      const idx = parseInt(document.getElementById('piIndex').value);
      if (idx >= 0) {
        programmeActuel[idx] = item;
      } else {
        programmeActuel.push(item);
      }
      
      await db.collection('contenu').doc('programme').set({ items: programmeActuel }, { merge: true });
      resetFormProgramme();
      alert('✓ Programme politique mis à jour.');
    } catch (err) {
      console.error('Erreur mise à jour programme:', err);
      alert('Erreur lors de la mise à jour.');
    }
  });
  
  document.getElementById('piBtnAnnuler').onclick = resetFormProgramme;
}

function renderListeBureau() {
  document.getElementById('listeBureau').innerHTML = bureauActuel.map((m, i) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid #e5e7eb;">
      <div>
        <strong>${m.role}</strong> — ${m.nom} ${m.tel ? '• ' + m.tel : ''}
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-primary btn-small" onclick="bureauEditer(${i})">✎ Modifier</button>
        <button class="btn btn-danger btn-small" onclick="bureauSupprimer(${i})">🗑 Supprimer</button>
      </div>
    </div>`).join('');
}

function bureauEditer(i) {
  const m = bureauActuel[i];
  document.getElementById('bmIndex').value = i;
  document.getElementById('bmRole').value = m.role;
  document.getElementById('bmNom').value = m.nom;
  document.getElementById('bmProfession').value = m.profession || '';
  document.getElementById('bmLieu').value = m.lieu || '';
  document.getElementById('bmTel').value = m.tel || '';
  document.getElementById('bmBtnSubmit').textContent = 'Enregistrer la Modification';
  document.getElementById('bmBtnAnnuler').classList.remove('hidden');
  document.getElementById('formBureauMembre').scrollIntoView({ behavior: 'smooth' });
}

function bureauSupprimer(i) {
  if (confirm('Supprimer ce membre du bureau ?')) {
    bureauActuel.splice(i, 1);
    db.collection('contenu').doc('bureau').set({ membres: bureauActuel }, { merge: true }).catch(err => console.error(err));
  }
}

function resetFormBureau() {
  document.getElementById('formBureauMembre').reset();
  document.getElementById('bmIndex').value = -1;
  document.getElementById('bmBtnSubmit').textContent = 'Ajouter au Bureau';
  document.getElementById('bmBtnAnnuler').classList.add('hidden');
}

function renderListeProgramme() {
  document.getElementById('listeProgramme').innerHTML = programmeActuel.map((p, i) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid #e5e7eb;">
      <div>
        <strong>${p.icone} ${p.titre}</strong> — ${p.texte}
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-primary btn-small" onclick="programmeEditer(${i})">✎ Modifier</button>
        <button class="btn btn-danger btn-small" onclick="programmeSupprimer(${i})">🗑 Supprimer</button>
      </div>
    </div>`).join('');
}

function programmeEditer(i) {
  const p = programmeActuel[i];
  document.getElementById('piIndex').value = i;
  document.getElementById('piIcone').value = p.icone;
  document.getElementById('piTitre').value = p.titre;
  document.getElementById('piTexte').value = p.texte;
  document.getElementById('piBtnSubmit').textContent = 'Enregistrer la Modification';
  document.getElementById('piBtnAnnuler').classList.remove('hidden');
  document.getElementById('formProgrammeItem').scrollIntoView({ behavior: 'smooth' });
}

function programmeSupprimer(i) {
  if (confirm('Supprimer ce point du programme ?')) {
    programmeActuel.splice(i, 1);
    db.collection('contenu').doc('programme').set({ items: programmeActuel }, { merge: true }).catch(err => console.error(err));
  }
}

function resetFormProgramme() {
  document.getElementById('formProgrammeItem').reset();
  document.getElementById('piIndex').value = -1;
  document.getElementById('piBtnSubmit').textContent = 'Ajouter au Programme';
  document.getElementById('piBtnAnnuler').classList.add('hidden');
}

/* ===================== EXPORT DE DONNÉES ===================== */
function configurerExport() {
  document.getElementById('exportAdhesionsCSV').onclick = async () => {
    const snap = await db.collection('adhesions').get();
    const data = snap.docs.map(doc => ({
      Nom: doc.data().nom,
      Prénom: doc.data().prenom,
      Email: doc.data().email,
      Téléphone: doc.data().tel,
      Région: doc.data().region,
      Cercle: doc.data().cercle,
      Statut: doc.data().statut,
      Date: ARM.Utils.formatDate(doc.data().createdAt)
    }));
    ARM.DataExporter.exporterCSV(data, 'adhesions');
  };

  document.getElementById('exportDonsCSV').onclick = async () => {
    const snap = await db.collection('dons').get();
    const data = snap.docs.map(doc => ({
      Montant: doc.data().montant,
      Méthode: doc.data().methode,
      Donateur: doc.data().nom,
      Référence: doc.data().reference,
      Statut: doc.data().statut,
      Date: ARM.Utils.formatDate(doc.data().createdAt)
    }));
    ARM.DataExporter.exporterCSV(data, 'dons');
  };

  document.getElementById('exportMessagesCSV').onclick = async () => {
    const snap = await db.collection('messages').get();
    const data = snap.docs.map(doc => ({
      Nom: doc.data().nom,
      Email: doc.data().email,
      Sujet: doc.data().sujet,
      Message: doc.data().message,
      Statut: doc.data().lu ? 'Lu' : 'Non lu',
      Date: ARM.Utils.formatDate(doc.data().createdAt)
    }));
    ARM.DataExporter.exporterCSV(data, 'messages');
  };

  document.getElementById('exportActualitesCSV').onclick = async () => {
    const snap = await db.collection('actualites').get();
    const data = snap.docs.map(doc => ({
      Titre: doc.data().titre,
      Date: doc.data().date,
      Lieu: doc.data().lieu,
      Contenu: doc.data().contenu,
      LienVisio: doc.data().lienVisio,
      Créée: ARM.Utils.formatDate(doc.data().createdAt)
    }));
    ARM.DataExporter.exporterCSV(data, 'actualites');
  };

  document.getElementById('exportToutJSON').onclick = async () => {
    const data = await analyticsManager.exporterDonnées();
    ARM.DataExporter.exporterJSON(data, 'arm-donnees-completes');
  };
}

/* ===================== GRAPHIQUE ANALYTIQUE ===================== */
let chartInst = null;

function dessinerGraphique(compteurs) {
  const ctx = document.getElementById('chartAdh');
  if (!ctx || typeof Chart === 'undefined') return;

  const labels = ['Adhésions', 'Dons (€)', 'Messages'];
  const data = [compteurs.adhesions || 0, compteurs.donsTotal || 0, compteurs.messages || 0];

  if (chartInst) chartInst.destroy();

  chartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Activité globale',
        data,
        backgroundColor: ['var(--vert)', 'var(--or)', 'var(--rouge)'],
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true, position: 'top' }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}
