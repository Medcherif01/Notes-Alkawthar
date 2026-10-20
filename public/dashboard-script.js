// ====================================
// GESTION DU DASHBOARD - Version Séparée
// ====================================

// Intercepteur fetch pour persistance d'authentification robuste en iframe
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
    options = options || {};
    options.headers = options.headers || {};
    const savedUser = localStorage.getItem('al_kawthar_user');
    const savedSection = localStorage.getItem('al_kawthar_section');
    if (savedUser) {
        if (options.headers instanceof Headers) {
            if (!options.headers.has('x-auth-user')) options.headers.set('x-auth-user', savedUser);
            if (savedSection && !options.headers.has('x-auth-section')) options.headers.set('x-auth-section', savedSection);
        } else if (Array.isArray(options.headers)) {
            options.headers.push(['x-auth-user', savedUser]);
            if (savedSection) options.headers.push(['x-auth-section', savedSection]);
        } else {
            if (!options.headers['x-auth-user']) options.headers['x-auth-user'] = savedUser;
            if (savedSection && !options.headers['x-auth-section']) options.headers['x-auth-section'] = savedSection;
        }
    }
    return originalFetch.call(this, url, options);
};

// Notification in-app non-bloquante pour éviter window.alert
function showNotification(message, isError = false) {
    let toast = document.getElementById('appToastNotification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'appToastNotification';
        toast.style.position = 'fixed';
        toast.style.bottom = '24px';
        toast.style.right = '24px';
        toast.style.zIndex = '99999';
        toast.style.padding = '12px 20px';
        toast.style.borderRadius = '10px';
        toast.style.fontWeight = '600';
        toast.style.fontSize = '14px';
        toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
        toast.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.gap = '10px';
        toast.style.fontFamily = "'Plus Jakarta Sans', system-ui, sans-serif";
        document.body.appendChild(toast);
    }
    toast.style.background = isError ? '#EF4444' : '#10B981';
    toast.style.color = '#FFFFFF';
    toast.innerHTML = `<i class="fas ${isError ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i> <span>${message}</span>`;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
    }, 4000);
}
window.alert = function(msg) { showNotification(msg, false); };

// ============================================================
// NORMALISATION CÔTÉ CLIENT
// Traite 0 (Number), "0", "0.0", null, undefined, "" → ''
// Conserve toute autre valeur comme String exact
// ============================================================
function normalizeVal(val) {
    if (val === null || val === undefined || val === '') return '';
    const str = String(val).trim();
    if (str === '') return '';
    const num = parseFloat(str);
    if (isNaN(num) || num === 0) return '';
    return str;
}

// Variables globales
let currentSemester = null;
let allNotesData = [];
let currentUserData = null;
let currentUserPermissions = { classes: [], subjects: [] };
let subjectsByClassGlobal = {};
let studentsByClassGlobal = {};
let currentStudentIndex = -1;
let currentStudentsList = [];
let autoProgressEnabled = false;
let isAdmin = false;
let _suppressFilterChange = false; // évite les déclenchements de filterAndDisplayNotes lors des changements programmatiques

// Éléments DOM
const classSelect = document.getElementById("class");
const subjectSelect = document.getElementById("subject");
const studentSelect = document.getElementById("studentName");
const sortClassSelect = document.getElementById("sortClass");
const sortSubjectSelect = document.getElementById("sortSubject");
const sortStudentSelect = document.getElementById("sortStudent");
const outputDiv = document.getElementById("output");
const usernameDisplay = document.getElementById('usernameDisplay');
const dashboardSectionName = document.getElementById('dashboardSectionName');
const semester1Button = document.getElementById('semester1Button');
const semester2Button = document.getElementById('semester2Button');
const formTitle = document.getElementById('formTitle');
const formErrorMessage = document.getElementById("formErrorMessage");
const formSuccessMessage = document.getElementById("formSuccessMessage");
const mainContainer = document.getElementById("mainContainer");
const travauxClasseInput = document.getElementById("travauxClasse");
const devoirsInput = document.getElementById("devoirs");
const evaluationInput = document.getElementById("evaluation");
const examenInput = document.getElementById("examen");
const generateWordButton = document.getElementById("generateWordButton");
const generateExcelButton = document.getElementById("generateExcelButton");
const logoutButton = document.getElementById("logoutButton");
const progressContainer = document.getElementById("progress-container");
const progressBar = document.getElementById("progressBar");

// Barèmes de notes
const noteLimits = {
    PEI1: { travauxClasse: 30, devoirs: 20, evaluation: 20, examen: 30 },
    PEI2: { travauxClasse: 20, devoirs: 20, evaluation: 30, examen: 30 },
    PEI3: { travauxClasse: 20, devoirs: 20, evaluation: 30, examen: 30 },
    PEI4: { travauxClasse: 20, devoirs: 20, evaluation: 30, examen: 30 },
    PEI5: { travauxClasse: 20, devoirs: 20, evaluation: 30, examen: 30 },
    DP1: { travauxClasse: 20, devoirs: 20, evaluation: 30, examen: 30 },
    DP2: { travauxClasse: 20, devoirs: 20, evaluation: 30, examen: 30 }
};

// Liste des admins
const ADMINS = {
    boys: ['Mohamed'],
    girls: ['Zohra', 'Mohamed']
};

async function refreshAppData() {
    try {
        const res = await fetch('/get-user');
        if (res.ok) {
            const data = await res.json();
            currentUserPermissions = data.permissions;
            subjectsByClassGlobal = data.subjectsByClass;
            studentsByClassGlobal = data.studentsByClass;
            populatePermissionBasedDropdowns();
        }
    } catch (e) {
        console.error('Error refreshing app data:', e);
    }
}

// ====================================
// INITIALISATION AU CHARGEMENT
// ====================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Dashboard chargé, vérification de la session...');
    
    try {
        const response = await fetch('/get-user');
        
        if (!response.ok) {
            console.log('❌ Session invalide, redirection vers login');
            window.location.href = '/home.html';
            return;
        }
        
        const data = await response.json();
        console.log('✅ Session valide:', data);
        
        currentUserData = data;
        usernameDisplay.textContent = data.username;
        
        // Vérifier si l'utilisateur est admin
        const userSection = data.section || 'boys';
        const uname = (data.username || '').trim().toLowerCase();
        isAdmin = ADMINS[userSection].map(u => u.toLowerCase()).includes(uname) || uname === 'mohamed' || uname === 'zohra' || data.permissions === 'admin';
        console.log(`🔑 Utilisateur: ${data.username}, Section: ${userSection}, Admin: ${isAdmin}`);

        const openAdminBtn = document.getElementById('openAdminModalBtn');
        if (openAdminBtn) {
            if (isAdmin || uname === 'mohamed' || uname === 'zohra') {
                openAdminBtn.style.display = 'inline-flex';
                openAdminBtn.addEventListener('click', openAdminModal);
            } else {
                openAdminBtn.style.display = 'none';
            }
        }
        
        // Appliquer la classe de section au body
        if (data.section === 'girls') {
            document.body.classList.add('girls-section');
            document.body.classList.remove('boys-section');
            dashboardSectionName.textContent = 'Section Filles';
        } else {
            document.body.classList.add('boys-section');
            document.body.classList.remove('girls-section');
            dashboardSectionName.textContent = 'Section Garçons';
        }

        currentUserPermissions = data.permissions;
        subjectsByClassGlobal = data.subjectsByClass;
        studentsByClassGlobal = data.studentsByClass;
        
        populatePermissionBasedDropdowns();
        setupEventListeners();
        
    } catch (error) {
        console.error('❌ Erreur d\'initialisation:', error);
        window.location.href = '/home.html';
    }
});

// ====================================
// FONCTIONS UTILITAIRES
// ====================================
function clearSelectOptions(select, defaultText) {
    select.innerHTML = `<option value="">${defaultText}</option>`;
}

function addOption(select, value, text) {
    select.add(new Option(text, value));
}

function showFormMessage(element, message, isError = true) {
    element.textContent = message;
    if (isError) {
        element.className = 'error-message show';
    } else {
        element.className = 'success-message-modern show';
    }
    setTimeout(() => element.classList.remove('show'), 4000);
}

function populatePermissionBasedDropdowns() {
    clearSelectOptions(classSelect, '-- Sélectionner une classe --');
    clearSelectOptions(sortClassSelect, 'Toutes les Classes');
    currentUserPermissions.classes.forEach(cls => {
        addOption(classSelect, cls, cls);
        addOption(sortClassSelect, cls, cls);
    });

    updateSortDropdownsForFilterClass('');
}

// ====================================
// CONFIGURATION DES EVENT LISTENERS
// ====================================
function setupEventListeners() {
    // Semestres
    semester1Button.addEventListener('click', () => setActiveSemester('S1'));
    semester2Button.addEventListener('click', () => setActiveSemester('S2'));
    
    // Formulaire
    classSelect.addEventListener("change", updateFormOnClassChange);
    subjectSelect.addEventListener("change", updateFormOnSubjectChange);
    studentSelect.addEventListener("change", updateStudentSelection);
    document.getElementById("skipToNextButton").addEventListener("click", moveToNextStudent);
    document.getElementById("noteForm").addEventListener("submit", handleFormSubmit);
    
    // Filtres — quand on choisit une classe, filtrer automatiquement les matières et élèves de cette classe
    sortClassSelect.addEventListener("change", () => {
        if (_suppressFilterChange) return;
        updateSortDropdownsForFilterClass(sortClassSelect.value);
        filterAndDisplayNotes();
    });
    sortSubjectSelect.addEventListener("change", () => {
        if (_suppressFilterChange) return;
        filterAndDisplayNotes();
    });
    sortStudentSelect.addEventListener("change", () => {
        if (_suppressFilterChange) return;
        filterAndDisplayNotes();
    });
    
    // Boutons d'action
    generateWordButton.addEventListener("click", generateWordFiles);
    generateExcelButton.addEventListener("click", generateExcelFile);
    logoutButton.addEventListener("click", handleLogout);
}

// ====================================
// GESTION DES SEMESTRES
// ====================================
function setActiveSemester(semester) {
    if (currentSemester === semester) return;
    currentSemester = semester;

    semester1Button.classList.toggle('active', semester === 'S1');
    semester2Button.classList.toggle('active', semester === 'S2');
    
    // Mise à jour du titre avec le nouveau format
    const semesterTag = formTitle.querySelector('.semester-tag');
    if (semesterTag) {
        semesterTag.textContent = `Semestre ${semester === 'S1' ? '1' : '2'}`;
    }
    
    mainContainer.dataset.printSemester = semester;
    mainContainer.style.display = 'block';

    // Reset silencieux des selects (sans déclencher filterAndDisplayNotes)
    _suppressFilterChange = true;
    [sortClassSelect, sortSubjectSelect, sortStudentSelect, classSelect].forEach(s => s.value = "");
    _suppressFilterChange = false;

    // Réinitialiser la navigation icônes
    iconNavClass   = null;
    iconNavSubject = null;

    updateFormOnClassChange();
    fetchAndDisplayData();
}

// ====================================
// GESTION DU FORMULAIRE
// ====================================
function updateFormOnClassChange() {
    const selectedClass = classSelect.value;
    clearSelectOptions(studentSelect, '-- Sélectionner un élève --');
    clearSelectOptions(subjectSelect, '-- Sélectionner une matière --');
    
    autoProgressEnabled = false;
    currentStudentIndex = -1;
    currentStudentsList = [];
    hideAutoProgressInfo();
    
    if (selectedClass) {
        // Filtrer les élèves et matières par classe
        const sortedStudents = (studentsByClassGlobal[selectedClass] || []).slice().sort();
        sortedStudents.forEach(s => addOption(studentSelect, s, s));
        
        const subjectsToShow = (subjectsByClassGlobal[selectedClass] || [])
            .filter(s => currentUserPermissions.subjects.includes(s)).slice().sort();
        subjectsToShow.forEach(s => addOption(subjectSelect, s, s));

        if (subjectsToShow.length === 1) {
            subjectSelect.value = subjectsToShow[0];
            updateFormOnSubjectChange();
        }
    }
    updateLimits();
}

function updateFormOnSubjectChange() {
    const selectedClass = classSelect.value;
    const selectedSubject = subjectSelect.value;
    
    if (selectedClass && selectedSubject) {
        autoProgressEnabled = true;
        currentStudentsList = (studentsByClassGlobal[selectedClass] || []).sort();
        studentSelect.value = '';
        currentStudentIndex = -1;
        
        if (currentStudentsList.length > 0) {
            moveToNextStudent();
        } else {
            hideAutoProgressInfo();
        }
    } else {
        autoProgressEnabled = false;
        hideAutoProgressInfo();
        studentSelect.dataset.autoMode = 'false';
    }
}

function updateStudentSelection() {
    const selectedStudent = studentSelect.value;
    if (selectedStudent) {
        currentStudentIndex = currentStudentsList.indexOf(selectedStudent);
        if (currentStudentIndex >= 0 && currentStudentIndex < currentStudentsList.length - 1) {
            showAutoProgressInfo();
        } else {
            hideAutoProgressInfo();
        }
        // Charger les notes existantes pour cet élève
        loadExistingNotesForStudent();
    } else {
        hideAutoProgressInfo();
        clearNoteInputs();
    }
}

function moveToNextStudent() {
    if (!autoProgressEnabled || currentStudentsList.length === 0) return;
    
    currentStudentIndex++;
    if (currentStudentIndex < currentStudentsList.length) {
        const nextStudent = currentStudentsList[currentStudentIndex];
        studentSelect.value = nextStudent;
        
        if (currentStudentIndex < currentStudentsList.length - 1) {
            showAutoProgressInfo();
        } else {
            hideAutoProgressInfo();
        }
        // Charger les notes existantes pour le prochain élève
        loadExistingNotesForStudent();
    } else {
        currentStudentIndex = currentStudentsList.length;
        studentSelect.value = '';
        hideAutoProgressInfo();
        clearNoteInputs();
    }
}

function showAutoProgressInfo() {
    const nextIndex = currentStudentIndex + 1;
    if (nextIndex < currentStudentsList.length) {
        const nextName = currentStudentsList[nextIndex];
        document.getElementById('nextStudentName').textContent = `Prochain: ${nextName}`;
        document.getElementById('autoProgressInfo').style.display = 'flex';
    } else {
        hideAutoProgressInfo();
    }
}

function hideAutoProgressInfo() {
    document.getElementById('autoProgressInfo').style.display = 'none';
}

function clearNoteInputs() {
    travauxClasseInput.value = '';
    devoirsInput.value = '';
    evaluationInput.value = '';
    examenInput.value = '';
    // Retirer l'attribut data-note-id quand on efface les champs
    document.getElementById('noteForm').removeAttribute('data-note-id');
}

// Nouvelle fonction pour charger les notes existantes
function loadExistingNotesForStudent() {
    const selectedClass = classSelect.value;
    const selectedSubject = subjectSelect.value;
    const selectedStudent = studentSelect.value;
    
    if (!selectedClass || !selectedSubject || !selectedStudent || !currentSemester) {
        clearNoteInputs();
        return;
    }
    
    // Chercher une note existante pour cet élève, cette matière et cette classe
    const existingNote = allNotesData.find(note => 
        note.class === selectedClass &&
        note.subject === selectedSubject &&
        note.studentName === selectedStudent &&
        note.semester === currentSemester
    );
    
    if (existingNote) {
        // Remplir les champs avec les notes existantes — normalizeVal() traite 0 → vide
        travauxClasseInput.value = normalizeVal(existingNote.travauxClasse);
        devoirsInput.value       = normalizeVal(existingNote.devoirs);
        evaluationInput.value    = normalizeVal(existingNote.evaluation);
        examenInput.value        = normalizeVal(existingNote.examen);
        
        // Stocker l'ID de la note pour permettre la mise à jour
        document.getElementById('noteForm').setAttribute('data-note-id', existingNote._id);
        
        // Afficher un message informatif
        showFormMessage(
            document.getElementById('formInfoMessage') || formSuccessMessage, 
            '📝 Notes existantes chargées. Vous pouvez les modifier.', 
            false
        );
    } else {
        // Aucune note existante, effacer les champs
        clearNoteInputs();
    }
}

function updateLimits() {
    const selectedClass = classSelect.value;
    if (!selectedClass) {
        setPlaceholders('-', '-', '-', '-');
        return;
    }
    
    const classType = selectedClass.split('-')[0];
    const limits = noteLimits[classType] || { travauxClasse: '-', devoirs: '-', evaluation: '-', examen: '-' };
    setPlaceholders(limits.travauxClasse, limits.devoirs, limits.evaluation, limits.examen);
}

function setPlaceholders(tc, d, e, ex) {
    travauxClasseInput.placeholder = `Max: ${tc}`;
    devoirsInput.placeholder = `Max: ${d}`;
    evaluationInput.placeholder = `Max: ${e}`;
    examenInput.placeholder = `Max: ${ex}`;
}

// ====================================
// GESTION DE LA SOUMISSION DU FORMULAIRE
// ====================================
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const selectedClass = classSelect.value;
    const subject = subjectSelect.value;
    const studentName = studentSelect.value;
    
    if (!selectedClass || !subject || !studentName || !currentSemester) {
        showFormMessage(formErrorMessage, '❌ Veuillez remplir tous les champs obligatoires.');
        return;
    }
    
    // normalizeVal: 0, "0", "", null → null (case vide). Sinon String exact.
    const tcVal   = normalizeVal(travauxClasseInput.value);
    const devVal  = normalizeVal(devoirsInput.value);
    const evaVal  = normalizeVal(evaluationInput.value);
    const examVal = normalizeVal(examenInput.value);

    const noteData = {
        class: selectedClass,
        subject: subject,
        studentName: studentName,
        semester: currentSemester,
        travauxClasse: tcVal   === '' ? null : tcVal,
        devoirs:       devVal  === '' ? null : devVal,
        evaluation:    evaVal  === '' ? null : evaVal,
        examen:        examVal === '' ? null : examVal
    };
    
    // Vérifier s'il s'agit d'une mise à jour ou d'une création
    const noteId = document.getElementById('noteForm').getAttribute('data-note-id');
    
    try {
        let response;
        
        if (noteId) {
            // Mise à jour d'une note existante
            response = await fetch(`/update-note/${noteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(noteData)
            });
        } else {
            // Création d'une nouvelle note
            response = await fetch('/save-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(noteData)
            });
        }
        
        if (response.ok) {
            const action = noteId ? 'mise à jour' : 'enregistrement';
            showFormMessage(formSuccessMessage, `✅ Note ${action === 'mise à jour' ? 'mise à jour' : 'enregistrée'} avec succès !`, false);
            fetchAndDisplayData();
            
            if (autoProgressEnabled) {
                setTimeout(() => {
                    moveToNextStudent();
                }, 1000);
            } else {
                // Si pas en mode auto, effacer les champs après sauvegarde
                setTimeout(() => {
                    clearNoteInputs();
                }, 1500);
            }
        } else {
            const error = await response.text();
            showFormMessage(formErrorMessage, `❌ Erreur: ${error}`);
        }
    } catch (error) {
        showFormMessage(formErrorMessage, '❌ Erreur réseau. Veuillez réessayer.');
        console.error('Error saving note:', error);
    }
}

// ====================================
// ICÔNES PAR MATIÈRE (mapping FontAwesome)
// ====================================
const SUBJECT_ICONS = {
    // Garçons
    'L.L':               { icon: 'fa-book-open',         color: '#7C3AED', emoji: '📖' },
    'I.S':               { icon: 'fa-globe-europe',       color: '#0284C7', emoji: '🌍' },
    'Maths':             { icon: 'fa-square-root-alt',    color: '#1D4ED8', emoji: '📐' },
    'Biologie':          { icon: 'fa-dna',                color: '#16A34A', emoji: '🧬' },
    'Sciences':          { icon: 'fa-flask',              color: '#059669', emoji: '🔬' },
    'Physique-Chimie':   { icon: 'fa-atom',               color: '#DC2626', emoji: '⚛️' },
    'Design':            { icon: 'fa-drafting-compass',   color: '#EA580C', emoji: '🎨' },
    'Anglais':           { icon: 'fa-language',           color: '#0891B2', emoji: '🗣️' },
    'Musique':           { icon: 'fa-music',              color: '#9333EA', emoji: '🎵' },
    'ART':               { icon: 'fa-palette',            color: '#DB2777', emoji: '🖼️' },
    'P.E':               { icon: 'fa-running',            color: '#F97316', emoji: '🏃' },
    'E.S':               { icon: 'fa-microscope',         color: '#0D9488', emoji: '🧪' },
    'S.E.S':             { icon: 'fa-chart-line',         color: '#4F46E5', emoji: '📊' },
    // Filles (noms complets)
    'Individus et Sociétés':                          { icon: 'fa-globe-europe',     color: '#0284C7', emoji: '🌍' },
    'Langue et Littérature':                          { icon: 'fa-book-open',        color: '#7C3AED', emoji: '📖' },
    'Sciences Numériques et Technologiques – SNT':    { icon: 'fa-laptop-code',      color: '#1D4ED8', emoji: '💻' },
    'Éducation Physique et Sportive – EPS':           { icon: 'fa-running',          color: '#F97316', emoji: '🏃' },
    'Sciences Économiques et Sociales – SES':         { icon: 'fa-chart-line',       color: '#4F46E5', emoji: '📊' },
    'Études Scientifiques – ES':                      { icon: 'fa-microscope',       color: '#0D9488', emoji: '🧪' },
};

function getSubjectIcon(subject) {
    return SUBJECT_ICONS[subject] || { icon: 'fa-graduation-cap', color: '#64748B', emoji: '🎓' };
}

// Icônes de classes
const CLASS_VISUAL = {
    'PEI1': { icon: 'fa-seedling',    gradient: 'linear-gradient(135deg,#16A34A,#4ADE80)', label: 'PEI 1' },
    'PEI2': { icon: 'fa-leaf',        gradient: 'linear-gradient(135deg,#0891B2,#38BDF8)', label: 'PEI 2' },
    'PEI3': { icon: 'fa-star',        gradient: 'linear-gradient(135deg,#7C3AED,#A78BFA)', label: 'PEI 3' },
    'PEI4': { icon: 'fa-fire',        gradient: 'linear-gradient(135deg,#EA580C,#FB923C)', label: 'PEI 4' },
    'PEI5': { icon: 'fa-bolt',        gradient: 'linear-gradient(135deg,#DB2777,#F472B6)', label: 'PEI 5' },
    'DP1':  { icon: 'fa-crown',       gradient: 'linear-gradient(135deg,#D97706,#FCD34D)', label: 'DP 1'  },
    'DP2':  { icon: 'fa-trophy',      gradient: 'linear-gradient(135deg,#DC2626,#F87171)', label: 'DP 2'  },
};

function getClassVisual(cls) {
    return CLASS_VISUAL[cls] || { icon: 'fa-school', gradient: 'linear-gradient(135deg,#4F46E5,#7C3AED)', label: cls };
}

// État de navigation icônes
let iconNavClass    = null;   // classe sélectionnée dans la nav icônes
let iconNavSubject  = null;   // matière sélectionnée dans la nav icônes

// ====================================
// RÉCUPÉRATION ET AFFICHAGE DES DONNÉES
// ====================================
async function fetchAndDisplayData() {
    if (!currentSemester) return;
    
    try {
        const response = await fetch(`/all-notes?semester=${currentSemester}`);
        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des notes');
        }
        
        allNotesData = await response.json();
        console.log(`📊 ${allNotesData.length} notes chargées pour ${currentSemester}`);

        // Après rechargement des données, re-afficher selon l'état de navigation
        if (iconNavClass && iconNavSubject) {
            // On est dans le tableau : rafraîchir les notes affichées
            displayNotesForSubject(iconNavClass, iconNavSubject);
        } else if (iconNavClass) {
            // On est dans les matières : rafraîchir les icônes matières
            displaySubjectIcons(iconNavClass);
        } else {
            // Accueil : afficher les icônes de classes
            displayClassIcons();
        }
    } catch (error) {
        console.error('Error fetching notes:', error);
        outputDiv.innerHTML = '<p style="color: red; padding:2rem; text-align:center;">❌ Erreur lors du chargement des notes</p>';
    }
}

// ====================================
// SYSTÈME D'ICÔNES — NIVEAU 1 : CLASSES
// ====================================
function displayClassIcons() {
    iconNavClass   = null;
    iconNavSubject = null;

    // Synchroniser les selects filtres (reset silencieux — sans déclencher filterAndDisplayNotes)
    _suppressFilterChange = true;
    sortClassSelect.value   = '';
    updateSortDropdownsForFilterClass('');
    sortSubjectSelect.value = '';
    sortStudentSelect.value = '';
    _suppressFilterChange = false;
    currentlyDisplayedNotes = [];
    updateBulkActionsVisibility();

    const classes = currentUserPermissions.classes;

    if (!classes || classes.length === 0) {
        outputDiv.innerHTML = `<div class="icon-nav-empty"><i class="fas fa-exclamation-circle"></i><p>Aucune classe disponible.</p></div>`;
        return;
    }

    let html = `
        <div class="icon-nav-wrapper">
            <div class="icon-nav-header">
                <i class="fas fa-school"></i>
                <span>Choisissez une classe pour consulter les notes</span>
            </div>
            <div class="icon-nav-grid icon-nav-classes">
    `;

    classes.forEach(cls => {
        const v = getClassVisual(cls);
        html += `
            <div class="icon-nav-card class-card" onclick="displaySubjectIcons('${cls}')" title="Classe ${cls}">
                <div class="icon-nav-bubble" style="background:${v.gradient};">
                    <i class="fas ${v.icon}"></i>
                </div>
                <span class="icon-nav-label">${v.label}</span>
            </div>
        `;
    });

    html += `</div></div>`;
    outputDiv.innerHTML = html;
}

// ====================================
// SYSTÈME D'ICÔNES — NIVEAU 2 : MATIÈRES
// ====================================
function displaySubjectIcons(className) {
    iconNavClass   = className;
    iconNavSubject = null;

    // Synchroniser les selects filtres silencieusement
    _suppressFilterChange = true;
    sortClassSelect.value   = className;
    updateSortDropdownsForFilterClass(className);
    sortSubjectSelect.value = '';
    sortStudentSelect.value = '';
    _suppressFilterChange = false;
    currentlyDisplayedNotes = [];
    updateBulkActionsVisibility();

    // Matières autorisées pour cet enseignant + cette classe
    const allSubjectsForClass = subjectsByClassGlobal[className] || [];
    const subjects = allSubjectsForClass.filter(s => currentUserPermissions.subjects.includes(s));

    const cv = getClassVisual(className);

    let html = `
        <div class="icon-nav-wrapper">
            <div class="icon-nav-breadcrumb">
                <button class="icon-nav-back" onclick="displayClassIcons()">
                    <i class="fas fa-arrow-left"></i> Toutes les classes
                </button>
                <span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span>
                <span class="breadcrumb-current" style="background:${cv.gradient};">
                    <i class="fas ${cv.icon}"></i> ${cv.label}
                </span>
            </div>
            <div class="icon-nav-header">
                <i class="fas fa-book"></i>
                <span>Choisissez une matière</span>
            </div>
            <div class="icon-nav-grid icon-nav-subjects">
    `;

    if (subjects.length === 0) {
        html += `<div class="icon-nav-empty-inline"><i class="fas fa-info-circle"></i> Aucune matière disponible pour cette classe.</div>`;
    } else {
        const students = studentsByClassGlobal[className] || [];
        subjects.forEach(subject => {
            const sv = getSubjectIcon(subject);
            const isComplete = isSubjectComplete(className, subject, students);
            html += `
                <div class="icon-nav-card subject-card ${isComplete ? 'complete' : ''}"
                     onclick="displayNotesForSubject('${className}', '${subject.replace(/'/g, "\\'")}')">
                    <div class="icon-nav-bubble subject-bubble" style="background: linear-gradient(135deg, ${sv.color}cc, ${sv.color});">
                        <i class="fas ${sv.icon}"></i>
                    </div>
                    ${isComplete ? '<div class="complete-badge"><i class="fas fa-check-circle"></i> Complet</div>' : ''}
                    <span class="icon-nav-label subject-label" title="${subject}">${subject}</span>
                </div>
            `;
        });
    }

    html += `</div></div>`;
    outputDiv.innerHTML = html;
}

// Vérifie si tous les élèves d'une classe ont au moins une note pour cette matière
function isSubjectComplete(className, subject, students) {
    if (!students || students.length === 0) return false;
    return students.every(student => {
        const note = allNotesData.find(n =>
            n.class   === className  &&
            n.subject === subject    &&
            n.studentName === student &&
            n.semester === currentSemester
        );
        if (!note) return false;
        const tc   = normalizeVal(note.travauxClasse);
        const dev  = normalizeVal(note.devoirs);
        const eva  = normalizeVal(note.evaluation);
        const exam = normalizeVal(note.examen);
        return tc !== '' || dev !== '' || eva !== '' || exam !== '';
    });
}

// ====================================
// SYSTÈME D'ICÔNES — NIVEAU 3 : TABLEAU
// ====================================
function displayNotesForSubject(className, subject) {
    iconNavClass   = className;
    iconNavSubject = subject;

    // Synchroniser les selects filtres silencieusement
    _suppressFilterChange = true;
    sortClassSelect.value   = className;
    sortSubjectSelect.value = subject;
    sortStudentSelect.value = '';
    _suppressFilterChange = false;

    const cv = getClassVisual(className);
    const sv = getSubjectIcon(subject);

    // Filtrer et trier les notes
    let filteredNotes = allNotesData.filter(n =>
        n.class   === className  &&
        n.subject === subject    &&
        n.semester === currentSemester
    );
    filteredNotes.sort((a, b) => a.studentName.localeCompare(b.studentName));

    // Calculer l'état de complétion
    const students = studentsByClassGlobal[className] || [];
    const complete  = isSubjectComplete(className, subject, students);

    // Breadcrumb + tableau
    let html = `
        <div class="icon-nav-table-header">
            <div class="icon-nav-breadcrumb">
                <button class="icon-nav-back" onclick="displayClassIcons()">
                    <i class="fas fa-arrow-left"></i> Classes
                </button>
                <span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span>
                <button class="icon-nav-back-subject" onclick="displaySubjectIcons('${className}')">
                    <i class="fas ${cv.icon}"></i> ${cv.label}
                </button>
                <span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span>
                <span class="breadcrumb-current subject-crumb" style="background: linear-gradient(135deg, ${sv.color}bb, ${sv.color});">
                    <i class="fas ${sv.icon}"></i> ${subject}
                </span>
                ${complete ? '<span class="breadcrumb-complete"><i class="fas fa-check-circle"></i> Matière complète</span>' : ''}
            </div>
        </div>
    `;

    outputDiv.innerHTML = html;

    // Appeler displayNotesTable qui gère aussi les bulk actions
    if (filteredNotes.length === 0) {
        outputDiv.innerHTML += `<div class="icon-nav-no-notes"><i class="fas fa-inbox"></i><p>Aucune note enregistrée pour cette matière.<br>Utilisez le formulaire ci-dessus pour saisir les notes.</p></div>`;
        currentlyDisplayedNotes = [];
        updateBulkActionsVisibility();
    } else {
        // Créer un conteneur séparé pour le tableau
        const tableContainer = document.createElement('div');
        tableContainer.id = 'table-container-inner';
        outputDiv.appendChild(tableContainer);
        // Temporairement pointer outputDiv vers tableContainer pour displayNotesTable
        const origOutputDiv = outputDiv;
        const savedHTML = outputDiv.innerHTML;
        // Patch : on insère le tableau dans le conteneur
        displayNotesTableInto(filteredNotes, tableContainer);
    }
}

// Version de displayNotesTable qui écrit dans un conteneur cible
function displayNotesTableInto(notes, container) {
    currentlyDisplayedNotes = notes;
    updateBulkActionsVisibility();

    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Élève</th>
                    <th>TC</th>
                    <th>Dev</th>
                    <th>Eval</th>
                    <th>Exam</th>
                    <th>Total</th>
                    <th>Saisi</th>
                    ${isAdmin ? '<th>Approuvé</th>' : ''}
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    notes.forEach(note => {
        const tc   = normalizeVal(note.travauxClasse);
        const dev  = normalizeVal(note.devoirs);
        const eva  = normalizeVal(note.evaluation);
        const exam = normalizeVal(note.examen);

        const hasAny = tc !== '' || dev !== '' || eva !== '' || exam !== '';
        let totalDisplay = '';
        if (hasAny) {
            const total = (tc   !== '' ? parseFloat(tc)   : 0) +
                          (dev  !== '' ? parseFloat(dev)  : 0) +
                          (eva  !== '' ? parseFloat(eva)  : 0) +
                          (exam !== '' ? parseFloat(exam) : 0);
            totalDisplay = String(parseFloat(total.toFixed(4)));
        }

        const enteredChecked = note.enteredInSystem ? 'checked' : '';
        const enteredCheckbox = `<input type="checkbox" ${enteredChecked} onchange="toggleEnteredInSystem('${note._id}', this.checked)" title="Marquer comme saisi">`;

        let approvedCheckbox = '';
        if (isAdmin) {
            const approvedChecked = note.approvedByAdmin ? 'checked' : '';
            approvedCheckbox = `<td><input type="checkbox" ${approvedChecked} onchange="toggleApprovedByAdmin('${note._id}', this.checked)" title="Approuver"></td>`;
        }

        const tcInput   = `<input type="number" value="${tc}"   placeholder="—" min="0" step="any" onchange="updateNoteField('${note._id}', 'travauxClasse', this.value)">`;
        const devInput  = `<input type="number" value="${dev}"  placeholder="—" min="0" step="any" onchange="updateNoteField('${note._id}', 'devoirs',      this.value)">`;
        const evaInput  = `<input type="number" value="${eva}"  placeholder="—" min="0" step="any" onchange="updateNoteField('${note._id}', 'evaluation',   this.value)">`;
        const examInput = `<input type="number" value="${exam}" placeholder="—" min="0" step="any" onchange="updateNoteField('${note._id}', 'examen',       this.value)">`;

        tableHTML += `
            <tr id="note-row-${note._id}">
                <td class="student-name-cell">${note.studentName}</td>
                <td>${tcInput}</td>
                <td>${devInput}</td>
                <td>${evaInput}</td>
                <td>${examInput}</td>
                <td><strong id="total-${note._id}">${totalDisplay}</strong></td>
                <td>${enteredCheckbox}</td>
                ${approvedCheckbox}
                <td>
                    <button onclick="deleteNote('${note._id}')" class="delete-btn-inline">
                        <i class="fas fa-trash"></i> Supprimer
                    </button>
                </td>
            </tr>
        `;
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
}

function filterAndDisplayNotes() {
    const filterClass   = sortClassSelect.value;
    const filterSubject = sortSubjectSelect.value;
    const filterStudent = sortStudentSelect.value;

    // Si aucun filtre sélectionné, revenir aux icônes de classes
    if (!filterClass && !filterSubject && !filterStudent) {
        displayClassIcons();
        return;
    }

    // Si classe sélectionnée sans matière ni élève → icônes de matières
    if (filterClass && !filterSubject && !filterStudent) {
        displaySubjectIcons(filterClass);
        return;
    }

    // Si classe + matière → tableau via le système d'icônes
    if (filterClass && filterSubject && !filterStudent) {
        displayNotesForSubject(filterClass, filterSubject);
        return;
    }

    // Sinon filtrage classique (avec filtre élève par exemple)
    iconNavClass   = filterClass   || null;
    iconNavSubject = filterSubject || null;

    let filteredNotes = allNotesData.filter(note => {
        return (!filterClass   || note.class       === filterClass)   &&
               (!filterSubject || note.subject     === filterSubject) &&
               (!filterStudent || note.studentName === filterStudent);
    });

    filteredNotes.sort((a, b) => {
        if (a.class !== b.class) return a.class.localeCompare(b.class);
        return a.studentName.localeCompare(b.studentName);
    });

    displayNotesTable(filteredNotes);
}

function updateSortDropdownsForFilterClass(filterClass) {
    const prevStudent = sortStudentSelect.value;
    const prevSubject = sortSubjectSelect.value;

    // 1. Mettre à jour les élèves de la classe sélectionnée
    clearSelectOptions(sortStudentSelect, 'Tous les Élèves');
    if (!filterClass) {
        const allStudents = new Set();
        (currentUserPermissions.classes || []).forEach(cls => {
            (studentsByClassGlobal[cls] || []).forEach(s => allStudents.add(s));
        });
        Array.from(allStudents).sort().forEach(s => addOption(sortStudentSelect, s, s));
    } else {
        const classStudents = (studentsByClassGlobal[filterClass] || []).slice().sort();
        classStudents.forEach(s => addOption(sortStudentSelect, s, s));
    }
    if (prevStudent && Array.from(sortStudentSelect.options).some(o => o.value === prevStudent)) {
        sortStudentSelect.value = prevStudent;
    } else {
        sortStudentSelect.value = '';
    }

    // 2. Mettre à jour les matières de la classe sélectionnée (uniquement celles de cette classe)
    clearSelectOptions(sortSubjectSelect, 'Toutes les Matières');
    if (!filterClass) {
        (currentUserPermissions.subjects || []).forEach(subj => {
            addOption(sortSubjectSelect, subj, subj);
        });
    } else {
        const classSubjects = (subjectsByClassGlobal[filterClass] || [])
            .filter(subj => (currentUserPermissions.subjects || []).includes(subj))
            .slice().sort();
        classSubjects.forEach(subj => {
            addOption(sortSubjectSelect, subj, subj);
        });
    }
    if (prevSubject && Array.from(sortSubjectSelect.options).some(o => o.value === prevSubject)) {
        sortSubjectSelect.value = prevSubject;
    } else {
        sortSubjectSelect.value = '';
    }
}

// ====================================
// AFFICHAGE DU TABLEAU AVEC MODIFICATION INLINE (mode filtrage élève)
// ====================================
function displayNotesTable(notes) {
    currentlyDisplayedNotes = notes;
    updateBulkActionsVisibility();

    if (notes.length === 0) {
        outputDiv.innerHTML = `
            <div class="icon-nav-no-notes">
                <i class="fas fa-inbox"></i>
                <p>Aucune note disponible pour les filtres sélectionnés.</p>
                <button class="icon-nav-back" onclick="displayClassIcons()" style="margin-top:1rem;">
                    <i class="fas fa-arrow-left"></i> Retour aux classes
                </button>
            </div>`;
        return;
    }

    // Breadcrumb retour
    let breadcrumb = `
        <div class="icon-nav-breadcrumb" style="margin-bottom:1rem;">
            <button class="icon-nav-back" onclick="displayClassIcons()">
                <i class="fas fa-arrow-left"></i> Classes
            </button>
        </div>
    `;

    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Classe</th>
                    <th>Matière</th>
                    <th>Élève</th>
                    <th>TC</th>
                    <th>Dev</th>
                    <th>Eval</th>
                    <th>Exam</th>
                    <th>Total</th>
                    <th>Saisi</th>
                    ${isAdmin ? '<th>Approuvé</th>' : ''}
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    notes.forEach(note => {
        // normalizeVal() : 0, "0", null, "" → '' (case vide)
        const tc   = normalizeVal(note.travauxClasse);
        const dev  = normalizeVal(note.devoirs);
        const eva  = normalizeVal(note.evaluation);
        const exam = normalizeVal(note.examen);

        const hasAny = tc !== '' || dev !== '' || eva !== '' || exam !== '';
        let totalDisplay = '';
        if (hasAny) {
            const total = (tc   !== '' ? parseFloat(tc)   : 0) +
                          (dev  !== '' ? parseFloat(dev)  : 0) +
                          (eva  !== '' ? parseFloat(eva)  : 0) +
                          (exam !== '' ? parseFloat(exam) : 0);
            totalDisplay = String(parseFloat(total.toFixed(4)));
        }

        const enteredChecked  = note.enteredInSystem  ? 'checked' : '';
        const enteredCheckbox = `<input type="checkbox" ${enteredChecked} onchange="toggleEnteredInSystem('${note._id}', this.checked)" title="Marquer comme saisi">`;

        let approvedCheckbox = '';
        if (isAdmin) {
            const approvedChecked = note.approvedByAdmin ? 'checked' : '';
            approvedCheckbox = `<td><input type="checkbox" ${approvedChecked} onchange="toggleApprovedByAdmin('${note._id}', this.checked)" title="Approuver"></td>`;
        }

        const tcInput   = `<input type="number" value="${tc}"   placeholder="—" min="0" step="any" onchange="updateNoteField('${note._id}', 'travauxClasse', this.value)">`;
        const devInput  = `<input type="number" value="${dev}"  placeholder="—" min="0" step="any" onchange="updateNoteField('${note._id}', 'devoirs',      this.value)">`;
        const evaInput  = `<input type="number" value="${eva}"  placeholder="—" min="0" step="any" onchange="updateNoteField('${note._id}', 'evaluation',   this.value)">`;
        const examInput = `<input type="number" value="${exam}" placeholder="—" min="0" step="any" onchange="updateNoteField('${note._id}', 'examen',       this.value)">`;

        tableHTML += `
            <tr id="note-row-${note._id}">
                <td>${note.class}</td>
                <td>${note.subject}</td>
                <td>${note.studentName}</td>
                <td>${tcInput}</td>
                <td>${devInput}</td>
                <td>${evaInput}</td>
                <td>${examInput}</td>
                <td><strong id="total-${note._id}">${totalDisplay}</strong></td>
                <td>${enteredCheckbox}</td>
                ${approvedCheckbox}
                <td>
                    <button onclick="deleteNote('${note._id}')" class="delete-btn-inline">
                        <i class="fas fa-trash"></i> Supprimer
                    </button>
                </td>
            </tr>
        `;
    });

    tableHTML += '</tbody></table>';
    outputDiv.innerHTML = breadcrumb + tableHTML;
}

// ====================================
// GESTION DES CHECKBOXES (NOUVEAU)
// ====================================
window.toggleEnteredInSystem = async function(noteId, isEntered) {
    try {
        const response = await fetch(`/update-note/${noteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enteredInSystem: isEntered })
        });
        
        if (response.ok) {
            console.log(`✅ Note ${noteId} - Saisi: ${isEntered}`);
            fetchAndDisplayData();
        } else {
            alert('Erreur lors de la mise à jour');
            fetchAndDisplayData();
        }
    } catch (error) {
        console.error('Error updating enteredInSystem:', error);
        alert('Erreur réseau');
        fetchAndDisplayData();
    }
};

window.toggleApprovedByAdmin = async function(noteId, isApproved) {
    if (!isAdmin) {
        alert('Seuls les administrateurs peuvent approuver les notes.');
        fetchAndDisplayData();
        return;
    }
    
    try {
        const response = await fetch(`/update-note/${noteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvedByAdmin: isApproved })
        });
        
        if (response.ok) {
            console.log(`✅ Note ${noteId} - Approuvé: ${isApproved}`);
            fetchAndDisplayData();
        } else {
            alert('Erreur lors de l\'approbation');
            fetchAndDisplayData();
        }
    } catch (error) {
        console.error('Error updating approvedByAdmin:', error);
        alert('Erreur réseau');
        fetchAndDisplayData();
    }
};

// ====================================
// MODIFICATION INLINE DES NOTES
// ====================================
window.updateNoteField = async function(noteId, field, value) {
    // normalizeVal: 0, "0", "", null → null (case vide). Sinon String exact.
    const normalized = normalizeVal(value);
    const cleanValue = normalized === '' ? null : normalized;
    
    const updateData = {};
    updateData[field] = cleanValue;
    
    try {
        const response = await fetch(`/update-note/${noteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            console.log(`✅ Note ${noteId} - ${field} mis à jour: ${cleanValue}`);
            
            // Mettre à jour le total localement sans recharger toute la page
            const note = allNotesData.find(n => n._id === noteId);
            if (note) {
                note[field] = cleanValue; // cleanValue est String ou null
                updateTotal(noteId, note);
            }
        } else {
            const error = await response.text();
            alert(`Erreur: ${error}`);
            fetchAndDisplayData(); // Recharger en cas d'erreur
        }
    } catch (error) {
        console.error('Error updating note field:', error);
        alert('Erreur réseau');
        fetchAndDisplayData();
    }
};

// Fonction pour mettre à jour le total d'une note
function updateTotal(noteId, note) {
    // normalizeVal() : 0, "0", null → '' → pas compté dans le total
    const tcStr   = normalizeVal(note.travauxClasse);
    const devStr  = normalizeVal(note.devoirs);
    const evaStr  = normalizeVal(note.evaluation);
    const examStr = normalizeVal(note.examen);
    const tc   = tcStr   !== '' ? parseFloat(tcStr)   : null;
    const dev  = devStr  !== '' ? parseFloat(devStr)  : null;
    const eva  = evaStr  !== '' ? parseFloat(evaStr)  : null;
    const exam = examStr !== '' ? parseFloat(examStr) : null;
    
    const hasAnyNote = tc !== null || dev !== null || eva !== null || exam !== null;
    
    let totalDisplay = '';
    if (hasAnyNote) {
        const total = (tc ?? 0) + (dev ?? 0) + (eva ?? 0) + (exam ?? 0);
        // Afficher sans zéros inutiles: 26 reste 26, pas 26.00
        totalDisplay = String(parseFloat(total.toFixed(4)));
    }
    
    const totalElement = document.getElementById(`total-${noteId}`);
    if (totalElement) {
        totalElement.textContent = totalDisplay;
    }
}

// ====================================
// SUPPRESSION DE NOTES
// ====================================
window.deleteNote = async function(noteId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette note ?')) return;
    
    try {
        const response = await fetch(`/delete-note/${noteId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showFormMessage(formSuccessMessage, '✅ Note supprimée avec succès !', false);
            fetchAndDisplayData();
        } else {
            const error = await response.text();
            alert(`Erreur: ${error}`);
        }
    } catch (error) {
        console.error('Error deleting note:', error);
        alert('Erreur réseau');
    }
};

// ====================================
// GÉNÉRATION DE DOCUMENTS
// ====================================
async function generateWordFiles() {
    if (!currentSemester) {
        alert('Veuillez sélectionner un semestre.');
        return;
    }
    
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    
    try {
        const response = await fetch('/generate-word', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ semester: currentSemester })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Notes_${currentSemester}_${Date.now()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            progressBar.style.width = '100%';
            setTimeout(() => {
                progressContainer.style.display = 'none';
            }, 1000);
        } else {
            alert('Erreur lors de la génération Word');
            progressContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('Error generating Word:', error);
        alert('Erreur réseau');
        progressContainer.style.display = 'none';
    }
}

async function generateExcelFile() {
    if (!currentSemester) {
        alert('Veuillez sélectionner un semestre.');
        return;
    }
    
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    
    try {
        const response = await fetch('/generate-excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ semester: currentSemester })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Notes_${currentSemester}_${Date.now()}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            progressBar.style.width = '100%';
            setTimeout(() => {
                progressContainer.style.display = 'none';
            }, 1000);
        } else {
            alert('Erreur lors de la génération Excel');
            progressContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('Error generating Excel:', error);
        alert('Erreur réseau');
        progressContainer.style.display = 'none';
    }
}

// ====================================
// DÉCONNEXION
// ====================================
async function handleLogout() {
    try {
        localStorage.removeItem('al_kawthar_user');
        localStorage.removeItem('al_kawthar_section');
        await fetch('/logout');
    } catch (error) {
        console.error('Error logging out:', error);
    }
    window.location.href = '/home.html';
}

// ====================================

// ====================================
// BOUTONS EN MASSE (BULK ACTIONS)
// ====================================

// Variable pour suivre les notes actuellement affichées (filtrées)
let currentlyDisplayedNotes = [];

// Fonction pour afficher/masquer les boutons en masse
function updateBulkActionsVisibility() {
    const bulkActionsContainer = document.getElementById('bulkActionsContainer');
    const approvedButtonsGroup = document.getElementById('approvedButtonsGroup');
    
    if (currentlyDisplayedNotes.length > 0) {
        bulkActionsContainer.style.display = 'flex';
        
        // Masquer les boutons "Approuvé" si l'utilisateur n'est pas admin
        if (!isAdmin && approvedButtonsGroup) {
            approvedButtonsGroup.style.display = 'none';
        } else if (approvedButtonsGroup) {
            approvedButtonsGroup.style.display = 'flex';
        }
    } else {
        bulkActionsContainer.style.display = 'none';
    }
}

// Fonction générique pour mettre à jour en masse
async function bulkUpdateNotes(field, newState, buttonId, buttonIcon, buttonText, actionName) {
    if (currentlyDisplayedNotes.length === 0) {
        alert('Aucune note à traiter');
        return;
    }
    
    const message = `Voulez-vous ${actionName} toutes les ${currentlyDisplayedNotes.length} notes affichées ?`;
    
    if (!confirm(message)) return;
    
    // Désactiver le bouton pendant le traitement
    const button = document.getElementById(buttonId);
    const originalHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Traitement...</span>';
    
    let successCount = 0;
    let failCount = 0;
    
    // Traiter toutes les notes affichées
    for (const note of currentlyDisplayedNotes) {
        try {
            const updateData = {};
            updateData[field] = newState;
            
            const response = await fetch(`/update-note/${note._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            
            if (response.ok) {
                successCount++;
                note[field] = newState; // Mise à jour locale
            } else {
                failCount++;
            }
        } catch (error) {
            console.error(`Error updating note ${note._id}:`, error);
            failCount++;
        }
    }
    
    // Réactiver le bouton
    button.disabled = false;
    button.innerHTML = originalHTML;
    
    // Afficher le résultat
    const resultMessage = `✅ ${successCount} note(s) mise(s) à jour`;
    const errorMessage = failCount > 0 ? `\n❌ ${failCount} erreur(s)` : '';
    alert(resultMessage + errorMessage);
    
    // Recharger les données
    await fetchAndDisplayData();
}

// Fonction pour cocher tous les "Saisi"
async function setAllEntered() {
    await bulkUpdateNotes(
        'enteredInSystem', 
        true, 
        'setAllEnteredButton',
        'fa-check-double',
        'Tout Saisi',
        'marquer comme "Saisi"'
    );
}

// Fonction pour décocher tous les "Saisi"
async function unsetAllEntered() {
    await bulkUpdateNotes(
        'enteredInSystem', 
        false, 
        'unsetAllEnteredButton',
        'fa-times-circle',
        'Tout Non Saisi',
        'marquer comme "Non Saisi"'
    );
}

// Fonction pour cocher tous les "Approuvé"
async function setAllApproved() {
    if (!isAdmin) {
        alert('Seuls les administrateurs peuvent approuver les notes.');
        return;
    }
    
    await bulkUpdateNotes(
        'approvedByAdmin', 
        true, 
        'setAllApprovedButton',
        'fa-check-circle',
        'Tout Approuvé',
        'approuver'
    );
}

// Fonction pour décocher tous les "Approuvé"
async function unsetAllApproved() {
    if (!isAdmin) {
        alert('Seuls les administrateurs peuvent désapprouver les notes.');
        return;
    }
    
    await bulkUpdateNotes(
        'approvedByAdmin', 
        false, 
        'unsetAllApprovedButton',
        'fa-ban',
        'Tout Désapprouvé',
        'désapprouver'
    );
}

// Attacher les événements aux boutons
document.addEventListener('DOMContentLoaded', () => {
    const setAllEnteredBtn = document.getElementById('setAllEnteredButton');
    const unsetAllEnteredBtn = document.getElementById('unsetAllEnteredButton');
    const setAllApprovedBtn = document.getElementById('setAllApprovedButton');
    const unsetAllApprovedBtn = document.getElementById('unsetAllApprovedButton');
    
    if (setAllEnteredBtn) setAllEnteredBtn.addEventListener('click', setAllEntered);
    if (unsetAllEnteredBtn) unsetAllEnteredBtn.addEventListener('click', unsetAllEntered);
    if (setAllApprovedBtn) setAllApprovedBtn.addEventListener('click', setAllApproved);
    if (unsetAllApprovedBtn) unsetAllApprovedBtn.addEventListener('click', unsetAllApproved);
});

// ====================================
// MODAL RAPPORT OFFICIEL (HTML / PDF A4)
// ====================================
function openReportModal() {
    const modal = document.getElementById('reportModal');
    if (!modal) return;
    
    const semSelect = document.getElementById('reportSemesterSelect');
    if (semSelect && currentSemester) {
        semSelect.value = currentSemester;
    }

    const classSelect = document.getElementById('reportClassSelect');
    if (classSelect) {
        classSelect.innerHTML = '<option value="ALL">Toutes les Classes (Bulletin Complet)</option>';
        const availableClasses = (currentUserPermissions.classes && currentUserPermissions.classes.length > 0)
            ? currentUserPermissions.classes
            : Object.keys(studentsByClassGlobal);
        [...new Set(availableClasses)].sort().forEach(cls => {
            classSelect.add(new Option(`Classe ${cls}`, cls));
        });
    }

    modal.style.display = 'flex';
}

function closeReportModal() {
    const modal = document.getElementById('reportModal');
    if (modal) modal.style.display = 'none';
}

// ====================================
// ADMINISTRATION — GESTION CLASSES, ÉLÈVES & ENSEIGNANTS
// ====================================
function initAdminPanel() {
    // Bouton Rapport PDF accessible à TOUS les utilisateurs
    const openReportBtn = document.getElementById('openReportModalBtn');
    if (openReportBtn) {
        openReportBtn.addEventListener('click', openReportModal);
    }
    const closeReportBtn = document.getElementById('closeReportModal');
    if (closeReportBtn) closeReportBtn.addEventListener('click', closeReportModal);
    const cancelReportBtn = document.getElementById('cancelReportModal');
    if (cancelReportBtn) cancelReportBtn.addEventListener('click', closeReportModal);

    const submitReportBtn = document.getElementById('submitReportModal');
    if (submitReportBtn) {
        submitReportBtn.addEventListener('click', () => {
            const sem = document.getElementById('reportSemesterSelect')?.value || currentSemester || 'S1';
            const targetClass = document.getElementById('reportClassSelect')?.value || 'ALL';
            const url = `/generate-html-report?semester=${encodeURIComponent(sem)}&targetClass=${encodeURIComponent(targetClass)}`;
            closeReportModal();
            window.location.href = url;
        });
    }

    // Gestion du panneau Admin (réservé aux admins)
    const openAdminBtn = document.getElementById('openAdminModalBtn');
    const uname = (currentUserData?.username || '').trim().toLowerCase();
    const effectiveIsAdmin = isAdmin || uname === 'mohamed' || uname === 'zohra';
    if (openAdminBtn) {
        if (effectiveIsAdmin) {
            openAdminBtn.style.display = 'inline-flex';
            openAdminBtn.removeEventListener('click', openAdminModal);
            openAdminBtn.addEventListener('click', openAdminModal);
        } else {
            openAdminBtn.style.display = 'none';
        }
    }

    if (!effectiveIsAdmin) return;
}

// ====================================
// ADMINISTRATION ACADÉMIQUE PRO — SANS ICÔNES ÉNORMES
// ====================================
let adminTeachersCache = [];
let adminListenersBound = false;

function openAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) {
        modal.style.display = 'flex';
        bindAdminControlsOnce();
        populateAdminModalData();
    }
}

function closeAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function getInitials(name) {
    if (!name || typeof name !== 'string') return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function showAdminNotice(text, isError = false) {
    const msg = document.getElementById('adminMessage');
    if (!msg) return;
    msg.style.color = isError ? 'var(--danger)' : '#16A34A';
    msg.textContent = (isError ? '⚠️ ' : '✅ ') + text;
    setTimeout(() => {
        if (msg.textContent.includes(text)) msg.textContent = '';
    }, 4500);
}

// ------------------------------------
// SOUS-DIALOGUES IN-APP (ZÉRO ALERT / PROMPT / CONFIRM)
// ------------------------------------
function showSubdialogPrompt({ title, desc, defaultValue, placeholder, onConfirm }) {
    const overlay = document.getElementById('adminPromptDialog');
    const titleEl = document.getElementById('adminPromptTitle');
    const descEl = document.getElementById('adminPromptDesc');
    const inputEl = document.getElementById('adminPromptInput');
    const confirmBtn = document.getElementById('adminPromptConfirmBtn');
    const cancelBtn = document.getElementById('adminPromptCancelBtn');

    if (!overlay || !inputEl || !confirmBtn || !cancelBtn) return;

    titleEl.textContent = title;
    descEl.textContent = desc;
    inputEl.value = defaultValue || '';
    inputEl.placeholder = placeholder || '';
    overlay.style.display = 'flex';
    inputEl.focus();
    inputEl.select();

    const cleanup = () => {
        overlay.style.display = 'none';
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
        inputEl.onkeydown = null;
    };

    cancelBtn.onclick = cleanup;
    confirmBtn.onclick = async () => {
        const val = inputEl.value.trim();
        if (!val) return;
        cleanup();
        await onConfirm(val);
    };

    inputEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmBtn.click();
        } else if (e.key === 'Escape') {
            cleanup();
        }
    };
}

function showSubdialogTransfer({ studentName, currentClass, onConfirm }) {
    const overlay = document.getElementById('adminTransferDialog');
    const descEl = document.getElementById('adminTransferDesc');
    const selectEl = document.getElementById('adminTransferSelect');
    const confirmBtn = document.getElementById('adminTransferConfirmBtn');
    const cancelBtn = document.getElementById('adminTransferCancelBtn');

    if (!overlay || !selectEl || !confirmBtn || !cancelBtn) return;

    descEl.innerHTML = `Transférer l'élève <strong>${studentName}</strong> (actuellement en <strong>${currentClass}</strong>) vers :`;
    selectEl.innerHTML = '';
    const otherClasses = Object.keys(studentsByClassGlobal).filter(c => c !== currentClass).sort();
    
    if (otherClasses.length === 0) {
        showAdminNotice('Aucune autre classe disponible pour le transfert.', true);
        return;
    }

    otherClasses.forEach(c => {
        selectEl.add(new Option(`Classe ${c}`, c));
    });

    overlay.style.display = 'flex';

    const cleanup = () => {
        overlay.style.display = 'none';
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
    };

    cancelBtn.onclick = cleanup;
    confirmBtn.onclick = async () => {
        const targetClass = selectEl.value;
        if (!targetClass) return;
        cleanup();
        await onConfirm(targetClass);
    };
}

function showSubdialogConfirm({ title, desc, actionText, onConfirm }) {
    const overlay = document.getElementById('adminConfirmDialog');
    const titleEl = document.getElementById('adminConfirmTitle');
    const descEl = document.getElementById('adminConfirmDesc');
    const confirmBtn = document.getElementById('adminConfirmActionBtn');
    const cancelBtn = document.getElementById('adminConfirmCancelBtn');

    if (!overlay || !confirmBtn || !cancelBtn) return;

    titleEl.textContent = title;
    descEl.innerHTML = desc;
    confirmBtn.textContent = actionText || 'Supprimer définitivement';
    overlay.style.display = 'flex';

    const cleanup = () => {
        overlay.style.display = 'none';
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
    };

    cancelBtn.onclick = cleanup;
    confirmBtn.onclick = async () => {
        cleanup();
        await onConfirm();
    };
}

// ------------------------------------
// BINDING DES CONTRÔLES D'ADMINISTRATION
// ------------------------------------
function bindAdminControlsOnce() {
    if (adminListenersBound) return;
    adminListenersBound = true;

    const closeBtn = document.getElementById('closeAdminModal');
    if (closeBtn) closeBtn.onclick = closeAdminModal;

    const resetBtn = document.getElementById('resetTeacherFormBtn');
    if (resetBtn) resetBtn.onclick = resetTeacherForm;

    const tab1 = document.getElementById('tabClassesStudents');
    const tab2 = document.getElementById('tabTeachersSubjects');
    const content1 = document.getElementById('adminTab1Content');
    const content2 = document.getElementById('adminTab2Content');

    if (tab1 && tab2) {
        tab1.onclick = () => {
            tab1.classList.add('active');
            tab2.classList.remove('active');
            content1.style.display = 'block';
            content2.style.display = 'none';
            populateAdminModalData();
        };
        tab2.onclick = () => {
            tab2.classList.add('active');
            tab1.classList.remove('active');
            content1.style.display = 'none';
            content2.style.display = 'block';
            loadTeachersList();
        };
    }

    // Toggle panels
    const toggleAddClassBtn = document.getElementById('toggleAddClassBtn');
    const panelAddClass = document.getElementById('panelAddClass');
    const cancelAddClassBtn = document.getElementById('cancelAddClassBtn');
    if (toggleAddClassBtn && panelAddClass) {
        toggleAddClassBtn.onclick = () => {
            const isHidden = panelAddClass.style.display === 'none';
            panelAddClass.style.display = isHidden ? 'block' : 'none';
            if (isHidden) document.getElementById('newClassName')?.focus();
        };
    }
    if (cancelAddClassBtn && panelAddClass) {
        cancelAddClassBtn.onclick = () => {
            panelAddClass.style.display = 'none';
            const input = document.getElementById('newClassName');
            if (input) input.value = '';
        };
    }

    const toggleAddStudentBtn = document.getElementById('toggleAddStudentBtn');
    const panelAddStudent = document.getElementById('panelAddStudent');
    const cancelAddStudentBtn = document.getElementById('cancelAddStudentBtn');
    if (toggleAddStudentBtn && panelAddStudent) {
        toggleAddStudentBtn.onclick = () => {
            const isHidden = panelAddStudent.style.display === 'none';
            panelAddStudent.style.display = isHidden ? 'block' : 'none';
            if (isHidden) document.getElementById('newStudentName')?.focus();
        };
    }
    if (cancelAddStudentBtn && panelAddStudent) {
        cancelAddStudentBtn.onclick = () => {
            panelAddStudent.style.display = 'none';
            const input = document.getElementById('newStudentName');
            if (input) input.value = '';
        };
    }

    const toggleAddTeacherBtn = document.getElementById('toggleAddTeacherBtn');
    const panelAddTeacher = document.getElementById('panelAddTeacher');
    const closeTeacherPanelBtn = document.getElementById('closeTeacherPanelBtn');
    if (toggleAddTeacherBtn && panelAddTeacher) {
        toggleAddTeacherBtn.onclick = () => {
            resetTeacherForm();
            panelAddTeacher.style.display = 'block';
            document.getElementById('teacherName')?.focus();
        };
    }
    if (closeTeacherPanelBtn && panelAddTeacher) {
        closeTeacherPanelBtn.onclick = () => {
            panelAddTeacher.style.display = 'none';
            resetTeacherForm();
        };
    }

    // Live search & filters
    const studentSearchInput = document.getElementById('adminStudentSearchInput');
    if (studentSearchInput) {
        studentSearchInput.oninput = () => populateAdminModalData();
    }

    const filterClassView = document.getElementById('adminFilterClassView');
    if (filterClassView) {
        filterClassView.onchange = () => populateAdminModalData();
    }

    const teacherSearchInput = document.getElementById('adminTeacherSearchInput');
    if (teacherSearchInput) {
        teacherSearchInput.oninput = () => renderFilteredTeachers();
    }

    // Action : Créer une classe
    const addClassBtn = document.getElementById('addClassBtn');
    if (addClassBtn) {
        addClassBtn.onclick = async () => {
            const classNameInput = document.getElementById('newClassName');
            const className = classNameInput.value.trim();
            if (!className) {
                showAdminNotice('Veuillez entrer un nom de classe.', true);
                return;
            }

            try {
                const res = await fetch('/admin/add-class', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ className })
                });
                const result = await res.json();
                if (result.success) {
                    showAdminNotice(result.message);
                    classNameInput.value = '';
                    panelAddClass.style.display = 'none';
                    if (!studentsByClassGlobal[className]) studentsByClassGlobal[className] = [];
                    await refreshAppData();
                    populateAdminModalData();
                    await fetchAndDisplayData();
                } else {
                    showAdminNotice(result.message, true);
                }
            } catch (err) {
                showAdminNotice('Erreur réseau lors de la création de la classe.', true);
            }
        };
    }

    // Action : Inscrire un élève
    const addStudentBtn = document.getElementById('addStudentBtn');
    if (addStudentBtn) {
        addStudentBtn.onclick = async () => {
            const className = document.getElementById('adminStudentClassSelect').value;
            const studentInput = document.getElementById('newStudentName');
            const studentName = studentInput.value.trim();
            if (!className || !studentName) {
                showAdminNotice('Veuillez sélectionner une classe et entrer le nom de l\'élève.', true);
                return;
            }

            try {
                const res = await fetch('/admin/add-student', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ className, studentName })
                });
                const result = await res.json();
                if (result.success) {
                    showAdminNotice(result.message);
                    studentInput.value = '';
                    panelAddStudent.style.display = 'none';
                    if (!studentsByClassGlobal[className]) studentsByClassGlobal[className] = [];
                    if (!studentsByClassGlobal[className].includes(studentName)) {
                        studentsByClassGlobal[className].push(studentName);
                        studentsByClassGlobal[className].sort();
                    }
                    await refreshAppData();
                    populateAdminModalData();
                    await fetchAndDisplayData();
                } else {
                    showAdminNotice(result.message, true);
                }
            } catch (err) {
                showAdminNotice('Erreur réseau lors de l\'inscription.', true);
            }
        };
    }

    // Action : Enregistrer Enseignant
    const teacherForm = document.getElementById('adminTeacherForm');
    if (teacherForm) {
        teacherForm.onsubmit = async (e) => {
            e.preventDefault();
            const oldTeacherName = document.getElementById('oldTeacherName').value.trim();
            const teacherName = document.getElementById('teacherName').value.trim();
            const teacherPassword = document.getElementById('teacherPassword').value.trim();
            const teacherSubject = document.getElementById('teacherSubject').value.trim();
            const teacherClasses = document.getElementById('teacherClasses').value.trim();

            if (!teacherName || !teacherSubject || !teacherClasses) {
                showAdminNotice('Veuillez remplir tous les champs obligatoires (*).', true);
                return;
            }

            try {
                const res = await fetch('/admin/save-teacher', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        oldTeacherName,
                        teacherName,
                        password: teacherPassword || teacherName,
                        subject: teacherSubject,
                        classes: teacherClasses
                    })
                });
                const result = await res.json();
                if (result.success) {
                    showAdminNotice(result.message);
                    resetTeacherForm();
                    panelAddTeacher.style.display = 'none';
                    await loadTeachersList();
                    await refreshAppData();
                } else {
                    showAdminNotice(result.message, true);
                }
            } catch (err) {
                showAdminNotice('Erreur réseau lors de l\'enregistrement de l\'enseignant.', true);
            }
        };
    }
}

// ------------------------------------
// TAB 1 : AFFICHAGE CLASSES ET ÉLÈVES
// ------------------------------------
function populateAdminModalData() {
    const classNames = Object.keys(studentsByClassGlobal).sort();

    // Remplir sélecteur de classe du formulaire d'inscription
    const studentClassSelect = document.getElementById('adminStudentClassSelect');
    if (studentClassSelect) {
        const currentVal = studentClassSelect.value;
        studentClassSelect.innerHTML = '<option value="">Sélectionner la classe</option>';
        classNames.forEach(cls => {
            studentClassSelect.add(new Option(`Classe ${cls}`, cls));
        });
        if (currentVal && classNames.includes(currentVal)) {
            studentClassSelect.value = currentVal;
        }
    }

    // Remplir sélecteur filtre de vue
    const filterClassView = document.getElementById('adminFilterClassView');
    if (filterClassView) {
        const currentFilter = filterClassView.value || 'ALL';
        filterClassView.innerHTML = '<option value="ALL">Afficher toutes les classes</option>';
        classNames.forEach(cls => {
            const count = (studentsByClassGlobal[cls] || []).length;
            filterClassView.add(new Option(`Classe ${cls} (${count} élèves)`, cls));
        });
        if (currentFilter && (currentFilter === 'ALL' || classNames.includes(currentFilter))) {
            filterClassView.value = currentFilter;
        }
    }

    // Récupérer termes de recherche
    const searchFilter = (document.getElementById('adminStudentSearchInput')?.value || '').toLowerCase().trim();
    const selectedClassFilter = filterClassView ? filterClassView.value : 'ALL';

    const container = document.getElementById('adminStudentsListContainer');
    if (!container) return;
    container.innerHTML = '';

    if (classNames.length === 0) {
        container.innerHTML = `
            <div style="padding: 2.5rem 1rem; text-align: center; color: var(--text-muted); background: var(--surface-2); border-radius: 10px; border: 1px dashed var(--border);">
                <i class="fas fa-folder-open" style="font-size: 1.5rem; opacity: 0.5; margin-bottom: 0.5rem; display: block;"></i>
                <div style="font-size: 0.9rem; font-weight: 600;">Aucune classe enregistrée</div>
                <div style="font-size: 0.8rem; margin-top: 0.25rem;">Cliquez sur « Nouvelle Classe » ci-dessus pour initialiser une cohorte.</div>
            </div>
        `;
        return;
    }

    let displayedClassesCount = 0;
    let displayedStudentsCount = 0;

    classNames.forEach(cls => {
        if (selectedClassFilter !== 'ALL' && selectedClassFilter !== cls) {
            return;
        }

        const allStudents = studentsByClassGlobal[cls] || [];
        const filteredStudents = allStudents.filter(s => {
            if (!searchFilter) return true;
            return s.toLowerCase().includes(searchFilter) || cls.toLowerCase().includes(searchFilter);
        });

        if (searchFilter && filteredStudents.length === 0 && !cls.toLowerCase().includes(searchFilter)) {
            return;
        }

        displayedClassesCount++;
        displayedStudentsCount += filteredStudents.length;

        const classCard = document.createElement('div');
        classCard.className = 'admin-class-card';

        // En-tête de classe
        const header = document.createElement('div');
        header.className = 'admin-class-card-header';
        header.innerHTML = `
            <div class="admin-class-card-title">
                <i class="fas fa-layer-group" style="font-size: 0.85rem; color: var(--primary);"></i>
                <span>Classe ${cls}</span>
                <span class="admin-class-pill">${allStudents.length} élève(s)</span>
            </div>
            <div style="display: flex; gap: 0.4rem; align-items: center;">
                <button type="button" class="admin-action-btn admin-action-edit" onclick="openRenameClassModal('${cls}')" title="Renommer la classe ${cls}">
                    <i class="fas fa-pen"></i> Renommer
                </button>
                <button type="button" class="admin-action-btn admin-btn-secondary" onclick="quickEnrollStudent('${cls}')" title="Inscrire un élève en classe ${cls}">
                    <i class="fas fa-user-plus"></i> + Élève
                </button>
                <button type="button" class="admin-action-btn admin-action-delete" onclick="openDeleteClassModal('${cls}')" title="Supprimer la classe ${cls}">
                    <i class="fas fa-trash"></i> Supprimer
                </button>
            </div>
        `;
        classCard.appendChild(header);

        // Tableau des élèves
        if (filteredStudents.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.style.padding = '1.25rem';
            emptyEl.style.textAlign = 'center';
            emptyEl.style.color = 'var(--text-muted)';
            emptyEl.style.fontSize = '0.82rem';
            emptyEl.innerHTML = searchFilter ? 'Aucun élève ne correspond à votre recherche.' : 'Aucun élève inscrit dans cette classe pour le moment.';
            classCard.appendChild(emptyEl);
        } else {
            const tableWrapper = document.createElement('div');
            tableWrapper.style.overflowX = 'auto';

            let tableHtml = `
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th style="width: 48px; text-align: center;">#</th>
                            <th>Nom &amp; Prénom de l'Élève</th>
                            <th style="width: 140px;">Classe</th>
                            <th style="width: 250px; text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            filteredStudents.forEach((studentName, idx) => {
                const numStr = String(idx + 1).padStart(2, '0');
                const initials = getInitials(studentName);
                const safeName = studentName.replace(/'/g, "\\'");

                tableHtml += `
                    <tr>
                        <td style="text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 0.76rem; color: var(--text-muted);">
                            ${numStr}
                        </td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 0.65rem;">
                                <span class="admin-avatar">${initials}</span>
                                <span style="font-weight: 600; color: var(--text-primary); font-size: 0.85rem;">${studentName}</span>
                            </div>
                        </td>
                        <td>
                            <span class="admin-badge admin-badge-class">Classe ${cls}</span>
                        </td>
                        <td style="text-align: right;">
                            <div style="display: inline-flex; gap: 0.35rem; justify-content: flex-end;">
                                <button type="button" class="admin-action-btn admin-action-edit" onclick="openRenameStudentModal('${cls}', '${safeName}')" title="Modifier le nom">
                                    <i class="fas fa-edit"></i> Modifier
                                </button>
                                <button type="button" class="admin-action-btn admin-action-transfer" onclick="openTransferStudentModal('${cls}', '${safeName}')" title="Transférer dans une autre classe">
                                    <i class="fas fa-exchange-alt"></i> Transférer
                                </button>
                                <button type="button" class="admin-action-btn admin-action-delete" onclick="openDeleteStudentModal('${cls}', '${safeName}')" title="Supprimer l'élève">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            tableHtml += `
                    </tbody>
                </table>
            `;
            tableWrapper.innerHTML = tableHtml;
            classCard.appendChild(tableWrapper);
        }

        container.appendChild(classCard);
    });

    if (displayedClassesCount === 0) {
        container.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.86rem;">
                Aucune classe ou élève ne correspond à vos filtres actuels.
            </div>
        `;
    }
}

// ------------------------------------
// ACTIONS ÉLÈVES & CLASSES (IN-APP DIALOGS)
// ------------------------------------
function quickEnrollStudent(className) {
    const panel = document.getElementById('panelAddStudent');
    const select = document.getElementById('adminStudentClassSelect');
    const nameInput = document.getElementById('newStudentName');
    if (panel && select) {
        panel.style.display = 'block';
        select.value = className;
        nameInput?.focus();
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function openRenameClassModal(oldClassName) {
    showSubdialogPrompt({
        title: `Renommer la classe ${oldClassName}`,
        desc: `Entrez le nouveau nom officiel de la classe :`,
        defaultValue: oldClassName,
        placeholder: 'ex: PEI6, Terminale A...',
        onConfirm: async (newClassName) => {
            if (newClassName === oldClassName) return;
            try {
                const res = await fetch('/admin/update-class', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ oldClassName, newClassName })
                });
                const result = await res.json();
                if (result.success) {
                    showAdminNotice(result.message);
                    await refreshAppData();
                    populateAdminModalData();
                    await fetchAndDisplayData();
                } else {
                    showAdminNotice(result.message, true);
                }
            } catch (e) {
                showAdminNotice('Erreur réseau lors de la modification de classe.', true);
            }
        }
    });
}

function openDeleteClassModal(className) {
    const studentCount = (studentsByClassGlobal[className] || []).length;
    showSubdialogConfirm({
        title: `Supprimer la classe ${className}`,
        desc: `Êtes-vous certain de vouloir supprimer la <strong>Classe ${className}</strong> ?<br><span style="color: var(--danger); font-size: 0.82rem;">Attention : les ${studentCount} élève(s) associés et leurs notes seront effacés.</span>`,
        actionText: 'Oui, supprimer la classe',
        onConfirm: async () => {
            try {
                const res = await fetch('/admin/delete-class', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ className })
                });
                const result = await res.json();
                if (result.success) {
                    showAdminNotice(result.message);
                    delete studentsByClassGlobal[className];
                    await refreshAppData();
                    populateAdminModalData();
                    await fetchAndDisplayData();
                } else {
                    showAdminNotice(result.message, true);
                }
            } catch (e) {
                showAdminNotice('Erreur réseau lors de la suppression de classe.', true);
            }
        }
    });
}

function openRenameStudentModal(className, oldName) {
    showSubdialogPrompt({
        title: `Modifier le nom de l'élève`,
        desc: `Modification pour l'élève inscrit en <strong>Classe ${className}</strong> :`,
        defaultValue: oldName,
        placeholder: 'Prénom et Nom complet',
        onConfirm: async (newName) => {
            if (newName === oldName) return;
            try {
                const res = await fetch('/admin/update-student', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ className, oldName, newName })
                });
                const result = await res.json();
                if (result.success) {
                    showAdminNotice(result.message);
                    if (studentsByClassGlobal[className]) {
                        const idx = studentsByClassGlobal[className].indexOf(oldName);
                        if (idx !== -1) studentsByClassGlobal[className][idx] = newName;
                    }
                    await refreshAppData();
                    populateAdminModalData();
                    await fetchAndDisplayData();
                } else {
                    showAdminNotice(result.message, true);
                }
            } catch (e) {
                showAdminNotice('Erreur réseau lors de la mise à jour de l\'élève.', true);
            }
        }
    });
}

function openTransferStudentModal(currentClass, studentName) {
    showSubdialogTransfer({
        studentName,
        currentClass,
        onConfirm: async (targetClass) => {
            try {
                const res = await fetch('/admin/update-student', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        className: currentClass,
                        oldName: studentName,
                        newName: studentName,
                        targetClass: targetClass
                    })
                });
                const result = await res.json();
                if (result.success) {
                    showAdminNotice(`Élève transféré en classe ${targetClass}.`);
                    if (studentsByClassGlobal[currentClass]) {
                        studentsByClassGlobal[currentClass] = studentsByClassGlobal[currentClass].filter(s => s !== studentName);
                    }
                    if (!studentsByClassGlobal[targetClass]) studentsByClassGlobal[targetClass] = [];
                    studentsByClassGlobal[targetClass].push(studentName);
                    studentsByClassGlobal[targetClass].sort();
                    await refreshAppData();
                    populateAdminModalData();
                    await fetchAndDisplayData();
                } else {
                    showAdminNotice(result.message, true);
                }
            } catch (e) {
                showAdminNotice('Erreur réseau lors du transfert.', true);
            }
        }
    });
}

function openDeleteStudentModal(className, studentName) {
    showSubdialogConfirm({
        title: `Supprimer l'élève`,
        desc: `Confirmez-vous le retrait de l'élève <strong>${studentName}</strong> de la classe <strong>${className}</strong> ?`,
        actionText: 'Supprimer l\'élève',
        onConfirm: async () => {
            try {
                const res = await fetch('/admin/delete-student', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ className, studentName })
                });
                const result = await res.json();
                if (result.success) {
                    showAdminNotice(result.message);
                    if (studentsByClassGlobal[className]) {
                        studentsByClassGlobal[className] = studentsByClassGlobal[className].filter(s => s !== studentName);
                    }
                    await refreshAppData();
                    populateAdminModalData();
                    await fetchAndDisplayData();
                } else {
                    showAdminNotice(result.message, true);
                }
            } catch (e) {
                showAdminNotice('Erreur réseau lors de la suppression.', true);
            }
        }
    });
}

// ------------------------------------
// TAB 2 : CORPS ENSEIGNANT & MATIÈRES
// ------------------------------------
async function loadTeachersList() {
    const container = document.getElementById('adminTeachersListContainer');
    if (!container) return;

    try {
        const res = await fetch('/admin/get-teachers');
        if (!res.ok) return;
        const data = await res.json();
        adminTeachersCache = data.teachers || [];
        renderFilteredTeachers();
    } catch (err) {
        console.error('Erreur chargement enseignants:', err);
    }
}

function renderFilteredTeachers() {
    const container = document.getElementById('adminTeachersListContainer');
    if (!container) return;
    container.innerHTML = '';

    const searchTerm = (document.getElementById('adminTeacherSearchInput')?.value || '').toLowerCase().trim();

    const filtered = adminTeachersCache.filter(t => {
        if (!searchTerm) return true;
        const nameMatch = t.name.toLowerCase().includes(searchTerm);
        const subjectsMatch = (t.assignments || []).some(a => (a.subject || '').toLowerCase().includes(searchTerm));
        const classesMatch = (t.assignments || []).some(a => (a.classes || []).some(c => c.toLowerCase().includes(searchTerm)));
        return nameMatch || subjectsMatch || classesMatch;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="padding: 2.5rem 1rem; text-align: center; color: var(--text-muted); background: var(--surface-2); border-radius: 10px; border: 1px dashed var(--border);">
                <i class="fas fa-users-slash" style="font-size: 1.5rem; opacity: 0.5; margin-bottom: 0.5rem; display: block;"></i>
                <div style="font-size: 0.9rem; font-weight: 600;">Aucun enseignant trouvé</div>
                <div style="font-size: 0.8rem; margin-top: 0.25rem;">${searchTerm ? 'Modifiez vos termes de recherche.' : 'Cliquez sur « Ajouter un Enseignant » pour en créer un.'}</div>
            </div>
        `;
        return;
    }

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'admin-table-wrapper';
    tableWrapper.style.overflowX = 'auto';

    let tableHtml = `
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Enseignant</th>
                    <th style="width: 220px;">Identifiants</th>
                    <th>Matière(s) Enseignée(s)</th>
                    <th>Classes Assignées</th>
                    <th style="width: 170px; text-align: right;">Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    filtered.forEach(t => {
        const initials = getInitials(t.name);
        const roleClass = t.isAdmin ? 'admin-role' : '';
        const safeTeacherJson = JSON.stringify(t).replace(/'/g, "&#39;");

        // Formatage des matières
        let subjectsHtml = '';
        let classesHtml = '';

        if (t.isAdmin) {
            subjectsHtml = '<span class="admin-badge admin-badge-subject"><i class="fas fa-unlock-alt"></i> Toutes matières</span>';
            classesHtml = '<span class="admin-badge admin-badge-class">Toutes classes</span>';
        } else if (t.assignments && t.assignments.length > 0) {
            subjectsHtml = t.assignments.map(a => `<span class="admin-badge admin-badge-subject">${a.subject}</span>`).join(' ');
            const allClasses = [...new Set(t.assignments.flatMap(a => a.classes || []))].sort();
            classesHtml = allClasses.map(c => `<span class="admin-badge admin-badge-class">${c}</span>`).join(' ') || '<span style="color:var(--text-muted); font-size:0.75rem;">Aucune</span>';
        } else {
            subjectsHtml = '<span style="color:var(--text-muted); font-size:0.75rem;">Non assignée</span>';
            classesHtml = '<span style="color:var(--text-muted); font-size:0.75rem;">Aucune</span>';
        }

        tableHtml += `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span class="admin-avatar teacher-avatar ${roleClass}">${initials}</span>
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.4rem;">
                                <strong style="color: var(--text-primary); font-size: 0.88rem;">${t.name}</strong>
                                ${t.isAdmin ? '<span class="admin-badge admin-badge-admin">ADMIN</span>' : ''}
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <div style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem;">
                            <span style="color: var(--text-muted); font-size: 0.68rem; font-weight: 700;">LOGIN</span>
                            <code class="admin-cred-tag">${t.name}</code>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem;">
                            <span style="color: var(--text-muted); font-size: 0.68rem; font-weight: 700;">MDP</span>
                            <code class="admin-cred-tag">${t.password || t.name}</code>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.3rem;">
                        ${subjectsHtml}
                    </div>
                </td>
                <td>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                        ${classesHtml}
                    </div>
                </td>
                <td style="text-align: right;">
                    <div style="display: inline-flex; gap: 0.35rem; justify-content: flex-end;">
                        <button type="button" class="admin-action-btn admin-action-edit" onclick='populateTeacherForEdit(${safeTeacherJson})' title="Modifier cet enseignant">
                            <i class="fas fa-edit"></i> Modifier
                        </button>
                        ${!t.isAdmin ? `
                            <button type="button" class="admin-action-btn admin-action-delete" onclick="openDeleteTeacherModal('${t.name.replace(/'/g, "\\'")}')" title="Supprimer cet enseignant">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    });

    tableHtml += `
            </tbody>
        </table>
    `;
    tableWrapper.innerHTML = tableHtml;
    container.appendChild(tableWrapper);
}

function populateTeacherForEdit(teacher) {
    const panel = document.getElementById('panelAddTeacher');
    if (panel) panel.style.display = 'block';

    document.getElementById('oldTeacherName').value = teacher.name;
    document.getElementById('teacherName').value = teacher.name;
    document.getElementById('teacherPassword').value = teacher.password || '';

    if (teacher.assignments && teacher.assignments.length > 0) {
        document.getElementById('teacherSubject').value = teacher.assignments[0].subject || '';
        document.getElementById('teacherClasses').value = (teacher.assignments[0].classes || []).join(', ');
    } else {
        document.getElementById('teacherSubject').value = '';
        document.getElementById('teacherClasses').value = '';
    }

    const header = document.getElementById('teacherFormHeader');
    if (header) {
        header.innerHTML = `<i class="fas fa-user-edit" style="color: var(--primary);"></i><span>Modifier l'Enseignant « ${teacher.name} »</span>`;
    }

    const resetBtn = document.getElementById('resetTeacherFormBtn');
    if (resetBtn) resetBtn.style.display = 'inline-block';

    const saveBtn = document.getElementById('saveTeacherSubmitBtn');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-check"></i><span>Mettre à jour l\'Enseignant</span>';
    }

    panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('teacherName')?.focus();
}

function resetTeacherForm() {
    document.getElementById('oldTeacherName').value = '';
    document.getElementById('adminTeacherForm')?.reset();

    const header = document.getElementById('teacherFormHeader');
    if (header) {
        header.innerHTML = `<i class="fas fa-user-plus" style="color: var(--primary);"></i><span>Ajouter un Enseignant</span>`;
    }

    const resetBtn = document.getElementById('resetTeacherFormBtn');
    if (resetBtn) resetBtn.style.display = 'none';

    const saveBtn = document.getElementById('saveTeacherSubmitBtn');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-check"></i><span>Enregistrer l\'Enseignant</span>';
    }
}

function openDeleteTeacherModal(teacherName) {
    showSubdialogConfirm({
        title: `Supprimer l'enseignant ${teacherName}`,
        desc: `Êtes-vous certain de vouloir supprimer le compte de l'enseignant <strong>${teacherName}</strong> ? Ses accès au portail seront révoqués.`,
        actionText: 'Supprimer l\'enseignant',
        onConfirm: async () => {
            try {
                const res = await fetch('/admin/delete-teacher', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ teacherName })
                });
                const result = await res.json();
                if (result.success) {
                    showAdminNotice(result.message);
                    await loadTeachersList();
                    await refreshAppData();
                } else {
                    showAdminNotice(result.message, true);
                }
            } catch (e) {
                showAdminNotice('Erreur réseau lors de la suppression.', true);
            }
        }
    });
}

function appendClassToTeacher(className) {
    const input = document.getElementById('teacherClasses');
    if (!input) return;
    if (className === 'ALL') {
        input.value = 'PEI1, PEI2, PEI3, PEI4, PEI5, DP';
        return;
    }
    let current = input.value.split(',').map(c => c.trim()).filter(Boolean);
    if (!current.includes(className)) {
        current.push(className);
        input.value = current.join(', ');
    }
}

// Exposer globalement pour inline onclick
window.openAdminModal = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.openRenameClassModal = openRenameClassModal;
window.openDeleteClassModal = openDeleteClassModal;
window.openRenameStudentModal = openRenameStudentModal;
window.openTransferStudentModal = openTransferStudentModal;
window.openDeleteStudentModal = openDeleteStudentModal;
window.quickEnrollStudent = quickEnrollStudent;
window.populateTeacherForEdit = populateTeacherForEdit;
window.openDeleteTeacherModal = openDeleteTeacherModal;
window.resetTeacherForm = resetTeacherForm;
window.appendClassToTeacher = appendClassToTeacher;

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initAdminPanel();
        bindAdminControlsOnce();
    }, 350);
});

// ====================================
// EXPOSITION GLOBALE — fonctions appelées depuis onclick inline (HTML dynamique)
// ====================================
window.displayClassIcons    = displayClassIcons;
window.displaySubjectIcons  = displaySubjectIcons;
window.displayNotesForSubject = displayNotesForSubject;
