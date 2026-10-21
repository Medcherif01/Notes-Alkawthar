const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const JSZip = require('jszip');
const axios = require('axios');
const XLSX = require('xlsx');
const session = require('express-session');
require('dotenv').config();

// Import des données de section et gestion du stockage persistant (db_storage.json)
const fs = require('fs');
const STORAGE_FILE = path.join(__dirname, '..', 'db_storage.json');
const dataSections = require(path.join(__dirname, 'data-sections'));
const {
    allowedTeachersBoys,
    teacherPermissionsBoys,
    studentsByClassBoys,
    allowedTeachersGirls,
    teacherPermissionsGirls,
    studentsByClassGirls
} = dataSections;

let dbStorage = {
    boys: {
        studentsByClass: JSON.parse(JSON.stringify(dataSections.studentsByClassBoys)),
        teacherPermissions: JSON.parse(JSON.stringify(dataSections.teacherPermissionsBoys)),
        allowedTeachers: JSON.parse(JSON.stringify(dataSections.allowedTeachersBoys))
    },
    girls: {
        studentsByClass: JSON.parse(JSON.stringify(dataSections.studentsByClassGirls)),
        teacherPermissions: JSON.parse(JSON.stringify(dataSections.teacherPermissionsGirls)),
        allowedTeachers: JSON.parse(JSON.stringify(dataSections.allowedTeachersGirls))
    },
    notes: []
};

let inMemoryNotes = [];
let noteIdCounter = 1;

try {
    if (fs.existsSync(STORAGE_FILE)) {
        const fileContent = fs.readFileSync(STORAGE_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent);
        if (parsed.boys) dbStorage.boys = parsed.boys;
        if (parsed.girls) dbStorage.girls = parsed.girls;
        if (parsed.notes && Array.isArray(parsed.notes)) {
            inMemoryNotes = parsed.notes;
            if (inMemoryNotes.length > 0) {
                const maxId = Math.max(...inMemoryNotes.map(n => Number(n._id) || 0));
                if (!isNaN(maxId)) noteIdCounter = maxId + 1;
            }
        }
        console.log('✅ Persistent database loaded successfully from db_storage.json');
    } else {
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(dbStorage, null, 2), 'utf-8');
        console.log('✅ New persistent database created at db_storage.json');
    }
} catch (e) {
    console.error('❌ Error loading db_storage.json, using defaults:', e);
}

// Force Mohamed admin password and permissions
if (dbStorage.boys && dbStorage.boys.allowedTeachers) {
    dbStorage.boys.allowedTeachers["Mohamed"] = "Med120786";
}
if (dbStorage.girls && dbStorage.girls.allowedTeachers) {
    dbStorage.girls.allowedTeachers["Mohamed"] = "Med120786";
}
if (dbStorage.boys && dbStorage.boys.teacherPermissions) {
    dbStorage.boys.teacherPermissions["Mohamed"] = "admin";
}
if (dbStorage.girls && dbStorage.girls.teacherPermissions) {
    dbStorage.girls.teacherPermissions["Mohamed"] = "admin";
}
saveDatabaseToDisk();

function saveDatabaseToDisk() {
    try {
        dbStorage.notes = inMemoryNotes;
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(dbStorage, null, 2), 'utf-8');
    } catch (e) {
        console.error('❌ Error saving database to disk:', e);
    }
}

const app = express();

// --- Configuration ---
const SESSION_SECRET = process.env.SESSION_SECRET || 'une-cle-secrete-pour-le-developpement';

// Mode 100% en-memory ultra-rapide (zéro connexion réseau, zéro timeout)
async function connectToDatabase() {
    return null;
}

class InMemoryNote {
    constructor(data) {
        Object.assign(this, data);
        if (!this._id) this._id = String(noteIdCounter++);
        if (!this.createdAt) this.createdAt = new Date();
        if (!this.updatedAt) this.updatedAt = new Date();
    }
    async save() {
        const existingIdx = inMemoryNotes.findIndex(n => 
            n.class === this.class && 
            n.subject === this.subject && 
            n.studentName === this.studentName && 
            n.semester === this.semester &&
            (n.section || 'boys') === (this.section || 'boys')
        );
        if (existingIdx !== -1) {
            inMemoryNotes[existingIdx] = {
                ...inMemoryNotes[existingIdx],
                ...JSON.parse(JSON.stringify(this)),
                updatedAt: new Date()
            };
            saveDatabaseToDisk();
            return inMemoryNotes[existingIdx];
        }
        inMemoryNotes.push(JSON.parse(JSON.stringify(this)));
        saveDatabaseToDisk();
        return this;
    }
}

const MemoryNoteModel = {
    find(query = {}) {
        let results = inMemoryNotes.filter(n => {
            if (query.semester && n.semester !== query.semester) return false;
            if (query.class && n.class !== query.class) return false;
            if (query.subject && n.subject !== query.subject) return false;
            if (query.studentName && n.studentName !== query.studentName) return false;
            if (query.approvedByAdmin !== undefined) {
                if (query.approvedByAdmin && query.approvedByAdmin.$ne === true) {
                    if (n.approvedByAdmin === true) return false;
                } else if (n.approvedByAdmin !== query.approvedByAdmin) {
                    return false;
                }
            }
            if (query.section) {
                const sec = n.section || 'boys';
                if (typeof query.section === 'string' && sec !== query.section) return false;
            }
            if (query.$or) {
                const matchesAny = query.$or.some(cond => {
                    if (cond.section === 'boys' || cond.section === { $exists: false } || cond.section === null) {
                        return (n.section === 'boys' || !n.section);
                    }
                    if (cond.class && cond.subject) {
                        return n.class === cond.class && n.subject === cond.subject;
                    }
                    return false;
                });
                if (!matchesAny) return false;
            }
            return true;
        });
        return {
            lean: async () => results.map(r => ({ ...r })),
            limit: (n) => ({
                lean: async () => results.slice(0, n).map(r => ({ ...r }))
            })
        };
    },
    async findOne(query = {}) {
        const res = MemoryNoteModel.find(query);
        const items = await res.lean();
        return items[0] || null;
    },
    async findById(id) {
        const found = inMemoryNotes.find(n => String(n._id) === String(id));
        if (!found) return null;
        const item = { ...found };
        item.save = async function() {
            const idx = inMemoryNotes.findIndex(n => String(n._id) === String(id));
            if (idx !== -1) inMemoryNotes[idx] = JSON.parse(JSON.stringify(item));
            saveDatabaseToDisk();
            return item;
        };
        return item;
    },
    async findByIdAndUpdate(id, updateData, options) {
        const idx = inMemoryNotes.findIndex(n => String(n._id) === String(id));
        if (idx === -1) return null;
        inMemoryNotes[idx] = { ...inMemoryNotes[idx], ...updateData, updatedAt: new Date() };
        saveDatabaseToDisk();
        return inMemoryNotes[idx];
    },
    async findByIdAndDelete(id) {
        const idx = inMemoryNotes.findIndex(n => String(n._id) === String(id));
        if (idx === -1) return null;
        const removed = inMemoryNotes.splice(idx, 1)[0];
        saveDatabaseToDisk();
        return removed;
    },
    async countDocuments(query = {}) {
        const res = MemoryNoteModel.find(query);
        const items = await res.lean();
        return items.length;
    },
    async updateMany(filter, update) {
        let count = 0;
        inMemoryNotes.forEach(n => {
            let match = true;
            if (filter.$or) {
                match = filter.$or.some(cond => {
                    if (cond.section && (cond.section.$exists !== undefined || cond.section === null)) {
                        return !n.section;
                    }
                    return false;
                });
            }
            if (match) {
                if (update.$set) {
                    Object.assign(n, update.$set);
                    count++;
                }
            }
        });
        if (count > 0) saveDatabaseToDisk();
        return { modifiedCount: count };
    }
};

const SafeNote = {
    find(query) {
        return MemoryNoteModel.find(query);
    },
    async findOne(query) {
        return MemoryNoteModel.findOne(query);
    },
    async findById(id) {
        return MemoryNoteModel.findById(id);
    },
    async findByIdAndUpdate(id, updateData, options) {
        return MemoryNoteModel.findByIdAndUpdate(id, updateData, options);
    },
    async findByIdAndDelete(id) {
        return MemoryNoteModel.findByIdAndDelete(id);
    },
    async countDocuments(query) {
        return MemoryNoteModel.countDocuments(query);
    },
    async updateMany(filter, update) {
        return MemoryNoteModel.updateMany(filter, update);
    },
    createInstance(data) {
        return new InMemoryNote(data);
    }
};

// Configuration Express pour Vercel, Cloud Run et AI Studio
app.set('trust proxy', 1);

const SESSION_MAX_AGE = 10 * 365 * 24 * 60 * 60 * 1000; // 10 ans en millisecondes
const sessionStore = new session.MemoryStore();

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        secure: 'auto',
        httpOnly: true,
        maxAge: SESSION_MAX_AGE,
        sameSite: 'lax'
    }
}));

// Adapter le cookie pour environnement iframe (SameSite=None; Secure en HTTPS)
app.use((req, res, next) => {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (req.session && req.session.cookie) {
        if (isHttps) {
            req.session.cookie.secure = true;
            req.session.cookie.sameSite = 'none';
        }
    }
    next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

function isUserAdmin(username, sectionData) {
    if (!username) return false;
    const clean = String(username).trim().toLowerCase();
    if (clean === 'mohamed' || clean === 'zohra') return true;
    const perms = sectionData?.teacherPermissions || {};
    const foundKey = Object.keys(perms).find(k => k.toLowerCase() === clean);
    if (foundKey && perms[foundKey] === 'admin') return true;
    return false;
}

function getTeacherPermissionsForUser(username, sectionData) {
    if (!username) return null;
    const clean = String(username).trim().toLowerCase();
    if (clean === 'mohamed' || clean === 'zohra') return 'admin';
    const perms = sectionData?.teacherPermissions || {};
    const foundKey = Object.keys(perms).find(k => k.toLowerCase() === clean);
    return foundKey ? perms[foundKey] : (perms[username] || null);
}

// Fonctions de gestion des sections
function getSectionData(section = 'boys') {
    const sec = (section === 'girls' || section === 'girls-section') ? 'girls' : 'boys';
    const storeSec = dbStorage[sec] || {};
    
    const fallbackAllowed = sec === 'girls' ? allowedTeachersGirls : allowedTeachersBoys;
    const fallbackPerms = sec === 'girls' ? teacherPermissionsGirls : teacherPermissionsBoys;
    const fallbackStudents = sec === 'girls' ? studentsByClassGirls : studentsByClassBoys;

    const allowedTeachers = storeSec.allowedTeachers ? storeSec.allowedTeachers : JSON.parse(JSON.stringify(fallbackAllowed || {}));
    const teacherPermissions = storeSec.teacherPermissions ? storeSec.teacherPermissions : JSON.parse(JSON.stringify(fallbackPerms || {}));
    const studentsByClass = storeSec.studentsByClass ? storeSec.studentsByClass : JSON.parse(JSON.stringify(fallbackStudents || {}));

    // Toujours garantir le mot de passe admin Mohamed
    allowedTeachers["Mohamed"] = "Med120786";
    teacherPermissions["Mohamed"] = "admin";
    if (sec === 'girls') {
        allowedTeachers["Zohra"] = "Zohra";
        teacherPermissions["Zohra"] = "admin";
    }

    const subjectsByClass = buildSubjectsByClass(teacherPermissions, studentsByClass);
    const allClasses = [...new Set([...Object.keys(studentsByClass), ...Object.keys(subjectsByClass)])].sort();
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

function buildSubjectsByClass(permissions, studentsByClass = {}) {
    const subjects = {};
    Object.keys(studentsByClass).forEach(c => {
        subjects[c] = new Set();
    });
    Object.values(permissions).forEach(perms => {
        if (perms === 'admin' || !Array.isArray(perms)) return;
        perms.forEach(p => {
            if (p.classes && Array.isArray(p.classes)) {
                p.classes.forEach(c => {
                    if (!subjects[c]) subjects[c] = new Set();
                    subjects[c].add(p.subject);
                });
            }
        });
    });
    for (const key in subjects) {
        subjects[key] = Array.from(subjects[key]).sort();
    }
    return subjects;
}

// Middleware de section
function sectionMiddleware(req, res, next) {
    const section = req.session?.section || req.headers['x-auth-section'] || req.query?.auth_section || 'boys';
    req.sectionData = getSectionData(section);
    next();
}

function normalizeNoteValue(val) {
    if (val === null || val === undefined || val === '') return null;
    const str = String(val).trim();
    if (str === '' || str === '0' || str === '0.0' || str === '0.00') return null;
    const num = parseFloat(str);
    if (isNaN(num)) return null;
    if (num === 0) return null;
    return str;
}

function normalizeNote(note) {
    const fields = ['travauxClasse', 'devoirs', 'evaluation', 'examen'];
    const normalized = { ...note };
    fields.forEach(f => {
        normalized[f] = normalizeNoteValue(note[f]);
    });
    return normalized;
}

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
    if (isUserAdmin(username, sectionData)) {
        return { classes: [...sectionData.allClasses], subjects: [...sectionData.allSubjects] };
    }
    const permissions = getTeacherPermissionsForUser(username, sectionData);
    if (permissions === 'admin') {
        return { classes: [...sectionData.allClasses], subjects: [...sectionData.allSubjects] };
    }
    if (!permissions || !Array.isArray(permissions)) return { classes: [], subjects: [] };

    let allowedClasses = new Set();
    let allowedSubjects = new Set();
    permissions.forEach(perm => {
        if (perm.subject) allowedSubjects.add(perm.subject);
        if (Array.isArray(perm.classes)) perm.classes.forEach(cls => allowedClasses.add(cls));
    });
    return {
        classes: Array.from(allowedClasses).sort(),
        subjects: Array.from(allowedSubjects).sort()
    };
}

function buildMongoQueryForUser(username, semester, teacherPermissions) {
    const baseQuery = { semester: semester };
    if (!username) return baseQuery;
    const cleanUser = String(username).trim().toLowerCase();
    if (cleanUser === 'mohamed' || cleanUser === 'zohra') return baseQuery;
    const foundKey = Object.keys(teacherPermissions || {}).find(k => k.toLowerCase() === cleanUser);
    const permissions = foundKey ? teacherPermissions[foundKey] : teacherPermissions[username];
    if (!permissions || permissions === 'admin') {
        return baseQuery;
    }
    const orConditions = permissions.flatMap(perm =>
        perm.classes.map(cls => ({ class: cls, subject: perm.subject }))
    );
    if (orConditions.length === 0) {
        return { _id: '000000000000000000000000' };
    }
    return { ...baseQuery, $or: orConditions };
}

async function checkUserPermissionAndSubjectExists(username, classToCheck, subjectToCheck, sectionData) {
    if (!username) return false;
    if (isUserAdmin(username, sectionData)) return true;
    const permissions = getTeacherPermissionsForUser(username, sectionData);
    if (permissions === 'admin') return true;
    if (!permissions || !Array.isArray(permissions)) return false;
    const cleanSub = String(subjectToCheck || '').trim().toLowerCase();
    const cleanCls = String(classToCheck || '').trim().toLowerCase();
    return permissions.some(p => {
        const pSub = String(p.subject || '').trim().toLowerCase();
        if (pSub !== cleanSub) return false;
        return Array.isArray(p.classes) && p.classes.some(c => String(c || '').trim().toLowerCase() === cleanCls);
    });
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
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

app.post('/login', (req, res) => {
    try {
        const { username, password, section } = req.body;
        const userSection = section === 'girls' ? 'girls' : 'boys';
        const sectionData = getSectionData(userSection);
        
        const cleanUsername = (username || '').trim();
        const cleanPassword = (password || '').trim();
        const allowed = sectionData.allowedTeachers || {};
        const foundUserKey = Object.keys(allowed).find(k => k.toLowerCase() === cleanUsername.toLowerCase());
        const matchedUser = foundUserKey || cleanUsername;
        
        const expectedPass = allowed[matchedUser];
        const isMatch = Boolean(expectedPass && (expectedPass === password || expectedPass === cleanPassword));
        
        if (isMatch) {
            if (!req.session) req.session = {};
            req.session.user = matchedUser;
            req.session.section = userSection;
            if (req.session.cookie) {
                req.session.cookie.maxAge = SESSION_MAX_AGE;
            }
            
            const sendSuccess = () => {
                console.log(`✅ Login successful for user: ${matchedUser} in section: ${userSection}`);
                res.status(200).json({ success: true, message: 'Connexion réussie' });
            };

            if (req.session && typeof req.session.save === 'function') {
                req.session.save(err => {
                    if (err) console.error("Session save error:", err);
                    sendSuccess();
                });
            } else {
                sendSuccess();
            }
        } else {
            console.log(`❌ Login failed for user: "${cleanUsername}" in section: ${userSection}`);
            res.status(401).json({ success: false, message: 'Login ou mot de passe incorrect' });
        }
    } catch (err) {
        console.error('❌ Login server error:', err);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

app.get('/logout', (req, res) => {
    const user = req.session?.user;
    req.session.destroy(err => {
        if (err) console.error("❌ Error destroying session:", err);
        console.log(`🚪 User ${user || 'unknown'} logged out.`);
        res.clearCookie('connect.sid');
        res.status(200).json({ success: true, message: 'Déconnexion réussie' });
    });
});

function requireAuth(req, res, next) {
    const authUser = req.headers['x-auth-user'] || req.query?.auth_user || (req.session && req.session.user);
    const authSection = req.headers['x-auth-section'] || req.query?.auth_section || (req.session && req.session.section) || 'boys';
    
    if (authUser) {
        if (!req.session) req.session = {};
        req.session.user = authUser;
        req.session.section = authSection;
        return next();
    }
    console.log(`🚫 User not authenticated trying to access ${req.path}`);
    res.status(401).json({ success: false, message: 'Non authentifié' });
}

app.get('/get-user', requireAuth, sectionMiddleware, (req, res) => {
    const username = req.session.user;
    const section = req.session.section || req.headers['x-auth-section'] || req.query?.auth_section || 'boys';
    const permissions = getTeacherPermissionsForUser(username, req.sectionData);
    const isAdminUser = isUserAdmin(username, req.sectionData);
    const assignments = (Array.isArray(permissions)) ? permissions : [];

    res.json({
        username: username,
        section: section,
        isAdmin: isAdminUser,
        assignments: assignments,
        permissions: getUserAllowedOptions(username, req.sectionData),
        subjectsByClass: req.sectionData.subjectsByClass,
        studentsByClass: req.sectionData.studentsByClass
    });
});

// Endpoint pour récupérer les attributions d'un enseignant et la liste de toutes les matières/classes
app.get('/api/teacher/assignments', requireAuth, sectionMiddleware, (req, res) => {
    const teacher = req.session.user;
    const section = req.session?.section || req.headers['x-auth-section'] || 'boys';
    const { permMap, studentsMap } = getAdminSectionMaps(section);
    
    const teacherPerms = permMap[teacher];
    const assignments = Array.isArray(teacherPerms) ? teacherPerms : [];
    const allClasses = Object.keys(studentsMap).sort();
    const allSubjects = [...new Set(req.sectionData.allSubjects)].sort();

    res.json({
        success: true,
        teacher,
        section,
        isAdmin: isUserAdmin(teacher, req.sectionData),
        assignments,
        allClasses,
        allSubjects
    });
});

// Endpoint pour qu'un enseignant ajoute/modifie lui-même une matière et des classes à son compte
app.post('/api/teacher/add-assignment', requireAuth, sectionMiddleware, (req, res) => {
    const teacher = req.session.user;
    const { subject, classes } = req.body;
    if (!subject || !subject.trim()) {
        return res.status(400).json({ success: false, message: 'Le nom de la matière est requis.' });
    }
    const cleanSubject = subject.trim();
    const classList = Array.isArray(classes) ? classes : String(classes || '').split(',').map(c => c.trim()).filter(Boolean);
    if (classList.length === 0) {
        return res.status(400).json({ success: false, message: 'Veuillez sélectionner au moins une classe pour cette matière.' });
    }

    const section = req.body.section || req.session?.section || req.headers['x-auth-section'] || 'boys';
    const { permMap, studentsMap } = getAdminSectionMaps(section);

    // S'assurer que les classes existent dans la structure
    classList.forEach(cls => {
        if (!studentsMap[cls]) studentsMap[cls] = [];
    });

    if (!permMap[teacher] || !Array.isArray(permMap[teacher])) {
        permMap[teacher] = [];
    }

    const existingIdx = permMap[teacher].findIndex(p => (p.subject || '').toLowerCase() === cleanSubject.toLowerCase());
    if (existingIdx !== -1) {
        const merged = [...new Set([...permMap[teacher][existingIdx].classes, ...classList])];
        permMap[teacher][existingIdx].classes = merged;
        permMap[teacher][existingIdx].subject = cleanSubject;
    } else {
        permMap[teacher].push({
            subject: cleanSubject,
            classes: classList
        });
    }

    saveDatabaseToDisk();
    console.log(`✅ Attribution ajoutée pour ${teacher} : ${cleanSubject} -> ${classList.join(', ')}`);

    const updatedSectionData = getSectionData(section);
    res.json({
        success: true,
        message: `La matière "${cleanSubject}" a été ajoutée à votre compte pour les classes : ${classList.join(', ')}.`,
        assignments: permMap[teacher],
        permissions: getUserAllowedOptions(teacher, updatedSectionData),
        subjectsByClass: updatedSectionData.subjectsByClass
    });
});

// Endpoint pour retirer une matière de ses attributions
app.post('/api/teacher/remove-assignment', requireAuth, sectionMiddleware, (req, res) => {
    const teacher = req.session.user;
    const { subject } = req.body;
    if (!subject) return res.status(400).json({ success: false, message: 'Matière requise.' });

    const section = req.body.section || req.session?.section || req.headers['x-auth-section'] || 'boys';
    const { permMap } = getAdminSectionMaps(section);

    if (Array.isArray(permMap[teacher])) {
        permMap[teacher] = permMap[teacher].filter(p => (p.subject || '').toLowerCase() !== subject.trim().toLowerCase());
    }

    saveDatabaseToDisk();
    const updatedSectionData = getSectionData(section);
    res.json({
        success: true,
        message: `Matière "${subject}" retirée de vos attributions.`,
        assignments: permMap[teacher] || [],
        permissions: getUserAllowedOptions(teacher, updatedSectionData),
        subjectsByClass: updatedSectionData.subjectsByClass
    });
});

// Endpoint pour récupérer les données du profil enseignant
app.get('/api/teacher/profile', requireAuth, sectionMiddleware, (req, res) => {
    const teacher = req.session.user;
    const section = req.session?.section || req.headers['x-auth-section'] || 'boys';
    const { allowedMap, permMap } = getAdminSectionMaps(section);

    res.json({
        success: true,
        username: teacher,
        section,
        isAdmin: isUserAdmin(teacher, req.sectionData),
        assignments: Array.isArray(permMap[teacher]) ? permMap[teacher] : []
    });
});

// Endpoint pour modifier son identifiant (login) et son mot de passe
app.post('/api/teacher/update-profile', requireAuth, sectionMiddleware, (req, res) => {
    const currentUsername = req.session.user;
    const { newUsername, newPassword } = req.body;

    const section = req.body.section || req.session?.section || req.headers['x-auth-section'] || 'boys';
    const { allowedMap, permMap, sec } = getAdminSectionMaps(section);

    let activeUser = currentUsername;

    // Mise à jour de l'identifiant (Login)
    if (newUsername && newUsername.trim() && newUsername.trim() !== currentUsername) {
        const cleanNew = newUsername.trim();
        const conflict = Object.keys(allowedMap).find(k => k.toLowerCase() === cleanNew.toLowerCase() && k.toLowerCase() !== currentUsername.toLowerCase());
        if (conflict) {
            return res.status(400).json({ success: false, message: `L'identifiant "${cleanNew}" est déjà utilisé par un autre compte.` });
        }

        const currentPass = allowedMap[currentUsername] || currentUsername;
        const currentPerms = permMap[currentUsername] || [];

        allowedMap[cleanNew] = (newPassword && newPassword.trim()) ? newPassword.trim() : currentPass;
        permMap[cleanNew] = currentPerms;

        delete allowedMap[currentUsername];
        delete permMap[currentUsername];

        // Mettre à jour l'auteur dans les notes existantes
        inMemoryNotes.forEach(n => {
            if (n.teacher === currentUsername && (n.section || 'boys') === sec) {
                n.teacher = cleanNew;
            }
        });

        req.session.user = cleanNew;
        activeUser = cleanNew;
    } else if (newPassword && newPassword.trim()) {
        allowedMap[activeUser] = newPassword.trim();
    }

    saveDatabaseToDisk();
    console.log(`✅ Profil mis à jour pour ${currentUsername} -> ${activeUser}`);

    res.json({
        success: true,
        message: 'Vos identifiants ont été mis à jour avec succès.',
        username: activeUser
    });
});

app.get('/all-notes', requireAuth, sectionMiddleware, async (req, res) => {
    await connectToDatabase();
    const { semester } = req.query;
    const username = req.session.user;
    const section = req.session.section || req.headers['x-auth-section'] || 'boys';
    if (!semester || !['S1', 'S2'].includes(semester)) {
        return res.status(400).json({ error: 'Le paramètre semester (S1 ou S2) est requis.' });
    }
    try {
        const permissions = getTeacherPermissionsForUser(username, req.sectionData);
        const isAdminUser = isUserAdmin(username, req.sectionData);

        const filtered = inMemoryNotes.filter(n => {
            if (n.semester !== semester) return false;
            const noteSec = n.section || 'boys';
            if (noteSec !== section) return false;

            if (!isAdminUser && Array.isArray(permissions)) {
                const canView = permissions.some(p =>
                    (p.subject || '').trim().toLowerCase() === (n.subject || '').trim().toLowerCase() &&
                    Array.isArray(p.classes) && p.classes.some(c => (c || '').trim().toLowerCase() === (n.class || '').trim().toLowerCase())
                );
                if (!canView) return false;
            }
            return true;
        });

        const notes = filtered.map(normalizeNote);
        console.log(`📊 Fetched ${notes.length} notes for user ${username} in section: ${section}, semester: ${semester}`);
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
    const section = req.body.section || req.session.section || req.headers['x-auth-section'] || 'boys';

    if (!await checkUserPermissionAndSubjectExists(teacher, studentClass, subject, req.sectionData)) {
        const { permMap, studentsMap } = getAdminSectionMaps(section);
        if (!studentsMap[studentClass]) studentsMap[studentClass] = [];
        if (!permMap[teacher] || !Array.isArray(permMap[teacher])) permMap[teacher] = [];
        const exIdx = permMap[teacher].findIndex(p => (p.subject || '').toLowerCase() === String(subject).trim().toLowerCase());
        if (exIdx !== -1) {
            if (!permMap[teacher][exIdx].classes.includes(studentClass)) {
                permMap[teacher][exIdx].classes.push(studentClass);
            }
        } else {
            permMap[teacher].push({ subject: String(subject).trim(), classes: [studentClass] });
        }
        saveDatabaseToDisk();
        req.sectionData = getSectionData(section);
    }
    try {
        const cleanTc = (travauxClasse === '' || travauxClasse === null || travauxClasse === undefined) ? null : String(travauxClasse);
        const cleanDev = (devoirs === '' || devoirs === null || devoirs === undefined) ? null : String(devoirs);
        const cleanEva = (evaluation === '' || evaluation === null || evaluation === undefined) ? null : String(evaluation);
        const cleanExam = (examen === '' || examen === null || examen === undefined) ? null : String(examen);

        const existingIdx = inMemoryNotes.findIndex(n =>
            n.class === studentClass &&
            n.subject === subject &&
            n.studentName === studentName &&
            n.semester === semester &&
            (n.section || 'boys') === section
        );

        if (existingIdx !== -1) {
            inMemoryNotes[existingIdx] = {
                ...inMemoryNotes[existingIdx],
                travauxClasse: cleanTc,
                devoirs: cleanDev,
                evaluation: cleanEva,
                examen: cleanExam,
                teacher,
                updatedAt: new Date()
            };
            saveDatabaseToDisk();
            console.log(`✅ Note updated for ${studentName} (${studentClass} - ${subject}) in ${section}`);
            return res.status(200).json({ success: true, message: 'Note mise à jour avec succès', note: inMemoryNotes[existingIdx] });
        }

        const newNote = {
            _id: String(noteIdCounter++),
            class: studentClass,
            subject,
            studentName,
            semester,
            section,
            travauxClasse: cleanTc,
            devoirs: cleanDev,
            evaluation: cleanEva,
            examen: cleanExam,
            teacher,
            approvedByAdmin: false,
            enteredInSystem: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        inMemoryNotes.push(newNote);
        saveDatabaseToDisk();
        console.log(`✅ Note created for ${studentName} (${studentClass} - ${subject}) in ${section}`);
        res.status(200).json({ success: true, message: 'Note enregistrée avec succès', note: newNote });
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
    const section = req.body.section || req.session.section || req.headers['x-auth-section'] || 'boys';

    try {
        let noteToUpdate = (id && id !== 'null' && id !== 'undefined') ? await SafeNote.findById(id) : null;
        
        // If not found by ID, look up by class, subject, studentName, semester
        if (!noteToUpdate && updatedData.class && updatedData.subject && updatedData.studentName && updatedData.semester) {
            noteToUpdate = inMemoryNotes.find(n => 
                n.class === updatedData.class &&
                n.subject === updatedData.subject &&
                n.studentName === updatedData.studentName &&
                n.semester === updatedData.semester &&
                (n.section || 'boys') === section
            );
        }

        const studentClass = noteToUpdate ? noteToUpdate.class : updatedData.class;
        const subject = noteToUpdate ? noteToUpdate.subject : updatedData.subject;

        if (studentClass && subject) {
            if (!await checkUserPermissionAndSubjectExists(teacher, studentClass, subject, req.sectionData)) {
                const { permMap, studentsMap } = getAdminSectionMaps(section);
                if (!studentsMap[studentClass]) studentsMap[studentClass] = [];
                if (!permMap[teacher] || !Array.isArray(permMap[teacher])) permMap[teacher] = [];
                const exIdx = permMap[teacher].findIndex(p => (p.subject || '').toLowerCase() === String(subject).trim().toLowerCase());
                if (exIdx !== -1) {
                    if (!permMap[teacher][exIdx].classes.includes(studentClass)) {
                        permMap[teacher][exIdx].classes.push(studentClass);
                    }
                } else {
                    permMap[teacher].push({ subject: String(subject).trim(), classes: [studentClass] });
                }
                saveDatabaseToDisk();
                req.sectionData = getSectionData(section);
            }
        }

        const cleanData = {};
        ['travauxClasse', 'devoirs', 'evaluation', 'examen'].forEach(field => {
            if (updatedData.hasOwnProperty(field)) {
                const value = updatedData[field];
                if (value === '' || value === null || value === undefined) {
                    cleanData[field] = null;
                } else {
                    cleanData[field] = String(value);
                }
            }
        });
        
        if (updatedData.hasOwnProperty('enteredInSystem')) {
            cleanData.enteredInSystem = Boolean(updatedData.enteredInSystem);
        }
        
        const permissions = getTeacherPermissionsForUser(teacher, req.sectionData);
        const isAdminUser = isUserAdmin(teacher, req.sectionData);
        if (isAdminUser && updatedData.hasOwnProperty('approvedByAdmin')) {
            cleanData.approvedByAdmin = Boolean(updatedData.approvedByAdmin);
        }
        
        cleanData.teacher = teacher;
        cleanData.updatedAt = new Date();

        if (noteToUpdate) {
            const updated = await SafeNote.findByIdAndUpdate(noteToUpdate._id, cleanData, { new: true });
            saveDatabaseToDisk();
            return res.status(200).json({ success: true, message: '✅ Note mise à jour avec succès.', note: updated });
        } else if (updatedData.class && updatedData.subject && updatedData.studentName && updatedData.semester) {
            const newNote = {
                _id: String(noteIdCounter++),
                class: updatedData.class,
                subject: updatedData.subject,
                studentName: updatedData.studentName,
                semester: updatedData.semester,
                section: section,
                travauxClasse: cleanData.travauxClasse ?? null,
                devoirs: cleanData.devoirs ?? null,
                evaluation: cleanData.evaluation ?? null,
                examen: cleanData.examen ?? null,
                teacher,
                approvedByAdmin: cleanData.approvedByAdmin ?? false,
                enteredInSystem: cleanData.enteredInSystem ?? false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            inMemoryNotes.push(newNote);
            saveDatabaseToDisk();
            return res.status(200).json({ success: true, message: '✅ Note enregistrée avec succès.', note: newNote });
        }

        return res.status(404).json({ success: false, message: '❌ Note non trouvée.' });
    } catch (error) {
        console.error('Error updating note:', error);
        res.status(500).json({ success: false, message: '❌ Erreur serveur lors de la mise à jour.' });
    }
});

app.post('/api/save-note-auto', requireAuth, sectionMiddleware, async (req, res) => {
    await connectToDatabase();
    try {
        const { id, class: studentClass, subject, studentName, semester, field, value } = req.body;
        const teacher = req.session.user;
        const section = req.body.section || req.session.section || req.headers['x-auth-section'] || 'boys';

        if (!studentClass || !subject || !studentName || !semester) {
            return res.status(400).json({ success: false, message: 'Paramètres manquants (classe, matière, élève, semestre).' });
        }

        if (!await checkUserPermissionAndSubjectExists(teacher, studentClass, subject, req.sectionData)) {
            const { permMap, studentsMap } = getAdminSectionMaps(section);
            if (!studentsMap[studentClass]) studentsMap[studentClass] = [];
            if (!permMap[teacher] || !Array.isArray(permMap[teacher])) permMap[teacher] = [];
            const exIdx = permMap[teacher].findIndex(p => (p.subject || '').toLowerCase() === String(subject).trim().toLowerCase());
            if (exIdx !== -1) {
                if (!permMap[teacher][exIdx].classes.includes(studentClass)) {
                    permMap[teacher][exIdx].classes.push(studentClass);
                }
            } else {
                permMap[teacher].push({ subject: String(subject).trim(), classes: [studentClass] });
            }
            saveDatabaseToDisk();
            req.sectionData = getSectionData(section);
        }

        let note = null;
        if (id && id !== 'null' && id !== 'undefined') {
            note = inMemoryNotes.find(n => String(n._id) === String(id));
        }
        if (!note) {
            note = inMemoryNotes.find(n => 
                n.class === studentClass &&
                String(n.subject || '').trim().toLowerCase() === String(subject || '').trim().toLowerCase() &&
                String(n.studentName || '').trim().toLowerCase() === String(studentName || '').trim().toLowerCase() &&
                n.semester === semester &&
                (n.section || 'boys') === section
            );
        }

        const permissions = getTeacherPermissionsForUser(teacher, req.sectionData);
        const isAdminUser = isUserAdmin(teacher, req.sectionData);

        if (note) {
            if (field) {
                if (['travauxClasse', 'devoirs', 'evaluation', 'examen'].includes(field)) {
                    note[field] = (value === '' || value === null || value === undefined) ? null : String(value);
                } else if (field === 'enteredInSystem') {
                    note.enteredInSystem = Boolean(value);
                } else if (field === 'approvedByAdmin' && isAdminUser) {
                    note.approvedByAdmin = Boolean(value);
                }
            } else {
                ['travauxClasse', 'devoirs', 'evaluation', 'examen'].forEach(f => {
                    if (req.body.hasOwnProperty(f)) {
                        const val = req.body[f];
                        note[f] = (val === '' || val === null || val === undefined) ? null : String(val);
                    }
                });
                if (req.body.hasOwnProperty('enteredInSystem')) {
                    note.enteredInSystem = Boolean(req.body.enteredInSystem);
                }
                if (req.body.hasOwnProperty('approvedByAdmin') && isAdminUser) {
                    note.approvedByAdmin = Boolean(req.body.approvedByAdmin);
                }
            }
            note.teacher = teacher;
            note.updatedAt = new Date();
            saveDatabaseToDisk();
            console.log(`💾 Auto-saved note ${note._id} for ${studentName} (${studentClass} - ${subject})`);
            return res.status(200).json({ success: true, message: 'Note mise à jour dans la base de données', note });
        } else {
            const cleanTc = (req.body.travauxClasse === '' || req.body.travauxClasse === null || req.body.travauxClasse === undefined) ? null : String(req.body.travauxClasse);
            const cleanDev = (req.body.devoirs === '' || req.body.devoirs === null || req.body.devoirs === undefined) ? null : String(req.body.devoirs);
            const cleanEva = (req.body.evaluation === '' || req.body.evaluation === null || req.body.evaluation === undefined) ? null : String(req.body.evaluation);
            const cleanExam = (req.body.examen === '' || req.body.examen === null || req.body.examen === undefined) ? null : String(req.body.examen);

            const newNote = {
                _id: String(noteIdCounter++),
                class: studentClass,
                subject,
                studentName,
                semester,
                section,
                travauxClasse: cleanTc,
                devoirs: cleanDev,
                evaluation: cleanEva,
                examen: cleanExam,
                teacher,
                approvedByAdmin: (isAdminUser && req.body.approvedByAdmin) ? true : false,
                enteredInSystem: req.body.enteredInSystem ? true : false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            if (field) {
                if (['travauxClasse', 'devoirs', 'evaluation', 'examen'].includes(field)) {
                    newNote[field] = (value === '' || value === null || value === undefined) ? null : String(value);
                } else if (field === 'enteredInSystem') {
                    newNote.enteredInSystem = Boolean(value);
                } else if (field === 'approvedByAdmin' && isAdminUser) {
                    newNote.approvedByAdmin = Boolean(value);
                }
            }

            inMemoryNotes.push(newNote);
            saveDatabaseToDisk();
            console.log(`💾 Created & saved new note ${newNote._id} for ${studentName} (${studentClass} - ${subject})`);
            return res.status(200).json({ success: true, message: 'Note créée et enregistrée dans la base de données', note: newNote });
        }
    } catch (err) {
        console.error('Error in save-note-auto:', err);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la sauvegarde.' });
    }
});

app.post('/api/save-notes-batch', requireAuth, sectionMiddleware, async (req, res) => {
    await connectToDatabase();
    try {
        const { notes } = req.body;
        if (!Array.isArray(notes)) {
            return res.status(400).json({ success: false, message: 'Tableau de notes requis.' });
        }
        const teacher = req.session.user;
        const section = req.body.section || req.session?.section || req.headers['x-auth-section'] || 'boys';
        const permissions = getTeacherPermissionsForUser(teacher, req.sectionData);
        const isAdminUser = isUserAdmin(teacher, req.sectionData);

        let savedCount = 0;
        const results = [];

        for (const item of notes) {
            const { class: studentClass, subject, studentName, semester } = item;
            if (!studentClass || !subject || !studentName || !semester) continue;

            if (!await checkUserPermissionAndSubjectExists(teacher, studentClass, subject, req.sectionData)) {
                continue;
            }

            let existing = null;
            if (item.id && item.id !== 'null') {
                existing = inMemoryNotes.find(n => String(n._id) === String(item.id));
            }
            if (!existing) {
                existing = inMemoryNotes.find(n => 
                    n.class === studentClass &&
                    n.subject === subject &&
                    n.studentName === studentName &&
                    n.semester === semester &&
                    (n.section || 'boys') === section
                );
            }

            const cleanTc = (item.travauxClasse === '' || item.travauxClasse === null || item.travauxClasse === undefined) ? null : String(item.travauxClasse);
            const cleanDev = (item.devoirs === '' || item.devoirs === null || item.devoirs === undefined) ? null : String(item.devoirs);
            const cleanEva = (item.evaluation === '' || item.evaluation === null || item.evaluation === undefined) ? null : String(item.evaluation);
            const cleanExam = (item.examen === '' || item.examen === null || item.examen === undefined) ? null : String(item.examen);

            if (existing) {
                if (cleanTc !== null) existing.travauxClasse = cleanTc;
                if (cleanDev !== null) existing.devoirs = cleanDev;
                if (cleanEva !== null) existing.evaluation = cleanEva;
                if (cleanExam !== null) existing.examen = cleanExam;
                if (item.hasOwnProperty('enteredInSystem')) existing.enteredInSystem = Boolean(item.enteredInSystem);
                if (item.hasOwnProperty('approvedByAdmin') && isAdminUser) existing.approvedByAdmin = Boolean(item.approvedByAdmin);
                existing.teacher = teacher;
                existing.updatedAt = new Date();
                results.push(existing);
            } else {
                const newNote = {
                    _id: String(noteIdCounter++),
                    class: studentClass,
                    subject,
                    studentName,
                    semester,
                    section,
                    travauxClasse: cleanTc,
                    devoirs: cleanDev,
                    evaluation: cleanEva,
                    examen: cleanExam,
                    teacher,
                    approvedByAdmin: (isAdminUser && item.approvedByAdmin) ? true : false,
                    enteredInSystem: item.enteredInSystem ? true : false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                inMemoryNotes.push(newNote);
                results.push(newNote);
            }
            savedCount++;
        }

        saveDatabaseToDisk();
        console.log(`💾 Batch saved ${savedCount} notes to disk.`);
        res.status(200).json({ success: true, count: savedCount, notes: results });
    } catch (err) {
        console.error('Error in batch save:', err);
        res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde groupée.' });
    }
});

app.delete('/delete-note/:id', requireAuth, sectionMiddleware, async (req, res) => {
    await connectToDatabase();
    const { id } = req.params;
    const teacher = req.session.user;
    try {
        const noteToDelete = await SafeNote.findById(id);
        if (!noteToDelete) return res.status(404).send("❌ Note non trouvée.");
        if (!await checkUserPermissionAndSubjectExists(teacher, noteToDelete.class, noteToDelete.subject, req.sectionData)) {
            return res.status(403).send('❌ Permission refusée.');
        }
        await SafeNote.findByIdAndDelete(id);
        res.status(200).send("✅ Note supprimée.");
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).send("❌ Erreur serveur lors de la suppression.");
    }
});

// Générateur de template docx de secours si le téléchargement distant échoue
function getFallbackDocxTemplate() {
    const fallbackZip = new JSZip();
    fallbackZip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

    fallbackZip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    fallbackZip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Classe: {className} - Semestre: {semesterDisplay}</w:t></w:p>
    {#subjects}
    <w:p><w:r><w:t>Matière: {subjectName} (Enseignant: {assignedTeacher})</w:t></w:p>
    {#students}
    <w:p><w:r><w:t>{studentName} | TC: {travauxClasse} | Dev: {devoirs} | Eval: {evaluation} | Exam: {examen} | Total: {total}</w:t></w:p>
    {/students}
    {/subjects}
    <w:sectPr/>
  </w:body>
</w:document>`);

    return fallbackZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

app.post('/generate-word', requireAuth, sectionMiddleware, async (req, res) => {
    await connectToDatabase();
    const { semester } = req.body;
    const username = req.session.user;
    const section = req.session.section || 'boys';
    try {
        const query = buildMongoQueryForUser(username, semester, req.sectionData.teacherPermissions);
        if (section === 'boys') {
            query.$or = [{ section: 'boys' }, { section: { $exists: false } }, { section: null }];
        } else {
            query.section = 'girls';
        }
        query.approvedByAdmin = { $ne: true };
        const noteResult = SafeNote.find(query);
        const rawNotes = typeof noteResult.lean === 'function' ? await noteResult.lean() : await noteResult;
        const notes = rawNotes.map(normalizeNote);
        if (notes.length === 0) return res.status(404).send(`❌ Aucune donnée non approuvée pour le semestre ${semester}.`);
        
        const templateURL = 'https://docs.google.com/document/d/1AyBNXpuAddW0_-6rT6oQ0m0DMbNg2KHv/export?format=docx';
        let templateContent;
        try {
            const response = await axios.get(templateURL, { responseType: 'arraybuffer', timeout: 5000 });
            templateContent = response.data;
            // Valider que c'est un zip valide
            new PizZip(templateContent);
        } catch (e) {
            templateContent = getFallbackDocxTemplate();
        }

        const zip = new JSZip();
        const allowedOptions = getUserAllowedOptions(username, req.sectionData);
        
        const notesByClass = notes.reduce((acc, note) => {
            if (allowedOptions.classes.includes(note.class)) {
                (acc[note.class] = acc[note.class] || []).push(note);
            }
            return acc;
        }, {});

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
        
        const getSubjectOrder = (subjectName) => {
            const entries = Object.entries(subjectOrderMap);
            for (let i = 0; i < entries.length; i++) {
                const [key, variants] = entries[i];
                if (variants.some(v => subjectName.toLowerCase() === v.toLowerCase() || 
                                       subjectName.toLowerCase().includes(v.toLowerCase()))) {
                    return i;
                }
            }
            return 999;
        };

        for (const className in notesByClass) {
            const classStudentList = req.sectionData.studentsByClass[className] || [];
            if (classStudentList.length === 0) continue;

            let doc;
            try {
                doc = new Docxtemplater(new PizZip(templateContent), { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
            } catch (err) {
                templateContent = getFallbackDocxTemplate();
                doc = new Docxtemplater(new PizZip(templateContent), { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
            }

            const uniqueSubjectsInClassNotes = [...new Set(notesByClass[className].map(n => n.subject))];
            const subjectsToInclude = (req.sectionData.subjectsByClass[className] || [])
                .filter(s => allowedOptions.subjects.includes(s) && uniqueSubjectsInClassNotes.includes(s));

            if (subjectsToInclude.length === 0) continue;

            const sortedSubjects = subjectsToInclude.sort((a, b) => {
                const orderA = getSubjectOrder(a);
                const orderB = getSubjectOrder(b);
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
        if (section === 'boys') {
            query.$or = [{ section: 'boys' }, { section: { $exists: false } }, { section: null }];
        } else {
            query.section = 'girls';
        }
        query.approvedByAdmin = { $ne: true };
        const noteResult = SafeNote.find(query);
        const rawNotesExcel = typeof noteResult.lean === 'function' ? await noteResult.lean() : await noteResult;
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

app.post('/migrate-old-notes', requireAuth, async (req, res) => {
    await connectToDatabase();
    try {
        const result = await SafeNote.updateMany(
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
        res.status(500).json({ json: false, message: 'Erreur lors de la migration' });
    }
});

app.get('/stats-notes', requireAuth, sectionMiddleware, async (req, res) => {
    await connectToDatabase();
    try {
        const totalNotes = await SafeNote.countDocuments({});
        const boysNotes = await SafeNote.countDocuments({ section: 'boys' });
        const girlsNotes = await SafeNote.countDocuments({ section: 'girls' });
        const noSectionNotes = await SafeNote.countDocuments({ 
            $or: [{ section: { $exists: false } }, { section: null }] 
        });
        
        const sampleResult = SafeNote.find({});
        const rawSamples = typeof sampleResult.lean === 'function' ? await sampleResult.lean() : await sampleResult;
        const sampleNotes = rawSamples.slice(0, 5);
        
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

// Admin management endpoints for classes, students, and teachers
function getAdminSectionMaps(section) {
    const sec = (section === 'girls' || section === 'girls-section') ? 'girls' : 'boys';
    if (!dbStorage[sec]) dbStorage[sec] = {};
    if (!dbStorage[sec].studentsByClass) {
        dbStorage[sec].studentsByClass = JSON.parse(JSON.stringify(sec === 'girls' ? studentsByClassGirls : studentsByClassBoys));
    }
    if (!dbStorage[sec].teacherPermissions) {
        dbStorage[sec].teacherPermissions = JSON.parse(JSON.stringify(sec === 'girls' ? teacherPermissionsGirls : teacherPermissionsBoys));
    }
    if (!dbStorage[sec].allowedTeachers) {
        dbStorage[sec].allowedTeachers = JSON.parse(JSON.stringify(sec === 'girls' ? allowedTeachersGirls : allowedTeachersBoys));
    }

    // Always guarantee Mohamed admin credentials
    dbStorage[sec].allowedTeachers["Mohamed"] = "Med120786";
    dbStorage[sec].teacherPermissions["Mohamed"] = "admin";
    if (sec === 'girls') {
        dbStorage[sec].allowedTeachers["Zohra"] = "Zohra";
        dbStorage[sec].teacherPermissions["Zohra"] = "admin";
    }

    return {
        sec,
        studentsMap: dbStorage[sec].studentsByClass,
        permMap: dbStorage[sec].teacherPermissions,
        allowedMap: dbStorage[sec].allowedTeachers
    };
}

app.post('/admin/add-class', requireAuth, sectionMiddleware, (req, res) => {
    const teacher = req.session.user;
    if (!isUserAdmin(teacher, req.sectionData)) {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    const { className } = req.body;
    if (!className || !className.trim()) return res.status(400).json({ success: false, message: 'Nom de classe requis.' });
    const trimmed = className.trim();
    
    const section = req.body.section || req.session?.section || req.headers['x-auth-section'] || 'boys';
    const { studentsMap } = getAdminSectionMaps(section);
    if (!studentsMap[trimmed]) {
        studentsMap[trimmed] = [];
    }
    saveDatabaseToDisk();
    res.json({ success: true, message: `Classe "${trimmed}" ajoutée avec succès.` });
});

app.post('/admin/update-class', requireAuth, sectionMiddleware, (req, res) => {
    const teacher = req.session.user;
    if (!isUserAdmin(teacher, req.sectionData)) {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    const { oldClassName, newClassName } = req.body;
    if (!oldClassName || !newClassName || !newClassName.trim()) {
        return res.status(400).json({ success: false, message: 'Ancien et nouveau noms requis.' });
    }
    const trimmedNew = newClassName.trim();
    const section = req.body.section || req.session?.section || req.headers['x-auth-section'] || 'boys';
    const { studentsMap, permMap } = getAdminSectionMaps(section);
    
    if (studentsMap[oldClassName]) {
        studentsMap[trimmedNew] = studentsMap[oldClassName];
        delete studentsMap[oldClassName];
    } else {
        studentsMap[trimmedNew] = [];
    }

    // Update teacher permissions mapping for this class
    Object.values(permMap).forEach(perms => {
        if (Array.isArray(perms)) {
            perms.forEach(p => {
                if (p.classes) {
                    p.classes = p.classes.map(c => c === oldClassName ? trimmedNew : c);
                }
            });
        }
    });

    // Update existing notes for this class in memory
    inMemoryNotes.forEach(n => {
        if (n.class === oldClassName && (n.section || 'boys') === section) {
            n.class = trimmedNew;
        }
    });
    saveDatabaseToDisk();

    res.json({ success: true, message: `Classe renommée en "${trimmedNew}".` });
});

app.post('/admin/delete-class', requireAuth, sectionMiddleware, (req, res) => {
    const teacher = req.session.user;
    if (!isUserAdmin(teacher, req.sectionData)) {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    const { className } = req.body;
    if (!className) return res.status(400).json({ success: false, message: 'Nom de classe requis.' });
    
    const section = req.body.section || req.session?.section || req.headers['x-auth-section'] || 'boys';
    const { studentsMap, permMap } = getAdminSectionMaps(section);
    
    delete studentsMap[className];

    // Remove class from teacher permissions
    Object.values(permMap).forEach(perms => {
        if (Array.isArray(perms)) {
            perms.forEach(p => {
                if (p.classes) {
                    p.classes = p.classes.filter(c => c !== className);
                }
            });
        }
    });
    saveDatabaseToDisk();

    res.json({ success: true, message: `Classe "${className}" et ses élèves ont été supprimés.` });
});

app.post('/admin/add-student', requireAuth, sectionMiddleware, (req, res) => {
    const teacher = req.session.user;
    if (!isUserAdmin(teacher, req.sectionData)) {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    const { className, studentName } = req.body;
    if (!className || !studentName || !studentName.trim()) {
        return res.status(400).json({ success: false, message: 'Classe et nom d\'élève requis.' });
    }
    const trimmed = studentName.trim();
    const section = req.body.section || req.session?.section || req.headers['x-auth-section'] || 'boys';
    const { studentsMap } = getAdminSectionMaps(section);
    if (!studentsMap[className]) {
        studentsMap[className] = [];
    }
    if (!studentsMap[className].includes(trimmed)) {
        studentsMap[className].push(trimmed);
        studentsMap[className].sort();
    }
    saveDatabaseToDisk();
    res.json({ success: true, message: `Élève "${trimmed}" ajouté à la classe ${className}.` });
});

app.post('/admin/update-student', requireAuth, sectionMiddleware, (req, res) => {
    const teacher = req.session.user;
    if (!isUserAdmin(teacher, req.sectionData)) {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    const { className, oldName, newName, targetClass } = req.body;
    if (!className || !oldName || !newName || !newName.trim()) {
        return res.status(400).json({ success: false, message: 'Informations incomplètes.' });
    }
    const trimmedNew = newName.trim();
    const destClass = (targetClass && targetClass.trim()) ? targetClass.trim() : className;
    
    const section = req.body.section || req.session?.section || req.headers['x-auth-section'] || 'boys';
    const { studentsMap } = getAdminSectionMaps(section);
    
    if (destClass === className) {
        if (studentsMap[className]) {
            const idx = studentsMap[className].indexOf(oldName);
            if (idx !== -1) {
                studentsMap[className][idx] = trimmedNew;
                studentsMap[className].sort();
            }
        }
    } else {
        if (studentsMap[className]) {
            studentsMap[className] = studentsMap[className].filter(s => s !== oldName);
        }
        if (!studentsMap[destClass]) studentsMap[destClass] = [];
        if (!studentsMap[destClass].includes(trimmedNew)) {
            studentsMap[destClass].push(trimmedNew);
            studentsMap[destClass].sort();
        }
    }

    // Update notes for this student
    inMemoryNotes.forEach(n => {
        if (n.studentName === oldName && (n.section || 'boys') === section) {
            n.studentName = trimmedNew;
            if (destClass !== className && n.class === className) {
                n.class = destClass;
            }
        }
    });
    saveDatabaseToDisk();

    res.json({ success: true, message: `Élève mis à jour avec succès.` });
});

app.post('/admin/delete-student', requireAuth, sectionMiddleware, (req, res) => {
    const teacher = req.session.user;
    if (!isUserAdmin(teacher, req.sectionData)) {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    const { className, studentName } = req.body;
    const section = req.body.section || req.session?.section || req.headers['x-auth-section'] || 'boys';
    const { studentsMap } = getAdminSectionMaps(section);
    if (studentsMap[className]) {
        studentsMap[className] = studentsMap[className].filter(s => s !== studentName);
    }
    saveDatabaseToDisk();
    res.json({ success: true, message: `Élève "${studentName}" supprimé de ${className}.` });
});

const handleSaveTeacher = (req, res) => {
    const adminUser = req.session.user;
    if (!isUserAdmin(adminUser, req.sectionData)) {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    const { oldTeacherName, teacherName, password, subject, classes, assignments } = req.body;
    if (!teacherName || (!subject && !assignments)) {
        return res.status(400).json({ success: false, message: 'Nom et matière(s) requis.' });
    }
    const section = req.body.section || req.session?.section || req.headers['x-auth-section'] || 'boys';
    const { permMap, allowedMap } = getAdminSectionMaps(section);
    
    const trimmedName = teacherName.trim();
    
    if (oldTeacherName && oldTeacherName !== trimmedName) {
        delete permMap[oldTeacherName];
        delete allowedMap[oldTeacherName];
    }
    
    allowedMap[trimmedName] = (password && password.trim()) ? password.trim() : (allowedMap[trimmedName] || trimmedName);
    
    if (!permMap[trimmedName] || permMap[trimmedName] === 'admin') {
        permMap[trimmedName] = [];
    }
    
    if (Array.isArray(assignments)) {
        permMap[trimmedName] = assignments.map(a => ({
            subject: String(a.subject || '').trim(),
            classes: Array.isArray(a.classes) ? a.classes : String(a.classes || '').split(',').map(c => c.trim()).filter(Boolean)
        })).filter(a => a.subject && a.classes.length > 0);
    } else if (subject && classes) {
        const subList = String(subject).split(',').map(s => s.trim()).filter(Boolean);
        const classList = Array.isArray(classes) ? classes : String(classes).split(',').map(c => c.trim()).filter(Boolean);
        
        if (oldTeacherName || req.body.replaceAssignments) {
            permMap[trimmedName] = subList.map(sub => ({ subject: sub, classes: classList }));
        } else {
            subList.forEach(sub => {
                const existingIdx = permMap[trimmedName].findIndex(p => p.subject.toLowerCase() === sub.toLowerCase());
                if (existingIdx !== -1) {
                    permMap[trimmedName][existingIdx] = { subject: sub, classes: classList };
                } else {
                    permMap[trimmedName].push({ subject: sub, classes: classList });
                }
            });
        }
    }
    saveDatabaseToDisk();
    
    res.json({ success: true, message: `Enseignant "${trimmedName}" enregistré avec succès.` });
};

app.post('/admin/add-teacher', requireAuth, sectionMiddleware, handleSaveTeacher);
app.post('/admin/save-teacher', requireAuth, sectionMiddleware, handleSaveTeacher);

app.post('/admin/delete-teacher', requireAuth, sectionMiddleware, (req, res) => {
    const user = req.session.user;
    if (!isUserAdmin(user, req.sectionData)) {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    const { teacherName } = req.body;
    if (!teacherName) return res.status(400).json({ success: false, message: 'Nom d\'enseignant requis.' });

    const section = req.body.section || req.session?.section || req.headers['x-auth-section'] || 'boys';
    const { permMap, allowedMap } = getAdminSectionMaps(section);

    if (permMap[teacherName] === 'admin' || teacherName === 'Mohamed' || teacherName === 'Zohra') {
        return res.status(400).json({ success: false, message: 'Impossible de supprimer un compte administrateur racine.' });
    }

    delete permMap[teacherName];
    delete allowedMap[teacherName];
    saveDatabaseToDisk();

    res.json({ success: true, message: `Enseignant "${teacherName}" supprimé avec succès.` });
});

app.get('/admin/get-teachers', requireAuth, sectionMiddleware, (req, res) => {
    const user = req.session.user;
    if (!isUserAdmin(user, req.sectionData)) {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    const section = req.session?.section || req.headers['x-auth-section'] || 'boys';
    const { permMap, allowedMap } = getAdminSectionMaps(section);
    
    const list = Object.entries(permMap).map(([name, perms]) => ({
        name,
        isAdmin: perms === 'admin',
        assignments: Array.isArray(perms) ? perms : [],
        password: allowedMap[name] || name
    }));

    res.json({ success: true, teachers: list });
});

app.post('/api/sync-data', requireAuth, sectionMiddleware, (req, res) => {
    const user = req.session.user;
    const isAdminUser = isUserAdmin(user, req.sectionData);
    const { section, studentsByClass, teacherPermissions, allowedTeachers, notes } = req.body;
    const sec = (section === 'girls' || section === 'girls-section') ? 'girls' : 'boys';
    if (!dbStorage[sec]) dbStorage[sec] = {};

    if (isAdminUser) {
        if (studentsByClass && typeof studentsByClass === 'object') {
            dbStorage[sec].studentsByClass = studentsByClass;
        }
        if (teacherPermissions && typeof teacherPermissions === 'object') {
            dbStorage[sec].teacherPermissions = teacherPermissions;
            dbStorage[sec].teacherPermissions["Mohamed"] = "admin";
            if (sec === 'girls') dbStorage[sec].teacherPermissions["Zohra"] = "admin";
        }
        if (allowedTeachers && typeof allowedTeachers === 'object') {
            dbStorage[sec].allowedTeachers = { ...(dbStorage[sec].allowedTeachers || {}), ...allowedTeachers };
            dbStorage[sec].allowedTeachers["Mohamed"] = "Med120786";
            if (sec === 'girls') dbStorage[sec].allowedTeachers["Zohra"] = "Zohra";
        }
    }
    if (Array.isArray(notes)) {
        notes.forEach(incoming => {
            if (!incoming.class || !incoming.subject || !incoming.studentName) return;
            const idx = inMemoryNotes.findIndex(n => 
                n.class === incoming.class &&
                String(n.subject || '').trim().toLowerCase() === String(incoming.subject || '').trim().toLowerCase() &&
                String(n.studentName || '').trim().toLowerCase() === String(incoming.studentName || '').trim().toLowerCase() &&
                n.semester === incoming.semester &&
                (n.section || 'boys') === (incoming.section || sec)
            );
            if (idx !== -1) {
                inMemoryNotes[idx] = { ...inMemoryNotes[idx], ...incoming, updatedAt: new Date() };
            } else {
                inMemoryNotes.push({ ...incoming, _id: incoming._id || String(noteIdCounter++) });
            }
        });
    }
    saveDatabaseToDisk();
    console.log(`✅ Base de données synchronisée et sauvegardée pour la section: ${sec}`);
    res.json({ success: true, message: 'Données synchronisées et persistées avec succès.' });
});

// Endpoint pour vider les cohortes de l'année précédente
app.post('/admin/reset-default-students', requireAuth, sectionMiddleware, (req, res) => {
    const user = req.session.user;
    if (!isUserAdmin(user, req.sectionData)) {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    const section = req.body.section || req.session?.section || req.headers['x-auth-section'] || 'boys';
    const sec = (section === 'girls' || section === 'girls-section') ? 'girls' : 'boys';
    if (!dbStorage[sec]) dbStorage[sec] = {};
    
    const classes = Object.keys(dbStorage[sec].studentsByClass || {});
    const cleared = {};
    classes.forEach(c => { cleared[c] = []; });
    dbStorage[sec].studentsByClass = cleared;
    
    inMemoryNotes = inMemoryNotes.filter(n => (n.section || 'boys') !== sec);
    saveDatabaseToDisk();
    res.json({ success: true, message: `Les anciens élèves de l'année passée ont été retirés. Vos classes sont prêtes pour inscrire la nouvelle cohorte.` });
});

// Endpoint pour exporter toutes les données au format JSON
app.get('/api/full-export', requireAuth, sectionMiddleware, (req, res) => {
    const user = req.session.user;
    if (!isUserAdmin(user, req.sectionData)) {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    const section = req.session?.section || req.headers['x-auth-section'] || 'boys';
    const sec = (section === 'girls' || section === 'girls-section') ? 'girls' : 'boys';
    const sectionNotes = inMemoryNotes.filter(n => (n.section || 'boys') === sec);
    res.json({
        section: sec,
        exportedAt: new Date().toISOString(),
        studentsByClass: dbStorage[sec]?.studentsByClass || {},
        teacherPermissions: dbStorage[sec]?.teacherPermissions || {},
        allowedTeachers: dbStorage[sec]?.allowedTeachers || {},
        notes: sectionNotes
    });
});

// Endpoint pour importer et restaurer une sauvegarde JSON complète
app.post('/api/full-import', requireAuth, sectionMiddleware, (req, res) => {
    const user = req.session.user;
    if (!isUserAdmin(user, req.sectionData)) {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    const { section, studentsByClass, teacherPermissions, allowedTeachers, notes } = req.body;
    const sec = (section === 'girls' || section === 'girls-section') ? 'girls' : 'boys';
    if (!dbStorage[sec]) dbStorage[sec] = {};

    if (studentsByClass && typeof studentsByClass === 'object') {
        dbStorage[sec].studentsByClass = studentsByClass;
    }
    if (teacherPermissions && typeof teacherPermissions === 'object') {
        dbStorage[sec].teacherPermissions = teacherPermissions;
        dbStorage[sec].teacherPermissions["Mohamed"] = "admin";
        if (sec === 'girls') dbStorage[sec].teacherPermissions["Zohra"] = "admin";
    }
    if (allowedTeachers && typeof allowedTeachers === 'object') {
        dbStorage[sec].allowedTeachers = { ...(dbStorage[sec].allowedTeachers || {}), ...allowedTeachers };
        dbStorage[sec].allowedTeachers["Mohamed"] = "Med120786";
        if (sec === 'girls') dbStorage[sec].allowedTeachers["Zohra"] = "Zohra";
    }
    if (Array.isArray(notes)) {
        inMemoryNotes = inMemoryNotes.filter(n => (n.section || 'boys') !== sec);
        notes.forEach(incoming => {
            inMemoryNotes.push({ ...incoming, _id: incoming._id || String(noteIdCounter++), section: sec });
        });
    }
    saveDatabaseToDisk();
    res.json({ success: true, message: 'Sauvegarde importée et base de données mise à jour avec succès !' });
});

// Route universelle HTML & PDF (A4) accessible en GET et POST
app.all('/generate-html-report', requireAuth, sectionMiddleware, async (req, res) => {
    const semester = req.body?.semester || req.query?.semester || 'S1';
    const targetClass = req.body?.targetClass || req.query?.targetClass || 'ALL';
    const username = req.session.user;
    const section = req.session.section || 'boys';
    
    const query = buildMongoQueryForUser(username, semester, req.sectionData.teacherPermissions);
    if (section === 'boys') {
        query.$or = [{ section: 'boys' }, { section: { $exists: false } }, { section: null }];
    } else {
        query.section = 'girls';
    }
    const noteResult = SafeNote.find(query);
    const rawNotes = typeof noteResult.lean === 'function' ? await noteResult.lean() : await noteResult;
    const notes = rawNotes.map(normalizeNote);

    const allowedOptions = getUserAllowedOptions(username, req.sectionData);
    const sectionTitle = section === 'girls' ? 'Section Filles' : 'Section Garçons';
    const brandColor = section === 'girls' ? '#9D174D' : '#1E40AF';
    const brandColorLight = section === 'girls' ? '#FDF2F8' : '#EFF6FF';
    const brandBorder = section === 'girls' ? '#FBCFE8' : '#BFDBFE';

    let classesToRender = allowedOptions.classes;
    if (targetClass && targetClass !== 'ALL') {
        classesToRender = classesToRender.filter(c => c === targetClass);
    }

    const getMention = (val) => {
        if (val === null || isNaN(val)) return '—';
        if (val >= 90) return { text: 'Excellent', color: '#166534', bg: '#DCFCE7' };
        if (val >= 80) return { text: 'Très Bien', color: '#15803D', bg: '#F0FDF4' };
        if (val >= 70) return { text: 'Bien', color: '#1D4ED8', bg: '#EFF6FF' };
        if (val >= 60) return { text: 'Assez Bien', color: '#B45309', bg: '#FEF3C7' };
        if (val >= 50) return { text: 'Passable', color: '#C2410C', bg: '#FFEDD5' };
        return { text: 'À renforcer', color: '#B91C1C', bg: '#FEE2E2' };
    };

    let html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bulletin Officiel de Notes — Al Kawthar (${semester})</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
    <style>
        @page {
            size: A4 portrait;
            margin: 10mm 12mm 12mm 12mm;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
            color: #0F172A;
            background: #F1F5F9;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            line-height: 1.4;
            padding: 24px 0;
        }
        .page-sheet {
            max-width: 210mm;
            min-height: 297mm;
            margin: 0 auto 30px auto;
            background: #FFFFFF;
            padding: 14mm 16mm;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.06);
            page-break-after: always;
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .page-sheet:last-child {
            page-break-after: auto;
            margin-bottom: 0;
        }
        .toolbar {
            position: fixed;
            top: 16px;
            right: 24px;
            z-index: 9999;
            background: rgba(15, 23, 42, 0.92);
            backdrop-filter: blur(12px);
            padding: 8px 16px;
            border-radius: 99px;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.25);
            border: 1px solid rgba(255,255,255,0.1);
        }
        .toolbar-title {
            color: #94A3B8;
            font-size: 11.5px;
            font-weight: 600;
            margin-right: 4px;
        }
        .toolbar button {
            background: ${brandColor};
            color: #FFFFFF;
            border: none;
            padding: 8px 16px;
            border-radius: 99px;
            font-size: 12.5px;
            font-weight: 700;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s;
        }
        .toolbar button:hover { opacity: 0.95; transform: translateY(-1px); }
        .toolbar button.close-btn { background: #334155; }

        /* En-tête officiel */
        .school-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 12px;
            border-bottom: 2px solid ${brandColor};
            margin-bottom: 14px;
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .school-logo {
            width: 54px;
            height: 54px;
            border-radius: 50%;
        }
        .school-title-group h1 {
            font-size: 16px;
            font-weight: 800;
            color: #0F172A;
            letter-spacing: -0.2px;
        }
        .school-title-group p {
            font-size: 11.5px;
            color: #475569;
            font-weight: 500;
        }
        .header-right {
            text-align: right;
            font-size: 11px;
            color: #475569;
        }
        .header-right strong { color: #0F172A; }

        /* Bandeau période */
        .meta-strip {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: ${brandColorLight};
            border: 1px solid ${brandBorder};
            border-radius: 6px;
            padding: 8px 14px;
            margin-bottom: 16px;
            font-size: 12px;
            font-weight: 600;
        }
        .meta-badge {
            background: ${brandColor};
            color: #FFFFFF;
            padding: 3px 10px;
            border-radius: 99px;
            font-size: 10.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        /* Section classe */
        .class-section {
            margin-bottom: 22px;
        }
        .class-heading {
            font-size: 13.5px;
            font-weight: 700;
            color: ${brandColor};
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            padding-bottom: 4px;
            border-bottom: 1px dashed #CBD5E1;
        }
        .class-heading span { font-size: 11px; color: #64748B; font-weight: 500; }

        /* Table de notes */
        table.grades-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 10px;
        }
        table.grades-table th {
            background: #0F172A;
            color: #FFFFFF;
            padding: 6px 8px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            font-size: 9.5px;
            border: 1px solid #1E293B;
            text-align: center;
        }
        table.grades-table td {
            padding: 5.5px 8px;
            border: 1px solid #E2E8F0;
            text-align: center;
            vertical-align: middle;
        }
        table.grades-table tr:nth-child(even) td {
            background: #F8FAFC;
        }
        table.grades-table td.student-col {
            text-align: left;
            font-weight: 600;
            color: #0F172A;
        }
        table.grades-table td.subject-col {
            text-align: left;
            color: #334155;
            font-weight: 500;
        }
        table.grades-table td.total-col {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 700;
            color: ${brandColor};
            background: ${brandColorLight};
            font-size: 11.5px;
        }
        .mention-tag {
            font-size: 9.5px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            display: inline-block;
        }
        .num-val {
            font-family: 'JetBrains Mono', monospace;
            font-size: 10.5px;
        }

        /* Résumé classe */
        .class-summary-box {
            display: flex;
            justify-content: flex-end;
            gap: 20px;
            font-size: 11px;
            color: #475569;
            margin-bottom: 14px;
            padding: 6px 14px;
            background: #F1F5F9;
            border-radius: 6px;
            border: 1px solid #E2E8F0;
        }
        .class-summary-box strong { color: #0F172A; font-family: 'JetBrains Mono', monospace; }

        /* Signatures */
        .signatures-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-top: 24px;
            padding-top: 14px;
            border-top: 1.5px dashed #CBD5E1;
            page-break-inside: avoid;
        }
        .signature-cell {
            text-align: center;
        }
        .signature-cell .role {
            font-size: 10.5px;
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-bottom: 40px;
        }
        .signature-cell .line {
            border-bottom: 1.5px solid #94A3B8;
            margin: 0 16px 6px;
        }
        .signature-cell .subtext {
            font-size: 9.5px;
            color: #94A3B8;
        }

        /* Pied de page */
        .sheet-footer {
            margin-top: 20px;
            padding-top: 8px;
            border-top: 1px solid #E2E8F0;
            display: flex;
            justify-content: space-between;
            font-size: 9.5px;
            color: #94A3B8;
        }

        @media print {
            body { background: #FFFFFF; padding: 0; }
            .toolbar { display: none !important; }
            .page-sheet {
                box-shadow: none;
                margin: 0;
                padding: 10mm 12mm;
                border-radius: 0;
                max-width: 100%;
                min-height: auto;
            }
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <span class="toolbar-title">Al Kawthar Academic</span>
        <button onclick="window.print()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Imprimer / Exporter PDF (A4)
        </button>
        <button class="close-btn" onclick="if (window.history.length > 1) { window.history.back(); } else { window.location.href='/dashboard.html'; }">Retour</button>
    </div>

    <div class="page-sheet">
        <div>
            <header class="school-header">
                <div class="header-left">
                    <img src="/logo.svg" alt="Al Kawthar" class="school-logo" onerror="this.style.display='none'">
                    <div class="school-title-group">
                        <h1>AL KAWTHAR INTERNATIONAL SCHOOL</h1>
                        <p>مدارس الكوثر العالمية — Système Officiel de Registre Académique</p>
                    </div>
                </div>
                <div class="header-right">
                    <p>Date d'édition : <strong>${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></p>
                    <p>Enseignant / Opérateur : <strong>${username}</strong></p>
                </div>
            </header>

            <div class="meta-strip">
                <div>
                    <span>Période Académique : <strong>Semestre ${semester}</strong></span>
                    <span style="margin: 0 10px; color: #94A3B8;">|</span>
                    <span>Division : <strong>${sectionTitle}</strong></span>
                </div>
                <div class="meta-badge">Registre Conforme</div>
            </div>`;

    let totalNotesRendered = 0;
    classesToRender.forEach(className => {
        const classNotes = notes.filter(n => n.class === className);
        if (classNotes.length === 0) return;

        totalNotesRendered += classNotes.length;
        const studentScores = [];

        html += `<div class="class-section">
            <div class="class-heading">
                <div>Classe : ${className}</div>
                <span>${classNotes.length} entrée(s) de notes</span>
            </div>
            <table class="grades-table">
                <thead>
                    <tr>
                        <th style="width: 25%; text-align: left;">Élève</th>
                        <th style="width: 20%; text-align: left;">Matière</th>
                        <th style="width: 9%;">T.C</th>
                        <th style="width: 9%;">Devoirs</th>
                        <th style="width: 9%;">Éval.</th>
                        <th style="width: 9%;">Examen</th>
                        <th style="width: 10%;">Total</th>
                        <th style="width: 9%;">Mention</th>
                    </tr>
                </thead>
                <tbody>`;

        classNotes.sort((a, b) => a.studentName.localeCompare(b.studentName) || a.subject.localeCompare(b.subject)).forEach(note => {
            const tc = note.travauxClasse ?? '—';
            const dev = note.devoirs ?? '—';
            const eva = note.evaluation ?? '—';
            const exam = note.examen ?? '—';
            const hasAny = (note.travauxClasse !== null && note.travauxClasse !== '') || 
                           (note.devoirs !== null && note.devoirs !== '') || 
                           (note.evaluation !== null && note.evaluation !== '') || 
                           (note.examen !== null && note.examen !== '');
            let total = '—';
            let mentionObj = null;
            if (hasAny) {
                const t = (note.travauxClasse ? parseFloat(note.travauxClasse) : 0) +
                          (note.devoirs ? parseFloat(note.devoirs) : 0) +
                          (note.evaluation ? parseFloat(note.evaluation) : 0) +
                          (note.examen ? parseFloat(note.examen) : 0);
                total = parseFloat(t.toFixed(2));
                studentScores.push(total);
                mentionObj = getMention(total);
            }

            html += `<tr>
                <td class="student-col">${note.studentName}</td>
                <td class="subject-col">${note.subject}</td>
                <td class="num-val">${tc}</td>
                <td class="num-val">${dev}</td>
                <td class="num-val">${eva}</td>
                <td class="num-val">${exam}</td>
                <td class="total-col">${total}</td>
                <td>${mentionObj ? `<span class="mention-tag" style="background:${mentionObj.bg}; color:${mentionObj.color};">${mentionObj.text}</span>` : '—'}</td>
            </tr>`;
        });

        const classAvg = studentScores.length > 0 ? (studentScores.reduce((a, b) => a + b, 0) / studentScores.length).toFixed(2) : 'N/D';
        const classMax = studentScores.length > 0 ? Math.max(...studentScores).toFixed(2) : 'N/D';
        const classMin = studentScores.length > 0 ? Math.min(...studentScores).toFixed(2) : 'N/D';

        html += `</tbody>
            </table>
            <div class="class-summary-box">
                <div>Moyenne : <strong>${classAvg}</strong></div>
                <div>Plus haute : <strong>${classMax}</strong></div>
                <div>Plus basse : <strong>${classMin}</strong></div>
                <div>Effectif évalué : <strong>${studentScores.length}</strong></div>
            </div>
        </div>`;
    });

    if (totalNotesRendered === 0) {
        html += `<div style="text-align: center; padding: 40px 20px; color: #64748B; background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 8px;">
            <p style="font-size: 14px; font-weight: 700; color: #334155;">Aucune note enregistrée pour cette sélection (${semester}).</p>
            <p style="font-size: 12px; margin-top: 6px;">Les notes saisies et validées par les enseignants s'afficheront ici automatiquement au format officiel A4.</p>
        </div>`;
    }

    html += `</div>
        <div>
            <div class="signatures-grid">
                <div class="signature-cell">
                    <div class="role">Enseignant Titulaire</div>
                    <div class="line"></div>
                    <div class="subtext">Signature & Date</div>
                </div>
                <div class="signature-cell">
                    <div class="role">Coordination Pédagogique</div>
                    <div class="line"></div>
                    <div class="subtext">Visa & Cachet</div>
                </div>
                <div class="signature-cell">
                    <div class="role">Direction Académique</div>
                    <div class="line"></div>
                    <div class="subtext">Approbation Finale</div>
                </div>
            </div>

            <footer class="sheet-footer">
                <span>Al Kawthar International School — Registre officiel académique</span>
                <span>Document imprimable en continu A4</span>
            </footer>
        </div>
    </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
});

// Fallback error middleware pour gestion gracieuse en mode déconnecté
app.use((err, req, res, next) => {
    if (err.name === 'MongooseError' || err.name === 'MongoNetworkError' || (err.message && err.message.includes('buffering timed out'))) {
        console.warn('[AI Studio] Database offline — returning mock empty response');
        if (req.method === 'GET') {
            return res.json(req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {});
        }
        return res.status(503).json({ error: 'Service temporarily unavailable (database offline)' });
    }
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Start server immediately on synchronous listen
const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    });
}

// Export pour Vercel
module.exports = app;
