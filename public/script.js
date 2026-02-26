// ====================================
// GESTION DES PAGES
// ====================================
let currentSection = 'boys';

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

function selectSection(section) {
    currentSection = section;
    const sectionBadge = document.getElementById('sectionBadge');
    const sectionName = document.getElementById('sectionName');
    const sectionIcon = document.getElementById('sectionIcon');
    
    if (section === 'girls') {
        document.body.classList.add('girls-section');
        document.body.classList.remove('boys-section');
        sectionName.textContent = 'Section Filles';
    } else {
        document.body.classList.add('boys-section');
        document.body.classList.remove('girls-section');
        sectionName.textContent = 'Section Garçons';
    }
    
    showPage('login-page');
}

// ====================================
// GESTION DU LOGIN
// ====================================
const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');
const loginForm = document.getElementById('loginForm');
const errorMessageElement = document.getElementById('errorMessage');

togglePassword.addEventListener('click', function () {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    this.classList.toggle('fa-eye-slash');
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, section: currentSection, rememberMe })
        });
        
        if (response.ok) {
            initDashboard();
            showPage('dashboard-page');
        } else {
            errorMessageElement.textContent = 'Login ou mot de passe incorrect.';
            errorMessageElement.classList.add('show');
            setTimeout(() => errorMessageElement.classList.remove('show'), 4000);
        }
    } catch (error) {
        errorMessageElement.textContent = 'Erreur de connexion. Veuillez réessayer.';
        errorMessageElement.classList.add('show');
    }
});

// ====================================
// GESTION DU DASHBOARD
// ====================================
let currentSemester = null;
let allNotesData = [];
let currentUserPermissions = { classes: [], subjects: [] };
let subjectsByClassGlobal = {};
let studentsByClassGlobal = {};
let currentStudentIndex = -1;
let currentStudentsList = [];
let autoProgressEnabled = false;

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

// Fonctions utilitaires
function clearSelectOptions(select, defaultText) {
    select.innerHTML = `<option value="">${defaultText}</option>`;
}

function addOption(select, value, text) {
    select.add(new Option(text, value));
}

function showFormMessage(element, message, isError = true) {
    element.textContent = message;
    element.className = isError ? 'error show' : 'success-message show';
    setTimeout(() => element.classList.remove('show'), 4000);
}

// Initialisation du dashboard
async function initDashboard() {
    try {
        const response = await fetch('/get-user');
        if (!response.ok) {
            showPage('section-page');
            return;
        }
        
        const data = await response.json();
        usernameDisplay.textContent = data.username;
        
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
    } catch (error) {
        console.error('❌ Initialization error:', error);
        showPage('section-page');
    }
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

// Gestion des semestres
semester1Button.addEventListener('click', () => setActiveSemester('S1'));
semester2Button.addEventListener('click', () => setActiveSemester('S2'));

function setActiveSemester(semester) {
    if (currentSemester === semester) return;
    currentSemester = semester;

    semester1Button.classList.toggle('active', semester === 'S1');
    semester2Button.classList.toggle('active', semester === 'S2');
    formTitle.innerHTML = `<i class="fas fa-edit"></i> Saisir les Notes - ${semester}`;
    mainContainer.dataset.printSemester = semester;
    mainContainer.style.display = 'block';

    [sortClassSelect, sortSubjectSelect, sortStudentSelect, classSelect].forEach(s => s.value = "");
    updateFormOnClassChange();
    fetchAndDisplayData();
}

// Gestion du formulaire
classSelect.addEventListener("change", updateFormOnClassChange);
subjectSelect.addEventListener("change", updateFormOnSubjectChange);
studentSelect.addEventListener("change", updateStudentSelection);
document.getElementById("skipToNextButton").addEventListener("click", moveToNextStudent);

function updateFormOnClassChange() {
    const selectedClass = classSelect.value;
    clearSelectOptions(studentSelect, '-- Sélectionner un élève --');
    clearSelectOptions(subjectSelect, '-- Sélectionner une matière --');
    
    autoProgressEnabled = false;
    currentStudentIndex = -1;
    currentStudentsList = [];
    hideAutoProgressInfo();
    
    if (selectedClass) {
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

function updateLimits() {
    const limits = noteLimits[classSelect.value] || {};
    travauxClasseInput.placeholder = `Max: ${limits.travauxClasse || '-'}`;
    devoirsInput.placeholder = `Max: ${limits.devoirs || '-'}`;
    evaluationInput.placeholder = `Max: ${limits.evaluation || '-'}`;
    examenInput.placeholder = `Max: ${limits.examen || '-'}`;
}

function clearNoteFields() {
    travauxClasseInput.value = '';
    devoirsInput.value = '';
    evaluationInput.value = '';
    examenInput.value = '';
}

function moveToNextStudent() {
    if (!autoProgressEnabled || currentStudentsList.length === 0) return;
    
    currentStudentIndex++;
    
    if (currentStudentIndex >= currentStudentsList.length) {
        const restart = confirm('Vous avez terminé avec tous les élèves de cette classe pour cette matière.\n\nVoulez-vous recommencer du début ?');
        if (restart) {
            currentStudentIndex = 0;
        } else {
            autoProgressEnabled = false;
            hideAutoProgressInfo();
            studentSelect.value = '';
            return;
        }
    }
    
    const nextStudent = currentStudentsList[currentStudentIndex];
    studentSelect.value = nextStudent;
    clearNoteFields();
    studentSelect.dataset.autoMode = 'true';
    
    studentSelect.classList.add('student-transition');
    setTimeout(() => studentSelect.classList.remove('student-transition'), 500);
    
    updateAutoProgressInfo();
    setTimeout(() => travauxClasseInput.focus(), 200);
}

function updateAutoProgressInfo() {
    const autoProgressInfo = document.getElementById('autoProgressInfo');
    const nextStudentName = document.getElementById('nextStudentName');
    
    if (!autoProgressEnabled || currentStudentsList.length === 0) {
        hideAutoProgressInfo();
        return;
    }
    
    const nextIndex = currentStudentIndex + 1;
    if (nextIndex < currentStudentsList.length) {
        const nextStudent = currentStudentsList[nextIndex];
        nextStudentName.textContent = `Prochain: ${nextStudent}`;
        autoProgressInfo.style.display = 'flex';
    } else {
        nextStudentName.textContent = 'Dernier élève de la liste';
        autoProgressInfo.style.display = 'flex';
    }
}

function hideAutoProgressInfo() {
    document.getElementById('autoProgressInfo').style.display = 'none';
}

function updateStudentSelection() {
    if (autoProgressEnabled && studentSelect.value) {
        const selectedStudent = studentSelect.value;
        const studentIndex = currentStudentsList.indexOf(selectedStudent);
        if (studentIndex !== -1) {
            currentStudentIndex = studentIndex;
            updateAutoProgressInfo();
        }
        studentSelect.dataset.autoMode = 'true';
    } else {
        studentSelect.dataset.autoMode = 'false';
    }
}

// Soumission du formulaire
document.getElementById("noteForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentSemester) return showFormMessage(formErrorMessage, "Sélectionnez un semestre.");

    const payload = {
        class: classSelect.value, 
        subject: subjectSelect.value, 
        studentName: studentSelect.value, 
        semester: currentSemester,
        travauxClasse: travauxClasseInput.value || null,
        devoirs: devoirsInput.value || null,
        evaluation: evaluationInput.value || null,
        examen: examenInput.value || null
    };

    if (!payload.class || !payload.subject || !payload.studentName) {
        return showFormMessage(formErrorMessage, "Veuillez remplir tous les champs.");
    }

    try {
        const response = await fetch("/save-notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const resultText = await response.text();
        showFormMessage(response.ok ? formSuccessMessage : formErrorMessage, resultText, !response.ok);
        if (response.ok) {
            clearNoteFields();
            await fetchAndDisplayData();
            
            if (!sortClassSelect.value && !sortSubjectSelect.value && !sortStudentSelect.value) {
                sortClassSelect.value = payload.class;
                updateSortStudentOptionsForFilterClass(payload.class);
                applyFiltersAndDisplayTable();
            } else {
                applyFiltersAndDisplayTable();
            }
            
            if (autoProgressEnabled) {
                setTimeout(() => moveToNextStudent(), 1000);
            }
        }
    } catch (error) {
        showFormMessage(formErrorMessage, "Erreur réseau. Veuillez réessayer.");
    }
});

// Gestion des filtres
sortClassSelect.addEventListener("change", () => {
    updateSortStudentOptionsForFilterClass(sortClassSelect.value);
    applyFiltersAndDisplayTable();
});
sortSubjectSelect.addEventListener("change", applyFiltersAndDisplayTable);
sortStudentSelect.addEventListener("change", applyFiltersAndDisplayTable);

function updateSortStudentOptionsForFilterClass(selectedClass) {
    clearSelectOptions(sortStudentSelect, 'Tous les Élèves');
    let studentsToList = new Set();
    const classesToScan = selectedClass ? [selectedClass] : currentUserPermissions.classes;
    classesToScan.forEach(cls => {
        (studentsByClassGlobal[cls] || []).forEach(s => studentsToList.add(s));
    });
    Array.from(studentsToList).sort().forEach(s => addOption(sortStudentSelect, s, s));
}

async function fetchAndDisplayData() {
    console.log('🟡 fetchAndDisplayData appelé - TRACE:', new Error().stack);
    if (!currentSemester) return;
    outputDiv.innerHTML = "<p>Chargement...</p>";
    try {
        const response = await fetch(`/all-notes?semester=${currentSemester}`);
        if (!response.ok) throw new Error(`Erreur ${response.status}`);
        allNotesData = await response.json();
        console.log(`📊 ${allNotesData.length} notes chargées pour ${currentSemester}`);
        showFilterMessage();
    } catch (error) {
        outputDiv.innerHTML = `<p class="error">Impossible de charger les notes.</p>`;
    }
}

function showFilterMessage() {
    console.log('🟡 showFilterMessage appelé - Effacement du tableau');
    outputDiv.innerHTML = `<div class="filter-message">
        <i class="fas fa-filter"></i>
        <h3>Sélectionnez des filtres pour afficher les notes</h3>
        <p>Utilisez les filtres ci-dessus (Classe, Matière, ou Élève) pour afficher les notes correspondantes du ${currentSemester}.</p>
    </div>`;
}

function applyFiltersAndDisplayTable() {
    console.log('🟢 applyFiltersAndDisplayTable appelé', { 
        class: sortClassSelect.value, 
        subject: sortSubjectSelect.value, 
        student: sortStudentSelect.value 
    });
    
    const hasFilter = sortClassSelect.value || sortSubjectSelect.value || sortStudentSelect.value;
    
    if (!hasFilter) {
        showFilterMessage();
        return;
    }
    
    const filteredData = allNotesData.filter(item => 
        (!sortClassSelect.value || item.class === sortClassSelect.value) &&
        (!sortSubjectSelect.value || item.subject === sortSubjectSelect.value) &&
        (!sortStudentSelect.value || item.studentName === sortStudentSelect.value)
    );
    displayTable(filteredData);
}

function displayTable(data) {
    outputDiv.innerHTML = "";
    if (data.length === 0) {
        outputDiv.innerHTML = `<p>Aucune note ne correspond à votre recherche pour le ${currentSemester}.</p>`;
        return;
    }
    
    const table = document.createElement("table");
    table.innerHTML = `
        <thead><tr>
            <th>Classe</th><th>Matière</th><th>Élève</th>
            <th>Travaux Cl.</th><th>Devoirs</th><th>Éval.</th><th>Examen</th>
            <th>Total</th><th>Actions</th><th>Saisi Système</th><th>Approuvé</th>
        </tr></thead>
        <tbody></tbody>`;
    const tbody = table.querySelector('tbody');

    data.sort((a, b) => a.class.localeCompare(b.class) || a.subject.localeCompare(b.subject) || a.studentName.localeCompare(b.studentName))
        .forEach(note => {
            const row = tbody.insertRow();
            row.dataset.noteId = note._id;
            let total = 0;
            
            row.innerHTML = `
                <td>${note.class}</td>
                <td>${note.subject}</td>
                <td>${note.studentName}</td>
                <td><input type="number" step="0.01" min="0" data-field="travauxClasse" value="${note.travauxClasse ?? ''}"></td>
                <td><input type="number" step="0.01" min="0" data-field="devoirs" value="${note.devoirs ?? ''}"></td>
                <td><input type="number" step="0.01" min="0" data-field="evaluation" value="${note.evaluation ?? ''}"></td>
                <td><input type="number" step="0.01" min="0" data-field="examen" value="${note.examen ?? ''}"></td>
                <td class="total-cell"></td>
                <td class="actions-cell">
                    <button class="save-button">Enr.</button>
                    <button class="delete-button">Sup.</button>
                </td>
                <td class="checkbox-cell">
                    <input type="checkbox" data-field="enteredInSystem" ${note.enteredInSystem ? 'checked' : ''}>
                </td>
                <td class="checkbox-cell">
                    <input type="checkbox" data-field="approvedByAdmin" ${note.approvedByAdmin ? 'checked' : ''}>
                </td>`;
            
            const inputs = row.querySelectorAll('input[data-field]:not([type="checkbox"])');
            inputs.forEach(input => total += parseFloat(input.value || 0));
            row.querySelector('.total-cell').textContent = total.toFixed(2);
            
            inputs.forEach(input => input.addEventListener('input', () => updateRowTotal(row)));
            
            // Gérer les changements de checkboxes avec stopPropagation
            const checkboxes = row.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                // Utiliser la capture d'événement pour empêcher toute propagation
                checkbox.addEventListener('change', async (event) => {
                    event.stopPropagation();
                    event.stopImmediatePropagation(); // Empêcher même les autres listeners
                    await handleCheckboxChange(row, checkbox, event);
                }, true); // true = phase de capture
                
                // Empêcher tous les événements de clic
                checkbox.addEventListener('click', (event) => {
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                }, true);
                
                // Empêcher aussi les événements mousedown et mouseup
                checkbox.addEventListener('mousedown', (event) => {
                    event.stopPropagation();
                }, true);
                
                checkbox.addEventListener('mouseup', (event) => {
                    event.stopPropagation();
                }, true);
            });
        });
    
    outputDiv.appendChild(table);
}

function updateRowTotal(row) {
    let total = 0;
    row.querySelectorAll('input[data-field]:not([type="checkbox"])').forEach(input => total += parseFloat(input.value || 0));
    row.querySelector('.total-cell').textContent = total.toFixed(2);
}

// Gérer les changements de checkboxes sans rafraîchir le tableau
async function handleCheckboxChange(row, checkbox, event) {
    console.log('🔵 handleCheckboxChange appelé', { noteId: row.dataset.noteId, field: checkbox.dataset.field, checked: checkbox.checked });
    
    // IMPORTANT: Empêcher la propagation de l'événement pour éviter les conflits
    if (event) {
        event.stopPropagation();
        event.stopImmediatePropagation();
        event.preventDefault();
    }
    
    const noteId = row.dataset.noteId;
    const field = checkbox.dataset.field;
    const value = checkbox.checked;
    
    // Sauvegarder les filtres actuels pour les restaurer après
    const savedFilters = {
        class: sortClassSelect.value,
        subject: sortSubjectSelect.value,
        student: sortStudentSelect.value
    };
    
    console.log('🔵 Envoi de la requête de mise à jour...', { filtres: savedFilters });
    
    try {
        const response = await fetch(`/update-note/${noteId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: value })
        });
        
        console.log('🔵 Réponse reçue:', response.status);
        
        if (response.ok) {
            // Feedback visuel temporaire
            row.style.backgroundColor = '#d4edda';
            setTimeout(() => row.style.backgroundColor = '', 700);
            
            // Mettre à jour les données locales sans recharger le tableau
            const noteIndex = allNotesData.findIndex(n => n._id === noteId);
            if (noteIndex !== -1) {
                allNotesData[noteIndex][field] = value;
            }
            
            // IMPORTANT: Restaurer les filtres si jamais ils ont été modifiés
            setTimeout(() => {
                if (sortClassSelect.value !== savedFilters.class || 
                    sortSubjectSelect.value !== savedFilters.subject || 
                    sortStudentSelect.value !== savedFilters.student) {
                    console.log('⚠️ Filtres modifiés détectés ! Restauration...', {
                        avant: savedFilters,
                        après: {
                            class: sortClassSelect.value,
                            subject: sortSubjectSelect.value,
                            student: sortStudentSelect.value
                        }
                    });
                    sortClassSelect.value = savedFilters.class;
                    sortSubjectSelect.value = savedFilters.subject;
                    sortStudentSelect.value = savedFilters.student;
                    applyFiltersAndDisplayTable();
                }
            }, 100);
            
            console.log(`✅ ${field} mis à jour pour la note ${noteId} - Tableau NON rechargé`);
        } else {
            console.error('❌ Erreur de sauvegarde:', response.status);
            alert('Erreur de sauvegarde du statut.');
            checkbox.checked = !value; // Revenir à l'état précédent
        }
    } catch (error) {
        console.error('❌ Erreur lors de la sauvegarde:', error);
        alert('Erreur réseau lors de la sauvegarde du statut.');
        checkbox.checked = !value; // Revenir à l'état précédent
    }
    
    console.log('🔵 handleCheckboxChange terminé');
}

// Actions du tableau
outputDiv.addEventListener('click', async (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    const noteId = row.dataset.noteId;

    if (e.target.classList.contains('save-button')) {
        const payload = {};
        // Ne sélectionner que les inputs numériques, pas les checkboxes
        row.querySelectorAll('input[data-field]:not([type="checkbox"])').forEach(input => {
            payload[input.dataset.field] = input.value || null;
        });
        fetch(`/update-note/${noteId}`, {
            method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
        }).then(res => {
            if (res.ok) {
                row.style.backgroundColor = '#d4edda';
                setTimeout(() => row.style.backgroundColor = '', 700);
            } else alert('Erreur de sauvegarde.');
        });
    }

    if (e.target.classList.contains('delete-button')) {
        if (confirm('Voulez-vous vraiment supprimer cette ligne ?')) {
            fetch(`/delete-note/${noteId}`, { method: "DELETE" }).then(res => {
                if (res.ok) row.remove();
                else alert('Erreur de suppression.');
            });
        }
    }
});

// Génération de fichiers
generateWordButton.addEventListener('click', () => generateFile('word'));
generateExcelButton.addEventListener('click', () => generateFile('excel'));

async function generateFile(type) {
    if (!currentSemester) return alert("Sélectionnez un semestre.");
    
    progressContainer.style.display = "block";
    progressBar.value = 0;

    const url = type === 'word' ? `/generate-word?semester=${currentSemester}` : `/generate-excel?semester=${currentSemester}`;
    const method = type === 'word' ? 'POST' : 'GET';
    
    try {
        const response = await fetch(url, { method });
        if (!response.ok) throw new Error(await response.text());
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        const filename = response.headers.get('content-disposition').split('filename=')[1].replace(/"/g, '');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
        alert(`Erreur de génération (${type}):\n${error.message}`);
    } finally {
        setTimeout(() => progressContainer.style.display = "none", 1500);
    }
}

// Déconnexion
logoutButton.addEventListener('click', async () => {
    try {
        await fetch('/logout');
        showPage('section-page');
        document.body.classList.remove('boys-section', 'girls-section');
        loginForm.reset();
    } catch (error) {
        console.error('Erreur de déconnexion:', error);
    }
});

// Vérifier si l'utilisateur est déjà connecté au chargement
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/get-user');
        if (response.ok) {
            initDashboard();
            showPage('dashboard-page');
        }
    } catch (error) {
        // Utilisateur non connecté, rester sur la page de sélection
    }
});
