# 🎯 A.R.M — Alliance pour le Rassemblement Malien

**Site web politique professionnel + PWA installable + Dashboard administrateur complet**

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange.svg)](https://firebase.google.com)
[![Version](https://img.shields.io/badge/Version-2.0-blue.svg)]()

---

## 📋 Table des matières

- [🌟 Fonctionnalités](#-fonctionnalités)
- [🚀 Installation Rapide](#-installation-rapide)
- [📁 Structure du Projet](#-structure-du-projet)
- [🔧 Configuration Firebase](#-configuration-firebase)
- [🎮 Utilisation](#-utilisation)
- [💡 Fonctionnalités Avancées](#-fonctionnalités-avancées)
- [🔐 Sécurité](#-sécurité)
- [📱 Déploiement](#-déploiement)
- [🤝 Contribution](#-contribution)

---

## 🌟 Fonctionnalités

### 👥 **Gestion Communautaire**
- ✅ Formulaire d'adhésion en ligne
- ✅ Validation et modération des adhésions
- ✅ Gestion des adhérents (statut, région, cercle)
- ✅ Recherche et filtrage côté client
- ✅ Export de données (CSV/JSON)

### 💰 **Gestion des Dons**
- ✅ Collecte de dons en ligne
- ✅ Support de plusieurs méthodes de paiement
- ✅ Confirmation et suivi des dons
- ✅ Analytics en temps réel
- ✅ Statistiques sur les collectes

### 📰 **Gestion du Contenu**
- ✅ Actualités dynamiques
- ✅ Calendrier d'événements
- ✅ Intégration visioconférence (Zoom, Google Meet)
- ✅ Galerie médias avec compression automatique
- ✅ Édition et suppression facile

### 📺 **ARM TV — Plateforme Vidéo**
- ✅ Streaming en direct (HLS/RTMP)
- ✅ Playlist vidéos organisées par thème
- ✅ Lecteur vidéo responsive
- ✅ Miniatures et descriptions
- ✅ Approuvation/Refus de vidéos

### 💬 **Engagement**
- ✅ Chat public en temps réel
- ✅ Modération des messages
- ✅ Formulaire de contact
- ✅ Notifications push (FCM)
- ✅ Partage social (WhatsApp, Native Share)

### 🛠️ **Tableau de Bord Administrateur**
- ✅ Interface intuitive et professionnelle
- ✅ Statistiques en temps réel (graphiques)
- ✅ Gestion multi-utilisateurs avec rôles
- ✅ Validation des formulaires en temps réel
- ✅ Rate limiting pour éviter les abus
- ✅ Caching pour les performances
- ✅ Export de données (CSV/JSON)
- ✅ Modération de contenu

### 📱 **Progressive Web App (PWA)**
- ✅ Installation sur l'écran d'accueil
- ✅ Mode hors ligne (Service Worker)
- ✅ Thème clair/sombre
- ✅ Responsive design (mobile, tablette, desktop)
- ✅ Performance optimisée

---

## 🚀 Installation Rapide

### **Prérequis**
- Navigateur moderne (Chrome, Firefox, Safari, Edge)
- Compte Firebase gratuit
- Vercel ou hébergement compatible (GitHub Pages, Netlify, etc.)

### **Étape 1 : Créer un projet Firebase**

1. Allez sur [firebase.google.com](https://firebase.google.com)
2. Cliquez sur **"Ajouter un projet"**
3. Nommez-le `arm-mali`
4. Acceptez les conditions et créez le projet

### **Étape 2 : Configurer Firestore**

1. Dans la console Firebase, allez sur **Firestore Database**
2. Cliquez sur **"Créer une base de données"**
3. Sélectionnez **"Mode test"** (pour développement)
4. Choisissez une région (ex: `europe-west1` pour le Mali)

### **Étape 3 : Activer l'authentification**

1. Allez sur **Authentication**
2. Cliquez sur **"Configurer une méthode de connexion"**
3. Sélectionnez **Email/Mot de passe** et activez-la

### **Étape 4 : Créer un compte administrateur**

1. Allez sur **Users**
2. Cliquez sur **"Add user"**
3. Email: `admin@arm-mali.org`
4. Mot de passe: `admin1985` (à modifier absolument)

### **Étape 5 : Récupérer la Configuration Firebase**

1. Allez sur **⚙️ Paramètres du projet**
2. Allez sur **"Vos applications"**
3. Cliquez sur **"SDK personnalisé"** (ou créez une app web)
4. Copiez la configuration Firebase

### **Étape 6 : Mettre à Jour data.js**

Ouvrez `data.js` et remplacez:

```javascript
const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "VOTRE_AUTH_DOMAIN",
  projectId: "arm-mali",
  storageBucket: "VOTRE_STORAGE",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId: "VOTRE_APP_ID"
};
```

### **Étape 7 : Déployer sur Vercel**

```bash
# 1. Poussez votre code sur GitHub
git add .
git commit -m "Déployer A.R.M v2.0"
git push origin main

# 2. Allez sur vercel.com et importez le repo
# 3. Vercel redéploiera automatiquement à chaque push
```

**Site en ligne** : `https://arm-murex-two.vercel.app` ✅

---

## 📁 Structure du Projet

```
ARM/
├── index.html              # Site public (accueil)
├── admin.html              # Tableau de bord admin
├── app.js                  # Logique site public
├── admin.js                # Logique admin (amélioré)
├── data.js                 # Config Firebase + données par défaut
├── modern.js               # Thème, stats, notifications push
├── infinite-scroll.js      # Pagination Firestore
├── media-gallery.js        # Gestion galerie/compression
├── armtv.js                # Lecteur vidéo + streaming
├── advanced-features.js    # Analytics, rôles, validation ✨ NOUVEAU
├── sw.js                   # Service Worker (offline)
├── manifest.json           # Métadonnées PWA
├── logo.png                # Logo A.R.M
└── README.md              # Ce fichier
```

---

## 🔧 Configuration Firebase

### **Règles Firestore (Sécurité)**

Pour la **production**, utilisez ces règles dans **Firestore > Règles**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Collections publiques en lecture, admin en écriture
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == ADMIN_UID;
    }
  }
}
```

### **Stocker les Vidéos**

1. Utilisez **Cloudflare Stream**, **Mux**, ou **YouTube** pour l'hébergement vidéo
2. Stockez simplement l'URL `.m3u8` ou `.mp4` dans `armtv_videos` (Firestore)
3. Firebase Storage n'est utilisé que pour la galerie d'images (limité)

### **Notifications Push**

1. Allez sur **Cloud Messaging** > **Clé VAPID serveur**
2. Copiez la clé dans `data.js`:

```javascript
const VAPID_KEY = "VOTRE_VAPID_KEY_ICI";
```

---

## 🎮 Utilisation

### **Accéder au Site Public**

```
https://arm-murex-two.vercel.app
```

Fonctionnalités:
- 📰 Lire actualités et événements
- 👥 S'adhérer au mouvement
- 💰 Faire un don
- 💬 Participer au chat
- 📺 Regarder ARM TV
- 📱 Installer comme app (PWA)

### **Accéder au Tableau de Bord Admin**

```
https://arm-murex-two.vercel.app/admin.html
```

**Identifiants**:
- Mot de passe: `admin1985` ⚠️ **À changer immédiatement!**

**Fonctionnalités**:
1. **📊 Statistiques** — Adhésions, dons, messages en temps réel
2. **👥 Adhésions** — Valider/refuser/supprimer adhérents
3. **💰 Dons** — Confirmer/supprimer dons
4. **💬 Messages** — Lire/marquer comme lu
5. **💭 Chat** — Modérer messages publics
6. **📰 Actualités** — Publier/éditer/supprimer
7. **📺 ARM TV** — Gérer vidéos, direct, playlist
8. **🖼️ Galerie** — Importer/gérer images
9. **🛠️ Contenu** — Modifier bureau, programme, infos
10. **📥 Export** — Télécharger données (CSV/JSON)

---

## 💡 Fonctionnalités Avancées

### **Analytics Avancée** ✨
```javascript
const metrics = await analyticsManager.getMetricsComplets();
// { global, totalAdhésions, tendances, ... }
```

### **Gestion des Rôles**
```javascript
roleManager.possèdePermission('écrire') // true/false
```

### **Validation Formulaires**
```javascript
ARM.FormValidator.valider('email@test.com', ['email']);
ARM.FormValidator.activerValidationEnTempsRéel(form, {
  email: ['email'],
  tel: ['telephone']
});
```

### **Caching des Données**
```javascript
cacheManager.définir('clé', valeur, 30 * 60 * 1000);
const val = cacheManager.obtenir('clé');
```

### **Lazy Loading d'Images**
```html
<img src="placeholder.jpg" data-src="image-réelle.jpg">
<script>ARM.LazyLoader.initialiser();</script>
```

### **Export de Données**
```javascript
ARM.DataExporter.exporterCSV(données, 'nomFichier');
ARM.DataExporter.exporterJSON(données, 'nomFichier');
```

---

## 🔐 Sécurité

### **À Faire Immédiatement** ⚠️

1. **Changer le mot de passe admin**
   - Admin.html → Se connecter → Paramètres (à implémenter)
   - Ou modifier dans Firebase Console directement

2. **Activer HTTPS**
   - Vercel le fait automatiquement ✅

3. **Configurer les règles Firestore**
   - Ne laissez PAS en mode test en production

4. **Ajouter reCAPTCHA** (optionnel)
   ```javascript
   // Dans les formulaires sensibles
   grecaptcha.execute('YOUR_SITE_KEY', {action: 'submit'});
   ```

5. **Restriction des emails Firebase**
   - Authentication → Paramètres → Domaines autorisés: `arm-murex-two.vercel.app`

---

## 📱 Déploiement

### **Option 1: Vercel** (Recommandé)
```bash
npm i -g vercel
vercel login
vercel
```

### **Option 2: GitHub Pages**
```bash
git push origin main
# Allez sur Settings > Pages > Branch: main
```

### **Option 3: Netlify**
```bash
npm run build  # Si vous avez un build
# Connectez votre repo sur netlify.com
```

### **Option 4: Hébergement Custom**
```bash
# Copier tous les fichiers sur votre serveur FTP/SSH
# S'assurer que index.html est le fichier par défaut
# Configurer HTTPS (Let's Encrypt gratuit)
```

---

## 🤝 Contribution

### **Signaler un Bug**
1. Allez sur **Issues** GitHub
2. Cliquez **"New Issue"**
3. Décrivez le problème avec des étapes pour le reproduire

### **Proposer une Amélioration**
1. Fork le repo
2. Créez une branche: `git checkout -b feature/maFonctionnalité`
3. Commitez: `git commit -m "Ajouter maFonctionnalité"`
4. Poussez: `git push origin feature/maFonctionnalité`
5. Créez une Pull Request

---

## 📚 Documentation Supplémentaire

### **Firebase**
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Auth](https://firebase.google.com/docs/auth)
- [Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)

### **Web Standards**
- [PWA Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Tailwind CSS](https://tailwindcss.com)

### **Vidéo en Direct**
- [Cloudflare Stream](https://www.cloudflare.com/products/cloudflare-stream/)
- [HLS Protocol](https://en.wikipedia.org/wiki/HTTP_Live_Streaming)

---

## 📝 License

MIT License — Libre d'utilisation, modification, distribution

```
Copyright © 2024 A.R.M — Alliance pour le Rassemblement Malien
Tous droits réservés.
```

---

## 📞 Support

- **Email**: contact@arm-mali.org
- **Téléphone**: +223 XXXX XXXX
- **WhatsApp**: Lien depuis le site
- **Issues GitHub**: [GitHub Issues](https://github.com/bouayuncos-hub/ARM/issues)

---

## 🎯 Roadmap (À Venir)

- [ ] Intégration paiement Stripe/PayPal
- [ ] Dashboard analytique avancé (Google Analytics)
- [ ] Forum de discussion
- [ ] App mobile native (React Native)
- [ ] Modération IA des commentaires
- [ ] Système de tickets support
- [ ] Événements en ligne (ticketing)
- [ ] E-shop pour la boutique du parti

---

**Créé avec ❤️ pour le Mali — Alliance pour le Rassemblement Malien**

**Version 2.0** — Dernière mise à jour: 2 Août 2026

---

### ⭐ Merci pour votre soutien!

Si ce projet vous a aidé, n'hésitez pas à ⭐ le sur GitHub!
