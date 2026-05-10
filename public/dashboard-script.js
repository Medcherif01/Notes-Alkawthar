// ====================================
// GESTION DU DASHBOARD - Version Séparée
// ====================================

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
        isAdmin = ADMINS[userSection].includes(data.username);
        console.log(`🔑 Utilisateur: ${data.username}, Section: ${userSection}, Admin: ${isAdmin}`);
        
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

    clearSelectOptions(sortSubjectSelect, 'Toutes les Matières');
    currentUserPermissions.subjects.forEach(subj => {
        addOption(sortSubjectSelect, subj, subj);
    });
    updateSortStudentOptionsForFilterClass('');
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
    
    // Filtres — ignorés si changement programmatique (depuis les icônes)
    sortClassSelect.addEventListener("change", () => {
        if (_suppressFilterChange) return;
        updateSortStudentOptionsForFilterClass(sortClassSelect.value);
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
        // Filtrer les élèves par section (CORRECTION POINT 2 et 3)
        const sortedStudents = (studentsByClassGlobal[selectedClass] || []).sort();
        sortedStudents.forEach(s => addOption(studentSelect, s, s));
        
        const subjectsToShow = (subjectsByClassGlobal[selectedClass] || [])
            .filter(s => currentUserPermissions.subjects.includes(s)).sort();
        subjectsToShow.forEach(s => addOption(subjectSelect, s, s));
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

function updateSortStudentOptionsForFilterClass(filterClass) {
    clearSelectOptions(sortStudentSelect, 'Tous les Élèves');
    
    if (!filterClass) {
        // Afficher tous les élèves de toutes les classes autorisées (filtrés par section)
        const allStudents = new Set();
        currentUserPermissions.classes.forEach(cls => {
            (studentsByClassGlobal[cls] || []).forEach(s => allStudents.add(s));
        });
        Array.from(allStudents).sort().forEach(s => addOption(sortStudentSelect, s, s));
    } else {
        // Afficher uniquement les élèves de la classe sélectionnée (déjà filtrés par section)
        (studentsByClassGlobal[filterClass] || []).sort().forEach(s => {
            addOption(sortStudentSelect, s, s);
        });
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
    if (!confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) return;
    
    try {
        const response = await fetch('/logout');
        if (response.ok) {
            window.location.href = '/home.html';
        }
    } catch (error) {
        console.error('Error logging out:', error);
        window.location.href = '/home.html';
    }
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
// EXPOSITION GLOBALE — fonctions appelées depuis onclick inline (HTML dynamique)
// ====================================
window.displayClassIcons    = displayClassIcons;
window.displaySubjectIcons  = displaySubjectIcons;
window.displayNotesForSubject = displayNotesForSubject;
