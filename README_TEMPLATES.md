# 📚 Documentation Template Word - Al Kawthar

## 🎯 But de cette documentation

Cette documentation vous aide à recréer un template Word pour générer les bulletins de notes avec toutes les balises et boucles nécessaires.

## 📁 Fichiers disponibles

### 1. 🚀 **TEMPLATE_PRET_A_COPIER.txt** (RECOMMANDÉ - À UTILISER EN PREMIER)
   - **Contenu prêt à copier-coller** directement dans Word
   - Instructions simples et visuelles
   - Version minimale et fonctionnelle
   - Checklist de validation
   - **👉 COMMENCEZ PAR CE FICHIER**

### 2. 📖 **TEMPLATE_WORD_GUIDE.md**
   - Guide complet et détaillé
   - Explications techniques
   - Structure complète du template
   - Barèmes de notation
   - Instructions pas à pas

### 3. 📝 **EXEMPLE_TEMPLATE_WORD.txt**
   - Exemples visuels avec données réelles
   - Plusieurs versions du template
   - Tableaux formatés en ASCII art
   - Exemples de rendu final

### 4. 🎨 **GUIDE_RAPIDE_TEMPLATE.txt**
   - Guide visuel avec encadrés
   - Structure complète illustrée
   - Exemples de transformation des balises
   - Mémento des règles importantes

## 🔥 Démarrage Rapide (5 minutes)

### Option 1: Méthode Simple (RECOMMANDÉE)

1. **Ouvrir** `TEMPLATE_PRET_A_COPIER.txt`
2. **Copier** le contenu entre les lignes de séparation
3. **Coller** dans un nouveau document Word
4. **Créer** un tableau Word (6 colonnes) à l'emplacement indiqué
5. **Remplir** le tableau avec les balises fournies
6. **Enregistrer** au format .docx

### Option 2: Méthode Détaillée

1. **Lire** `TEMPLATE_WORD_GUIDE.md` pour comprendre la structure
2. **Consulter** `EXEMPLE_TEMPLATE_WORD.txt` pour voir des exemples
3. **Suivre** `GUIDE_RAPIDE_TEMPLATE.txt` pour créer le document
4. **Valider** avec `TEMPLATE_PRET_A_COPIER.txt` (checklist)

## 📊 Structure des Balises

### Niveau 1: Document
```
{className}         → Nom de la classe (PEI1, DP2, etc.)
{semesterDisplay}   → Semestre (S1 ou S2)
```

### Niveau 2: Boucle Matières
```
{#subjects}
  {subjectName}       → Nom de la matière
  {assignedTeacher}   → Enseignant attitré
  
  {#students}         → Boucle élèves (NIVEAU 3)
    ...
  {/students}
{/subjects}
```

### Niveau 3: Boucle Élèves
```
{#students}
  {studentName}       → Nom de l'élève
  {travauxClasse}     → Note travaux classe
  {devoirs}           → Note devoirs
  {evaluation}        → Note évaluation
  {examen}            → Note examen
  {total}             → Total automatique /100
{/students}
```

## ✅ Checklist Rapide

- [ ] `{className}` présent
- [ ] `{semesterDisplay}` présent
- [ ] `{#subjects}` ... `{/subjects}` (boucle ouverte et fermée)
- [ ] `{subjectName}` et `{assignedTeacher}` dans subjects
- [ ] `{#students}` ... `{/students}` (boucle ouverte et fermée)
- [ ] Toutes les balises élèves dans students
- [ ] Tableau Word créé avec 6 colonnes
- [ ] Pas de fautes de frappe (respecter majuscules/minuscules)
- [ ] Toutes les accolades `{ }` présentes

## 🎯 Toutes les Balises Disponibles

| Balise | Description | Exemple de Valeur |
|--------|-------------|-------------------|
| `{className}` | Nom de la classe | PEI2, DP1 |
| `{semesterDisplay}` | Semestre | S1, S2 |
| `{subjectName}` | Nom de la matière | Mathématiques, Français |
| `{assignedTeacher}` | Enseignant attitré | Kamel, Mohamed Ali |
| `{studentName}` | Nom de l'élève | Ahmed Mohamed |
| `{travauxClasse}` | Note travaux | 18, 19, 15 |
| `{devoirs}` | Note devoirs | 17, 19, 16 |
| `{evaluation}` | Note évaluation | 25, 28, 22 |
| `{examen}` | Note examen | 28, 29, 24 |
| `{total}` | Total /100 | 88.00, 95.00 |

## 📊 Barèmes par Niveau

### PEI1
- Travaux Classe: /30
- Devoirs: /20
- Évaluation: /20
- Examen: /30
- **Total: /100**

### PEI2-5, DP1-2
- Travaux Classe: /20
- Devoirs: /20
- Évaluation: /30
- Examen: /30
- **Total: /100**

## 🚨 Erreurs Courantes

| ❌ Erreur | ✅ Correct |
|-----------|-----------|
| `{ClassName}` | `{className}` |
| `{StudentName}` | `{studentName}` |
| `{Travaux Classe}` | `{travauxClasse}` |
| `{#student}` | `{#students}` |
| `{subjects}` | `{#subjects}` |
| `{#subjects` | `{#subjects}` |
| `subjects}` | `{/subjects}` |

## 🎨 Exemple Minimal Fonctionnel

```
ÉCOLE AL KAWTHAR INTERNATIONAL
BULLETIN DE NOTES

Classe: {className}
Semestre: {semesterDisplay}

{#subjects}

Matière: {subjectName}
Enseignant: {assignedTeacher}

[TABLEAU WORD avec 6 colonnes]
En-tête: Nom Élève | Travaux Classe | Devoirs | Évaluation | Examen | Total

{#students}
Données: {studentName} | {travauxClasse} | {devoirs} | {evaluation} | {examen} | {total}
{/students}

{/subjects}

FIN DU BULLETIN
```

## 📝 Instructions de Création

### Étape 1: Ouvrir Word
Créer un nouveau document vierge.

### Étape 2: Copier le Template
Ouvrir `TEMPLATE_PRET_A_COPIER.txt` et copier le contenu.

### Étape 3: Créer le Tableau
Insertion → Tableau → 6 colonnes, 4 lignes:
- Ligne 1: En-têtes
- Ligne 2: `{#students}`
- Ligne 3: Balises de données
- Ligne 4: `{/students}`

### Étape 4: Enregistrer
Format: Document Word (.docx)
Nom: template_notes_alkawthar.docx

### Étape 5: Uploader
Uploader sur votre CDN ou serveur.

### Étape 6: Mettre à jour le code
Dans `api/index.js`, ligne 419:
```javascript
const templateURL = 'VOTRE_NOUVELLE_URL_ICI';
```

## 🧪 Tester le Template

1. Uploader le template sur votre serveur
2. Mettre à jour l'URL dans le code
3. Se connecter à l'application
4. Ajouter des notes de test
5. Générer un document Word
6. Vérifier le résultat

## 🔗 Structure des Fichiers

```
webapp/
├── TEMPLATE_PRET_A_COPIER.txt    ← À UTILISER EN PREMIER
├── TEMPLATE_WORD_GUIDE.md        ← Guide complet
├── EXEMPLE_TEMPLATE_WORD.txt     ← Exemples détaillés
├── GUIDE_RAPIDE_TEMPLATE.txt     ← Guide visuel
└── README_TEMPLATES.md           ← Ce fichier
```

## 💡 Conseils

1. **Commencez simple**: Utilisez `TEMPLATE_PRET_A_COPIER.txt`
2. **Respectez les noms**: Les balises sont sensibles à la casse
3. **Fermez les boucles**: Chaque `{#...}` doit avoir son `{/...}`
4. **Testez régulièrement**: Générez un document après chaque modification
5. **Sauvegardez**: Gardez une copie de votre template fonctionnel

## 🆘 Besoin d'Aide?

1. **Consultez la checklist** dans `TEMPLATE_PRET_A_COPIER.txt`
2. **Vérifiez les exemples** dans `EXEMPLE_TEMPLATE_WORD.txt`
3. **Lisez les erreurs courantes** dans ce README
4. **Référez-vous au code source** dans `api/index.js` (lignes 402-525)

## 📌 Points Clés à Retenir

✅ **12 balises au total** (2 document + 2 matières + 6 élèves + 2 boucles)
✅ **2 boucles imbriquées** (subjects → students)
✅ **Tableau obligatoire** pour afficher les notes
✅ **Accolades obligatoires** pour toutes les balises
✅ **Respect de la casse** (majuscules/minuscules)

## 🎯 Ordre des Matières

Le système trie automatiquement:
1. Langue et litt
2. Philosophie
3. Société indi
4. Maths
5. Sciences
6. Biologie
7. Physique chimie
8. Design
9. SES
10. SNT
11. ART
12. Musique
13. PE
14. Anglais
+ Autres (ordre alphabétique)

---

**Version:** 1.0  
**Date:** 2026-01-08  
**Projet:** Al Kawthar - Système de Gestion des Notes  
**Auteur:** GenSpark AI Developer
