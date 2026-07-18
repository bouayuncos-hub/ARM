/* =========================================================================
   MODULE : DÉFILEMENT INFINI (INFINITE SCROLL) POUR FIRESTORE
   =========================================================================
   Architecture :
   - Pagination par curseur (`startAfter`) au lieu d'un `onSnapshot` global :
     on ne charge et ne garde en mémoire/DOM que ce qui a été affiché,
     ce qui reste fluide même avec des milliers de documents.
   - Un IntersectionObserver surveille une "sentinelle" (élément vide en bas
     de liste) : dès qu'elle entre dans le viewport, la page suivante est
     chargée. Coût quasi nul (pas de scroll listener classique).
   - Verrou `enCours` pour ne jamais déclencher deux chargements en parallèle.
   - Fonction `rafraichir()` fournie pour revenir à la page 1 (ex: après
     une action qui change les données, ou un changement de filtre).

   Utilisation :
   const liste = creerDefilementInfini({
     collection: db.collection('adhesions'),
     orderBy: ['createdAt', 'desc'],
     pageSize: 25,
     sentinel: document.getElementById('sentinelAdhesions'),
     onPage: (docs, estPremierePage) => { ...rendu DOM... }
   });
   liste.demarrer();      // charge la première page et observe la sentinelle
   liste.rafraichir();    // relance depuis le début
   ========================================================================= */

function creerDefilementInfini({ collection, orderBy, pageSize = 20, sentinel, onPage, onFin }) {
  let dernierDoc = null;
  let enCours = false;
  let termine = false;
  let observer = null;

  async function chargerPage(estPremierePage = false) {
    if (enCours || termine) return;
    enCours = true;
    if (sentinel) sentinel.textContent = 'Chargement…';

    let q = collection.orderBy(orderBy[0], orderBy[1] || 'desc').limit(pageSize);
    if (dernierDoc) q = q.startAfter(dernierDoc);

    try {
      const snap = await q.get();
      if (snap.empty) {
        termine = true;
        if (sentinel) sentinel.textContent = estPremierePage ? 'Aucune donnée.' : 'Fin de la liste.';
        if (onFin) onFin();
        enCours = false;
        return;
      }
      dernierDoc = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < pageSize) {
        termine = true;
        if (sentinel) sentinel.textContent = 'Fin de la liste.';
      } else if (sentinel) {
        sentinel.textContent = '';
      }
      onPage(snap.docs, estPremierePage);
    } catch (err) {
      console.error('Erreur défilement infini :', err);
      if (sentinel) sentinel.textContent = 'Erreur de chargement.';
    }
    enCours = false;
  }

  function demarrer() {
    chargerPage(true);
    if (sentinel && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach(en => { if (en.isIntersecting) chargerPage(false); });
      }, { rootMargin: '200px' });
      observer.observe(sentinel);
    }
  }

  function rafraichir() {
    dernierDoc = null;
    termine = false;
    enCours = false;
    chargerPage(true);
  }

  function arreter() {
    if (observer) observer.disconnect();
  }

  return { demarrer, rafraichir, arreter };
}
