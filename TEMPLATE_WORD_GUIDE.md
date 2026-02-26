# 📝 Guide du Template Word - Balises et Structure

## 🎯 Vue d'ensemble

Ce document explique **TOUTES** les balises et boucles utilisées dans le template Word pour générer les bulletins de notes. Utilisez ce guide pour créer un nouveau document Word modèle.

---

## 📋 Structure Complète du Template

### 🔹 Balises Principales (À la racine du document)

1. **`{className}`** - Nom de la classe
   - Exemple: PEI1, PEI2, DP1, DP2
   - Position: En-tête du document

2. **`{semesterDisplay}`** - Affichage du semestre
   - Valeurs: S1 ou S2
   - Position: Sous le nom de la classe

---

## 🔄 Boucle Principale: Matières (subjects)

La boucle principale parcourt toutes les matières de la classe:

```
{#subjects}
  ... contenu pour chaque matière ...
{/subjects}
```

### 🔹 Balises disponibles dans la boucle `subjects`

À l'intérieur de `{#subjects}...{/subjects}`, vous avez accès à:

1. **`{subjectName}`** - Nom de la matière
   - Exemples: Maths, Sciences, Français, Anglais, PE, etc.

2. **`{assignedTeacher}`** - Nom de l'enseignant attitré
   - Exemples: Mohamed Ali, Sami, Kamel, Amal, etc.

---

## 🔄 Boucle Secondaire: Élèves (students)

À l'intérieur de la boucle `subjects`, il y a une deuxième boucle pour les élèves:

```
{#subjects}
  Matière: {subjectName}
  Enseignant: {assignedTeacher}
  
  {#students}
    ... données de chaque élève ...
  {/students}
{/subjects}
```

### 🔹 Balises disponibles dans la boucle `students`

À l'intérieur de `{#students}...{/students}`, vous avez accès à:

1. **`{studentName}`** - Nom complet de l'élève
   - Exemple: Ahmed Mohamed, Fatima Ali

2. **`{travauxClasse}`** - Note des travaux de classe
   - Type: Nombre ou vide si non saisi
   - Barème: Voir section ci-dessous

3. **`{devoirs}`** - Note des devoirs
   - Type: Nombre ou vide si non saisi
   - Barème: Voir section ci-dessous

4. **`{evaluation}`** - Note d'évaluation
   - Type: Nombre ou vide si non saisi
   - Barème: Voir section ci-dessous

5. **`{examen}`** - Note d'examen
   - Type: Nombre ou vide si non saisi
   - Barème: Voir section ci-dessous

6. **`{total}`** - Total des notes (calculé automatiquement)
   - Type: Nombre décimal (2 décimales)
   - Calcul: travauxClasse + devoirs + evaluation + examen
   - Maximum: 100 points

---

## 📊 Barèmes par Niveau

### PEI1
- Travaux Classe: **/30 points**
- Devoirs: **/20 points**
- Évaluation: **/20 points**
- Examen: **/30 points**
- **Total: /100 points**

### PEI2, PEI3, PEI4, PEI5, DP1, DP2
- Travaux Classe: **/20 points**
- Devoirs: **/20 points**
- Évaluation: **/30 points**
- Examen: **/30 points**
- **Total: /100 points**

---

## 🎨 Exemple de Structure Word Complète

Voici la structure EXACTE à reproduire dans votre document Word:

```
═══════════════════════════════════════════════════
           ÉCOLE AL KAWTHAR INTERNATIONAL
           BULLETIN DE NOTES - CLASSE {className}
                    SEMESTRE {semesterDisplay}
═══════════════════════════════════════════════════

{#subjects}
─────────────────────────────────────────────────
📚 MATIÈRE: {subjectName}
👨‍🏫 ENSEIGNANT: {assignedTeacher}
─────────────────────────────────────────────────

┌────────────────────────────────────────────────────────────────────────┐
│ NOM ÉLÈVE          │ Travaux │ Devoirs │ Éval.  │ Examen │ TOTAL /100 │
├────────────────────────────────────────────────────────────────────────┤
{#students}
│ {studentName}      │  {travauxClasse}  │  {devoirs}  │  {evaluation}  │  {examen}  │   {total}    │
{/students}
└────────────────────────────────────────────────────────────────────────┘

{/subjects}

═══════════════════════════════════════════════════
              FIN DU BULLETIN - {className}
═══════════════════════════════════════════════════
```

---

## 📝 Instructions pour Créer le Template Word

### Étape 1: Créer le document
1. Ouvrir Microsoft Word (ou LibreOffice Writer)
2. Créer un nouveau document vierge

### Étape 2: Ajouter l'en-tête
```
ÉCOLE AL KAWTHAR INTERNATIONAL
BULLETIN DE NOTES - CLASSE {className}
SEMESTRE {semesterDisplay}
```

### Étape 3: Ajouter la boucle des matières
```
{#subjects}
```

### Étape 4: À l'intérieur de la boucle subjects, ajouter:
```
MATIÈRE: {subjectName}
ENSEIGNANT: {assignedTeacher}
```

### Étape 5: Créer un tableau pour les élèves
Créer un tableau Word avec les colonnes:
- Nom Élève
- Travaux Classe
- Devoirs
- Évaluation
- Examen
- Total

### Étape 6: Dans la première ligne de données du tableau, ajouter:
```
{#students}
{studentName}  |  {travauxClasse}  |  {devoirs}  |  {evaluation}  |  {examen}  |  {total}
{/students}
```

### Étape 7: Fermer la boucle subjects
```
{/subjects}
```

---

## ⚠️ Points Importants

### 1. Balises à Utiliser EXACTEMENT
- **{className}** - NE PAS modifier
- **{semesterDisplay}** - NE PAS modifier
- **{#subjects}** et **{/subjects}** - Boucle obligatoire
- **{subjectName}** - NE PAS modifier
- **{assignedTeacher}** - NE PAS modifier
- **{#students}** et **{/students}** - Boucle obligatoire
- **{studentName}** - NE PAS modifier
- **{travauxClasse}** - NE PAS modifier
- **{devoirs}** - NE PAS modifier
- **{evaluation}** - NE PAS modifier
- **{examen}** - NE PAS modifier
- **{total}** - NE PAS modifier

### 2. Ordre des Boucles
```
Document
├── {className}
├── {semesterDisplay}
└── {#subjects}
    ├── {subjectName}
    ├── {assignedTeacher}
    └── {#students}
        ├── {studentName}
        ├── {travauxClasse}
        ├── {devoirs}
        ├── {evaluation}
        ├── {examen}
        └── {total}
    {/students}
{/subjects}
```

### 3. Notes Importantes
- Les accolades `{}` sont obligatoires
- Les balises sont sensibles à la casse (majuscules/minuscules)
- Les boucles doivent être fermées dans le bon ordre
- Le tableau doit être dans la boucle {#students}{/students}
- Les valeurs vides ne cassent pas le document (gérées automatiquement)

---

## 🎯 Ordre de Tri des Matières

Le système trie automatiquement les matières dans cet ordre:

1. Langue et litt (Français)
2. Philosophie
3. Société indi (Individu et société)
4. Maths
5. Sciences
6. Biologie
7. Physique chimie
8. Design
9. SES (Sciences économiques)
10. SNT
11. ART
12. Musique
13. PE (Sport)
14. Anglais

Les autres matières apparaissent après, par ordre alphabétique.

---

## ✅ Checklist de Validation

Avant d'enregistrer votre template Word, vérifiez:

- [ ] La balise `{className}` est présente
- [ ] La balise `{semesterDisplay}` est présente
- [ ] La boucle `{#subjects}` est ouverte
- [ ] La balise `{subjectName}` est présente dans la boucle subjects
- [ ] La balise `{assignedTeacher}` est présente dans la boucle subjects
- [ ] La boucle `{#students}` est ouverte dans subjects
- [ ] Les balises `{studentName}`, `{travauxClasse}`, `{devoirs}`, `{evaluation}`, `{examen}`, `{total}` sont présentes dans students
- [ ] La boucle `{/students}` est fermée
- [ ] La boucle `{/subjects}` est fermée
- [ ] Toutes les balises utilisent les accolades `{}`
- [ ] Pas de fautes de frappe dans les noms de balises

---

## 🔧 Dépannage

### Problème: Le document généré est vide
→ Vérifiez que les boucles sont bien fermées

### Problème: Les élèves ne s'affichent pas
→ Vérifiez que la boucle `{#students}` est à l'intérieur de `{#subjects}`

### Problème: Les notes ne s'affichent pas
→ Vérifiez l'orthographe exacte: `travauxClasse`, `devoirs`, `evaluation`, `examen`

### Problème: Le total ne calcule pas
→ Le calcul est automatique, utilisez juste `{total}`

---

## 📞 Support Technique

Pour toute question sur les balises ou la structure du template, référez-vous à ce document ou consultez le code source dans `api/index.js` lignes 402-525.

---

**Dernière mise à jour:** 2026-01-08
**Version du template:** 3.0
**Compatible avec:** Docxtemplater 3.x, PizZip
