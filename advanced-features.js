/* =====================================================================
   ADVANCED FEATURES — Fonctionnalités avancées pour A.R.M
   =====================================================================
   - Analytics avancée (graphiques, export de données)
   - Gestion multi-utilisateurs / rôles admin
   - Optimisation des performances (caching, compression)
   - Validation en temps réel des formulaires
   - Rate limiting côté client
   ===================================================================== */

/* ===================== ANALYTICS AVANCÉE ===================== */
class AnalyticsManager {
  constructor(db) {
    this.db = db;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async getMetricsComplets() {
    const cacheKey = 'metrics_complets';
    if (this.cache.has(cacheKey)) {
      const { data, timestamp } = this.cache.get(cacheKey);
      if (Date.now() - timestamp < this.cacheTimeout) return data;
    }

    try {
      const [compteurs, adhésions, dons, messages, actualités] = await Promise.all([
        this.db.collection('compteurs').doc('global').get(),
        this.db.collection('adhesions').get(),
        this.db.collection('dons').get(),
        this.db.collection('messages').get(),
        this.db.collection('actualites').get()
      ]);

      const data = {
        global: compteurs.data() || {},
        totalAdhésions: adhésions.size,
        totalDons: dons.size,
        totalMessages: messages.size,
        totalActualités: actualités.size,
        adhésionsParStatut: this.compterParPropriété(adhésions, 'statut'),
        donsParMéthode: this.compterParPropriété(dons, 'methode'),
        messagesNonLus: this.compterWhere(messages, 'lu', false),
        tendances: this.calculerTendances(adhésions, dons)
      };

      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (err) {
      console.error('Erreur getMetricsComplets:', err);
      return null;
    }
  }

  compterParPropriété(snapshot, propriété) {
    const comptage = {};
    snapshot.forEach(doc => {
      const val = doc.data()[propriété] || 'indéfini';
      comptage[val] = (comptage[val] || 0) + 1;
    });
    return comptage;
  }

  compterWhere(snapshot, propriété, valeur) {
    let compte = 0;
    snapshot.forEach(doc => {
      if (doc.data()[propriété] === valeur) compte++;
    });
    return compte;
  }

  calculerTendances(adhésions, dons) {
    const maintenant = Date.now();
    const hier = maintenant - 24 * 60 * 60 * 1000;
    const semaineDernière = maintenant - 7 * 24 * 60 * 60 * 1000;

    let adhéré24h = 0, adhéré7j = 0, dons24h = 0, dons7j = 0;

    adhésions.forEach(doc => {
      const t = doc.data().createdAt || 0;
      if (t > hier) adhéré24h++;
      if (t > semaineDernière) adhéré7j++;
    });

    dons.forEach(doc => {
      const t = doc.data().createdAt || 0;
      if (t > hier) dons24h++;
      if (t > semaineDernière) dons7j++;
    });

    return { adhéré24h, adhéré7j, dons24h, dons7j };
  }

  async exporterDonnées(type = 'complet') {
    const collections = {
      adhesions: await this.db.collection('adhesions').get(),
      dons: await this.db.collection('dons').get(),
      messages: await this.db.collection('messages').get(),
      actualites: await this.db.collection('actualites').get(),
      chat: await this.db.collection('chat').get()
    };

    const exportData = {};
    Object.entries(collections).forEach(([nom, snap]) => {
      exportData[nom] = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    });

    return exportData;
  }
}

/* ===================== GESTION MULTI-UTILISATEURS / RÔLES ===================== */
class RoleManager {
  constructor(db) {
    this.db = db;
    this.roleLocal = localStorage.getItem('arm_role') || 'viewer';
  }

  async initialiserRôles() {
    try {
      const doc = await this.db.collection('config').doc('roles').get();
      if (!doc.exists) {
        await this.db.collection('config').doc('roles').set({
          admin: { permissions: ['lire', 'écrire', 'supprimer', 'modérer'] },
          moderateur: { permissions: ['lire', 'écrire', 'modérer'] },
          editeur: { permissions: ['lire', 'écrire'] },
          viewer: { permissions: ['lire'] }
        });
      }
    } catch (err) {
      console.error('Erreur initialisation rôles:', err);
    }
  }

  possèdePermission(action) {
    const permissions = {
      admin: ['lire', 'écrire', 'supprimer', 'modérer'],
      moderateur: ['lire', 'écrire', 'modérer'],
      editeur: ['lire', 'écrire'],
      viewer: ['lire']
    };
    return (permissions[this.roleLocal] || []).includes(action);
  }

  définirRôle(rôle) {
    this.roleLocal = rôle;
    localStorage.setItem('arm_role', rôle);
  }
}

/* ===================== VALIDATION FORMULAIRES EN TEMPS RÉEL ===================== */
class FormValidator {
  static validations = {
    email: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    telephone: (val) => /^\+?[\d\s\-\(\)]{7,}$/.test(val.replace(/\s/g, '')),
    montant: (val) => parseFloat(val) > 0,
    url: (val) => {
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    },
    texteLong: (val) => val && val.trim().length >= 10,
    texteNormal: (val) => val && val.trim().length >= 3,
    required: (val) => val && val.toString().trim().length > 0
  };

  static valider(valeur, règles) {
    if (typeof règles === 'string') règles = [règles];
    return règles.every(règle => {
      const validateur = this.validations[règle];
      return validateur ? validateur(valeur) : true;
    });
  }

  static activerValidationEnTempsRéel(formulaire, schéma) {
    Object.entries(schéma).forEach(([fieldName, règles]) => {
      const field = formulaire.querySelector(`[name="${fieldName}"]`);
      if (!field) return;

      field.addEventListener('blur', () => {
        const estValide = this.valider(field.value, règles);
        field.classList.toggle('is-invalid', !estValide);
        field.classList.toggle('is-valid', estValide);
      });

      field.addEventListener('input', () => {
        const estValide = this.valider(field.value, règles);
        field.classList.toggle('is-invalid', !estValide && field.value);
        field.classList.toggle('is-valid', estValide);
      });
    });
  }
}

/* ===================== RATE LIMITING (côté client) ===================== */
class RateLimiter {
  constructor(maxRequêtes = 10, timeWindow = 60000) {
    this.maxRequêtes = maxRequêtes;
    this.timeWindow = timeWindow;
    this.requêtes = [];
  }

  peutFaire() {
    const maintenant = Date.now();
    this.requêtes = this.requêtes.filter(t => maintenant - t < this.timeWindow);

    if (this.requêtes.length >= this.maxRequêtes) {
      return false;
    }

    this.requêtes.push(maintenant);
    return true;
  }

  attendreAvantProchaine() {
    if (this.requêtes.length === 0) return 0;
    const plusAncienne = this.requêtes[0];
    const delai = this.timeWindow - (Date.now() - plusAncienne);
    return Math.max(0, delai);
  }
}

/* ===================== EXPORT DE DONNÉES (CSV/JSON) ===================== */
class DataExporter {
  static exporterCSV(données, nomFichier = 'export') {
    if (!Array.isArray(données) || données.length === 0) {
      console.error('Les données doivent être un tableau non vide');
      return;
    }

    const entêtes = Object.keys(données[0]);
    const lignes = [
      entêtes.join(','),
      ...données.map(obj =>
        entêtes.map(clé => {
          const val = obj[clé];
          return typeof val === 'string' && val.includes(',')
            ? `"${val.replace(/"/g, '""')}"`
            : val;
        }).join(',')
      )
    ];

    const csv = lignes.join('\n');
    this.télécharger(csv, `${nomFichier}.csv`, 'text/csv');
  }

  static exporterJSON(données, nomFichier = 'export') {
    const json = JSON.stringify(données, null, 2);
    this.télécharger(json, `${nomFichier}.json`, 'application/json');
  }

  static télécharger(contenu, nomFichier, typeMIME) {
    const blob = new Blob([contenu], { type: typeMIME });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nomFichier;
    lien.click();
    URL.revokeObjectURL(url);
  }
}

/* ===================== CACHING / PERFORMANCE ===================== */
class CacheManager {
  constructor(nomStock = 'arm_cache') {
    this.nomStock = nomStock;
    this.ttl = 30 * 60 * 1000; // 30 minutes par défaut
  }

  définir(clé, valeur, ttl = this.ttl) {
    const cache = JSON.parse(localStorage.getItem(this.nomStock) || '{}');
    cache[clé] = {
      valeur,
      expiration: Date.now() + ttl
    };
    localStorage.setItem(this.nomStock, JSON.stringify(cache));
  }

  obtenir(clé) {
    const cache = JSON.parse(localStorage.getItem(this.nomStock) || '{}');
    if (!cache[clé]) return null;

    const { valeur, expiration } = cache[clé];
    if (Date.now() > expiration) {
      delete cache[clé];
      localStorage.setItem(this.nomStock, JSON.stringify(cache));
      return null;
    }

    return valeur;
  }

  vider() {
    localStorage.removeItem(this.nomStock);
  }
}

/* ===================== NOTIFICATIONS AMÉLIORÉES ===================== */
class NotificationService {
  static afficherNotification(titre, options = {}) {
    const défaut = {
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'arm-notif',
      requireInteraction: false
    };

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(titre, { ...défaut, ...options });
    } else if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(titre, { ...défaut, ...options });
      });
    }
  }

  static enregistrerPush(db, token) {
    return db.collection('abonnes_push').doc(token).set({
      token,
      createdAt: Date.now(),
      plateforme: this.détecterPlateforme()
    });
  }

  static détecterPlateforme() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    if (/Android/.test(ua)) return 'Android';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Mac/.test(ua)) return 'macOS';
    return 'Autre';
  }
}

/* ===================== LAZY LOADING ===================== */
class LazyLoader {
  static initialiser() {
    if ('IntersectionObserver' in window) {
      const observateur = new IntersectionObserver((entrées) => {
        entrées.forEach(entrée => {
          if (entrée.isIntersecting) {
            const img = entrée.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              observateur.unobserve(img);
            }
          }
        });
      });

      document.querySelectorAll('img[data-src]').forEach(img => {
        observateur.observe(img);
      });
    }
  }
}

/* ===================== UTILS ===================== */
const ARM_Utils = {
  formatDate: (timestamp) => new Date(timestamp).toLocaleString('fr-FR'),
  formatCurrency: (montant) => montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }),
  slugify: (texte) => texte.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
  debounce: (func, wait) => {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },
  throttle: (func, wait) => {
    let dernierAppel = 0;
    return function (...args) {
      const maintenant = Date.now();
      if (maintenant - dernierAppel >= wait) {
        func.apply(this, args);
        dernierAppel = maintenant;
      }
    };
  }
};

// Export global
if (typeof window !== 'undefined') {
  window.ARM = {
    AnalyticsManager,
    RoleManager,
    FormValidator,
    RateLimiter,
    DataExporter,
    CacheManager,
    NotificationService,
    LazyLoader,
    Utils: ARM_Utils
  };
}
