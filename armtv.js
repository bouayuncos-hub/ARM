/* =========================================================================
   ARM TV + VIDÉOTHÈQUE (site public)
   - Une seule lecture Firestore : toutes les vidéos publiées (statut
     'approuvé'). Tri et répartition faits dans le navigateur, donc aucun
     index Firestore à créer.
       · ARM TV      : vidéos avec armtv !== false, triées par "ordre"
       · Vidéothèque : vidéos avec galerie === true, plus récentes d'abord
   - Chaque vidéo peut venir de YouTube, Facebook, Instagram, TikTok, X ou
     d'un fichier direct (voir video-embed.js).
   - Enchaînement automatique : YouTube et fichiers détectent la fin de la
     vidéo ; pour les autres réseaux, ARM TV passe à la suivante après la
     durée saisie par l'admin (sinon boutons ⏮ ⏭).
   ========================================================================= */

let armtvPlaylist = [];
let armtvIndex = 0;
let armtvThemeActif = 'Tous';
let armtvEnDirect = false;
let armtvMinuterie = null;
let videotheque = [];
let videoFiltre = 'toutes';
let videoOuverte = null;

const elStage = () => document.getElementById('armtvStage');

/* ---------------------------- ARM TV ---------------------------- */
function armtvAfficherInfos(v, info) {
  document.getElementById('armtvTitreActuel').textContent = v.titre || '';
  document.getElementById('armtvThemeActuel').textContent = v.theme || '';
  document.getElementById('armtvBadge').innerHTML = info.plateforme ? badgePlateforme(info.plateforme) : '';
  const lien = document.getElementById('armtvLienOrigine');
  if (info.plateforme && info.plateforme !== 'fichier' && /^https?:\/\//i.test(v.urlVideo || '')) {
    lien.href = v.urlVideo;
    lien.textContent = 'Voir sur ' + info.nom + ' ↗';
    lien.classList.remove('hidden');
  } else lien.classList.add('hidden');
}

function armtvMonter(v, autoplay) {
  clearTimeout(armtvMinuterie);
  const info = analyserVideo(v.urlVideo);
  if (info.erreur) return false;
  document.getElementById('armtvVide').classList.add('hidden');
  document.getElementById('armtvVide').classList.remove('flex');
  monterLecteur(elStage(), info, {
    autoplay,
    poster: miniatureVideo(v, info),
    onEnd: armtvEnDirect ? null : armtvSuivant
  });
  // Réseaux sans détection de fin : passage à la suivante après la durée indiquée
  if (!armtvEnDirect && autoplay && v.duree > 0 && !['youtube', 'fichier'].includes(info.plateforme)) {
    armtvMinuterie = setTimeout(armtvSuivant, v.duree * 60000);
  }
  armtvAfficherInfos(v, info);
  return true;
}

function armtvLire(i, autoplay = true) {
  if (!armtvPlaylist.length || armtvEnDirect) return;
  armtvIndex = (i + armtvPlaylist.length) % armtvPlaylist.length;
  armtvMonter(armtvPlaylist[armtvIndex], autoplay);
  document.querySelectorAll('#armtvPlaylistGrid [data-index]').forEach(b =>
    b.classList.toggle('ring-2', +b.dataset.index === armtvIndex));
}
function armtvSuivant() { armtvLire(armtvIndex + 1, true); }
function armtvPrecedent() { armtvLire(armtvIndex - 1, true); }

function vignette(v, info, hauteur) {
  const mini = miniatureVideo(v, info);
  const p = PLATEFORMES[info.plateforme] || PLATEFORMES.fichier;
  return mini
    ? `<img src="${esc(mini)}" alt="" loading="lazy" class="w-full ${hauteur} object-cover">`
    : `<div class="w-full ${hauteur} flex items-center justify-center text-3xl text-white" style="background:linear-gradient(135deg,${p.couleur},#071510)">${p.icone}</div>`;
}

function armtvRenderPlaylist() {
  const grid = document.getElementById('armtvPlaylistGrid');
  const items = armtvPlaylist.map((v, i) => ({ v, i }))
    .filter(({ v }) => armtvThemeActif === 'Tous' || v.theme === armtvThemeActif);
  grid.innerHTML = items.map(({ v, i }) => {
    const info = analyserVideo(v.urlVideo);
    return `
    <button type="button" class="relative text-left rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/30 ring-inset ring-[#f4c542] ${i === armtvIndex ? 'ring-2' : ''}" data-index="${i}">
      ${vignette(v, info, 'h-24')}
      <span class="absolute top-1.5 left-1.5">${badgePlateforme(info.plateforme || 'fichier', '!text-[10px] !px-1.5 !py-0.5')}</span>
      <div class="p-2">
        <p class="text-xs font-bold line-clamp-2">${esc(v.titre)}</p>
        <p class="text-[10px] text-white/50">${esc(v.theme)}</p>
      </div>
    </button>`;
  }).join('') || '<p class="text-sm text-white/50 col-span-2">Aucune vidéo dans cette catégorie pour le moment.</p>';
}

function armtvRenderOnglets() {
  const presents = new Set(armtvPlaylist.map(v => v.theme));
  const themes = ['Tous', ...THEMES_ARMTV.filter(t => presents.has(t))];
  document.getElementById('armtvThemes').innerHTML = themes.map(t => `
    <button type="button" class="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${t === armtvThemeActif ? 'bg-[#f4c542] text-[#2b1f00]' : 'bg-white/10 text-white'}" data-theme-tv="${esc(t)}">${esc(t)}</button>
  `).join('');
}

function armtvAfficherVide() {
  demonterLecteur(elStage());
  const vide = document.getElementById('armtvVide');
  vide.classList.remove('hidden'); vide.classList.add('flex');
  document.getElementById('armtvCommandes').classList.add('invisible');
}

/* ------------------------- VIDÉOTHÈQUE ------------------------- */
function videothequeRenderFiltres() {
  const presentes = new Set(videotheque.map(v => analyserVideo(v.urlVideo).plateforme));
  const filtres = [['toutes', 'Toutes']].concat(
    Object.keys(PLATEFORMES).filter(k => presentes.has(k)).map(k => [k, PLATEFORMES[k].nom]));
  document.getElementById('videoFiltres').innerHTML = filtres.length > 2 ? filtres.map(([k, n]) =>
    `<button type="button" class="chip ${k === videoFiltre ? 'actif' : ''}" data-filtre="${k}">${esc(n)}</button>`).join('') : '';
}

function videothequeRender() {
  const grid = document.getElementById('videoGrid');
  const liste = videotheque.filter(v => videoFiltre === 'toutes' || analyserVideo(v.urlVideo).plateforme === videoFiltre);
  document.getElementById('videoVide').classList.toggle('hidden', videotheque.length > 0);
  grid.innerHTML = liste.map(v => {
    const info = analyserVideo(v.urlVideo);
    return `
    <button type="button" class="card overflow-hidden text-left group fade-in" data-video="${esc(v.__id)}">
      <div class="relative aspect-video bg-black overflow-hidden">
        ${vignette(v, info, 'h-full')}
        <span class="absolute inset-0 flex items-center justify-center">
          <span class="w-14 h-14 rounded-full bg-black/55 text-white text-2xl flex items-center justify-center group-hover:scale-110 transition">▶</span>
        </span>
        <span class="absolute top-2 left-2">${badgePlateforme(info.plateforme || 'fichier')}</span>
      </div>
      <div class="p-4">
        <p class="text-[11px] font-bold uppercase tracking-wider mb-1" style="color:var(--vert)">${esc(v.theme)}</p>
        <h3 class="serif font-bold text-lg leading-snug line-clamp-2">${esc(v.titre)}</h3>
        ${v.description ? `<p class="text-sm muted line-clamp-2 mt-1">${esc(v.description)}</p>` : ''}
      </div>
    </button>`;
  }).join('');
  if (typeof observerFadeIn === 'function') observerFadeIn(grid);
}

function ouvrirVideo(id) {
  const v = videotheque.find(x => x.__id === id);
  if (!v) return;
  const info = analyserVideo(v.urlVideo);
  if (info.erreur) return;
  videoOuverte = v;
  if (elStage() && elStage().__pause) elStage().__pause();   // met ARM TV en pause
  clearTimeout(armtvMinuterie);
  document.getElementById('videoModalTitre').textContent = v.titre || '';
  document.getElementById('videoModalBadge').innerHTML = badgePlateforme(info.plateforme);
  document.getElementById('videoModalDesc').textContent = v.description || '';
  const lien = document.getElementById('videoModalLien');
  if (info.plateforme !== 'fichier') { lien.href = v.urlVideo; lien.textContent = 'Voir sur ' + info.nom + ' ↗'; lien.classList.remove('hidden'); }
  else lien.classList.add('hidden');
  document.getElementById('videoModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  monterLecteur(document.getElementById('videoModalStage'), info, { autoplay: true, poster: miniatureVideo(v, info) });
  document.getElementById('videoModalFermer').focus();
}

function fermerVideo() {
  demonterLecteur(document.getElementById('videoModalStage'));
  document.getElementById('videoModal').classList.add('hidden');
  document.body.style.overflow = '';
  videoOuverte = null;
}

/* --------------------------- DÉMARRAGE --------------------------- */
async function armtvInit() {
  if (!elStage()) return;

  document.getElementById('armtvSuiv').onclick = armtvSuivant;
  document.getElementById('armtvPrec').onclick = armtvPrecedent;
  document.getElementById('armtvPlaylistGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-index]');
    if (b) { armtvLire(+b.dataset.index, true); elStage().scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  });
  document.getElementById('armtvThemes').addEventListener('click', e => {
    const b = e.target.closest('[data-theme-tv]'); if (!b) return;
    armtvThemeActif = b.dataset.themeTv;
    armtvRenderOnglets(); armtvRenderPlaylist();
  });
  document.getElementById('videoGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-video]'); if (b) ouvrirVideo(b.dataset.video);
  });
  document.getElementById('videoFiltres').addEventListener('click', e => {
    const b = e.target.closest('[data-filtre]'); if (!b) return;
    videoFiltre = b.dataset.filtre;
    videothequeRenderFiltres(); videothequeRender();
  });
  document.getElementById('videoModalFermer').onclick = fermerVideo;
  document.getElementById('videoModal').addEventListener('click', e => { if (e.target.id === 'videoModal') fermerVideo(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && videoOuverte) fermerVideo(); });
  document.getElementById('videoModalPartager').onclick = async () => {
    if (!videoOuverte) return;
    const url = /^https?:\/\//i.test(videoOuverte.urlVideo) ? videoOuverte.urlVideo : location.href;
    const titre = (videoOuverte.titre || 'Vidéo') + ' — A.R.M';
    if (navigator.share) { try { await navigator.share({ title: titre, url }); } catch (err) {} }
    else window.open('https://wa.me/?text=' + encodeURIComponent(titre + ' ' + url), '_blank', 'noopener');
  };

  let publiees = [];
  try {
    const snap = await db.collection('armtv_videos').where('statut', '==', 'approuvé').limit(500).get();
    publiees = snap.docs.map(d => Object.assign({ __id: d.id }, d.data()))
      .filter(v => !analyserVideo(v.urlVideo).erreur);
  } catch (err) { console.warn('Vidéos :', err.message); }

  armtvPlaylist = publiees.filter(v => v.armtv !== false)
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || (a.createdAt || 0) - (b.createdAt || 0));
  videotheque = publiees.filter(v => v.galerie === true)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  armtvRenderOnglets();
  armtvRenderPlaylist();
  videothequeRenderFiltres();
  videothequeRender();
  if (armtvPlaylist.length) armtvLire(0, false);   // pas de lecture automatique au chargement
  else armtvAfficherVide();

  // Direct (YouTube Live, Facebook Live ou flux .m3u8)
  db.collection('armtv_config').doc('direct').onSnapshot(doc => {
    const d = doc.data();
    const badge = document.getElementById('armtvDirectBadge');
    const actif = !!(d && d.enDirect && d.urlDirect && !analyserVideo(d.urlDirect).erreur);
    if (actif) {
      armtvEnDirect = true;
      badge.classList.remove('hidden');
      document.getElementById('armtvCommandes').classList.add('invisible');
      armtvMonter({ titre: d.titreDirect || 'Diffusion en direct', theme: 'Direct', urlVideo: d.urlDirect }, true);
    } else {
      badge.classList.add('hidden');
      if (armtvEnDirect) {
        armtvEnDirect = false;
        if (armtvPlaylist.length) { document.getElementById('armtvCommandes').classList.remove('invisible'); armtvLire(armtvIndex, false); }
        else armtvAfficherVide();
      }
    }
  }, err => console.warn('ARM TV direct :', err.message));
}

armtvInit();
