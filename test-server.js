const express = require('express');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration simplifiée pour le test
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session simple pour le test
app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // HTTP pour le test local
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 1 jour
    }
}));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Données de test
const allowedTeachers = {
    "Mohamed Ali": "Mohamed Ali",
    "Sami": "Sami",
    "Abas": "Abas",
    "Sylvano": "Sylvano",
    "Zine": "Zine",
    "Morched": "Morched",
    "Tonga": "Tonga",
    "Kamel": "Kamel",
    "Mohamed": "Mohamed" // Admin
};

const teacherPermissions = {
    Mohamed: 'admin',
    'Mohamed Ali': [
        { subject: 'P.E', classes: ['PEI1', 'PEI2', 'PEI3', 'PEI4', 'DP1', 'DP2'] }
    ],
    Sami: [
        { subject: 'Musique', classes: ['PEI1', 'PEI2', 'PEI3'] },
        { subject: 'ART', classes: ['PEI1', 'PEI2', 'PEI3', 'PEI4', 'DP1', 'DP2'] }
    ],
    Abas: [
        { subject: 'L.L', classes: ['PEI2', 'PEI3', 'PEI4', 'DP1'] },
        { subject: 'I.S', classes: ['PEI4'] }
    ]
};

const studentsByClass = {
    PEI1: ["Bilal Molina", "Faysal Achar", "Jad Mahayni", "Manaf Kotbi"],
    PEI2: ["Ahmed Bouaziz", "Ali Kotbi", "Eyad Hassan", "Yasser Younes"],
    PEI3: ["Adam Kaaki", "Ahmad Mahayni", "Mohamed Chalak", "Seifeddine Ayadi", "Wajih Sabadine"],
    PEI4: ["Abdulrahman Bouaziz", "Mohamed Amine Sgheir", "Mohamed Younes", "Samir Kaaki", "Youssef Baakak"],
    DP1: [],
    DP2: ["Habib Lteif", "Mahdi Karimi", "Salah Boumalouga"]
};

// Calculer les matières par classe
const subjectsByClass = {};
Object.values(teacherPermissions).forEach(perms => {
    if (perms === 'admin') return;
    perms.forEach(p => {
        p.classes.forEach(c => {
            if (!subjectsByClass[c]) subjectsByClass[c] = new Set();
            subjectsByClass[c].add(p.subject);
        });
    });
});
for (const key in subjectsByClass) {
    subjectsByClass[key] = Array.from(subjectsByClass[key]).sort();
}

const allClasses = Object.keys(subjectsByClass).sort();
const allSubjects = [...new Set(Object.values(subjectsByClass).flat())].sort();

// Fonction utilitaire pour les permissions
function getUserAllowedOptions(username) {
    const permissions = teacherPermissions[username];
    if (permissions === 'admin') {
        return { classes: [...allClasses], subjects: [...allSubjects] };
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

// Données de notes simulées
let mockNotes = [];

// Routes de login
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (allowedTeachers[username] && allowedTeachers[username] === password) {
        req.session.user = username;
        console.log(`✅ Login successful for user: ${username}`);
        res.redirect('/');
    } else {
        console.log(`❌ Login failed for user: ${username}`);
        res.redirect('/login?error=1');
    }
});

app.get('/logout', (req, res) => {
    const user = req.session.user;
    req.session.destroy(err => {
        if (err) console.error("❌ Error destroying session:", err);
        console.log(`🚪 User ${user} logged out.`);
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

// Middleware d'authentification
app.use((req, res, next) => {
    if (req.session && req.session.user) {
        next();
    } else {
        console.log(`🚫 User not authenticated trying to access ${req.path}. Redirecting to login.`);
        res.redirect('/login');
    }
});

// Routes protégées
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/get-user', (req, res) => {
    const username = req.session.user;
    res.json({
        username: username,
        permissions: getUserAllowedOptions(username),
        subjectsByClass: subjectsByClass,
        studentsByClass: studentsByClass
    });
});

app.get('/all-notes', async (req, res) => {
    const { semester } = req.query;
    if (!semester || !['S1', 'S2'].includes(semester)) {
        return res.status(400).json({ error: 'Le paramètre semester (S1 ou S2) est requis.' });
    }
    
    // Filtrer les notes par semestre
    const filteredNotes = mockNotes.filter(note => note.semester === semester);
    res.status(200).json(filteredNotes);
});

app.post('/save-notes', async (req, res) => {
    const { class: studentClass, subject, studentName, semester, travauxClasse, devoirs, evaluation, examen } = req.body;
    const teacher = req.session.user;
    
    // Simuler la création d'une note
    const newNote = {
        _id: Date.now().toString(), // ID simple pour le test
        class: studentClass,
        subject,
        studentName,
        semester,
        travauxClasse: travauxClasse === '' ? null : Number(travauxClasse),
        devoirs: devoirs === '' ? null : Number(devoirs),
        evaluation: evaluation === '' ? null : Number(evaluation),
        examen: examen === '' ? null : Number(examen),
        teacher
    };
    
    // Vérifier si une note existe déjà
    const existingNoteIndex = mockNotes.findIndex(note => 
        note.class === studentClass && 
        note.subject === subject && 
        note.studentName === studentName && 
        note.semester === semester
    );
    
    if (existingNoteIndex !== -1) {
        return res.status(400).send(`❌ Notes déjà existantes pour cet élève.`);
    }
    
    mockNotes.push(newNote);
    console.log(`✅ Note ajoutée pour ${studentName} en ${subject} (${studentClass})`);
    res.status(200).send('✅ Notes sauvegardées avec succès');
});

app.listen(PORT, () => {
    console.log(`🚀 Serveur de test démarré sur http://localhost:${PORT}`);
    console.log(`📝 Utilisez les identifiants de test (ex: username: Mohamed, password: Mohamed)`);
});