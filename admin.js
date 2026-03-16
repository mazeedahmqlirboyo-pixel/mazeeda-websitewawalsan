// admin.js
import { supabase } from './supabaseClient.js';
import Papa from 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/+esm';

// DOM Elements
const toastContainer = document.getElementById('toast-container');
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const emailInput = document.getElementById('login-email');
const passwordInput = document.getElementById('login-password');

// Dashboard Elements
const filterClass = document.getElementById('filter-class');
const filterStatus = document.getElementById('filter-status');
const tableBody = document.getElementById('table-body');
const tableLoading = document.getElementById('table-loading');
const tableEmpty = document.getElementById('table-empty');
const dataCountText = document.getElementById('data-count-text');

const btnCopyUnfilled = document.getElementById('btn-copy-unfilled');
const csvUpload = document.getElementById('csv-upload');

// Edit Modal Elements
const editModal = document.getElementById('edit-modal');
const editModalBackdrop = document.getElementById('edit-modal-backdrop');
const editModalContent = document.getElementById('edit-modal-content');
const closeEditModalBtn = document.getElementById('close-edit-modal');
const editWaForm = document.getElementById('edit-wa-form');
const editWaIdInput = document.getElementById('edit-wa-id');
const editStudentNamaInput = document.getElementById('edit-student-nama');
const editStudentKelasInput = document.getElementById('edit-student-kelas');
const editWaNumberInput = document.getElementById('edit-wa-number');
const editWaNumberAltInput = document.getElementById('edit-wa-number-alt');
const editStudentNameEl = document.getElementById('edit-student-name');
const btnSaveEdit = document.getElementById('btn-save-edit');

// Delete Modal Elements
const deleteModal = document.getElementById('delete-modal');
const deleteModalBackdrop = document.getElementById('delete-modal-backdrop');
const deleteModalContent = document.getElementById('delete-modal-content');
const deleteStudentNameEl = document.getElementById('delete-student-name');
const btnCancelDelete = document.getElementById('btn-cancel-delete');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');

let currentDeleteRecordId = null; // Temp state for modal
let currentDeleteStudentName = null;

// State
let allStudentsData = []; // Combined data

// ---- NOTIFICATION UTILS ----
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const isSuccess = type === 'success';

    toast.className = `flex items-center gap-3 w-full max-w-sm px-4 py-3 rounded-xl shadow-lg border-l-4 slide-in pointer-events-auto transition-all duration-300 ${isSuccess ? 'bg-white border-green-500 text-slate-800' : 'bg-red-50 text-red-800 border-red-500'
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

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ---- AUTH LOGIC ----
async function checkCurrentSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        showDashboard();
    } else {
        showLogin();
    }
}

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        showDashboard();
    } else if (event === 'SIGNED_OUT') {
        showLogin();
    }
});

function showDashboard() {
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    fetchData(); // Load data
}

function showLogin() {
    dashboardView.classList.add('hidden');
    loginView.classList.remove('hidden');
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const originalText = btnLogin.innerHTML;
    btnLogin.innerHTML = `<div class="spinner !border-t-white !w-5 !h-5 mx-auto"></div>`;
    btnLogin.disabled = true;

    try {
        const { error } = await supabase.auth.signInWithPassword({
            email: emailInput.value,
            password: passwordInput.value,
        });

        if (error) throw error;
        // The onAuthStateChange listener will handle the UI switch

    } catch (error) {
        showToast("Login gagal: " + error.message, 'error');
        btnLogin.innerHTML = originalText;
        btnLogin.disabled = false;
    }
});

btnLogout.addEventListener('click', async () => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    } catch (error) {
        showToast("Logout gagal: " + error.message, 'error');
    }
});

// ---- DATA LOGIC ----
async function fetchData() {
    tableLoading.classList.remove('hidden');
    tableEmpty.classList.add('hidden');
    tableBody.innerHTML = '';

    try {
        // Fetch students baseline
        const { data: students, error: siswiError } = await supabase
            .from('daftar_siswi')
            .select('*')
            .order('nama', { ascending: true });

        if (siswiError) throw siswiError;

        // Fetch WhatsApp data
        const { data: waData, error: waError } = await supabase
            .from('data_whatsapp')
            .select('*');

        if (waError) throw waError;

        // Merge data
        allStudentsData = students.map(student => {
            // Find if student submitted WA
            const submission = waData.find(w => w.nama === student.nama && w.kelas === student.kelas);

            return {
                id: student.id,
                wa_record_id: submission ? submission.id : null,
                nama: student.nama,
                kelas: student.kelas,
                nomor_whatsapp: submission ? submission.nomor_whatsapp : null,
                nomor_tambahan: submission ? submission.nomor_tambahan : null,
                created_at: submission ? submission.created_at : null,
                status: submission ? 'filled' : 'unfilled'
            };
        });

        // Extract unique classes and sort them naturally (e.g., A1, A2, B1, ...)
        const uniqueClasses = [...new Set(students.map(s => s.kelas))];
        uniqueClasses.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        // Populate Class Filter
        const currentSelectedClass = filterClass.value;
        filterClass.innerHTML = '<option value="">Semua Kelas</option>';
        uniqueClasses.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls;
            option.textContent = cls;
            filterClass.appendChild(option);
        });
        filterClass.value = currentSelectedClass; // Restore selection if any

        // Sort overall data: first by class (natural), then by name (alphabetical)
        allStudentsData.sort((a, b) => {
            const classCompare = a.kelas.localeCompare(b.kelas, undefined, { numeric: true, sensitivity: 'base' });
            if (classCompare !== 0) return classCompare;
            return a.nama.localeCompare(b.nama);
        });

        renderTable();

    } catch (error) {
        console.error("Fetch Data Error:", error);
        showToast("Gagal memuat data: " + error.message, 'error');
        tableLoading.classList.add('hidden');
    }
}

function renderTable() {
    const classVal = filterClass.value;
    const statusVal = filterStatus.value;

    let filtered = allStudentsData;

    if (classVal) {
        filtered = filtered.filter(s => s.kelas === classVal);
    }
    if (statusVal) {
        filtered = filtered.filter(s => s.status === statusVal);
    }

    dataCountText.textContent = `Total: ${filtered.length}`;

    tableBody.innerHTML = '';

    if (filtered.length === 0) {
        tableEmpty.classList.remove('hidden');
    } else {
        tableEmpty.classList.add('hidden');

        filtered.forEach((d, index) => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition-colors group";

            // Format Date
            let dateStr = '-';
            if (d.created_at) {
                const date = new Date(d.created_at);
                dateStr = date.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            }

            const statusBadge = d.status === 'filled'
                ? `<span class="inline-flex items-center gap-1 bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"><svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Submitted</span>`
                : `<span class="inline-flex items-center gap-1 bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"><svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Pending</span>`;

            const actionId = `${d.id}-${d.wa_record_id || 'new'}`; // Unique ID for action buttons
            const WAbtnRowId = `actions-${actionId}`;

            let actionsHtml = '';
            if (d.wa_record_id) {
                actionsHtml = `
                    <div class="flex items-center gap-1.5" id="${WAbtnRowId}">
                        <button class="btn-edit p-1.5 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors" title="Edit WA">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button class="btn-delete p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus WA">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                `;
            }

            // Format WA Numbers
            const waPrimaryStr = d.nomor_whatsapp ? `<a href="https://wa.me/62${d.nomor_whatsapp}" target="_blank" class="text-primary-600 hover:underline">0${d.nomor_whatsapp}</a>` : '-';
            const waAltStr = d.nomor_tambahan ? `<a href="https://wa.me/62${d.nomor_tambahan}" target="_blank" class="text-primary-600 hover:underline">0${d.nomor_tambahan}</a>` : '-';

            tr.innerHTML = `
                <td class="py-2.5 px-3 text-[12px] text-slate-500 font-medium">${index + 1}</td>
                <td class="py-2.5 px-3 text-[13px] font-semibold text-slate-800">${d.nama}</td>
                <td class="py-2.5 px-3 border-l border-slate-100 flex items-center justify-center">
                    <span class="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider">${d.kelas}</span>
                </td>
                <td class="py-2.5 px-3 text-[13px] border-l border-slate-100">${waPrimaryStr}</td>
                <td class="py-2.5 px-3 text-[13px] border-l border-slate-100">${waAltStr}</td>
                <td class="py-2.5 px-3 border-l border-slate-100">
                    <div class="flex flex-col flex-wrap gap-1">
                        ${statusBadge}
                        ${d.created_at ? `<span class="text-[10px] text-slate-400 flex items-center gap-1"><svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>${dateStr}</span>` : ''}
                    </div>
                </td>
                <td class="py-2.5 px-3 border-l border-slate-100 text-center">
                    ${actionsHtml}
                </td>
            `;

            tableBody.appendChild(tr);

            // Bind events safely if action buttons exist
            if (d.status === 'filled') {
                const actionContainer = document.getElementById(WAbtnRowId);
                const editBtn = actionContainer.querySelector('.btn-edit');
                const deleteBtn = actionContainer.querySelector('.btn-delete');

                editBtn.addEventListener('click', () => {
                    openEditModal(d.wa_record_id, d.nomor_whatsapp, d.nomor_tambahan || '', d.nama, d.kelas);
                });

                deleteBtn.addEventListener('click', () => {
                    deleteWaNumber(d.wa_record_id, d.nama);
                });
            }
        });
    }

    tableLoading.classList.add('hidden');
}

filterClass.addEventListener('change', renderTable);
filterStatus.addEventListener('change', renderTable);

// ---- EDIT & DELETE ACTIONS ----
// Rather than relying on window.X for type="module", we invoke them safely inside the loop above
function openEditModal(waRecordId, waNumber, waNumberAlt, nama, kelas) {
    editWaIdInput.value = waRecordId;
    editStudentNamaInput.value = nama;
    editStudentKelasInput.value = kelas;
    editWaNumberInput.value = waNumber;
    editWaNumberAltInput.value = waNumberAlt;
    editStudentNameEl.textContent = nama;

    editModal.classList.remove('hidden');
    requestAnimationFrame(() => {
        editModalBackdrop.classList.remove('opacity-0');
        editModalBackdrop.classList.add('opacity-100');
        editModalContent.classList.remove('opacity-0', 'translate-y-8', 'sm:translate-y-4');
        editModalContent.classList.add('opacity-100', 'translate-y-0');
    });
};

function closeEditModal() {
    editModalBackdrop.classList.remove('opacity-100');
    editModalBackdrop.classList.add('opacity-0');
    editModalContent.classList.remove('opacity-100', 'translate-y-0');
    editModalContent.classList.add('opacity-0', 'translate-y-8', 'sm:translate-y-4');

    setTimeout(() => {
        editModal.classList.add('hidden');
    }, 300);
}

closeEditModalBtn.addEventListener('click', closeEditModal);

function cleanPhoneNumber(str) {
    let cleaned = str.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    else if (cleaned.startsWith('62')) cleaned = cleaned.substring(2);
    return cleaned;
}

editWaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editWaIdInput.value;
    const nomorWA = cleanPhoneNumber(editWaNumberInput.value);
    const nomorAlt = cleanPhoneNumber(editWaNumberAltInput.value);

    // Minor validation
    if (nomorWA.length < 9) {
        showToast("Nomor WhatsApp utama minimal 10 digit (tanpa awalan).", 'error');
        return;
    }

    const originalText = btnSaveEdit.innerHTML;
    btnSaveEdit.disabled = true;
    btnSaveEdit.innerHTML = `<div class="spinner !border-t-white !w-5 !h-5 mx-auto"></div>`;

    try {
        const payload = {
            nomor_whatsapp: nomorWA,
            nomor_tambahan: nomorAlt || null
        };

        const { error } = await supabase
            .from('data_whatsapp')
            .update(payload)
            .eq('id', id);

        if (error) throw error;

        // --- GOOGLE SPREADSHEET SYNC ---
        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw43ocFL1mIGi0phcdJlBG7BzWWWuIhOc996hqVz-ZBhAZ5b5K3mDx13F_k51fMS_zPvA/exec';
        try {
            const gsPayload = {
                nama: editStudentNamaInput.value,
                nomor_whatsapp: payload.nomor_whatsapp,
                nomor_tambahan: payload.nomor_tambahan || ""
            };
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(gsPayload)
            });
        } catch (gsError) {
            console.error("Warning: Failed to sync with Google Sheet", gsError);
        }

        showToast("Nomor WhatsApp berhasil diupdate.", 'success');
        closeEditModal();
        fetchData(); // Refresh UI

    } catch (err) {
        console.error(err);
        showToast("Gagal update data: " + err.message, 'error');
    } finally {
        btnSaveEdit.disabled = false;
        btnSaveEdit.innerHTML = originalText;
    }
});

function openDeleteModal(waRecordId, nama) {
    currentDeleteRecordId = waRecordId;
    currentDeleteStudentName = nama;
    deleteStudentNameEl.textContent = nama;

    deleteModal.classList.remove('hidden');
    requestAnimationFrame(() => {
        deleteModalBackdrop.classList.remove('opacity-0');
        deleteModalBackdrop.classList.add('opacity-100');
        deleteModalContent.classList.remove('opacity-0', 'scale-95');
        deleteModalContent.classList.add('opacity-100', 'scale-100');
    });
}

function closeDeleteModal() {
    deleteModalBackdrop.classList.remove('opacity-100');
    deleteModalBackdrop.classList.add('opacity-0');
    deleteModalContent.classList.remove('opacity-100', 'scale-100');
    deleteModalContent.classList.add('opacity-0', 'scale-95');

    setTimeout(() => {
        deleteModal.classList.add('hidden');
        currentDeleteRecordId = null;
        currentDeleteStudentName = null;
    }, 300);
}

btnCancelDelete.addEventListener('click', closeDeleteModal);

window.deleteWaNumber = function (waRecordId, nama) {
    openDeleteModal(waRecordId, nama);
};

btnConfirmDelete.addEventListener('click', async () => {
    if (!currentDeleteRecordId) return;

    const originalText = btnConfirmDelete.innerHTML;
    btnConfirmDelete.disabled = true;
    btnConfirmDelete.innerHTML = `<div class="spinner !border-t-white !w-5 !h-5 mx-auto"></div>`;

    try {
        const { error } = await supabase
            .from('data_whatsapp')
            .delete()
            .eq('id', currentDeleteRecordId);

        if (error) throw error;

        // --- GOOGLE SPREADSHEET SYNC ---
        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw43ocFL1mIGi0phcdJlBG7BzWWWuIhOc996hqVz-ZBhAZ5b5K3mDx13F_k51fMS_zPvA/exec';
        try {
            const gsPayload = {
                nama: currentDeleteStudentName,
                nomor_whatsapp: "", // Clear number in sheet
                nomor_tambahan: ""  // Clear number in sheet
            };
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(gsPayload)
            });
        } catch (gsError) {
            console.error("Warning: Failed to sync with Google Sheet", gsError);
        }

        showToast(`Data WhatsApp ${currentDeleteStudentName} berhasil dihapus.`, 'success');
        closeDeleteModal();
        fetchData(); // Refresh table entirely

    } catch (err) {
        console.error(err);
        showToast("Gagal menghapus data: " + err.message, 'error');
    } finally {
        btnConfirmDelete.disabled = false;
        btnConfirmDelete.innerHTML = originalText;
    }
});

// ---- COPY LOGIC ----
btnCopyUnfilled.addEventListener('click', async () => {
    // Determine the active filtered list
    const classVal = filterClass.value;
    let filtered = allStudentsData.filter(s => s.status === 'unfilled');

    if (classVal) {
        filtered = filtered.filter(s => s.kelas === classVal);
    }

    if (filtered.length === 0) {
        showToast("Semua siswa dalam filter ini sudah mengisi data.", 'success');
        return;
    }

    const unsubmittedNames = filtered.map(s => s.nama).join('\n');

    try {
        await navigator.clipboard.writeText(unsubmittedNames);
        showToast(`Berhasil menyalin ${filtered.length} nama ke clipboard.`, 'success');
    } catch (err) {
        console.error('Failed to copy text: ', err);
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = unsubmittedNames;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showToast(`Berhasil menyalin ${filtered.length} nama ke clipboard.`, 'success');
        } catch (e) {
            showToast("Gagal menyalin. Clipboard mungkin tidak diizinkan.", 'error');
        }
        document.body.removeChild(textArea);
    }
});

// ---- CSV UPLOAD LOGIC ----
csvUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset input
    const originalFile = file.name;
    csvUpload.value = '';

    Papa.parse(file, {
        header: true, // we skip typical headers if they use "NAMA LENGKAP", "BAGIAN"
        skipEmptyLines: true,
        complete: async function (results) {
            const data = results.data;
            if (data.length === 0) {
                showToast("File CSV kosong.", 'error');
                return;
            }

            // Extract using the exact header names or index
            const studentsToInsert = data.map(row => {
                // Find matching keys ignoring case
                const keys = Object.keys(row);
                const nameKey = keys.find(k => k.trim().toUpperCase() === 'NAMA LENGKAP');
                const classKey = keys.find(k => k.trim().toUpperCase() === 'BAGIAN');

                return {
                    nama: nameKey ? row[nameKey] : Object.values(row)[0], // Fallback to 1st column
                    kelas: classKey ? row[classKey] : Object.values(row)[1] // Fallback to 2nd column
                };
            }).filter(item => item.nama && item.kelas); // require both

            if (studentsToInsert.length === 0) {
                showToast("Format kolom CSV salah. Harap perhatikan: NAMA LENGKAP dan BAGIAN.", 'error');
                return;
            }

            // Upload to Supabase 
            // NOTE: This will fail if Supabase requires RLS allow list for insert, which implies Admin auth context. 
            // We assume the auth JWT takes care of it.

            showToast("Mengimport data, mohon tunggu...", 'success');

            try {
                // Bulk insert
                const { error } = await supabase
                    .from('daftar_siswi')
                    .insert(studentsToInsert);

                if (error) {
                    throw error;
                }

                showToast(`Data siswi berhasil diimport (${studentsToInsert.length} data).`, 'success');
                // Re-fetch data to update table and class dropdown
                fetchData();

            } catch (error) {
                console.error("Upload Error:", error);
                showToast("Gagal mengimport data: " + error.message, 'error');
            }
        },
        error: (error) => {
            console.error("Papa parse error:", error);
            showToast("Gagal membaca file CSV.", 'error');
        }
    });

});

// Initial load
checkCurrentSession();
