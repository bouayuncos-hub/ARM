/* =========================================================================
   MODULE : GALERIE MÉDIAS — UPLOAD AVEC COMPRESSION CÔTÉ CLIENT
   =========================================================================
   Pourquoi compresser côté client ?
   - On évite d'envoyer des photos de téléphone à 4-8 Mo vers Firebase
     Storage : moins de coût de stockage/bande passante, upload quasi
     instantané, et affichage plus rapide côté visiteurs (images déjà
     redimensionnées à une taille d'affichage réaliste).
   - La compression se fait via un <canvas> (redimensionnement + ré-encodage
     JPEG à qualité réglable) : aucune librairie externe nécessaire.

   Flux :
   1. L'utilisateur choisit un ou plusieurs fichiers.
   2. Chaque image est redimensionnée (largeur max 1600px) et compressée
      (qualité 0.75) avant l'envoi → Blob JPEG optimisé.
   3. Upload vers Firebase Storage (`medias/{timestamp}_{nom}`).
   4. L'URL publique + métadonnées sont enregistrées dans Firestore
      (`medias`), ce qui permet un affichage en défilement infini (voir
      infinite-scroll.js) au lieu de tout charger d'un coup.
   ========================================================================= */

function compresserImage(fichier, { largeurMax = 1600, qualite = 0.75 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      const ratio = Math.min(1, largeurMax / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', qualite);
    };
    img.onerror = reject;
    reader.readAsDataURL(fichier);
  });
}

function initGalerieMedias({ db, storage, inputEl, progressEl, gridEl, sentinelEl }) {
  /* ---- Upload ---- */
  inputEl.addEventListener('change', async () => {
    const fichiers = Array.from(inputEl.files || []);
    if (!fichiers.length) return;
    progressEl.classList.remove('hidden');

    for (let i = 0; i < fichiers.length; i++) {
      const f = fichiers[i];
      progressEl.textContent = `Compression et envoi ${i + 1}/${fichiers.length} — ${f.name}`;
      try {
        const blobCompresse = await compresserImage(f);
        const chemin = `medias/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
        const ref = storage.ref(chemin);
        await ref.put(blobCompresse, { contentType: 'image/jpeg' });
        const url = await ref.getDownloadURL();
        await db.collection('medias').add({
          url, chemin, nom: f.name,
          tailleOriginale: f.size, tailleCompressee: blobCompresse.size,
          createdAt: Date.now()
        });
      } catch (err) {
        console.error('Erreur upload média :', err);
      }
    }
    progressEl.classList.add('hidden');
    inputEl.value = '';
    listeGalerie.rafraichir();
  });

  /* ---- Affichage en défilement infini ---- */
  gridEl.innerHTML = '';
  const listeGalerie = creerDefilementInfini({
    collection: db.collection('medias'),
    orderBy: ['createdAt', 'desc'],
    pageSize: 12,
    sentinel: sentinelEl,
    onPage: (docs, estPremierePage) => {
      if (estPremierePage) gridEl.innerHTML = '';
      docs.forEach(doc => {
        const m = doc.data();
        const ko = m.tailleCompressee ? Math.round(m.tailleCompressee / 1024) : '?';
        const div = document.createElement('div');
        div.className = 'card overflow-hidden relative group';
        div.innerHTML = `
          <img src="${m.url}" class="w-full h-32 object-cover" loading="lazy">
          <div class="p-2 text-[10px] text-gray-400 flex justify-between items-center">
            <span>${ko} Ko</span>
            <button class="text-red-600 font-bold">🗑</button>
          </div>`;
        div.querySelector('button').onclick = async () => {
          try { await storage.ref(m.chemin).delete(); } catch (e) {}
          await db.collection('medias').doc(doc.id).delete();
          div.remove();
        };
        gridEl.appendChild(div);
      });
    }
  });
  listeGalerie.demarrer();
  return listeGalerie;
}
