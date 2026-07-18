# A.R.M — Alliance pour le Rassemblement Malien — Site web + Admin

## 1. Fichiers du projet
- `index.html` — site public (accueil, programme, bureau, dons, adhésion, actualités, chat, contact)
- `admin.html` + `admin.js` — tableau de bord administrateur (mot de passe unique, défilement infini, galerie médias)
- `infinite-scroll.js` — module de pagination performante (défilement infini) pour les grandes listes
- `media-gallery.js` — module d'upload de médias avec compression côté client
- `data.js` — config Firebase, logo (base64), bureau, programme, régions du Mali
- `manifest.json` + `sw.js` — installation de l'app (bouton "Installer l'app")
- `logo.png`, `icon-192.png`, `icon-512.png` — logo A.R.M pour favicon et icônes PWA (le logo est aussi intégré partout dans l'interface via `data.js`)

## 2. Configuration Firebase (à faire une seule fois)
1. Dans la console Firebase, crée ou ouvre le projet **arm-mali**.
2. Active **Firestore Database** (mode production), **Firebase Storage**, et **Authentication > Email/Mot de passe**.
3. Dans **Authentication > Users**, crée **un seul** compte avec :
   - Email : `admin@arm-mali.org` (email technique interne — invisible pour toi au quotidien)
   - Mot de passe : `admin1985`
   Sur `/admin.html`, tu ne saisis que le mot de passe : l'email fixe est envoyé automatiquement par le code (voir `ADMIN_EMAIL_FIXE` dans `data.js`). Cela te donne une vraie sécurité Firebase (les règles ci-dessous vérifient `request.auth`) tout en gardant une interface à un seul champ.
4. Dans **Paramètres du projet > Général**, copie la config SDK et colle-la dans `data.js` (remplace les `REMPLACE_MOI`).

### Règles Firestore (Firestore Database > Règles)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /chat/{doc} { allow read, create: if true; allow update, delete: if request.auth != null; }
    match /actualites/{doc} { allow read: if true; allow write: if request.auth != null; }
    match /adhesions/{doc} { allow create: if true; allow read, update, delete: if request.auth != null; }
    match /dons/{doc} { allow create: if true; allow read, update, delete: if request.auth != null; }
    match /messages/{doc} { allow create: if true; allow read, update, delete: if request.auth != null; }
    match /medias/{doc} { allow read: if true; allow write, delete: if request.auth != null; }
    match /armtv_videos/{doc} { allow read: if true; allow write, delete: if request.auth != null; }
    match /armtv_config/{doc} { allow read: if true; allow write: if request.auth != null; }
    match /contenu/{doc} { allow read: if true; allow write: if request.auth != null; }
    // Compteurs globaux : incrémentés depuis le site public (dons, adhésions,
    // messages), lus par le tableau de bord. Champs limités pour éviter
    // toute écriture arbitraire ; pour une sécurité maximale à terme,
    // migrer ces incréments vers une Cloud Function.
    match /compteurs/global {
      allow read: if request.auth != null;
      allow write: if request.resource.data.keys().hasOnly(['adhesions','donsTotal','messages'])
                    && request.resource.data.adhesions is number
                    && request.resource.data.donsTotal is number
                    && request.resource.data.messages is number;
    }
  }
}
```

### Règles Storage (Storage > Règles)
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /medias/{fichier} {
      allow read: if true;
      allow write, delete: if request.auth != null;
    }
  }
}
```

## 3. Nouveaux modules (défilement infini + galerie médias)
- `infinite-scroll.js` : module générique de pagination Firestore par curseur (`startAfter`), déclenché par un `IntersectionObserver` — utilisé pour les tableaux Adhésions, Dons et Chat dans l'admin, afin de rester rapide même avec des milliers d'enregistrements (on ne charge jamais tout d'un coup).
- `media-gallery.js` : upload de médias avec **compression côté client** (redimensionnement + réencodage JPEG via `<canvas>`, avant l'envoi vers Firebase Storage) + affichage en défilement infini. Accessible dans l'admin, onglet "Galerie médias".
- Les statistiques (`Adhésions`, `Total des dons`, `Messages`) ne scannent plus les collections : elles lisent un seul document `compteurs/global`, incrémenté atomiquement (`FieldValue.increment`) à chaque nouvelle soumission côté site public. Lecture quasi instantanée, quel que soit le volume de données.

## 4. Mise en ligne (comme d'habitude, sans terminal)
1. Glisse-dépose tous les fichiers du dossier dans ton dépôt GitHub (racine du projet).
2. Vercel redéploiera automatiquement.
3. Le site public est à la racine (`/`), le tableau de bord à `/admin.html`.

## 5. ARM TV — Phase 1 (médiathèque + lecteur continu + planning + direct)
- Section publique `#armtv` sur la page d'accueil : lecteur vidéo qui joue automatiquement la playlist approuvée, avec filtres par thème (actualités Mali, AES, culture, économie, diaspora, activités A.R.M, etc.).
- Depuis l'admin (onglet **📺 ARM TV**) : ajoute une vidéo en collant son URL (`.mp4` ou flux `.m3u8`), choisis son thème et son ordre de passage, puis **Approuver** pour qu'elle apparaisse sur le site public.
- **Mode direct** : colle l'URL d'un flux `.m3u8` (fourni par Cloudflare Stream, Mux, etc. — voir mes explications sur les options de streaming) et clique "🔴 Démarrer le direct" : tous les visiteurs basculent automatiquement sur le direct. "⏹ Arrêter le direct" repasse en playlist normale.
- **Important — hébergement des vidéos** : ce module ne stocke pas les fichiers vidéo lui-même, il lit une URL. Pour des vidéos courtes tu peux utiliser Firebase Storage (upload manuel, comme la galerie médias), mais pour du contenu volumineux ou du direct à grande échelle, utilise un vrai service vidéo (Cloudflare Stream/Mux) — Firebase Storage n'est pas conçu pour du streaming à fort trafic.
- Si la console Firebase affiche une erreur d'index lors du premier chargement de la playlist (`where + orderBy` combinés), clique simplement sur le lien qu'elle fournit pour créer l'index composite automatiquement — c'est normal et à faire une seule fois.
- La génération automatique de contenu par IA (sélection de sources, montage, voix off multilingue, sous-titres, miniatures) n'est pas incluse dans cette phase : elle demande des services IA tiers payants et une infrastructure serveur dédiée. On en reparle quand la Phase 1 tourne bien.

## 6. Sur le paiement par carte
Le formulaire "Carte bancaire" de la page Dons est **une simulation** : il enregistre le don dans Firestore avec le statut "simulé - à confirmer" mais **n'encaisse pas réellement d'argent** — saisir un vrai numéro de carte sur une page qui n'est pas certifiée PCI-DSS est interdit et dangereux. Pour un encaissement réel et sécurisé, deux options simples sans backend complexe :
- **Stripe Payment Links** ou **PayPal.me / Donate button** : tu crées un lien de paiement, je l'intègre à la place du formulaire simulé.
- Un vrai module carte intégré nécessite un backend (Stripe Checkout côté serveur) — dis-moi si tu veux que je le prépare.
En attendant, le virement vers le compte épargne **BMS Mali** fonctionne dès maintenant (pense à compléter le numéro de compte/IBAN dans `index.html`, section Dons).

## 7. Contenu modifiable
- Bureau exécutif, programme politique, régions/cercles → dans `data.js` (tu peux les modifier toi-même sans coder, juste éditer le texte).
- Actualités, événements (+ lien visioconférence), adhésions, dons, messages, chat → gérés en direct depuis `/admin.html`, aucune modification de code nécessaire.

## 8. Contrôle total de l'administrateur
Depuis l'onglet **🛠️ Contenu du site**, l'administrateur peut désormais modifier ou supprimer directement, sans toucher au code :
- la devise, l'adresse du siège et l'IBAN (affichés en direct partout sur le site) ;
- chaque membre du bureau exécutif (ajout, modification, suppression) ;
- chaque point du programme politique (ajout, modification, suppression).

Toutes les autres sections (adhésions, dons, messages, chat, actualités, ARM TV, galerie médias) disposent maintenant aussi d'un bouton **🗑 Supprimer**, en plus des actions déjà existantes (valider/refuser, modifier). `data.js` ne sert plus que de contenu de démarrage : dès qu'un enregistrement existe dans Firestore, il prend le dessus automatiquement sur le site public.

## 9. Application Android
Ce livrable couvre le site web (PWA installable). L'application Android native (Kotlin) est un projet à part — dis-moi quand tu veux que je la prépare (même contenu : accueil, dons, adhésion, actualités, chat, connectée au même projet Firebase `arm-mali`).
