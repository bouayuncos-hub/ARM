# 🔧 Guide Complet de Configuration Firebase — A.R.M

**Guide étape par étape pour configurer Firebase et déployer le site A.R.M**

---

## 📋 Table des matières

1. [Créer un projet Firebase](#1-créer-un-projet-firebase)
2. [Configurer Firestore](#2-configurer-firestore)
3. [Activer l'authentification](#3-activer-lauthentification)
4. [Configurer le stockage](#4-configurer-le-stockage)
5. [Configurer les notifications push](#5-configurer-les-notifications-push)
6. [Définir les règles de sécurité](#6-définir-les-règles-de-sécurité)
7. [Récupérer la configuration](#7-récupérer-la-configuration)
8. [Tester localement](#8-tester-localement)
9. [Dépanner les problèmes courants](#9-dépanner-les-problèmes-courants)

---

## 1. Créer un projet Firebase

### Étape 1.1 : Aller sur Firebase Console

1. Ouvrez [firebase.google.com](https://firebase.google.com) dans votre navigateur
2. Cliquez sur **"Accédez à la console"** (en haut à droite)
3. Connectez-vous avec votre compte Google

### Étape 1.2 : Créer un nouveau projet

1. Cliquez sur **"Créer un projet"**
2. Remplissez le formulaire :
   - **Nom du projet** : `arm-mali` (ou votre choix)
   - **Cliquez sur Continuer**
3. **Activer Google Analytics** : Optionnel, mais recommandé
   - Si activé, choisissez un compte Analytics
4. **Cliquez sur "Créer un projet"**

**Attendez 1-2 minutes** que le projet se crée...

### Étape 1.3 : Accéder au tableau de bord

Une fois créé, cliquez sur votre projet pour accéder au tableau de bord.

```
Vous devriez voir:
┌─────────────────────────────────────┐
│ 🎯 Tableau de bord Firebase         │
│ ├─ Firestore Database               │
│ ├─ Authentication                   │
│ ├─ Storage                          │
│ ├─ Cloud Messaging                  │
│ └─ ...                              │
└─────────────────────────────────────┘
```

---

## 2. Configurer Firestore

### Étape 2.1 : Créer une base de données Firestore

1. Dans le menu de gauche, cliquez sur **"Firestore Database"**
2. Cliquez sur **"Créer une base de données"**
3. Choisissez la région :
   - **Pour l'Afrique de l'Ouest** : `europe-west1` (Belgique)
   - ⚠️ **Important** : Cette région ne peut pas être changée après création!
4. Sélectionnez **"Démarrer en mode test"** (pour développement)
5. Cliquez sur **"Créer"**

**Mode test** = Lecture/Écriture pour tout le monde (à SÉCURISER en production)

### Étape 2.2 : Créer les collections

Une fois Firestore créée, créez les collections nécessaires :

#### Collection 1 : `adhesions`

1. Cliquez sur **"Démarrer une collection"**
2. **ID de la collection** : `adhesions`
3. Cliquez sur **"Suivant"**
4. Cliquez sur **"Enregistrer"** (pas besoin de document pour l'instant)

**Structure de document** (exemple) :
```json
{
  "prenom": "Ibrahim",
  "nom": "Bouare",
  "email": "ibrahim@arm.org",
  "tel": "+223 XXXX XXXX",
  "region": "Kayes",
  "cercle": "Kita",
  "statut": "validé",
  "createdAt": 1722609600000
}
```

#### Collection 2 : `dons`

**Structure** :
```json
{
  "montant": 50000,
  "methode": "carte",
  "nom": "Jean Dupont",
  "reference": "DON-2024-001",
  "statut": "confirmé",
  "createdAt": 1722609600000
}
```

#### Collection 3 : `messages`

**Structure** :
```json
{
  "nom": "Alice",
  "email": "alice@example.com",
  "sujet": "Question sur l'adhésion",
  "message": "Comment puis-je adhérer?",
  "lu": false,
  "createdAt": 1722609600000
}
```

#### Collection 4 : `actualites`

**Structure** :
```json
{
  "titre": "Réunion du Bureau Exécutif",
  "date": "2024-08-15",
  "lieu": "Bamako",
  "image": "https://...",
  "contenu": "Le bureau se réunit pour...",
  "lienVisio": "https://meet.google.com/...",
  "createdAt": 1722609600000
}
```

#### Collection 5 : `chat`

**Structure** :
```json
{
  "nom": "Utilisateur",
  "message": "Bonjour à tous!",
  "createdAt": 1722609600000
}
```

#### Collection 6 : `compteurs`

Document unique pour les statistiques globales.

1. Créez une collection : `compteurs`
2. Créez un document avec l'ID : `global`
3. Contenu :
```json
{
  "adhesions": 0,
  "donsTotal": 0,
  "messages": 0
}
```

#### Collection 7 : `armtv_videos`

**Structure** :
```json
{
  "titre": "Allocution du Président",
  "theme": "Politique",
  "ordre": 0,
  "urlVideo": "https://example.com/video.m3u8",
  "miniature": "https://example.com/thumb.jpg",
  "description": "Discours...",
  "statut": "approuvé",
  "createdAt": 1722609600000
}
```

#### Collection 8 : `contenu`

Deux documents : `info`, `bureau`, `programme`

**Document: `info`**
```json
{
  "devise": "Fraternité • Liberté • Égalité",
  "siege": "Sebenikoro, Rue 530, Bamako",
  "iban": "XX00 0000 0000..."
}
```

**Document: `bureau`**
```json
{
  "membres": [
    {
      "role": "Président",
      "nom": "Ibrahim Bouare",
      "profession": "Politicien",
      "lieu": "Bamako",
      "tel": "+223 XXXX XXXX"
    }
  ]
}
```

**Document: `programme`**
```json
{
  "items": [
    {
      "icone": "🎯",
      "titre": "Économie",
      "texte": "Développement économique..."
    }
  ]
}
```

---

## 3. Activer l'authentification

### Étape 3.1 : Configurer l'authentification par email

1. Dans le menu, cliquez sur **"Authentication"**
2. Cliquez sur l'onglet **"Sign-in method"**
3. Cliquez sur **"Email/Password"**
4. Activez **"Email/Password"**
5. Cliquez sur **"Enregistrer"**

### Étape 3.2 : Créer le compte administrateur

1. Cliquez sur l'onglet **"Users"**
2. Cliquez sur **"Add user"**
3. Remplissez :
   - **Email** : `admin@arm-mali.org`
   - **Password** : `admin1985` (⚠️ **À CHANGER ABSOLUMENT!**)
4. Cliquez sur **"Add user"**

**Conservez cet email et ce mot de passe pour accéder à admin.html**

---

## 4. Configurer le stockage

### Étape 4.1 : Activer Cloud Storage

1. Dans le menu, cliquez sur **"Storage"**
2. Cliquez sur **"Commencer"**
3. Sélectionnez une région : `europe-west1`
4. Choisissez **"Démarrer en mode test"**
5. Cliquez sur **"Créer"**

### Étape 4.2 : Créer les dossiers (optionnel)

Le stockage se structure en dossiers. Créez (depuis l'interface ou le code) :

```
gs://arm-mali.appspot.com/
├── galerie/           # Images de la galerie
├── armtv/            # Miniatures vidéos
└── logo/             # Logo du parti
```

---

## 5. Configurer les notifications push

### Étape 5.1 : Récupérer la clé VAPID

1. Allez dans le menu : **"Cloud Messaging"**
2. Allez à l'onglet **"Web configuration"**
3. Cliquez sur le bouton **"Generate key pair"**
4. **Copiez la clé VAPID publique** (elle commencera par `BP...`)

### Étape 5.2 : Configurer le Service Worker

Vous devez créer un fichier `firebase-messaging-sw.js` à la racine :

```javascript
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  projectId: "arm-mali",
  // ... autres paramètres
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

---

## 6. Définir les règles de sécurité

### ⚠️ IMPORTANT EN PRODUCTION

Le **mode test** = DANGEREUX! Tout le monde peut lire et modifier vos données.

### Étape 6.1 : Configurer les règles Firestore

1. Allez dans **Firestore Database**
2. Cliquez sur l'onglet **"Rules"**
3. Remplacez le contenu par :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Fonctions d'aide
    function isAdmin() {
      return request.auth.token.email == 'admin@arm-mali.org';
    }

    function isAuthenticated() {
      return request.auth != null;
    }

    // Collections publiques : lecture pour tout le monde
    match /actualites/{document=**} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /armtv_videos/{document=**} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /chat/{document=**} {
      allow read: if true;
      allow create: if request.resource.data.nom != null;
      allow update, delete: if isAdmin();
    }

    // Collections semi-publiques
    match /messages/{document=**} {
      allow read: if isAdmin();
      allow create: if request.resource.data.email != null;
      allow update, delete: if isAdmin();
    }

    match /adhesions/{document=**} {
      allow read: if isAdmin();
      allow create: if request.resource.data.email != null;
      allow update, delete: if isAdmin();
    }

    match /dons/{document=**} {
      allow read: if isAdmin();
      allow create: if request.resource.data.montant > 0;
      allow update, delete: if isAdmin();
    }

    // Compteurs globaux
    match /compteurs/{document=**} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // Contenu du site
    match /contenu/{document=**} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}
```

4. Cliquez sur **"Publier"**

### Étape 6.2 : Configurer les règles Cloud Storage

1. Allez dans **Storage**
2. Cliquez sur l'onglet **"Rules"**
3. Remplacez par :

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Images publiques : lecture pour tout le monde, écriture admin
    match /galerie/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.email == 'admin@arm-mali.org';
    }

    // Autres dossiers
    match /{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.token.email == 'admin@arm-mali.org';
    }
  }
}
```

4. Cliquez sur **"Publier"**

---

## 7. Récupérer la configuration

### Étape 7.1 : Obtenir les paramètres Firebase

1. Allez dans **⚙️ Paramètres du Projet** (en bas à gauche)
2. Cliquez sur l'onglet **"Vos applications"**
3. Si pas d'app web, cliquez sur **"Créer une application web"**
4. Entrez un surnom : `ARM Web`
5. Cliquez sur **"Enregistrer une application"**
6. Cliquez sur **"Copier"** (après le `const firebaseConfig = {...}`)

### Étape 7.2 : Mettre à jour data.js

Remplacez le contenu du fichier `data.js` avec votre configuration :

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "arm-mali.firebaseapp.com",
  projectId: "arm-mali",
  storageBucket: "arm-mali.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdefghijklmnopqrst"
};

const ADMIN_EMAIL_FIXE = "admin@arm-mali.org";
const VAPID_KEY = "VOTRE_VAPID_KEY_ICI";

// Autres configurations...
```

---

## 8. Tester localement

### Étape 8.1 : Configurer un serveur local

```bash
# Option 1: Python
cd /chemin/vers/ARM
python -m http.server 8000

# Option 2: Node.js
npx http-server

# Option 3: Avec un vrai serveur
npm install -g live-server
live-server
```

### Étape 8.2 : Accéder au site

- **Site public** : http://localhost:8000
- **Admin** : http://localhost:8000/admin.html

### Étape 8.3 : Tester l'authentification

1. Accédez à admin.html
2. Entrez le mot de passe : `admin1985`
3. Vous devriez voir le tableau de bord

---

## 9. Dépanner les problèmes courants

### ❌ Erreur : "PERMISSION_DENIED"

**Cause** : Vos règles Firestore ne permettent pas l'accès.

**Solution** :
1. Vérifiez que vous êtes connecté comme admin
2. Vérifiez que l'email correspond à `admin@arm-mali.org`
3. Vérifiez les règles Firestore (étape 6)

### ❌ Erreur : "auth/user-not-found"

**Cause** : L'utilisateur n'existe pas dans Firebase Auth.

**Solution** :
1. Créez l'utilisateur dans Firebase Console > Authentication > Users
2. Utilisez l'email : `admin@arm-mali.org`

### ❌ Erreur : "Firebase app not initialized"

**Cause** : `data.js` n'est pas chargé ou a une erreur.

**Solution** :
1. Vérifiez que `data.js` est avant `admin.js` dans le HTML
2. Vérifiez la syntaxe de `firebaseConfig`
3. Ouvrez la console (F12) pour voir les erreurs

### ❌ Aucune donnée n'apparaît

**Cause** : Les collections n'existent pas ou ont un mauvais nom.

**Solution** :
1. Créez manuellement les collections (étape 2.2)
2. Vérifiez les noms exactement (sensible à la casse)
3. Rafraîchissez la page

### ❌ Notifications push ne fonctionnent pas

**Cause** : VAPID_KEY vide ou ServiceWorker non enregistré.

**Solution** :
1. Récupérez la clé VAPID (étape 5.1)
2. Mettez-la à jour dans `data.js`
3. Créez `firebase-messaging-sw.js` (étape 5.2)
4. Vérifiez que le navigateur accepte les notifications

---

## ✅ Checklist de Configuration

- [ ] Projet Firebase créé (`arm-mali`)
- [ ] Firestore Database créée (région: `europe-west1`)
- [ ] Collections créées : adhesions, dons, messages, actualites, chat, compteurs, armtv_videos, contenu
- [ ] Authentication activée (Email/Password)
- [ ] Compte admin créé : admin@arm-mali.org
- [ ] Cloud Storage activé
- [ ] Règles Firestore configurées
- [ ] Règles Storage configurées
- [ ] Configuration Firebase récupérée
- [ ] `data.js` mis à jour
- [ ] VAPID_KEY configurée (optionnel pour notifications)
- [ ] Testé localement ✅

---

## 🚀 Prochaine Étape

Une fois que tout est configuré :

1. Pushez vos fichiers sur GitHub
2. Déployez sur Vercel avec le script `install.sh`
3. Votre site sera en ligne à `https://votre-projet.vercel.app`

---

**Questions ?** Consultez la [documentation Firebase officielle](https://firebase.google.com/docs)

**Besoin d'aide ?** Créez une issue sur [GitHub](https://github.com/bouayuncos-hub/ARM/issues)
