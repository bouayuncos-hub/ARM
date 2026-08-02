#!/usr/bin/env bash

# 🚀 SCRIPT DE DÉPLOIEMENT AUTOMATIQUE — A.R.M v2.0
# Ce script configure et déploie automatiquement le site A.R.M sur Vercel

set -e  # Arrêter si une erreur survient

echo "🎯 =================================================="
echo "   A.R.M — Alliance pour le Rassemblement Malien"
echo "   Installation Automatique v2.0"
echo "=================================================="
echo ""

# Couleurs pour l'output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher avec couleur
print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
  exit 1
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

# ÉTAPE 1: Vérifier les prérequis
echo ""
print_info "ÉTAPE 1 : Vérification des prérequis..."
echo ""

if ! command -v git &> /dev/null; then
  print_error "Git n'est pas installé. Installez-le depuis https://git-scm.com"
fi
print_success "Git trouvé"

if ! command -v node &> /dev/null; then
  print_error "Node.js n'est pas installé. Installez-le depuis https://nodejs.org"
fi
print_success "Node.js trouvé: $(node --version)"

# ÉTAPE 2: Cloner ou mettre à jour le repo
echo ""
print_info "ÉTAPE 2 : Configuration du repository..."
echo ""

if [ ! -d ".git" ]; then
  print_info "Clonage du repository..."
  git clone https://github.com/bouayuncos-hub/ARM.git .
  print_success "Repository cloné"
else
  print_info "Mise à jour du repository..."
  git pull origin main
  print_success "Repository mis à jour"
fi

# ÉTAPE 3: Configurer Firebase
echo ""
print_info "ÉTAPE 3 : Configuration Firebase..."
echo ""

if [ ! -f "data.js" ]; then
  print_error "Le fichier data.js n'existe pas!"
fi

print_warning "Veuillez entrer vos paramètres Firebase"
print_info "Vous pouvez les trouver dans: Firebase Console > Paramètres du Projet > Vos Applications"
echo ""

read -p "Entrez votre API Key: " API_KEY
read -p "Entrez votre Auth Domain: " AUTH_DOMAIN
read -p "Entrez votre Project ID: " PROJECT_ID
read -p "Entrez votre Storage Bucket: " STORAGE_BUCKET
read -p "Entrez votre Messaging Sender ID: " MESSAGING_SENDER_ID
read -p "Entrez votre App ID: " APP_ID
read -p "Entrez votre VAPID Key (optionnel): " VAPID_KEY

# Créer le fichier data.js
cat > data.js << EOF
// 🔐 Configuration Firebase — À PROTÉGER EN PRODUCTION
const firebaseConfig = {
  apiKey: "$API_KEY",
  authDomain: "$AUTH_DOMAIN",
  projectId: "$PROJECT_ID",
  storageBucket: "$STORAGE_BUCKET",
  messagingSenderId: "$MESSAGING_SENDER_ID",
  appId: "$APP_ID"
};

// Email de l'administrateur (avec mot de passe défini dans Firebase)
const ADMIN_EMAIL_FIXE = "admin@arm-mali.org";

// 🎨 Branding — Logo & Couleurs
const LOGO_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

// 📱 Notifications Push Firebase
const VAPID_KEY = "$VAPID_KEY";

// 🏛️ Infos du Parti (valeurs par défaut)
const PARTY_INFO = {
  devise: "Fraternité • Liberté • Égalité",
  siege: "Sebenikoro, Rue 530, Porte 245, Bamako, Mali",
  contact: "+223 XXXX XXXX",
  email: "contact@arm-mali.org"
};

// 👔 Bureau Exécutif (valeurs par défaut)
const BUREAU = [
  {
    role: "Président",
    nom: "Ibrahim Bouare",
    profession: "Homme politique",
    lieu: "Bamako",
    tel: "+223 XXXX XXXX"
  }
];

// 📋 Programme Politique (valeurs par défaut)
const PROGRAMME = [
  { icone: "🎯", titre: "Développement Économique", texte: "Créer des emplois et booster l'économie locale" },
  { icone: "🏥", titre: "Santé Pour Tous", texte: "Accès aux soins de qualité pour chaque citoyen" },
  { icone: "📚", titre: "Éducation Inclusive", texte: "Former la jeunesse malienne d'aujourd'hui" }
];

// 📺 Thèmes ARM TV
const THEMES_ARMTV = ["Politique", "Jeunesse", "Femmes", "Économie", "Développement", "Autre"];

// 🔔 Configuration des notifications (disponible si VAPID_KEY renseigné)
const NOTIF_CONFIG = {
  enabled: !!VAPID_KEY,
  title: "Alliance pour le Rassemblement Malien",
  icon: LOGO_DATA_URI
};

// 🌍 Régions du Mali
const REGIONS_MALI = [
  "Kayes", "Koulikoro", "Bamako", "Ségou", "Mopti", 
  "Tombouctou", "Gao", "Kidal", "Ménaka", "Taoudénit"
];

console.log("✓ Configuration Firebase chargée");
EOF

print_success "Fichier data.js créé avec vos paramètres Firebase"

# ÉTAPE 4: Installer Vercel CLI
echo ""
print_info "ÉTAPE 4 : Installation de Vercel CLI..."
echo ""

npm install -g vercel
print_success "Vercel CLI installé"

# ÉTAPE 5: Déployer sur Vercel
echo ""
print_info "ÉTAPE 5 : Déploiement sur Vercel..."
echo ""

print_warning "Vous allez être redirigé vers Vercel pour vous connecter/créer un compte"
print_warning "Appuyez sur ENTER pour continuer..."
read

vercel --prod
print_success "🚀 Site déployé sur Vercel!"

# ÉTAPE 6: Afficher le résumé
echo ""
echo "=================================================="
print_success "✅ INSTALLATION TERMINÉE!"
echo "=================================================="
echo ""
print_info "📍 Votre site est maintenant en ligne!"
echo ""
print_info "🌐 Site public:"
echo "   https://YOUR-PROJECT.vercel.app"
echo ""
print_info "🛡️ Tableau de bord admin:"
echo "   https://YOUR-PROJECT.vercel.app/admin.html"
echo ""
print_info "🔑 Identifiants admin:"
echo "   Email: admin@arm-mali.org"
echo "   Mot de passe: (celui configuré dans Firebase)"
echo ""
print_warning "⚠️  SÉCURITÉ:"
print_warning "   1. Changez le mot de passe admin dès que possible"
print_warning "   2. Configurez les règles Firestore pour la production"
print_warning "   3. Ne commitez JAMAIS data.js avec vos clés réelles"
echo ""
print_info "📚 Documentation: https://github.com/bouayuncos-hub/ARM/blob/main/README.md"
print_info "💬 Support: contact@arm-mali.org"
echo ""
echo "=================================================="
