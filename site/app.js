// IndexedDB setup
const DB_NAME = 'noteAppDB';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

let db;
let currentTitle = null; // Used for tracking the note being edited

// Function to open and initialize IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'title' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB opened successfully');
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.errorCode);
            reject(event.target.error);
        };
    });
}

// Function to get a transaction
function getTransaction(mode) {
    return db.transaction([STORE_NAME], mode).objectStore(STORE_NAME);
}

// THEME HANDLING (uses localStorage)
function applyTheme(theme) {
    document.body.className = theme;
    localStorage.setItem("theme", theme);
    document.getElementById("theme-toggle").textContent = theme === "dark" ? "☀️ Light" : "🌙 Dark";
}

function toggleTheme() {
    const newTheme = document.body.className === "dark" ? "light" : "dark";
    applyTheme(newTheme);
}

// NOTES APP FUNCTIONS (uses IndexedDB)

// Show main section and load notes
async function showMainSection() {
    document.getElementById("edit-section").style.display = "none";
    document.getElementById("main-section").style.display = "block";
    await loadNotes(); // Ensure notes are loaded after DB is ready
}

// Show edit section
async function showEditSection(title = "") {
    document.getElementById("main-section").style.display = "none";
    document.getElementById("edit-section").style.display = "block";
    currentTitle = title;
    if (title) {
        const transaction = getTransaction('readonly');
        const request = transaction.get(title);
        request.onsuccess = (event) => {
            const note = event.target.result;
            if (note) {
                document.getElementById("note-title").value = note.title;
                document.getElementById("note-body").value = note.body;
            }
        };
    } else {
        document.getElementById("note-title").value = "";
        document.getElementById("note-body").value = "";
    }
    document.getElementById("note-title").focus();
}

// Save or update a note
async function saveNote() {
    const titleInput = document.getElementById("note-title");
    const bodyInput = document.getElementById("note-body");

    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();

    if (!title) {
        alert("Title cannot be empty!");
        return;
    }

    const transaction = getTransaction('readwrite');
    const store = transaction;

    if (currentTitle && currentTitle !== title) {
        // If title changed, delete the old note
        const deleteRequest = store.delete(currentTitle);
        deleteRequest.onerror = (event) => console.error('Error deleting old note:', event.target.error);
    } else if (currentTitle === null) {
        // Check if title already exists when creating a new note
        const getRequest = store.get(title);
        getRequest.onsuccess = (event) => {
            if (event.target.result) {
                alert("A note with this title already exists. Please choose a different title or edit the existing note.");
                return; // Stop execution
            } else {
                // Add new note
                const addRequest = store.add({ title: title, body: body });
                addRequest.onsuccess = () => showMainSection();
                addRequest.onerror = (event) => console.error('Error adding note:', event.target.error);
            }
        };
        return; // Exit here as add/update logic is handled in onsuccess
    }

    // Put (add/update) the note
    const putRequest = store.put({ title: title, body: body });
    putRequest.onsuccess = () => showMainSection();
    putRequest.onerror = (event) => console.error('Error saving note:', event.target.error);
}


// Delete a note
async function deleteNote(title) {
    if (confirm(`Are you sure you want to delete the note "${title}"?`)) {
        const transaction = getTransaction('readwrite');
        const request = transaction.delete(title);
        request.onsuccess = () => loadNotes();
        request.onerror = (event) => console.error('Error deleting note:', event.target.error);
    }
}

// Load all notes and display them
async function loadNotes() {
    const noteList = document.getElementById("note-list");
    noteList.innerHTML = "";

    const transaction = getTransaction('readonly');
    const request = transaction.getAll();

    request.onsuccess = (event) => {
        const notes = event.target.result;
        notes.sort((a, b) => a.title.localeCompare(b.title)); // Sort notes by title

        if (notes.length === 0) {
            noteList.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 20px;">No notes yet! Click "Add Note" to create your first note.</p>';
            return;
        }

        notes.forEach(note => {
            const noteDiv = document.createElement("div");
            noteDiv.className = "note-item";

            const titleEl = document.createElement("strong");
            titleEl.textContent = note.title;
            titleEl.onclick = () => {
                contentDiv.classList.toggle("hidden");
            };

            const titleBoxEl = document.createElement("div");
            titleBoxEl.className = "title-box";

            const btnBoxEl = document.createElement("div");
            btnBoxEl.className = "btn-box";

            const contentDiv = document.createElement("div");
            contentDiv.className = "note-content hidden";
            contentDiv.textContent = note.body;

            // Copy button
            const copyBtn = document.createElement("button");
            copyBtn.textContent = "Copy";
            copyBtn.className = "btn-copy";
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(note.body)
                    .then(() => alert("Note copied to clipboard!"))
                    .catch(() => alert("Failed to copy note. Please try again."));
            };

            // Edit button
            const editBtn = document.createElement("button");
            editBtn.textContent = "Edit";
            editBtn.className = "btn-edit";
            editBtn.onclick = () => showEditSection(note.title);

            // Delete button
            const delBtn = document.createElement("button");
            delBtn.textContent = "Delete";
            delBtn.className = "btn-delete";
            delBtn.onclick = () => deleteNote(note.title);

            titleBoxEl.appendChild(titleEl);
            btnBoxEl.appendChild(copyBtn);
            btnBoxEl.appendChild(editBtn);
            btnBoxEl.appendChild(delBtn);
            titleBoxEl.appendChild(btnBoxEl);

            noteDiv.appendChild(titleBoxEl);
            noteDiv.appendChild(contentDiv);
            noteList.appendChild(noteDiv);
        });
    };

    request.onerror = (event) => console.error('Error loading notes:', event.target.error);
}

// Event Listeners and Initial Load
document.addEventListener('DOMContentLoaded', async () => {
    // Open IndexedDB first
    await openDB();

    // Apply stored theme or default to light
    const storedTheme = localStorage.getItem("theme") || "light";
    applyTheme(storedTheme);

    // Set up theme toggle listener
    document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

    // Show main section after DB is ready and theme is applied
    showMainSection();
});

// Expose functions globally for HTML onclick attributes
window.showEditSection = showEditSection;
window.saveNote = saveNote;
window.showMainSection = showMainSection;
window.deleteNote = deleteNote;
window.toggleTheme = toggleTheme; // Keep this for the HTML onclick


