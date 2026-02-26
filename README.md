# 🎓 Al Kawthar - Système de Gestion des Notes

Application web moderne pour la gestion des notes scolaires avec support de deux sections (Garçons et Filles).

## ✨ Fonctionnalités Principales

### 🎯 Sélection de Section
- **Page d'accueil interactive** avec animations modernes
- **Deux sections distinctes** : Garçons et Filles
- **Design moderne** avec gradients et effets visuels

### 👥 Gestion Multi-Sections

#### Section Garçons
- Classes: PEI1, PEI2, PEI3, PEI4, DP2
- Enseignants: Mohamed Ali (P.E), Sami (Musique, ART), Abas, Sylvano (Hervé), Zine, Youssif, Tonga, Kamel, Mohamed Teacher (Physique-Chimie DP2)
- Admin: Mohamed

#### Section Filles
- Classes: DP1, DP2, PEI1, PEI2, PEI3, PEI4, PEI5
- Enseignantes: Amal, Inas, Anouar, Souha, Samira, Zohra Zidane, Aichetou, Hiba, Shanouja, Hana, Farah, Tayba
- Admins: Zohra et Mohamed

### 📊 Gestion des Notes
- **Saisie intuitive** des notes par matière et élève
- **Filtrage avancé** par classe, matière et élève
- **Progression automatique** entre les élèves
- **Deux semestres** (S1 et S2)
- **Calcul automatique** des totaux

### 📄 Génération de Documents
- **Export Word** : Un fichier par classe dans une archive ZIP
- **Export Excel** : Feuilles séparées par classe
- **Barre de progression** pendant la génération

### 🔐 Sécurité
- **Authentification** par enseignant
- **Permissions granulaires** par matière et classe
- **Sessions sécurisées** avec MongoDB Store
- **Option "Rester connecté"** (14 jours)

## 🎨 Design Moderne

### Animations
- **Page de sélection** : Animations fluides (slideIn, fadeIn, pulse)
- **Page de connexion** : Effets de transition et hover interactifs
- **Interface principale** : Animations sur les cartes et boutons
- **Responsive** : Optimisé pour mobile et desktop

### Couleurs
- **Section Garçons** : Thème bleu (#2196F3)
- **Section Filles** : Thème rose (#E91E63)
- **Gradients modernes** : Transitions fluides entre couleurs
- **Ombres portées** : Profondeur visuelle

## 🛠️ Architecture Technique

### Backend
- **Node.js** avec Express
- **MongoDB** avec Mongoose
- **Sessions** : express-session + connect-mongo
- **Middleware de section** : Isolation complète des données

### Frontend
- **HTML5** / **CSS3** avec animations
- **JavaScript Vanilla** : Pas de framework lourd
- **Font Awesome** : Icônes modernes
- **Responsive Design** : Grid et Flexbox

### Fichiers Clés
```
api/
  ├── index.js                  # Serveur principal (sans Socket.IO pour Vercel)
  ├── index-with-socketio.js   # Version avec Socket.IO (dev local)
  ├── data-sections.js          # Données des deux sections
  └── section-middleware.js     # Middleware de gestion des sections

public/
  ├── section-selector.html     # Page de sélection de section
  ├── login.html                # Page de connexion
  ├── index.html                # Interface principale
  └── styles.css                # Styles avec animations

```

## 📦 Installation

### Prérequis
- Node.js 22.x
- MongoDB (URI fournie dans .env)

### Installation Locale
```bash
# Cloner le dépôt
git clone https://github.com/medch24/Notes-Alkawthar.git
cd Notes-Alkawthar

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# Démarrer le serveur
npm start
```

### Déploiement sur Vercel

Le projet est configuré pour Vercel avec `vercel.json`. Le déploiement se fait automatiquement depuis GitHub.

**Variables d'environnement à configurer sur Vercel** :
- `MONGO_URL` : URI de connexion MongoDB
- `SESSION_SECRET` : Clé secrète pour les sessions

## 🔑 Identifiants de Test

### Section Garçons
- Username: `Mohamed` / Password: `Mohamed` (Admin)
- Username: `Kamel` / Password: `Kamel` (Enseignant)

### Section Filles
- Username: `Zohra` / Password: `Zohra` (Admin)
- Username: `Amal` / Password: `Amal` (Enseignante)

## 📝 Barèmes de Notes

### PEI1
- Travaux Classe: 30 points
- Devoirs: 20 points
- Évaluation: 20 points
- Examen: 30 points

### PEI2, PEI3, PEI4, DP1, DP2
- Travaux Classe: 20 points
- Devoirs: 20 points
- Évaluation: 30 points
- Examen: 30 points

## 🚀 Fonctionnalités Avancées

### Progression Automatique
Lorsqu'une matière est sélectionnée, le système propose automatiquement de passer à l'élève suivant après chaque saisie.

### Filtrage Intelligent
- Affichage uniquement des données pertinentes selon les permissions
- Filtres cumulatifs par classe, matière et élève
- Message d'invite si aucun filtre n'est sélectionné

### Génération de Documents
- **Word** : Utilise un template personnalisé avec toutes les matières
- **Excel** : Feuilles Excel avec colonnes organisées

## 📊 Base de Données

### Collections MongoDB
- **notes** : Stockage des notes par élève, matière et semestre
- **sessions** : Gestion des sessions utilisateurs avec MongoDB Store

### Schéma des Notes
```javascript
{
  class: String,
  subject: String,
  studentName: String,
  semester: String (S1 ou S2),
  travauxClasse: Number,
  devoirs: Number,
  evaluation: Number,
  examen: Number,
  teacher: String
}
```

## 🔧 Configuration

### Variables d'Environnement (.env)
```env
MONGO_URL=mongodb+srv://...
SESSION_SECRET=votre-secret-securise
PORT=3000
```

### Configuration Vercel (vercel.json)
```json
{
  "version": 2,
  "builds": [{
    "src": "api/index.js",
    "use": "@vercel/node"
  }],
  "routes": [{
    "src": "/(.*)",
    "dest": "api/index.js"
  }]
}
```

## 📱 Responsive Design

L'application est entièrement responsive et s'adapte à tous les écrans :
- **Desktop** : Interface complète avec toutes les fonctionnalités
- **Tablet** : Layout adapté avec navigation simplifiée
- **Mobile** : Interface optimisée pour le tactile

## 🎯 Roadmap

- [ ] Ajout de graphiques de performance
- [ ] Export PDF des bulletins
- [ ] Notifications push pour les nouveaux ajouts
- [ ] API REST pour intégrations tierces
- [ ] Application mobile native

## 🤝 Contribution

Les contributions sont les bienvenues ! Pour contribuer :

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence privée - Al Kawthar International School.

## 👥 Auteurs

- **Développement Initial** : GenSpark AI Developer
- **Client** : Al Kawthar International School, Jeddah

## 📞 Support

Pour toute question ou assistance, contactez l'équipe IT de Al Kawthar International School.

---

**Note**: Ce projet utilise une version sans Socket.IO pour être compatible avec les fonctions serverless de Vercel. Une version avec Socket.IO est disponible dans `api/index-with-socketio.js` pour le développement local.
