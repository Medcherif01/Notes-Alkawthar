const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const JSZip = require('jszip');
const axios = require('axios');
const XLSX = require('xlsx');
const session = require('express-session');
const MongoStore = require('connect-mongo');
require('dotenv').config();

// Import des données de section
const {
    allowedTeachersBoys,
    teacherPermissionsBoys,
    studentsByClassBoys,
    allowedTeachersGirls,
    teacherPermissionsGirls,
    studentsByClassGirls
} = require(path.join(__dirname, 'data-sections'));

const app = express();

// --- Configuration ---
const MONGO_URL = process.env.MONGO_URL || "mongodb+srv://cherifmed:Mmedch86@notes.9gwg9o9.mongodb.net/?retryWrites=true&w=majority&appName=Notes";
const SESSION_SECRET = process.env.SESSION_SECRET || 'une-cle-secrete-pour-le-developpement';

// Connexion MongoDB (connection pooling pour serverless)
let cachedDb = null;
async function connectToDatabase() {
    if (cachedDb) {
        return cachedDb;
    }
    const connection = await mongoose.connect(MONGO_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
    });
    cachedDb = connection;
    return connection;
}

// Configuration Express pour Vercel
app.set('trust proxy', 1);

// Session avec MongoStore pour persistance
// Session permanente jusqu'à déconnexion manuelle
const SESSION_MAX_AGE = 10 * 365 * 24 * 60 * 60 * 1000; // 10 ans en millisecondes
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGO_URL,
        dbName: 'test',
        collectionName: 'sessions',
        ttl: 10 * 365 * 24 * 60 * 60, // 10 ans en secondes
        autoRemove: 'native',
        touchAfter: 24 * 3600 // Mise à jour lazy toutes les 24h
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: SESSION_MAX_AGE, // 10 ans - persist même après fermeture du navigateur
        sameSite: 'lax'
    }
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Schéma MongoDB avec nouveaux champs
const NoteSchema = new mongoose.Schema({
    class: String,
    subject: String,
    studentName: String,
    semester: { type: String, required: true, enum: ['S1', 'S2'] },
    section: { type: String, required: false, enum: ['boys', 'girls'], default: 'boys' },
    // Stocker les notes comme String pour conserver la valeur exacte saisie par l'enseignant
    travauxClasse: { type: String, default: null },
    devoirs: { type: String, default: null },
    evaluation: { type: String, default: null },
    examen: { type: String, default: null },
    teacher: { type: String },
    approvedByAdmin: { type: Boolean, default: false },
    enteredInSystem: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

let Note;
try {
    Note = mongoose.model('Note');
} catch {
    Note = mongoose.model('Note', NoteSchema);
}

// Fonctions de gestion des sections
function getSectionData(section = 'boys') {
    let allowedTeachers, teacherPermissions, studentsByClass;
    
    if (section === 'girls') {
        allowedTeachers = {...allowedTeachersGirls};
        teacherPermissions = JSON.parse(JSON.stringify(teacherPermissionsGirls));
        studentsByClass = JSON.parse(JSON.stringify(studentsByClassGirls));
    } else {
        allowedTeachers = {...allowedTeachersBoys};
        teacherPermissions = JSON.parse(JSON.stringify(teacherPermissionsBoys));
        studentsByClass = JSON.parse(JSON.stringify(studentsByClassBoys));
    }
    
    const subjectsByClass = buildSubjectsByClass(teacherPermissions);
    const allClasses = Object.keys(subjectsByClass).sort();
    const allSubjects = [...new Set(Object.values(subjectsByClass).flat())].sort();
    
    return {
        allowedTeachers,
        teacherPermissions,
        studentsByClass,
        subjectsByClass,
        allClasses,
        allSubjects
    };
}

function buildSubjectsByClass(permissions) {
    const subjects = {};
    Object.values(permissions).forEach(perms => {
        if (perms === 'admin') return;
        perms.forEach(p => {
            p.classes.forEach(c => {
                if (!subjects[c]) subjects[c] = new Set();
                subjects[c].add(p.subject);
            });
        });
    });
    for (const key in subjects) {
        subjects[key] = Array.from(subjects[key]).sort();
    }
    return subjects;
}

// Middleware de section
function sectionMiddleware(req, res, next) {
    const section = req.session?.section || 'boys';
    req.sectionData = getSectionData(section);
    next();
}

// ====================================================
// NORMALISATION DES NOTES
// Convertit 0 (Number), "0", null, undefined, ""  → null
// Conserve toute autre valeur comme String exact
// ====================================================
function normalizeNoteValue(val) {
    if (val === null || val === undefined || val === '') return null;
    const str = String(val).trim();
    if (str === '' || str === '0' || str === '0.0' || str === '0.00') return null;
    // Si c'est un nombre valide non nul, le garder comme String exact
    const num = parseFloat(str);
    if (isNaN(num)) return null;
    if (num === 0) return null;
    return str;
}

// Normalise un objet note (pour les notes venant de MongoDB qui ont 0 Number)
function normalizeNote(note) {
    const fields = ['travauxClasse', 'devoirs', 'evaluation', 'examen'];
    const normalized = { ...note };
    fields.forEach(f => {
        normalized[f] = normalizeNoteValue(note[f]);
    });
    return normalized;
}

// Fonctions utilitaires
function getAssignedTeacher(subject, className, teacherPermissions) {
    for (const [teacher, perms] of Object.entries(teacherPermissions)) {
        if (perms === 'admin') continue;
        for (const perm of perms) {
            if (perm.subject === subject && perm.classes.includes(className)) {
                return teacher;
            }
        }
    }
    return "N/D";
}

function getUserAllowedOptions(username, sectionData) {
    const permissions = sectionData.teacherPermissions[username];
    if (permissions === 'admin') {
        return { classes: [...sectionData.allClasses], subjects: [...sectionData.allSubjects] };
    }
    if (!permissions) return { classes: [], subjects: [] };

    let allowedClasses = new Set();
    let allowedSubjects = new Set();
    permissions.forEach(perm => {
        allowedSubjects.add(perm.subject);
        perm.classes.forEach(cls => allowedClasses.add(cls));
    });
    return {
        classes: Array.from(allowedClasses).sort(),
        subjects: Array.from(allowedSubjects).sort()
    };
}

function buildMongoQueryForUser(username, semester, teacherPermissions) {
    const baseQuery = { semester: semester };
    const permissions = teacherPermissions[username];
    if (!permissions || permissions === 'admin') {
        return baseQuery;
    }
    const orConditions = permissions.flatMap(perm =>
        perm.classes.map(cls => ({ class: cls, subject: perm.subject }))
    );
    if (orConditions.length === 0) {
        return { _id: new mongoose.Types.ObjectId('000000000000000000000000') };
    }
    return { ...baseQuery, $or: orConditions };
}

async function checkUserPermissionAndSubjectExists(username, classToCheck, subjectToCheck, sectionData) {
    if (!sectionData.subjectsByClass[classToCheck] || !sectionData.subjectsByClass[classToCheck].includes(subjectToCheck)) {
        return false;
    }
    const permissions = sectionData.teacherPermissions[username];
    if (permissions === 'admin') return true;
    if (!permissions) return false;
    return permissions.some(p => p.subject === subjectToCheck && p.classes.includes(classToCheck));
}

// Routes publiques
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'home.html'));
});

app.get('/home.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'home.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

app.get('/dashboard.html', (req, res) => {
    // Servir le fichier sans middleware - la vérification se fait côté client
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

// Route de login (POST) - mise à jour pour gérer la section depuis le body
app.post('/login', (req, res) => {
    const { username, password, section } = req.body;
    const userSection = section || 'boys';
    
    const sectionData = getSectionData(userSection);
    
    if (sectionData.allowedTeachers[username] && sectionData.allowedTeachers[username] === password) {
        req.session.user = username;
        req.session.section = userSection;
        
        // Session permanente - persiste même après fermeture du navigateur
        req.session.cookie.maxAge = SESSION_MAX_AGE;
        
        console.log(`✅ Login successful for user: ${username} in section: ${userSection}`);
        res.status(200).json({ success: true, message: 'Connexion réussie' });
    } else {
        console.log(`❌ Login failed for user: ${username}`);
        res.status(401).json({ success: false, message: 'Login ou mot de passe incorrect' });
    }
});

app.get('/logout', (req, res) => {
    const user = req.session.user;
    req.session.destroy(err => {
        if (err) console.error("❌ Error destroying session:", err);
        console.log(`🚪 User ${user} logged out.`);
        res.clearCookie('connect.sid');
        res.status(200).json({ success: true, message: 'Déconnexion réussie' });
    });
});

// Middleware d'authentification
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        console.log(`🚫 User not authenticated trying to access ${req.path}`);
        res.status(401).json({ success: false, message: 'Non authentifié' });
    }
}

// Routes protégées
app.get('/get-user', requireAuth, sectionMiddleware, (req, res) => {
    const username = req.session.user;
    const section = req.session.section || 'boys';
    res.json({
        username: username,
        section: section,
        permissions: getUserAllowedOptions(username, req.sectionData),
        subjectsByClass: req.sectionData.subjectsByClass,
        studentsByClass: req.sectionData.studentsByClass
    });
});

app.get('/all-notes', requireAuth, sectionMiddleware, async (req, res) => {
    await connectToDatabase();
    const { semester } = req.query;
    const username = req.session.user;
    const section = req.session.section || 'boys';
    if (!semester || !['S1', 'S2'].includes(semester)) {
        return res.status(400).json({ error: 'Le paramètre semester (S1 ou S2) est requis.' });
    }
    try {
        const query = buildMongoQueryForUser(username, semester, req.sectionData.teacherPermissions);
        // CORRECTION: Filtrage strict par section avec support des anciennes notes
        // - Les sections sont STRICTEMENT indépendantes
        // - Les notes sans section (anciennes données) sont considérées comme 'boys' par défaut
        // - Cela évite la perte de données historiques tout en maintenant la séparation stricte
        if (section === 'boys') {
            // Section garçons: inclure notes 'boys' ET notes sans section (anciennes)
            query.$or = [{ section: 'boys' }, { section: { $exists: false } }, { section: null }];
        } else {
            // Section filles: UNIQUEMENT les notes marquées 'girls' (strictement)
            query.section = 'girls';
        }
        const rawNotes = await Note.find(query).lean();
        // Normaliser toutes les notes: 0 (Number) → null → case vide
        const notes = rawNotes.map(normalizeNote);
        console.log(`📊 Fetched ${notes.length} notes for section: ${section}, semester: ${semester}`);
        res.status(200).json(notes);
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des notes' });
    }
});

app.post('/save-notes', requireAuth, sectionMiddleware, async (req, res) => {
    await connectToDatabase();
    const { class: studentClass, subject, studentName, semester, travauxClasse, devoirs, evaluation, examen } = req.body;
    const teacher = req.session.user;
    if (!await checkUserPermissionAndSubjectExists(teacher, studentClass, subject, req.sectionData)) {
        return res.status(403).send(`❌ Permission refusée.`);
    }
    try {
        const section = req.session.section || 'boys';
        const existingNote = await Note.findOne({ class: studentClass, subject, studentName, semester, section });
        if (existingNote) {
            return res.status(400).send(`❌ Notes déjà existantes pour cet élève.`);
        }
        const note = new Note({
            class: studentClass, subject, studentName, semester, section,
            travauxClasse: (travauxClasse === '' || travauxClasse === null || travauxClasse === undefined) ? null : String(travauxClasse),
            devoirs: (devoirs === '' || devoirs === null || devoirs === undefined) ? null : String(devoirs),
            evaluation: (evaluation === '' || evaluation === null || evaluation === undefined) ? null : String(evaluation),
            examen: (examen === '' || examen === null || examen === undefined) ? null : String(examen),
            teacher,
            approvedByAdmin: false,
            enteredInSystem: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        await note.save();
        res.status(200).send('✅ Notes sauvegardées avec succès');
    } catch (error) {
        console.error('Error saving note:', error);
        res.status(500).send('❌ Erreur serveur lors de la sauvegarde.');
    }
});

app.put('/update-note/:id', requireAuth, sectionMiddleware, async (req, res) => {
    await connectToDatabase();
    const { id } = req.params;
    const updatedData = req.body;
    const teacher = req.session.user;
    try {
        const noteToUpdate = await Note.findById(id);
        if (!noteToUpdate) return res.status(404).send("❌ Note non trouvée.");
        if (!await checkUserPermissionAndSubjectExists(teacher, noteToUpdate.class, noteToUpdate.subject, req.sectionData)) {
            return res.status(403).send('❌ Permission refusée.');
        }
        const cleanData = {};
        ['travauxClasse', 'devoirs', 'evaluation', 'examen'].forEach(field => {
            if (updatedData.hasOwnProperty(field)) {
                const value = updatedData[field];
                if (value === '' || value === null || value === undefined) {
                    cleanData[field] = null;
                } else {
                    // Conserver la valeur exacte saisie par l'enseignant (String)
                    cleanData[field] = String(value);
                }
            }
        });
        
        // Permettre la mise à jour des statuts (admin et enseignant)
        if (updatedData.hasOwnProperty('enteredInSystem')) {
            cleanData.enteredInSystem = Boolean(updatedData.enteredInSystem);
        }
        
        // Seuls les admins peuvent modifier approvedByAdmin
        const permissions = req.sectionData.teacherPermissions[teacher];
        if (permissions === 'admin' && updatedData.hasOwnProperty('approvedByAdmin')) {
            cleanData.approvedByAdmin = Boolean(updatedData.approvedByAdmin);
        }
        
        cleanData.teacher = teacher;
        cleanData.updatedAt = new Date();
        await Note.findByIdAndUpdate(id, cleanData, { new: true });
        res.status(200).send("✅ Note mise à jour.");
    } catch (error) {
        console.error('Error updating note:', error);
        res.status(500).send("❌ Erreur serveur lors de la mise à jour.");
    }
});

app.delete('/delete-note/:id', requireAuth, sectionMiddleware, async (req, res) => {
    await connectToDatabase();
    const { id } = req.params;
    const teacher = req.session.user;
    try {
        const noteToDelete = await Note.findById(id);
        if (!noteToDelete) return res.status(404).send("❌ Note non trouvée.");
        if (!await checkUserPermissionAndSubjectExists(teacher, noteToDelete.class, noteToDelete.subject, req.sectionData)) {
            return res.status(403).send('❌ Permission refusée.');
        }
        await Note.findByIdAndDelete(id);
        res.status(200).send("✅ Note supprimée.");
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).send("❌ Erreur serveur lors de la suppression.");
    }
});

app.post('/generate-word', requireAuth, sectionMiddleware, async (req, res) => {
    await connectToDatabase();
    const { semester } = req.body;
    const username = req.session.user;
    const section = req.session.section || 'boys';
    try {
        const query = buildMongoQueryForUser(username, semester, req.sectionData.teacherPermissions);
        // CORRECTION: Filtrage strict par section avec support des anciennes notes
        if (section === 'boys') {
            query.$or = [{ section: 'boys' }, { section: { $exists: false } }, { section: null }];
        } else {
            query.section = 'girls';
        }
        query.approvedByAdmin = { $ne: true }; // Ne pas générer les notes déjà approuvées
        const rawNotes = await Note.find(query).lean();
        // Normaliser: 0 (Number) → null → case vide dans Word
        const notes = rawNotes.map(normalizeNote);
        if (notes.length === 0) return res.status(404).send(`❌ Aucune donnée non approuvée pour le semestre ${semester}.`);
        
        const templateURL = 'https://docs.google.com/document/d/1AyBNXpuAddW0_-6rT6oQ0m0DMbNg2KHv/export?format=docx';
        const response = await axios.get(templateURL, { responseType: 'arraybuffer' });
        const templateContent = response.data;

        const zip = new JSZip();
        const allowedOptions = getUserAllowedOptions(username, req.sectionData);
        
        const notesByClass = notes.reduce((acc, note) => {
            if (allowedOptions.classes.includes(note.class)) {
                (acc[note.class] = acc[note.class] || []).push(note);
            }
            return acc;
        }, {});

        // Ordre spécifique des matières pour la génération Word
        // Map des noms de matières avec leurs variantes
        const subjectOrderMap = {
            'Langue et litt': ['Langue et litt', 'L.L', 'Langue', 'Littérature', 'Français'],
            'Philosophie': ['Philosophie', 'Philo'],
            'Société indi': ['Société indi', 'Société', 'Individu et société', 'I.S'],
            'Maths': ['Maths', 'Mathématiques', 'Math'],
            'Sciences': ['Sciences', 'Science'],
            'Biologie': ['Biologie', 'Bio'],
            'Physique chimie': ['Physique chimie', 'Physique-Chimie', 'PC'],
            'Design': ['Design'],
            'SES': ['SES', 'Sciences économiques'],
            'SNT': ['SNT'],
            'ART': ['ART', 'Arts', 'Art'],
            'Musique': ['Musique', 'Music'],
            'PE': ['PE', 'P.E', 'Sport', 'EPS'],
            'Anglais': ['Anglais', 'English', 'Ang']
        };
        
        // Fonction pour trouver la position d'une matière dans l'ordre
        const getSubjectOrder = (subjectName) => {
            const entries = Object.entries(subjectOrderMap);
            for (let i = 0; i < entries.length; i++) {
                const [key, variants] = entries[i];
                if (variants.some(v => subjectName.toLowerCase() === v.toLowerCase() || 
                                       subjectName.toLowerCase().includes(v.toLowerCase()))) {
                    return i;
                }
            }
            return 999; // Matières non listées à la fin
        };

        for (const className in notesByClass) {
            const classStudentList = req.sectionData.studentsByClass[className] || [];
            if (classStudentList.length === 0) continue;

            const doc = new Docxtemplater(new PizZip(templateContent), { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });

            const uniqueSubjectsInClassNotes = [...new Set(notesByClass[className].map(n => n.subject))];
            const subjectsToInclude = (req.sectionData.subjectsByClass[className] || [])
                .filter(s => allowedOptions.subjects.includes(s) && uniqueSubjectsInClassNotes.includes(s));

            if (subjectsToInclude.length === 0) continue;

            // Trier les matières selon l'ordre spécifié
            const sortedSubjects = subjectsToInclude.sort((a, b) => {
                const orderA = getSubjectOrder(a);
                const orderB = getSubjectOrder(b);
                
                // Trier par ordre, puis alphabétiquement si même ordre
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                return a.localeCompare(b);
            });

            const renderDataSubjects = sortedSubjects.map(subjectName => ({
                subjectName: subjectName,
                assignedTeacher: getAssignedTeacher(subjectName, className, req.sectionData.teacherPermissions),
                students: classStudentList.map(studentName => {
                    const rawNote = notesByClass[className].find(n => n.studentName === studentName && n.subject === subjectName);
                    // normalizeNote() traite 0 (Number/String), null, "" → null → case vide
                    const noteNorm = rawNote ? normalizeNote(rawNote) : null;
                    const tc   = noteNorm?.travauxClasse ?? '';
                    const dev  = noteNorm?.devoirs       ?? '';
                    const eva  = noteNorm?.evaluation    ?? '';
                    const exam = noteNorm?.examen        ?? '';
                    const tcNum   = tc   !== '' ? parseFloat(tc)   : 0;
                    const devNum  = dev  !== '' ? parseFloat(dev)  : 0;
                    const evaNum  = eva  !== '' ? parseFloat(eva)  : 0;
                    const examNum = exam !== '' ? parseFloat(exam) : 0;
                    const hasAny = tc !== '' || dev !== '' || eva !== '' || exam !== '';
                    const total  = hasAny ? (tcNum + devNum + evaNum + examNum) : null;
                    return {
                        studentName,
                        travauxClasse: tc,
                        devoirs:       dev,
                        evaluation:    eva,
                        examen:        exam,
                        total: total !== null ? String(parseFloat(total.toFixed(4))) : ""
                    };
                })
            }));

            doc.render({ className, semesterDisplay: semester, subjects: renderDataSubjects });
            const buffer = doc.getZip().generate({ type: 'nodebuffer', compression: "DEFLATE" });
            zip.file(`${className}_${semester}.docx`, buffer);
        }

        if (Object.keys(zip.files).length === 0) {
            return res.status(404).send(`❌ Aucun fichier n'a pu être généré.`);
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: "DEFLATE" });
        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="Notes_${username}_${semester}.zip"`,
        }).send(zipBuffer);

    } catch (error) {
        console.error("❌ Error generating Word files:", error);
        res.status(500).send("❌ Erreur serveur lors de la génération.");
    }
});

app.post('/generate-excel', requireAuth, sectionMiddleware, async (req, res) => {
    await connectToDatabase();
    const { semester } = req.body;
    const username = req.session.user;
    const section = req.session.section || 'boys';
    try {
        const query = buildMongoQueryForUser(username, semester, req.sectionData.teacherPermissions);
        // CORRECTION: Filtrage strict par section avec support des anciennes notes
        if (section === 'boys') {
            query.$or = [{ section: 'boys' }, { section: { $exists: false } }, { section: null }];
        } else {
            query.section = 'girls';
        }
        query.approvedByAdmin = { $ne: true };
        const rawNotesExcel = await Note.find(query).lean();
        // Normaliser: 0 (Number) → null → case vide dans Excel
        const notes = rawNotesExcel.map(normalizeNote);
        if (notes.length === 0) return res.status(404).send(`❌ Aucune note non approuvée pour la génération Excel.`);

        const wb = XLSX.utils.book_new();
        const allowedOptions = getUserAllowedOptions(username, req.sectionData);

        allowedOptions.classes.forEach(className => {
            const classNotes = notes.filter(n => n.class === className);
            if (classNotes.length === 0) return;
            
            const wsData = [
                ['Classe', 'Matière', 'Élève', 'Travaux Classe', 'Devoirs', 'Évaluation', 'Examen', 'Total', 'Enseignant Saisie', 'Enseignant Attitré', 'Saisi Système', 'Approuvé Admin']
            ];
            classNotes.sort((a,b) => a.studentName.localeCompare(b.studentName) || a.subject.localeCompare(b.subject))
            .forEach(note => {
                // normalizeNote() déjà appliqué — null = case vide, jamais 0
                const tc   = note.travauxClasse ?? '';
                const dev  = note.devoirs       ?? '';
                const eva  = note.evaluation    ?? '';
                const exam = note.examen        ?? '';
                const hasAny = tc !== '' || dev !== '' || eva !== '' || exam !== '';
                let totalDisplay = '';
                if (hasAny) {
                    const t = (tc   !== '' ? parseFloat(tc)   : 0) +
                              (dev  !== '' ? parseFloat(dev)  : 0) +
                              (eva  !== '' ? parseFloat(eva)  : 0) +
                              (exam !== '' ? parseFloat(exam) : 0);
                    totalDisplay = String(parseFloat(t.toFixed(4)));
                }
                wsData.push([
                    note.class, note.subject, note.studentName,
                    tc, dev, eva, exam,
                    totalDisplay,
                    note.teacher || '', 
                    getAssignedTeacher(note.subject, note.class, req.sectionData.teacherPermissions),
                    note.enteredInSystem ? 'Oui' : 'Non',
                    note.approvedByAdmin ? 'Oui' : 'Non'
                ]);
            });
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            ws['!cols'] = Array(12).fill({ wch: 18 });
            XLSX.utils.book_append_sheet(wb, ws, className);
        });

        if (wb.SheetNames.length === 0) {
             return res.status(404).send(`❌ Aucune donnée à exporter en Excel.`);
        }
        
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="Notes_${username}_${semester}.xlsx"`,
        }).send(buffer);

    } catch (error) {
        console.error("❌ Error generating Excel file:", error);
        res.status(500).send("❌ Erreur serveur.");
    }
});

// Route de migration pour ajouter le champ section aux anciennes notes
app.post('/migrate-old-notes', requireAuth, async (req, res) => {
    await connectToDatabase();
    try {
        // Mettre à jour toutes les notes sans section pour les mettre en 'boys' par défaut
        const result = await Note.updateMany(
            { $or: [{ section: { $exists: false } }, { section: null }] },
            { $set: { section: 'boys' } }
        );
        
        console.log(`✅ Migration: ${result.modifiedCount} notes mises à jour`);
        res.status(200).json({ 
            success: true, 
            message: `${result.modifiedCount} notes migrées avec succès` 
        });
    } catch (error) {
        console.error('❌ Error during migration:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la migration' });
    }
});

// Route de statistiques pour déboguer (admin seulement)
app.get('/stats-notes', requireAuth, sectionMiddleware, async (req, res) => {
    await connectToDatabase();
    try {
        const totalNotes = await Note.countDocuments({});
        const boysNotes = await Note.countDocuments({ section: 'boys' });
        const girlsNotes = await Note.countDocuments({ section: 'girls' });
        const noSectionNotes = await Note.countDocuments({ 
            $or: [{ section: { $exists: false } }, { section: null }] 
        });
        
        const sampleNotes = await Note.find({}).limit(5).lean();
        
        res.status(200).json({
            total: totalNotes,
            boys: boysNotes,
            girls: girlsNotes,
            noSection: noSectionNotes,
            samples: sampleNotes
        });
    } catch (error) {
        console.error('❌ Error fetching stats:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des stats' });
    }
});

// Export pour Vercel
module.exports = app;
