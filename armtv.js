/* =========================================================================
   ARM TV — LECTEUR PUBLIC (playlist programmée + mode direct)
   =========================================================================
   - Playlist : vidéos approuvées par l'admin (statut === 'approuvé'),
     lues automatiquement les unes après les autres (diffusion continue).
   - Filtrage par thème (onglets).
   - Mode direct : si le document `armtv_config/direct` a `enDirect: true`,
     le lecteur bascule automatiquement sur le flux HLS (.m3u8) fourni par
     l'admin (ex. Cloudflare Stream), sans rien à recoder plus tard.
   - Les flux HLS (.m3u8) sont lus via hls.js ; les fichiers mp4 classiques
     sont lus nativement par la balise <video>.
   ========================================================================= */

let armtvPlaylist = [];
let armtvIndex = 0;
let armtvHls = null;
let armtvThemeActif = 'Tous';

function armtvChargerSource(video) {
  const player = document.getElementById('armtvPlayer');
  if (armtvHls) { armtvHls.destroy(); armtvHls = null; }

  const url = video.urlVideo || '';
  if (url.endsWith('.m3u8') && window.Hls && Hls.isSupported()) {
    armtvHls = new Hls();
    armtvHls.loadSource(url);
    armtvHls.attachMedia(player);
    player.play().catch(() => {});
  } else {
    player.src = url;
    player.play().catch(() => {});
  }
  document.getElementById('armtvTitreActuel').textContent = video.titre || '';
  document.getElementById('armtvThemeActuel').textContent = video.theme || '';
}

function armtvJouerSuivant() {
  if (!armtvPlaylist.length) return;
  armtvIndex = (armtvIndex + 1) % armtvPlaylist.length;
  armtvChargerSource(armtvPlaylist[armtvIndex]);
}

function armtvRenderPlaylist() {
  const grid = document.getElementById('armtvPlaylistGrid');
  const filtres = armtvThemeActif === 'Tous' ? armtvPlaylist : armtvPlaylist.filter(v => v.theme === armtvThemeActif);
  grid.innerHTML = filtres.map((v, i) => `
    <button class="card overflow-hidden text-left" onclick="armtvLireIndex(${armtvPlaylist.indexOf(v)})">
      ${v.miniature ? `<img src="${v.miniature}" class="w-full h-24 object-cover">` : `<div class="w-full h-24 bg-gray-100 flex items-center justify-center text-2xl">📺</div>`}
      <div class="p-2">
        <p class="text-xs font-bold line-clamp-2">${v.titre || ''}</p>
        <p class="text-[10px] text-gray-400">${v.theme || ''}</p>
      </div>
    </button>`).join('') || '<p class="text-sm text-gray-400 col-span-full">Aucune vidéo dans cette catégorie pour le moment.</p>';
}
function armtvLireIndex(i) {
  armtvIndex = i;
  armtvChargerSource(armtvPlaylist[i]);
}

function armtvRenderOnglets() {
  const box = document.getElementById('armtvThemes');
  const themes = ['Tous', ...THEMES_ARMTV];
  box.innerHTML = themes.map(t => `
    <button class="armtv-tab px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${t === armtvThemeActif ? 'btn-primary' : 'bg-gray-100'}" data-t="${t}">${t}</button>
  `).join('');
  box.querySelectorAll('.armtv-tab').forEach(b => b.onclick = () => {
    armtvThemeActif = b.dataset.t;
    armtvRenderOnglets();
    armtvRenderPlaylist();
  });
}

let armtvDefilement = null;
async function armtvInit() {
  const player = document.getElementById('armtvPlayer');
  if (!player) return; // section absente de cette page
  player.addEventListener('ended', armtvJouerSuivant);

  // Playlist programmée — chargée par pages (défilement infini) plutôt qu'en un seul bloc
  const sentinel = document.getElementById('armtvSentinel');
  try {
    armtvDefilement = creerDefilementInfini({
      collection: db.collection('armtv_videos').where('statut', '==', 'approuvé'),
      orderBy: ['ordre', 'asc'],
      pageSize: 20,
      sentinel,
      onPage: (docs, premierePage) => {
        if (premierePage) armtvPlaylist = [];
        armtvPlaylist.push(...docs.map(d => d.data()));
        armtvRenderOnglets();
        armtvRenderPlaylist();
        if (premierePage && armtvPlaylist.length) armtvChargerSource(armtvPlaylist[0]);
      }
    });
    armtvDefilement.demarrer();
  } catch (err) { console.error('ARM TV playlist :', err); }

  // Mode direct
  try {
    db.collection('armtv_config').doc('direct').onSnapshot(doc => {
      const d = doc.data();
      const badge = document.getElementById('armtvDirectBadge');
      if (d && d.enDirect && d.urlDirect) {
        badge.classList.remove('hidden');
        armtvChargerSource({ titre: d.titreDirect || 'Diffusion en direct', theme: 'Direct', urlVideo: d.urlDirect });
      } else {
        badge.classList.add('hidden');
      }
    });
  } catch (err) { console.error('ARM TV direct :', err); }
}

document.addEventListener('DOMContentLoaded', armtvInit);
