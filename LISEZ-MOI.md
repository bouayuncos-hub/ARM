# A.R.M — Alliance pour le Rassemblement Malien — Site web + tableau de bord

## 1. Fichiers à mettre à la racine du dépôt GitHub (tous)
| Fichier | Rôle |
|---|---|
| `index.html` | Site public (accueil, programme, bureau, dons, adhésion, actualités, ARM TV, chat, contact) |
| `app.js` | Logique du site public |
| `armtv.js` | ARM TV (playlist + direct) et Vidéothèque |
| `video-embed.js` | **Nouveau** — reconnaissance des liens YouTube, Facebook, Instagram, TikTok, X + lecteur |
| `admin.html` + `admin.js` | Tableau de bord administrateur (`/admin.html`, ou l'icône ⚙ en bas du site) |
| `utils.js` | **Nouveau** — protection de l'affichage (obligatoire sur les deux pages) |
| `infinite-scroll.js` | Défilement infini (listes longues) |
| `media-gallery.js` | Galerie médias avec compression des photos |
| `data.js` | Configuration Firebase (projet `arm-boua`), logo, bureau, programme, régions |
| `manifest.json`, `sw.js` | Installation de l'application sur téléphone |
| `logo.png`, `icon-192.png`, `icon-512.png` | Logo et icônes |

⚠️ Ces fichiers **remplacent entièrement** la version en ligne : glisse-les tous en même temps, sans en oublier, en particulier `utils.js` et `video-embed.js`.

## 2. Ce qui a été corrigé
- **Faille de sécurité du chat** : un message piégé pouvait exécuter du code chez tous les visiteurs et dans le tableau de bord. Tout texte est désormais neutralisé avant affichage (site et admin).
- **Faux formulaire de carte bancaire supprimé** : il demandait un vrai numéro de carte sans encaisser d'argent. Remplacé par un vrai lien de paiement (Stripe Payment Link, PayPal…) que tu colles dans l'admin. Tant qu'aucun lien n'est renseigné, le site propose Mobile Money et virement.
- **Statistiques bloquées à 0** : corrigé (nouvelle règle Firestore ci-dessous).
- **Total des dons fiable** : il n'augmente que quand tu confirmes un don réellement reçu, et diminue si tu annules ou supprimes.
- **Bouton « Modifier » des actualités** : fonctionne maintenant avec les apostrophes.
- **Doublons après reconnexion** : supprimés.
- **Contenu invisible** : le bureau ou le programme modifiés depuis l'admin pouvaient rester transparents à cause de l'animation. Corrigé.
- **Messages de succès trompeurs** : en cas d'échec d'envoi, le visiteur voit maintenant une erreur au lieu de « Merci ».
- **Mise en cache** : le service worker ne met plus en cache les échanges Firebase (temps réel et connexion admin).
- **ARM TV** : plus besoin de créer d'index Firestore ; écran d'attente quand la playlist est vide.

## 3. Nouveautés réintégrées / ajoutées
- Mode clair / sombre (bouton 🌙), polices Fraunces + Inter, logo affiché en entier.
- Dons : carte (lien externe), **Mobile Money (Orange Money, Moov Money, Wave)**, virement BMS, avec déclaration du don et référence.
- Adhésion en **3 étapes** (Identité → Localisation → Envoi) avec récapitulatif et consentement.
- Recherche dans le bureau et les actualités, partage des actualités (WhatsApp / partage du téléphone).
- Statistiques publiques en temps réel sur l'accueil.
- Admin : numéros Mobile Money et lien de paiement carte modifiables, modification des vidéos ARM TV, réordonnancement (↑ ↓) du bureau et du programme, bouton « 📋 Lien » dans la galerie pour réutiliser une photo dans une actualité.

## 4. Règles Firestore (Firestore Database → Règles → Publier)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function admin() { return request.auth != null; }
    function texte(champ, max) {
      return request.resource.data[champ] is string
          && request.resource.data[champ].size() > 0
          && request.resource.data[champ].size() <= max;
    }

    match /chat/{doc} {
      allow read: if true;
      allow create: if texte('nom', 40) && texte('message', 500);
      allow update, delete: if admin();
    }
    match /adhesions/{doc} {
      allow create: if texte('nom', 80) && texte('prenom', 80) && texte('tel', 30)
                    && request.resource.data.statut == 'en attente';
      allow read, update, delete: if admin();
    }
    match /dons/{doc} {
      allow create: if request.resource.data.montant is number
                    && request.resource.data.montant > 0
                    && request.resource.data.montant <= 100000
                    && request.resource.data.statut == 'en attente';
      allow read, update, delete: if admin();
    }
    match /messages/{doc} {
      allow create: if texte('nom', 80) && texte('message', 3000)
                    && request.resource.data.lu == false;
      allow read, update, delete: if admin();
    }
    match /actualites/{doc}   { allow read: if true; allow write: if admin(); }
    match /medias/{doc}       { allow read: if true; allow write: if admin(); }
    match /armtv_videos/{doc} { allow read: if true; allow write: if admin(); }
    match /armtv_config/{doc} { allow read: if true; allow write: if admin(); }
    match /contenu/{doc}      { allow read: if true; allow write: if admin(); }

    match /compteurs/global {
      allow read: if true;
      allow write: if admin() || (
        request.resource.data.keys().hasOnly(['adhesions','donsTotal','messages'])
        && request.resource.data.get('donsTotal', 0) == (resource == null ? 0 : resource.data.get('donsTotal', 0))
        && request.resource.data.get('adhesions', 0) is number
        && request.resource.data.get('messages', 0) is number
        && request.resource.data.get('adhesions', 0) >= (resource == null ? 0 : resource.data.get('adhesions', 0))
        && request.resource.data.get('messages', 0) >= (resource == null ? 0 : resource.data.get('messages', 0))
      );
    }
  }
}
```

## 5. Règles Storage (Storage → Règles → Publier)
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /medias/{fichier} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
      allow delete: if request.auth != null;
    }
  }
}
```

## 6. Connexion administrateur
Firebase Console → Authentication :
- **Sign-in method** : « Email/Mot de passe » activé.
- **Users** : un compte `admin@arm-mali.org` avec le mot de passe `admin1985`.
Sur `/admin.html`, tu ne tapes que le mot de passe.

## 7. Après la mise en ligne, dans l'admin → 🛠️ Contenu du site
Renseigne : IBAN BMS, numéros Orange Money / Moov Money / Wave, et (si tu en as un) le lien de paiement carte. Tant qu'ils sont vides, le site affiche « à renseigner par l'administrateur ».

## 8. Paiement par carte réel
Le plus simple : crée un **Stripe Payment Link** (ou un bouton de don PayPal) avec montant libre, puis colle le lien `https://…` dans l'admin. Le visiteur paie sur la page sécurisée du prestataire ; vérifie ensuite les paiements dans ton espace Stripe/PayPal.

## 9. Publier des vidéos YouTube, Facebook, Instagram, TikTok et X
Admin → onglet **🎬 Vidéos & ARM TV** → « Publier une vidéo » :
1. **Colle le lien** de la vidéo. La plateforme est reconnue automatiquement et un **aperçu** s'affiche.
2. Donne un **titre** et un **thème**.
3. Coche où la publier : **🎬 Vidéothèque du site** et/ou **📺 ARM TV**.
4. **🚀 Publier maintenant** (visible tout de suite) ou **Enregistrer sans publier** (brouillon).

Dans la liste : **✔ Publier**, **⏸ Retirer** (la vidéo disparaît du site sans être effacée), **✎ Modifier**, **🗑 Supprimer**, et des filtres par plateforme.

**Liens acceptés**
| Plateforme | Exemple de lien qui fonctionne |
|---|---|
| YouTube | `youtube.com/watch?v=…`, `youtu.be/…`, `youtube.com/shorts/…`, `youtube.com/live/…` |
| Facebook | `facebook.com/…/videos/…`, `facebook.com/watch?v=…`, `facebook.com/reel/…`, `fb.watch/…` |
| Instagram | `instagram.com/p/…`, `instagram.com/reel/…` |
| TikTok | `tiktok.com/@compte/video/123…` (pas les liens courts `vm.tiktok.com` : ouvre-les d'abord, puis copie le lien complet) |
| X / Twitter | `x.com/compte/status/123…` (X affiche le post entier, texte + vidéo) |
| Fichier | lien direct `.mp4` / `.m3u8` (Firebase Storage, Cloudflare Stream…) |

**Bon à savoir**
- La vidéo doit être **publique** sur le réseau social. Une vidéo privée, réservée aux amis ou dont l'intégration est désactivée par son auteur ne pourra pas être lue sur le site.
- **ARM TV enchaîne automatiquement** les vidéos YouTube et les fichiers. Facebook, Instagram, TikTok et X ne signalent pas la fin d'une vidéo : renseigne la **durée (en minutes)** pour qu'ARM TV passe à la suivante, sinon les visiteurs utilisent ⏮ ⏭.
- **Miniature** : automatique pour YouTube. Pour les autres, envoie une image dans « Galerie médias », clique « 📋 Lien » et colle-la dans « Miniature ».
- **Direct** : la zone « Diffusion en direct » accepte maintenant un lien **YouTube Live** ou **Facebook Live**, en plus des flux `.m3u8`.
- Les règles Firestore ne changent pas (collection `armtv_videos`, déjà protégée : seul l'admin peut publier).
