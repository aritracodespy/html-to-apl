let db;
let currentTitle = null;

// IndexedDB Setup
const request = indexedDB.open("NotesDB", 1);

request.onupgradeneeded = (e) => {
  db = e.target.result;
  db.createObjectStore("notes", { keyPath: "title" });
};

request.onsuccess = (e) => {
  db = e.target.result;
  const storedTheme = localStorage.getItem("theme") || "light";
  applyTheme(storedTheme);
  showMainSection();
};

request.onerror = () => alert("Failed to open database.");

// THEME HANDLING
function applyTheme(theme) {
  document.body.className = theme;
  localStorage.setItem("theme", theme);
  document.getElementById("theme-toggle").textContent = theme === "dark" ? "☀️ Light" : "🌙 Dark";
}

function toggleTheme() {
  const newTheme = document.body.className === "dark" ? "light" : "dark";
  applyTheme(newTheme);
}

// UI CONTROL
function showMainSection() {
  document.getElementById("edit-section").style.display = "none";
  document.getElementById("main-section").style.display = "block";
  loadNotes();
}

function showEditSection(title = "") {
  document.getElementById("main-section").style.display = "none";
  document.getElementById("edit-section").style.display = "block";
  currentTitle = title;

  if (title) {
    const tx = db.transaction("notes", "readonly");
    const store = tx.objectStore("notes");
    const req = store.get(title);
    req.onsuccess = () => {
      const note = req.result;
      document.getElementById("note-title").value = note.title;
      document.getElementById("note-body").value = note.body;
    };
  } else {
    document.getElementById("note-title").value = "";
    document.getElementById("note-body").value = "";
  }
}

function saveNote() {
  const title = document.getElementById("note-title").value.trim();
  const body = document.getElementById("note-body").value.trim();
  if (!title) return alert("Title cannot be empty!");

  const tx = db.transaction("notes", "readwrite");
  const store = tx.objectStore("notes");

  if (currentTitle && currentTitle !== title) {
    store.delete(currentTitle);
  }

  store.put({ title, body });
  tx.oncomplete = showMainSection;
}

function deleteNote(title) {
  const tx = db.transaction("notes", "readwrite");
  const store = tx.objectStore("notes");
  store.delete(title);
  tx.oncomplete = loadNotes;
}

function loadNotes() {
  const noteList = document.getElementById("note-list");
  noteList.innerHTML = "";

  const tx = db.transaction("notes", "readonly");
  const store = tx.objectStore("notes");
  const req = store.openCursor();

  req.onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const { title, body } = cursor.value;

      const noteDiv = document.createElement("div");
      noteDiv.className = "note-item";

      const titleEl = document.createElement("strong");
      titleEl.textContent = title;
      titleEl.onclick = () => contentDiv.classList.toggle("hidden");

      const titleBoxEl = document.createElement("div");
      titleBoxEl.className = "title-box";

      const btnBoxEl = document.createElement("div");
      btnBoxEl.className = "btn-box";

      const contentDiv = document.createElement("div");
      contentDiv.className = "note-content hidden";
      contentDiv.textContent = body;

      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copy";
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(body)
          .then(() => alert("Note copied to clipboard!"))
          .catch(() => alert("Failed to copy note."));
      };

      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.onclick = () => showEditSection(title);

      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.onclick = () => {
        if (confirm("Delete this note?")) {
          deleteNote(title);
        }
      };

      titleBoxEl.appendChild(titleEl);
      btnBoxEl.appendChild(copyBtn);
      btnBoxEl.appendChild(editBtn);
      btnBoxEl.appendChild(delBtn);
      titleBoxEl.appendChild(btnBoxEl);

      noteDiv.appendChild(titleBoxEl);
      noteDiv.appendChild(contentDiv);
      noteList.appendChild(noteDiv);

      cursor.continue();
    }
  };
}