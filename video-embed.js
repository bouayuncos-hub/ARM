/* =========================================================================
   VIDÉOS — RECONNAISSANCE DES LIENS + LECTEUR UNIFIÉ
   =========================================================================
   L'administrateur colle simplement le lien d'une vidéo :
     YouTube   : youtube.com/watch?v=…, youtu.be/…, /shorts/…, /live/…
     Facebook  : facebook.com/…/videos/…, /watch?v=…, /reel/…, fb.watch/…
     Instagram : instagram.com/p/…, /reel/…, /tv/…
     TikTok    : tiktok.com/@compte/video/123…
     X/Twitter : x.com/compte/status/123…  ou  twitter.com/…
     Fichier   : lien direct .mp4 / .webm / .m3u8 (Firebase Storage, Cloudflare…)
   analyserVideo(url) reconnaît la plateforme et construit le lecteur officiel
   intégré de chaque réseau. Seul l'identifiant de la vidéo (vérifié) est
   inséré dans le lecteur : un lien piégé ne peut rien injecter dans le site.
   ========================================================================= */

const PLATEFORMES = {
  youtube:   { nom: 'YouTube',     icone: '▶', couleur: '#e62117' },
  facebook:  { nom: 'Facebook',    icone: 'f', couleur: '#1877f2' },
  instagram: { nom: 'Instagram',   icone: '◎', couleur: '#c13584' },
  tiktok:    { nom: 'TikTok',      icone: '♪', couleur: '#111111' },
  x:         { nom: 'X (Twitter)', icone: '𝕏', couleur: '#14171a' },
  fichier:   { nom: 'ARM TV',      icone: '📺', couleur: '#0f7a3d' }
};

function _infoVideo(plateforme, url, extra) {
  return Object.assign({ plateforme, url, vertical: false, miniature: '' }, PLATEFORMES[plateforme], extra);
}

function analyserVideo(urlBrute) {
  const url = String(urlBrute || '').trim();
  if (!url) return { erreur: 'Colle le lien de la vidéo.' };
  if (!/^https?:\/\//i.test(url)) return { erreur: 'Le lien doit commencer par https://' };
  let u;
  try { u = new URL(url); } catch (e) { return { erreur: 'Ce lien n\'est pas valide.' }; }
  const hote = u.hostname.toLowerCase().replace(/^(www|m|mobile|web)\./, '');
  const chemin = u.pathname;
  let m;

  // ---- YouTube ----
  if (hote === 'youtu.be' || hote === 'youtube.com' || hote.endsWith('.youtube.com') || hote === 'youtube-nocookie.com') {
    let id = null;
    if (hote === 'youtu.be') id = chemin.split('/')[1];
    else if (u.searchParams.get('v')) id = u.searchParams.get('v');
    else if ((m = chemin.match(/^\/(?:shorts|live|embed|v)\/([\w-]{11})/))) id = m[1];
    if (!id || !/^[\w-]{11}$/.test(id)) {
      return { plateforme: 'youtube', erreur: 'Lien YouTube non reconnu : ouvre la vidéo, puis Partager › Copier le lien.' };
    }
    return _infoVideo('youtube', url, {
      id, vertical: /^\/shorts\//.test(chemin), miniature: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
    });
  }

  // ---- Facebook ----
  if (hote === 'facebook.com' || hote.endsWith('.facebook.com') || hote === 'fb.watch') {
    const href = hote === 'fb.watch' ? url : 'https://www.facebook.com' + chemin + u.search;
    if (hote !== 'fb.watch' && !/\/(videos|watch|reel|share\/v|share\/r)\b/.test(chemin + u.search)) {
      return { plateforme: 'facebook', erreur: 'Ce lien Facebook ne mène pas à une vidéo. Copie le lien de la vidéo elle-même (…/videos/… ou …/reel/…).' };
    }
    return _infoVideo('facebook', url, { href, vertical: /\/(reel|share\/r)\//.test(chemin) });
  }

  // ---- Instagram ----
  if (hote === 'instagram.com' || hote.endsWith('.instagram.com')) {
    m = chemin.match(/^\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/);
    if (!m) return { plateforme: 'instagram', erreur: 'Lien Instagram non reconnu : copie le lien de la publication ou du reel (…/p/… ou …/reel/…).' };
    return _infoVideo('instagram', url, { type: m[1] === 'reels' ? 'reel' : m[1], code: m[2], vertical: true });
  }

  // ---- TikTok ----
  if (hote === 'tiktok.com' || hote.endsWith('.tiktok.com')) {
    if (/^(vm|vt)\./.test(hote) || /^\/t\//.test(chemin)) {
      return { plateforme: 'tiktok', erreur: 'Lien court TikTok : ouvre-le dans ton navigateur, puis copie le lien complet (…/video/123…).' };
    }
    m = chemin.match(/\/video\/(\d+)/) || chemin.match(/^\/(?:embed\/v2|embed|player\/v1)\/(\d+)/);
    if (!m) return { plateforme: 'tiktok', erreur: 'Lien TikTok non reconnu : il doit contenir …/video/123…' };
    return _infoVideo('tiktok', url, { id: m[1], vertical: true });
  }

  // ---- X / Twitter ----
  if (hote === 'x.com' || hote === 'twitter.com') {
    m = chemin.match(/^\/\w+\/status(?:es)?\/(\d+)/);
    if (!m) return { plateforme: 'x', erreur: 'Lien X non reconnu : copie le lien du post (…/status/123…).' };
    return _infoVideo('x', url, { id: m[1], vertical: true });
  }

  // ---- Fichier vidéo direct ----
  const info = _infoVideo('fichier', url, { hls: /\.m3u8(\?|$)/i.test(url) });
  if (!/\.(mp4|webm|ogg|mov|m4v|m3u8)(\?|$)/i.test(url) && !/firebasestorage|cloudflarestream|videodelivery|mux\.com/i.test(url)) {
    info.avertissement = 'Plateforme non reconnue : ce lien sera lu comme un fichier vidéo direct.';
  }
  return info;
}

/* URL du lecteur officiel de chaque réseau (construite uniquement à partir
   d'identifiants vérifiés). */
function urlLecteur(info, autoplay) {
  const a = autoplay ? 1 : 0;
  switch (info.plateforme) {
    case 'youtube':   return `https://www.youtube-nocookie.com/embed/${info.id}?rel=0&playsinline=1&autoplay=${a}`;
    case 'facebook':  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(info.href)}&show_text=false&autoplay=${autoplay ? 'true' : 'false'}`;
    case 'instagram': return `https://www.instagram.com/${info.type}/${info.code}/embed/`;
    case 'tiktok':    return `https://www.tiktok.com/player/v1/${info.id}?autoplay=${a}&music_info=1&description=1`;
    case 'x':         return `https://platform.twitter.com/embed/Tweet.html?id=${info.id}&theme=dark&dnt=true`;
    default:          return '';
  }
}

/* Badge coloré de la plateforme (contenu fixe, sans donnée externe) */
function badgePlateforme(plateforme, classe = '') {
  const p = PLATEFORMES[plateforme] || PLATEFORMES.fichier;
  return `<span class="badge-pf ${classe}" style="background:${p.couleur}">${p.icone} ${p.nom}</span>`;
}

/* Miniature : celle saisie par l'admin, sinon celle de YouTube */
function miniatureVideo(v, info) {
  if (v && /^https?:\/\//i.test(v.miniature || '')) return v.miniature;
  return (info && info.miniature) || '';
}

/* ---- Chargement de l'API YouTube (pour enchaîner automatiquement les vidéos) ---- */
let _promesseYT = null;
function chargerApiYouTube(delai = 5000) {
  if (window.YT && YT.Player) return Promise.resolve(true);
  if (!_promesseYT) {
    _promesseYT = new Promise(res => {
      const avant = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (avant) { try { avant(); } catch (e) {} } res(true); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => res(false);
      document.head.appendChild(s);
    });
  }
  return Promise.race([_promesseYT, new Promise(r => setTimeout(() => r(false), delai))]);
}

/* ---- Lecteur unifié ----
   monterLecteur(conteneur, info, { autoplay, onEnd, poster })
   - YouTube : lecteur YouTube avec détection de fin (enchaînement automatique)
   - Fichier : balise <video> (HLS via hls.js si disponible)
   - Autres  : lecteur officiel intégré du réseau social                    */
function monterLecteur(cible, info, opts = {}) {
  const { autoplay = false, onEnd = null, poster = '' } = opts;
  demonterLecteur(cible);
  const jeton = (cible.__jeton = (cible.__jeton || 0) + 1);
  cible.classList.toggle('lecteur-vertical', !!info.vertical);

  const iframe = (src) => {
    const f = document.createElement('iframe');
    f.src = src;
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write';
    f.allowFullscreen = true;
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    f.title = (info.nom || 'Vidéo') + ' — lecteur';
    cible.appendChild(f);
    return f;
  };

  if (info.plateforme === 'fichier') {
    const v = document.createElement('video');
    v.controls = true; v.playsInline = true; v.preload = 'metadata';
    if (poster) v.poster = poster;
    let hls = null;
    if (info.hls && window.Hls && Hls.isSupported()) { hls = new Hls(); hls.loadSource(info.url); hls.attachMedia(v); }
    else v.src = info.url;
    if (onEnd) v.addEventListener('ended', onEnd);
    cible.appendChild(v);
    if (autoplay) v.play().catch(() => {});
    cible.__pause = () => v.pause();
    cible.__detruire = () => { v.pause(); if (hls) hls.destroy(); };
    return;
  }

  if (info.plateforme === 'youtube') {
    const zone = document.createElement('div');
    cible.appendChild(zone);
    chargerApiYouTube().then(ok => {
      if (jeton !== cible.__jeton) return;          // une autre vidéo a été lancée entre-temps
      if (ok) {
        const lecteur = new YT.Player(zone, {
          videoId: info.id, width: '100%', height: '100%', host: 'https://www.youtube-nocookie.com',
          playerVars: { autoplay: autoplay ? 1 : 0, rel: 0, playsinline: 1, modestbranding: 1 },
          events: { onStateChange: e => { if (e.data === 0 && onEnd) onEnd(); } }
        });
        cible.__pause = () => { try { lecteur.pauseVideo(); } catch (e) {} };
        cible.__detruire = () => { try { lecteur.destroy(); } catch (e) {} };
      } else {
        zone.remove();
        iframe(urlLecteur(info, autoplay));         // repli : lecteur simple
      }
    });
    return;
  }

  iframe(urlLecteur(info, autoplay));
}

function demonterLecteur(cible) {
  if (!cible) return;
  if (cible.__detruire) { try { cible.__detruire(); } catch (e) {} }
  cible.__detruire = null; cible.__pause = null;
  cible.__jeton = (cible.__jeton || 0) + 1;
  cible.innerHTML = '';
}

/* ---- Styles du lecteur (injectés une fois, valables sur le site et l'admin) ---- */
(function () {
  if (document.getElementById('style-video-embed')) return;
  const st = document.createElement('style');
  st.id = 'style-video-embed';
  st.textContent = `
    .lecteur{position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:16px;overflow:hidden;}
    .lecteur.lecteur-vertical{aspect-ratio:auto;height:min(78vh,700px);}
    .lecteur iframe,.lecteur video,.lecteur>div{width:100%;height:100%;border:0;display:block;}
    .lecteur.lecteur-vertical iframe{width:auto;max-width:100%;aspect-ratio:9/16;margin:0 auto;background:#000;}
    .badge-pf{display:inline-flex;align-items:center;gap:4px;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;line-height:1.2;white-space:nowrap;}
  `;
  document.head.appendChild(st);
})();
