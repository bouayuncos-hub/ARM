/* =========================================================================
   ARM TV — LECTEUR PUBLIC (playlist programmée + mode direct)
   - Playlist : vidéos approuvées par l'admin, lues à la suite en boucle.
   - Tri par "ordre" fait dans le navigateur : aucun index Firestore
     composite à créer.
   - Mode direct : si armtv_config/direct.enDirect est vrai, le lecteur
     bascule sur le flux HLS (.m3u8) indiqué par l'admin, puis revient à
     la playlist quand le direct s'arrête.
   ========================================================================= */

let armtvPlaylist = [];
let armtvIndex = 0;
let armtvHls = null;
let armtvThemeActif = 'Tous';
let armtvEnDirect = false;

function armtvChargerSource(video, lancer = true) {
  const player = document.getElementById('armtvPlayer');
  if (armtvHls) { armtvHls.destroy(); armtvHls = null; }
  const url = String(video.urlVideo || '').trim();
  if (!/^https?:\/\//i.test(url)) return;

  document.getElementById('armtvVide').classList.add('hidden');
  document.getElementById('armtvVide').classList.remove('flex');

  if (/\.m3u8(\?|$)/i.test(url) && window.Hls && Hls.isSupported()) {
    armtvHls = new Hls();
    armtvHls.loadSource(url);
    armtvHls.attachMedia(player);
  } else {
    player.src = url;   // mp4, ou HLS natif sur iPhone/Safari
  }
  if (lancer) player.play().catch(() => {});
  if (video.miniature && /^https?:\/\//i.test(video.miniature)) player.poster = video.miniature;
  document.getElementById('armtvTitreActuel').textContent = video.titre || '';
  document.getElementById('armtvThemeActuel').textContent = video.theme || '';
}

function armtvJouerSuivant() {
  if (armtvEnDirect || !armtvPlaylist.length) return;
  armtvIndex = (armtvIndex + 1) % armtvPlaylist.length;
  armtvChargerSource(armtvPlaylist[armtvIndex]);
}

function armtvLireIndex(i) {
  if (!armtvPlaylist[i]) return;
  armtvIndex = i;
  armtvChargerSource(armtvPlaylist[i]);
  document.getElementById('armtvPlayer').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function armtvRenderPlaylist() {
  const grid = document.getElementById('armtvPlaylistGrid');
  const filtres = armtvPlaylist
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => armtvThemeActif === 'Tous' || v.theme === armtvThemeActif);
  grid.innerHTML = filtres.map(({ v, i }) => {
    const mini = /^https?:\/\//i.test(v.miniature || '') ? esc(v.miniature) : '';
    return `
    <button type="button" class="text-left rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/30" data-index="${i}">
      ${mini ? `<img src="${mini}" alt="" loading="lazy" class="w-full h-24 object-cover">`
             : `<div class="w-full h-24 bg-white/5 flex items-center justify-center text-2xl">📺</div>`}
      <div class="p-2">
        <p class="text-xs font-bold line-clamp-2">${esc(v.titre)}</p>
        <p class="text-[10px] text-white/50">${esc(v.theme)}</p>
      </div>
    </button>`;
  }).join('') || '<p class="text-sm text-white/50 col-span-2">Aucune vidéo dans cette catégorie pour le moment.</p>';
}

function armtvRenderOnglets() {
  const box = document.getElementById('armtvThemes');
  // N'affiche que les thèmes qui contiennent au moins une vidéo
  const presents = new Set(armtvPlaylist.map(v => v.theme));
  const themes = ['Tous', ...THEMES_ARMTV.filter(t => presents.has(t))];
  box.innerHTML = themes.map(t => `
    <button type="button" class="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${t === armtvThemeActif ? 'bg-[#f4c542] text-[#2b1f00]' : 'bg-white/10 text-white'}" data-theme-tv="${esc(t)}">${esc(t)}</button>
  `).join('');
}

async function armtvInit() {
  const player = document.getElementById('armtvPlayer');
  if (!player) return;
  player.addEventListener('ended', armtvJouerSuivant);
  document.getElementById('armtvPlaylistGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-index]');
    if (b) armtvLireIndex(+b.dataset.index);
  });
  document.getElementById('armtvThemes').addEventListener('click', e => {
    const b = e.target.closest('[data-theme-tv]');
    if (!b) return;
    armtvThemeActif = b.dataset.themeTv;
    armtvRenderOnglets();
    armtvRenderPlaylist();
  });

  try {
    const snap = await db.collection('armtv_videos').where('statut', '==', 'approuvé').limit(300).get();
    armtvPlaylist = snap.docs.map(d => d.data())
      .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || (a.createdAt || 0) - (b.createdAt || 0));
  } catch (err) { console.warn('ARM TV playlist :', err.message); }

  armtvRenderOnglets();
  armtvRenderPlaylist();
  if (armtvPlaylist.length) {
    armtvChargerSource(armtvPlaylist[0], false); // pas de lecture automatique avec son au chargement
  } else {
    const vide = document.getElementById('armtvVide');
    vide.classList.remove('hidden');
    vide.classList.add('flex');
  }

  db.collection('armtv_config').doc('direct').onSnapshot(doc => {
    const d = doc.data();
    const badge = document.getElementById('armtvDirectBadge');
    if (d && d.enDirect && d.urlDirect) {
      armtvEnDirect = true;
      badge.classList.remove('hidden');
      armtvChargerSource({ titre: d.titreDirect || 'Diffusion en direct', theme: 'Direct', urlVideo: d.urlDirect });
    } else {
      badge.classList.add('hidden');
      if (armtvEnDirect) {
        armtvEnDirect = false;
        if (armtvPlaylist.length) armtvChargerSource(armtvPlaylist[armtvIndex], false);
      }
    }
  }, err => console.warn('ARM TV direct :', err.message));
}

armtvInit();
