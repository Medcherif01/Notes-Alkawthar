// Fichier de configuration initiale pour les deux sections (Garçons / Filles)
// Les données réelles (classes, élèves, enseignants et notes) sont 100% stockées
// de manière dynamique et persistante dans la base de données (db_storage.json).

const defaultSubjects = [
    'Maths',
    'Français',
    'Anglais',
    'Physique-Chimie',
    'Biologie',
    'Sciences',
    'L.L',
    'I.S',
    'ART',
    'Design',
    'Musique',
    'P.E',
    'S.E.S',
    'E.S'
];

// --- Section Garçons (Structure initiale vide) ---
const teacherPermissionsBoys = {
    'Mohamed': 'admin'
};

const studentsByClassBoys = {};

const allowedTeachersBoys = {
    'Mohamed': 'Med120786'
};

// --- Section Filles (Structure initiale vide) ---
const teacherPermissionsGirls = {
    'Mohamed': 'admin',
    'Zohra': 'admin'
};

const studentsByClassGirls = {};

const allowedTeachersGirls = {
    'Mohamed': 'Med120786',
    'Zohra': 'Zohra'
};

module.exports = {
    defaultSubjects,
    allowedTeachersBoys,
    teacherPermissionsBoys,
    studentsByClassBoys,
    allowedTeachersGirls,
    teacherPermissionsGirls,
    studentsByClassGirls
};
