// script.js
import { supabase } from './supabaseClient.js';

// ---- DOM ELEMENTS ----
const classSelect = document.getElementById('class-select');
const studentListContainer = document.getElementById('student-list-container');
const studentList = document.getElementById('student-list');
const studentCountBadge = document.getElementById('student-count-badge');
const emptyState = document.getElementById('empty-state');
const loadingIndicator = document.getElementById('loading-indicator');

// Modal Elements
const formModal = document.getElementById('form-modal');
const modalBackdrop = document.getElementById('modal-backdrop');
const modalContent = document.getElementById('modal-content');
const closeModalBtn = document.getElementById('close-modal');
const selectedStudentNameEl = document.getElementById('selected-student-name');

// Form Elements
const waForm = document.getElementById('wa-form');
const studentNameInput = document.getElementById('student-name-input');
const studentClassInput = document.getElementById('student-class-input');
const waNumber = document.getElementById('wa-number');
const waNumberAlt = document.getElementById('wa-number-alt');
const btnAddWa = document.getElementById('btn-add-wa');
const additionalWaContainer = document.getElementById('additional-wa-container');

// Confirm Modal Elements
const btnPreSubmit = document.getElementById('btn-pre-submit');
const btnActualSubmit = document.getElementById('btn-actual-submit');
const confirmModal = document.getElementById('confirm-modal');
const confirmModalBackdrop = document.getElementById('confirm-modal-backdrop');
const confirmModalContent = document.getElementById('confirm-modal-content');
const btnCancelConfirm = document.getElementById('btn-cancel-confirm');
const btnFinalSubmit = document.getElementById('btn-final-submit');

// Toast Container
const toastContainer = document.getElementById('toast-container');

// ---- STATE ----
let currentStudents = [];
let submittedStudentIds = new Set(); // We could track by name + class or an ID if there is one

// ---- NOTIFICATION UTILS ----
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const isSuccess = type === 'success';
    
    toast.className = `flex items-center gap-3 w-full max-w-sm px-4 py-3 rounded-xl shadow-lg border-l-4 slide-up pointer-events-auto transition-all duration-300 ${
        isSuccess ? 'bg-white border-green-500 text-slate-800' : 'bg-red-50 text-red-800 border-red-500'
    }`;
    
    const icon = isSuccess 
        ? `<svg class="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>`
        : `<svg class="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
    
    toast.innerHTML = `
        ${icon}
        <p class="text-sm font-medium flex-1">${message}</p>
        <button class="text-slate-400 hover:text-slate-600 transition-colors focus:outline-none" onclick="this.parentElement.remove()">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
    `;

    toastContainer.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ---- MAIN LOGIC ----

// Initialize: Fetch all available classes and populate dropdown
async function loadClasses() {
    try {
        const { data, error } = await supabase
            .from('daftar_siswi')
            .select('kelas');

        if (error) throw error;
        
        if (data && data.length > 0) {
            const uniqueClasses = [...new Set(data.map(item => item.kelas))];
            // Sort naturally (e.g. A1, A10, A2, B1 -> A1, A2, A10, B1)
            uniqueClasses.sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
            
            uniqueClasses.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls;
                option.textContent = cls;
                classSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error loading classes:", error);
        showToast("Gagal memuat daftar kelas.", 'error');
    }
}

// 1. Listen for class change
classSelect.addEventListener('change', async (e) => {
    const selectedClass = e.target.value;
    if (!selectedClass) return;

    fetchStudents(selectedClass);
});

async function fetchStudents(className) {
    // Show loading
    studentListContainer.classList.add('hidden');
    loadingIndicator.classList.remove('hidden');
    loadingIndicator.classList.add('flex');
    emptyState.classList.add('hidden');
    studentList.innerHTML = '';

    try {
        // Fetch students for the selected class
        const { data: students, error: studentError } = await supabase
            .from('daftar_siswi')
            .select('*')
            .eq('kelas', className)
            .order('nama', { ascending: true });

        if (studentError) throw studentError;

        // Optionally, fetch who already submitted to show a checkmark (advanced UX)
        // Assume data_whatsapp has 'nama' and 'kelas' mapping.
        const { data: submittedData, error: subError } = await supabase
            .from('data_whatsapp')
            .select('nama, kelas')
            .eq('kelas', className);

        if (!subError && submittedData) {
            const submittedNames = submittedData.map(d => d.nama);
            students.forEach(s => s.submitted = submittedNames.includes(s.nama));
        }

        renderStudents(students);
    } catch (error) {
        console.error("Error fetching students:", error);
        showToast("Gagal memuat daftar siswi: " + error.message, 'error');
        loadingIndicator.classList.add('hidden');
        loadingIndicator.classList.remove('flex');
    }
}

function renderStudents(students) {
    loadingIndicator.classList.add('hidden');
    loadingIndicator.classList.remove('flex');
    studentListContainer.classList.remove('hidden');
    studentListContainer.classList.add('fade-in');

    studentCountBadge.textContent = students ? students.length : 0;

    if (!students || students.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    students.forEach(student => {
        const item = document.createElement('button');
        
        // If submitted, disable the button and style accordingly
        if (student.submitted) {
            item.className = `w-full text-left bg-green-50/40 border border-green-100 p-4 rounded-xl shadow-sm flex justify-between items-center cursor-not-allowed opacity-80`;
            item.disabled = true;
            item.innerHTML = `
                <div class="flex flex-col">
                    <span class="font-medium text-green-700">${student.nama}</span>
                    <span class="text-[10px] font-semibold text-green-600 mt-0.5 flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Terdata</span>
                </div>
                <svg class="w-5 h-5 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            `;
        } else {
            item.className = `w-full text-left bg-white border border-slate-100 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-primary-200 transition-all active:scale-[0.98] group flex justify-between items-center`;
            item.innerHTML = `
                <div class="flex flex-col">
                    <span class="font-medium text-slate-700 group-hover:text-primary-600 transition-colors">${student.nama}</span>
                </div>
                <svg class="w-5 h-5 text-slate-300 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            `;
            item.addEventListener('click', () => openModal(student));
        }

        studentList.appendChild(item);
    });
}

// ---- MODAL LOGIC ----
function openModal(student) {
    // Populate form
    selectedStudentNameEl.textContent = student.nama;
    studentNameInput.value = student.nama;
    studentClassInput.value = student.kelas;
    
    // Reset form
    waForm.reset();
    additionalWaContainer.classList.add('hidden');
    
    // Show modal with animation
    formModal.classList.remove('hidden');
    
    // Trigger animations in next frame
    requestAnimationFrame(() => {
        modalBackdrop.classList.remove('opacity-0');
        modalBackdrop.classList.add('opacity-100');
        modalContent.classList.remove('opacity-0', 'translate-y-8', 'sm:translate-y-4');
        modalContent.classList.add('opacity-100', 'translate-y-0');
    });
}

function closeModal() {
    // Reverse animations
    modalBackdrop.classList.remove('opacity-100');
    modalBackdrop.classList.add('opacity-0');
    modalContent.classList.remove('opacity-100', 'translate-y-0');
    modalContent.classList.add('opacity-0', 'translate-y-8', 'sm:translate-y-4');
    
    // Hide modal after animation completes
    setTimeout(() => {
        formModal.classList.add('hidden');
    }, 300);
}

closeModalBtn.addEventListener('click', closeModal);
formModal.addEventListener('click', (e) => {
    if (e.target === formModal || e.target === modalBackdrop) closeModal();
});

// ---- FORM LOGIC ----
btnAddWa.addEventListener('click', () => {
    additionalWaContainer.classList.remove('hidden');
    btnAddWa.style.display = 'none';
});

// Format phone number to strictly digits starting without 0
function cleanPhoneNumber(str) {
    let cleaned = str.replace(/\D/g, ''); // Remove all non-digits
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    } else if (cleaned.startsWith('62')) {
        cleaned = cleaned.substring(2);
    }
    return cleaned;
}

// Restrict typing to numbers only in real-time
function restrictToNumbers(e) {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
}
waNumber.addEventListener('input', restrictToNumbers);
waNumberAlt.addEventListener('input', restrictToNumbers);

// Form validation trigger before showing modal
btnPreSubmit.addEventListener('click', () => {
    // Rely on native HTML5 validity. If not valid, trigger actual hidden submit to show native tooltips 
    if (!waForm.checkValidity()) {
        btnActualSubmit.click();
        return;
    }

    const nomorRaw = waNumber.value;
    const nomorWA = cleanPhoneNumber(nomorRaw);
    let nomorAltRaw = waNumberAlt.value;
    let nomorAlt = cleanPhoneNumber(nomorAltRaw);

    if (nomorWA.length < 9) {
        showToast("Nomor WhatsApp minimal 10 digit angka", 'error');
        return;
    }
    if (nomorAlt && nomorAlt.length < 9) {
        showToast("Nomor WhatsApp Tambahan minimal 10 digit angka", 'error');
        return;
    }

    // Pass and show modal
    openConfirmModal();
});

// Avoid default submit if triggered by enter key. Modal handles it instead.
waForm.addEventListener('submit', (e) => {
    e.preventDefault();
});

function openConfirmModal() {
    confirmModal.classList.remove('hidden');
    requestAnimationFrame(() => {
        confirmModalBackdrop.classList.remove('opacity-0');
        confirmModalBackdrop.classList.add('opacity-100');
        confirmModalContent.classList.remove('opacity-0', 'scale-95');
        confirmModalContent.classList.add('opacity-100', 'scale-100');
    });
}

function closeConfirmModal() {
    confirmModalBackdrop.classList.remove('opacity-100');
    confirmModalBackdrop.classList.add('opacity-0');
    confirmModalContent.classList.remove('opacity-100', 'scale-100');
    confirmModalContent.classList.add('opacity-0', 'scale-95');
    
    setTimeout(() => {
        confirmModal.classList.add('hidden');
    }, 300);
}

btnCancelConfirm.addEventListener('click', closeConfirmModal);

btnFinalSubmit.addEventListener('click', async () => {
    const nama = studentNameInput.value;
    const kelas = studentClassInput.value;
    const nomorWA = cleanPhoneNumber(waNumber.value);
    const nomorAlt = cleanPhoneNumber(waNumberAlt.value);

    // Set loading state on modal button
    const originalBtnText = btnFinalSubmit.innerHTML;
    btnFinalSubmit.disabled = true;
    btnFinalSubmit.innerHTML = `<div class="loader mr-2 !w-5 !h-5 !border-2 !border-primary-300 !border-t-white"></div> Mengirim...`;

    try {
        const payload = {
            nama: nama,
            kelas: kelas,
            nomor_whatsapp: nomorWA,
            nomor_tambahan: nomorAlt || null,
        };

        const { error } = await supabase
            .from('data_whatsapp')
            .insert([payload]);

        if (error) {
             if (error.code === '23505') {
                 // Close confirm modal to let them see the toast clearly
                 closeConfirmModal();
                 throw new Error("Nomor WhatsApp ini sudah terdaftar sebelumnya.");
             }
             throw error;
        }

        // --- GOOGLE SPREADSHEET SYNC ---
        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw43ocFL1mIGi0phcdJlBG7BzWWWuIhOc996hqVz-ZBhAZ5b5K3mDx13F_k51fMS_zPvA/exec';
        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (gsError) {
            console.error("Warning: Failed to sync with Google Sheet", gsError);
        }

        // Success
        showToast("Terima kasih, data berhasil disimpan.", 'success');
        closeConfirmModal();
        closeModal(); // Close the main form modal
        
        // Refresh list
        fetchStudents(classSelect.value || kelas);
        
    } catch (error) {
        console.error("Error submitting data:", error);
        showToast("Gagal menyimpan data: " + error.message, 'error');
    } finally {
        btnFinalSubmit.disabled = false;
        btnFinalSubmit.innerHTML = originalBtnText;
    }
});

// Run on startup
loadClasses();
