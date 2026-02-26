// Fichier de données pour les deux sections

// ==================== DONNÉES BRUTES ====================

// --- Section Garçons ---
// Note: Pour les enseignants, le login et le mot de passe sont identiques au nom
const teacherPermissionsBoys = {
    'Mohamed': 'admin',
    'Mohamed Ali': [
        { subject: 'P.E', classes: ['PEI1', 'PEI2', 'PEI3', 'PEI4', 'DP2'] }
    ],
    'Sami': [
        { subject: 'Musique', classes: ['PEI1', 'PEI2', 'PEI3', 'PEI4', 'DP2'] },
        { subject: 'ART', classes: ['PEI1', 'PEI2', 'PEI3', 'PEI4', 'DP2'] }
    ],
    'Mohamed Teacher': [
        { subject: 'Physique-Chimie', classes: ['DP2'] }
    ],
    'Abas': [
        { subject: 'L.L', classes: ['PEI1', 'PEI2', 'PEI3', 'PEI4', 'DP2'] }
    ],
    'Sylvano': [
        { subject: 'Maths', classes: ['PEI1', 'PEI2', 'PEI3', 'PEI4'] },
        { subject: 'Physique-Chimie', classes: ['PEI4'] }
    ],
    'Zine': [
        { subject: 'Biologie', classes: ['PEI2', 'PEI3', 'PEI4', 'DP2'] },
        { subject: 'E.S', classes: ['DP2'] },
        { subject: 'Sciences', classes: ['PEI1'] }
    ],
    'Youssif': [
        { subject: 'I.S', classes: ['PEI1', 'PEI2', 'PEI3', 'PEI4', 'DP2'] },
        { subject: 'S.E.S', classes: ['DP2'] }
    ],
    'Tonga': [
        { subject: 'Design', classes: ['PEI1', 'PEI2', 'PEI3', 'PEI4'] },
        { subject: 'Maths', classes: ['DP2'] },
        { subject: 'Physique-Chimie', classes: ['PEI2', 'PEI3'] }
    ],
    'Kamel': [
        { subject: 'Anglais', classes: ['PEI1', 'PEI2', 'PEI3', 'PEI4', 'DP2'] }
    ]
};

const studentsByClassBoys = {
    PEI1: ["Bilal Molina", "Faysal Achar", "Jad Mahayni", "Manaf Kotbi"],
    PEI2: ["Ahmed Bouaziz", "Ali Kotbi", "Eyad Hassan", "Yasser Younes"],
    PEI3: ["Adam Kaaki", "Ahmad Mahayni", "Mohamed Chalak", "Seifeddine Ayadi", "Wajih Sabadine"],
    PEI4: ["Abdulrahman Bouaziz", "Mohamed Amine Sgheir", "Mohamed Younes", "Samir Kaaki", "Youssef Baakak"],
    DP2: ["Habib Lteif", "Salah Boumalouga"]
};

// --- Section Filles ---
// Note: Pour les enseignantes, le login et le mot de passe sont identiques au nom
const teacherPermissionsGirls = {
    'Mohamed': 'admin',
    'Zohra': 'admin',
    'Amal': [
        { subject: 'Anglais', classes: ['PEI1', 'PEI2', 'PEI3', 'PEI4'] }
    ],
    'Inas': [
        { subject: 'Maths', classes: ['PEI5', 'PEI4', 'DP1', 'DP2'] },
        { subject: 'Physique-Chimie', classes: ['PEI5', 'DP1', 'DP2'] },
        { subject: 'Études Scientifiques – ES', classes: ['DP1'] }
    ],
    'Anouar': [
        { subject: 'Design', classes: ['PEI1', 'PEI2', 'PEI3', 'PEI4'] },
        { subject: 'Biologie', classes: ['PEI3', 'PEI4'] },
        { subject: 'Physique-Chimie', classes: ['PEI3'] },
        { subject: 'Maths', classes: ['PEI3'] }
    ],
    'Souha': [
        { subject: 'Physique-Chimie', classes: ['PEI2'] },
        { subject: 'Maths', classes: ['PEI1', 'PEI2'] },
        { subject: 'Biologie', classes: ['PEI2', 'PEI5'] },
        { subject: 'Sciences Numériques et Technologiques – SNT', classes: ['PEI5'] },
        { subject: 'Sciences', classes: ['PEI1'] }
    ],
    'Samira': [
        { subject: 'Individus et Sociétés', classes: ['PEI4', 'PEI5', 'DP1', 'DP2'] },
        { subject: 'Langue et Littérature', classes: ['PEI4', 'PEI5', 'DP1', 'DP2'] },
        { subject: 'Sciences Économiques et Sociales – SES', classes: ['DP1', 'DP2'] }
    ],
    'Zohra Zidane': [
        { subject: 'Physique-Chimie', classes: ['PEI4'] },
        { subject: 'Biologie', classes: ['DP1', 'DP2'] },
        { subject: 'Études Scientifiques – ES', classes: ['DP1', 'DP2'] }
    ],
    'Aichetou': [
        { subject: 'Individus et Sociétés', classes: ['PEI1', 'PEI2', 'PEI3'] },
        { subject: 'Langue et Littérature', classes: ['PEI1', 'PEI2', 'PEI3'] },
        { subject: 'Sciences Économiques et Sociales – SES', classes: ['PEI5'] }
    ],
    'Hiba': [
        { subject: 'Anglais', classes: ['DP1', 'DP2'] }
    ],
    'Shanouja': [
        { subject: 'Anglais', classes: ['PEI5'] }
    ],
    'Hana': [
        { subject: 'Éducation Physique et Sportive – EPS', classes: ['PEI1', 'PEI2', 'PEI3', 'PEI4', 'PEI5', 'DP1', 'DP2'] }
    ],
    'Farah': [
        { subject: 'Musique', classes: ['PEI1', 'PEI2', 'PEI3', 'PEI4', 'PEI5', 'DP1', 'DP2'] }
    ],
    'Tayba': [
        { subject: 'ART', classes: ['PEI1', 'PEI2', 'PEI3', 'PEI4', 'PEI5', 'DP1', 'DP2'] }
    ]
};

const studentsByClassGirls = {
    DP1: ["Yothna Masrouhi"],
    DP2: ["Isra Elalmi"],
    PEI1: ["Naya Sabbidine"],
    PEI2: ["Cynthia Fadlallah", "Dina Tlili", "Israa Alkattan", "Lina Tlili", "Neyla Molina"],
    PEI3: ["Jawahair Eshmawi"],
    PEI4: ["Maria Wahib", "Sarah Aldebasy", "Yousr Letaief"],
    PEI5: ["Badia Khaldi", "Luluwah Alghabashi"]
};

// ==================== GÉNÉRATION DYNAMIQUE DES UTILISATEURS ====================

// Fonction pour générer la liste des enseignants autorisés
function generateAllowedTeachers(permissions, admins) {
    const allowed = {};
    
    // 1. Ajouter les administrateurs avec leurs mots de passe spécifiques
    for (const [adminUser, adminPass] of Object.entries(admins)) {
        allowed[adminUser] = adminPass;
    }
    
    // 2. Ajouter les enseignants (Username = Password)
    for (const teacherName of Object.keys(permissions)) {
        // Si l'enseignant n'est pas déjà défini comme admin (pour éviter d'écraser le mot de passe admin)
        if (!allowed[teacherName]) {
             allowed[teacherName] = teacherName; 
        }
    }
    
    return allowed;
}

// Configuration des administrateurs (User: Password)
// Section Garçons: Mohamed uniquement
const adminsBoys = { 
    "Mohamed": "Mohamed" 
};

// Section Filles: Zohra Zidane + Mohamed
const adminsGirls = { 
    "Zohra": "Zohra",        // Admin: Zohra Zidane (login: Zohra, mdp: Zohra)
    "Mohamed": "Mohamed"     // Admin: Mohamed (login: Mohamed, mdp: Mohamed)
};

// Génération des listes d'accès
const allowedTeachersBoys = generateAllowedTeachers(teacherPermissionsBoys, adminsBoys);
const allowedTeachersGirls = generateAllowedTeachers(teacherPermissionsGirls, adminsGirls);

// Export des données
module.exports = {
    allowedTeachersBoys,
    teacherPermissionsBoys,
    studentsByClassBoys,
    allowedTeachersGirls,
    teacherPermissionsGirls,
    studentsByClassGirls
};
