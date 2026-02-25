const isWeb = typeof require === 'undefined';
let fs, path, dataPath;

if (!isWeb) {
    fs = require('fs');
    path = require('path');
    dataPath = path.join(__dirname, 'db.json');
}

// Default initial user data
const defaultData = {
    darkMode: false,
    courses: [],
    assignments: [],
    exams: [],
    habits: [],
    tasks: [],
    notes: [],
    lastHabitReset: new Date().toLocaleDateString()
};

let db = { ...defaultData };
let currentView = 'Week'; // Day, Week, Month, Year

// Media Player State
let isPlaying = false;
let audioPlayer;

function loadData() {
    try {
        if (isWeb) {
            const raw = localStorage.getItem('student_planner_db');
            if (raw) {
                db = { ...defaultData, ...JSON.parse(raw) };
            } else {
                saveData();
            }
        } else {
            if (fs.existsSync(dataPath)) {
                const raw = fs.readFileSync(dataPath, 'utf8');
                db = { ...defaultData, ...JSON.parse(raw) };
            } else {
                saveData();
            }
        }
    } catch (e) {
        console.error("Failed to load data", e);
    }

    // Reset daily habits if it's a new day
    const today = new Date().toLocaleDateString();
    if (db.lastHabitReset !== today) {
        db.habits.forEach(h => h.current = 0);
        db.lastHabitReset = today;
        saveData();
    }
}

function saveData() {
    try {
        if (isWeb) {
            localStorage.setItem('student_planner_db', JSON.stringify(db));
        } else {
            fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
        }
    } catch (e) {
        console.error("Failed to save data", e);
    }
}

// ----------------- UI UPDATES -----------------

function updateClock() {
    const clockEl = document.getElementById('clock');
    const dateEl = document.getElementById('date');
    if (!clockEl || !dateEl) return;
    const now = new Date();
    clockEl.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    dateEl.innerText = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    updateFocusCourse(now);
}


// ----------------- DELETE LOGIC -----------------
let pendingDelete = null;
function requestDelete(type, id, skipConfirm = false) {
    if (skipConfirm) {
        executeDelete(type, id);
    } else {
        pendingDelete = { type, id };
        document.getElementById('confirm-modal').classList.remove('hidden');
    }
}

function executeDelete(type, id) {
    if (type === 'course') db.courses = db.courses.filter(i => i.id !== id);
    if (type === 'assignment') db.assignments = db.assignments.filter(i => i.id !== id);
    if (type === 'exam') db.exams = db.exams.filter(i => i.id !== id);
    if (type === 'habit') db.habits = db.habits.filter(i => i.id !== id);
    if (type === 'task') db.tasks = db.tasks.filter(i => i.id !== id);
    if (type === 'note') db.notes = db.notes.filter(i => i.id !== id);

    saveData();
    renderAll();
}

document.getElementById('confirm-yes-btn').addEventListener('click', () => {
    if (pendingDelete) {
        executeDelete(pendingDelete.type, pendingDelete.id);
        pendingDelete = null;
    }
    document.getElementById('confirm-modal').classList.add('hidden');
});
document.getElementById('confirm-no-btn').addEventListener('click', () => {
    pendingDelete = null;
    document.getElementById('confirm-modal').classList.add('hidden');
});

// ----------------- MODALS -----------------
window.openModal = function (id) {
    document.getElementById(id).classList.remove('hidden');
    // populate course dropdowns
    if (id === 'assignment-modal' || id === 'exam-modal') {
        const selects = document.querySelectorAll('#a-course, #e-course');
        selects.forEach(select => {
            select.innerHTML = '<option value="">-- None --</option>';
            db.courses.forEach(c => {
                select.innerHTML += `<option value="${c.title}">${c.title}</option>`;
            });
        });
    }
}
window.closeModal = function (id) {
    document.getElementById(id).classList.add('hidden');
}

document.getElementById('form-course').addEventListener('submit', (e) => {
    e.preventDefault();
    const days = Array.from(document.querySelectorAll('input[name="c-days"]:checked')).map(cb => cb.value);
    db.courses.push({
        id: Date.now(),
        title: document.getElementById('c-title').value,
        teacher: document.getElementById('c-teacher').value,
        days: days,
        start: document.getElementById('c-start').value,
        end: document.getElementById('c-end').value
    });
    saveData();
    e.target.reset();
    closeModal('course-modal');
    renderAll();
});

document.getElementById('form-assignment').addEventListener('submit', (e) => {
    e.preventDefault();
    db.assignments.push({
        id: Date.now(),
        title: document.getElementById('a-title').value,
        course: document.getElementById('a-course').value,
        dueDate: document.getElementById('a-date').value,
        priority: document.getElementById('a-priority').value,
        completed: false
    });
    saveData();
    e.target.reset();
    closeModal('assignment-modal');
    renderAll();
});

document.getElementById('form-exam').addEventListener('submit', (e) => {
    e.preventDefault();
    db.exams.push({
        id: Date.now(),
        title: document.getElementById('e-title').value,
        course: document.getElementById('e-course').value,
        date: document.getElementById('e-date').value,
        time: document.getElementById('e-time').value,
        completed: false
    });
    saveData();
    e.target.reset();
    closeModal('exam-modal');
    renderAll();
});

document.getElementById('form-habit').addEventListener('submit', (e) => {
    e.preventDefault();
    db.habits.push({
        id: Date.now(),
        title: document.getElementById('h-title').value,
        target: parseInt(document.getElementById('h-target').value),
        measure: document.getElementById('h-measure').value,
        current: 0
    });
    saveData();
    e.target.reset();
    closeModal('habit-modal');
    renderAll();
});

document.getElementById('form-task').addEventListener('submit', (e) => {
    e.preventDefault();
    db.tasks.push({
        id: Date.now(),
        title: document.getElementById('t-title').value,
        completed: false
    });
    saveData();
    e.target.reset();
    closeModal('task-modal');
    renderAll();
});

document.getElementById('form-note').addEventListener('submit', (e) => {
    e.preventDefault();
    db.notes.push({
        id: Date.now(),
        text: document.getElementById('n-text').value
    });
    saveData();
    e.target.reset();
    closeModal('note-modal');
    renderAll();
});

// ----------------- RENDERING -----------------

function renderAll() {
    renderSchedule();
    renderAssignments();
    renderHabits();
    renderTasks();
    renderNotes();
    updateFocusCourse(new Date());
}

function renderSchedule() {
    const container = document.getElementById('schedule-container');
    const titleEl = document.getElementById('schedule-title');
    container.innerHTML = '';

    // Sort items by time/date
    const getSortedCourses = () => [...db.courses].sort((a, b) => a.start.localeCompare(b.start));

    if (currentView === 'Day') {
        titleEl.innerHTML = '<span class="material-symbols-outlined text-[var(--sunset-purple)]">today</span> Today\'s Schedule';
        container.className = "grid grid-cols-1 gap-3 transition-all duration-300";

        const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const todayCourses = getSortedCourses().filter(c => c.days.includes(todayDay));
        let html = `<div class="glass-card p-4 rounded-xl border-t-2 border-[var(--sunset-purple)] w-full max-w-2xl mx-auto">
            <p class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">${todayDay}</p>
            <div class="space-y-3">`;

        if (todayCourses.length === 0) {
            html += `<p class="text-sm font-bold text-gray-400">No classes today!</p>`;
        } else {
            todayCourses.forEach(c => {
                html += `<div class="p-3 bg-[var(--surface)] text-[var(--text-main)] rounded shadow-sm border-l-2 border-[var(--sunset-purple)] flex justify-between group">
                    <div>
                        <p class="text-sm font-bold leading-tight">${c.title}</p>
                        <p class="text-xs text-[var(--text-muted)]">${c.start} - ${c.end} ${c.teacher ? '• ' + c.teacher : ''}</p>
                    </div>
                    <span class="material-symbols-outlined text-gray-300 hover:text-red-400 cursor-pointer hidden group-hover:block" onclick="requestDelete('course', ${c.id})">delete</span>
                </div>`;
            });
        }
        html += `</div></div>`;
        container.innerHTML = html;

    } else if (currentView === 'Week') {
        titleEl.innerHTML = '<span class="material-symbols-outlined text-[var(--sunset-purple)]">calendar_view_week</span> Weekly Schedule';
        container.className = "grid grid-cols-1 md:grid-cols-7 gap-3 transition-all duration-300";

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const colors = ['purple', 'pink', 'orange', 'lavender', 'gray-200', 'gray-200', 'gray-200']; // Using var names partially

        days.forEach((day, index) => {
            const dayCourses = getSortedCourses().filter(c => c.days.includes(day));
            let borderColor = index < 4 ? `var(--sunset-${colors[index]})` : '#E5E7EB';

            let html = `<div class="glass-card p-4 rounded-xl border-t-2" style="border-top-color: ${borderColor}">
                <p class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">${day}</p>
                <div class="space-y-2">`;

            if (dayCourses.length === 0) {
                const icon = (day === 'Saturday' || day === 'Sunday') ? 'weekend' : 'event_busy';
                html += `<div class="h-16 flex items-center justify-center border-2 border-dashed border-gray-100 rounded">
                    <span class="material-symbols-outlined text-gray-200">${icon}</span>
                </div>`;
            } else {
                dayCourses.forEach(c => {
                    html += `<div class="p-2 bg-[var(--surface)] text-[var(--text-main)] rounded shadow-sm border-l-2 group relative" style="border-left-color: ${borderColor}">
                        <p class="text-xs font-bold leading-tight">${c.title}</p>
                        <p class="text-[9px] text-[var(--text-muted)]">${c.start} - ${c.end}</p>
                        <span class="material-symbols-outlined absolute top-1 right-1 text-[12px] text-gray-300 hover:text-red-400 cursor-pointer hidden group-hover:block" onclick="requestDelete('course', ${c.id})">delete</span>
                    </div>`;
                });
            }
            html += `</div></div>`;
            container.innerHTML += html;
        });

    } else if (currentView === 'Month' || currentView === 'Year') {
        titleEl.innerHTML = `<span class="material-symbols-outlined text-[var(--sunset-purple)]">${currentView === 'Month' ? 'calendar_month' : 'view_timeline'}</span> ${currentView} Overview`;
        container.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-300";

        // Month/Year view combines assignments and exams
        const upcoming = [...db.assignments.map(a => ({ ...a, type: 'assignment' })), ...db.exams.map(e => ({ ...e, type: 'exam' }))]
            .sort((a, b) => new Date(a.dueDate || a.date) - new Date(b.dueDate || b.date));

        let html = '';
        if (upcoming.length === 0) {
            html = `<div class="col-span-full text-center py-10 text-[var(--text-muted)]">No upcoming events found.</div>`;
        }
        upcoming.forEach(item => {
            const dateStr = item.dueDate || item.date;
            const icon = item.type === 'assignment' ? 'assignment' : 'school';
            const color = item.type === 'assignment' ? 'var(--sunset-pink)' : 'var(--sunset-orange)';
            const title = item.title;
            const course = item.course || '';

            html += `<div class="glass-card p-5 rounded-xl border-l-4 group" style="border-left-color: ${color}">
                <div class="flex justify-between">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="material-symbols-outlined text-sm" style="color: ${color}">${icon}</span>
                        <p class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">${item.type}</p>
                    </div>
                     <span class="material-symbols-outlined text-gray-300 hover:text-red-400 cursor-pointer hidden group-hover:block" onclick="requestDelete('${item.type}', ${item.id})">delete</span>
                </div>
                <h4 class="font-bold text-lg">${title}</h4>
                <p class="text-sm text-[var(--text-muted)]">${course}</p>
                <div class="mt-3 text-xs font-semibold px-2 py-1 bg-[var(--hover-bg)] rounded inline-block">
                    Due: ${new Date(dateStr).toLocaleDateString()} ${item.time ? 'at ' + item.time : ''}
                </div>
            </div>`;
        });
        container.innerHTML = html;
    }
}

function renderAssignments() {
    const list = document.getElementById('assignments-list');
    list.innerHTML = '';

    // Combine arrays for the Upcoming widget
    const upcoming = [...db.assignments.map(a => ({ ...a, type: 'assignment' })), ...db.exams.map(e => ({ ...e, type: 'exam' }))]
        .sort((a, b) => new Date(a.dueDate || a.date) - new Date(b.dueDate || b.date))
        .slice(0, 5); // show max 5

    if (upcoming.length === 0) {
        list.innerHTML = `<p class="text-xs text-[var(--text-muted)] italic text-center py-4">No upcoming assignments or exams.</p>`;
        return;
    }

    upcoming.forEach(item => {
        const isPastDue = new Date(item.dueDate || item.date) < new Date(new Date().toDateString());
        const isCompleted = item.completed;

        const bgColor = item.type === 'assignment' ? 'var(--sunset-purple)' : 'var(--sunset-orange)';
        const icon = item.type === 'assignment' ? 'functions' : 'school';
        const dateStr = item.dueDate || item.date;

        const div = document.createElement('div');
        div.className = `flex items-center justify-between p-3 bg-[var(--surface)] text-[var(--text-main)] rounded-xl border border-[var(--border-color)] group relative ${isCompleted ? 'opacity-50' : ''}`;

        let priorityTag = '';
        if (item.priority === 'High Priority') {
            priorityTag = `<span class="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded-full uppercase tracking-wider flex-shrink-0">High Priority</span>`;
        }

        div.innerHTML = `
            <div class="flex items-center gap-3 overflow-hidden">
                <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleCompleted('${item.type}', ${item.id}, this.checked)" class="rounded text-[var(--sunset-purple)] focus:ring-[var(--sunset-purple)] border-[var(--border-color)] bg-[var(--input-bg)]">
                <div class="w-10 h-10 flex-shrink-0 rounded-lg bg-opacity-10 flex items-center justify-center text-white" style="background-color: ${bgColor}">
                    <span class="material-symbols-outlined text-sm">${icon}</span>
                </div>
                <div class="min-w-0">
                    <h4 class="text-sm font-bold truncate line-clamp-1 ${isCompleted ? 'line-through' : ''}">${item.title}</h4>
                    <p class="text-xs text-[var(--text-muted)] truncate">${item.course ? item.course + ' • ' : ''}Due: ${dateStr}</p>
                </div>
            </div>
            ${priorityTag}
            <span class="material-symbols-outlined absolute -right-2 -top-2 bg-[var(--surface)] text-[var(--text-main)] rounded-full shadow-sm text-sm hover:text-red-500 cursor-pointer hidden group-hover:block" onclick="requestDelete('${item.type}', ${item.id}, ${isCompleted || isPastDue})">cancel</span>
        `;
        list.appendChild(div);
    });
}

window.toggleCompleted = function (type, id, checked) {
    if (type === 'assignment') {
        const item = db.assignments.find(i => i.id === id);
        if (item) item.completed = checked;
    } else if (type === 'exam') {
        const item = db.exams.find(i => i.id === id);
        if (item) item.completed = checked;
    } else if (type === 'task') {
        const item = db.tasks.find(i => i.id === id);
        if (item) item.completed = checked;
    }
    saveData();
    renderAll();
}

function renderHabits() {
    const list = document.getElementById('habits-list');
    list.innerHTML = '';

    if (db.habits.length === 0) {
        list.innerHTML = '<p class="text-xs text-[var(--text-muted)] italic">No daily habits. Add one!</p>';
        return;
    }

    db.habits.forEach(habit => {
        const progress = Math.min((habit.current / habit.target) * 100, 100);
        const div = document.createElement('div');
        div.className = "group relative cursor-pointer";
        // Click anywhere to add a point
        div.onclick = (e) => {
            if (e.target.innerText === 'cancel') return; // ignore if delete button clicked
            habit.current += 1;
            saveData();
            renderHabits();
        };

        div.innerHTML = `
            <div class="flex justify-between text-xs font-bold mb-1">
                <span class="${habit.current >= habit.target ? 'text-[var(--sunset-lavender)]' : ''}">${habit.title}</span>
                <span class="flex items-center gap-1">${habit.current}/${habit.target} <span class="text-[9px] font-normal text-[var(--text-muted)]">${habit.measure}</span></span>
            </div>
            <div class="w-full h-2 bg-[var(--border-color)] hover:bg-[var(--text-muted)] rounded-full overflow-hidden transition-colors">
                <div class="h-full bg-[var(--sunset-lavender)] transition-all duration-300" style="width: ${progress}%"></div>
            </div>
            <span class="material-symbols-outlined absolute -right-3 -top-3 w-6 h-6 bg-[var(--surface)] text-[var(--text-muted)] rounded-full shadow-md hover:text-white hover:bg-red-500 hidden group-hover:flex items-center justify-center transition-colors border border-[var(--border-color)] text-sm z-10" onclick="requestDelete('habit', ${habit.id})">close</span>
        `;
        list.appendChild(div);
    });
}

function renderTasks() {
    const list = document.getElementById('tasks-list');
    list.innerHTML = '';
    db.tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = "flex items-center gap-3 group relative";

        const isPastDue = false; // Tasks don't have dates in this simple model

        li.innerHTML = `
            <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleCompleted('task', ${task.id}, this.checked)" class="rounded text-[var(--sunset-purple)] focus:ring-[var(--sunset-purple)] border-gray-300">
            <span class="text-sm font-medium ${task.completed ? 'text-[var(--text-muted)] line-through' : ''}">${task.title}</span>
            <span class="material-symbols-outlined ml-auto text-sm text-[var(--text-muted)] hover:text-red-400 cursor-pointer hidden group-hover:block" onclick="requestDelete('task', ${task.id}, ${task.completed})">close</span>
        `;
        list.appendChild(li);
    });
}

function renderNotes() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    db.notes.forEach(note => {
        const div = document.createElement('div');
        div.className = "relative p-3 bg-[var(--surface)] text-[var(--text-main)] rounded-xl text-xs leading-relaxed shadow-sm border border-[var(--border-color)] group hover:shadow-md transition-shadow group";

        div.innerHTML = `
            <span class="whitespace-pre-wrap">${note.text}</span>
            <span class="material-symbols-outlined text-sm text-[var(--text-muted)] hover:text-red-400 cursor-pointer absolute top-2 right-2 hidden group-hover:block" onclick="requestDelete('note', ${note.id})">delete</span>
        `;
        list.appendChild(div);
    });
}

function updateFocusCourse(now) {
    const container = document.getElementById('focus-course-container');
    if (!container) return;

    const todayDay = now.toLocaleDateString('en-US', { weekday: 'long' });
    const todayCourses = db.courses.filter(c => c.days.includes(todayDay));

    // Find next course today
    const currentMins = now.getHours() * 60 + now.getMinutes();

    let focus = null;
    let subtitle = '';

    const sorted = todayCourses.sort((a, b) => a.start.localeCompare(b.start));
    for (const c of sorted) {
        const [sh, sm] = c.start.split(':').map(Number);
        const [eh, em] = c.end.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;

        if (currentMins >= startMins && currentMins <= endMins) {
            focus = c;
            subtitle = 'Happening Now';
            break;
        } else if (currentMins < startMins) {
            focus = c;
            subtitle = `Starts at ${c.start}`;
            break;
        }
    }

    if (!focus) {
        // Find tomorrow's
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const tomorrowDay = tomorrow.toLocaleDateString('en-US', { weekday: 'long' });
        const tomCourses = db.courses.filter(c => c.days.includes(tomorrowDay)).sort((a, b) => a.start.localeCompare(b.start));
        if (tomCourses.length > 0) {
            focus = tomCourses[0];
            subtitle = `Tomorrow at ${focus.start}`;
        }
    }

    if (focus) {
        container.innerHTML = `
            <div class="w-16 h-16 rounded-2xl bg-[var(--sunset-purple)] bg-opacity-5 flex items-center justify-center">
                <span class="material-symbols-outlined text-3xl text-[var(--sunset-purple)]">science</span>
            </div>
            <div class="flex-1 overflow-hidden">
                <h4 class="font-bold text-sm truncate">${focus.title}</h4>
                <p class="text-xs text-[var(--text-muted)] mt-1 truncate">${subtitle}</p>
                <div class="mt-2 flex gap-1">
                    <span class="w-2 h-2 rounded-full bg-[var(--sunset-purple)]"></span>
                    <span class="w-2 h-2 rounded-full bg-[var(--sunset-purple)] opacity-30"></span>
                    <span class="w-2 h-2 rounded-full bg-[var(--sunset-purple)] opacity-30"></span>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `<p class="text-sm text-[var(--text-muted)] italic py-2">No upcoming courses schedule.</p>`;
    }
}

// Initializers
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    updateClock();
    setInterval(updateClock, 10000);

    // View Filters
    const navButtons = document.querySelectorAll('#nav-filters button');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.className = "px-2 py-1 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors");
            btn.className = "px-2 py-1 text-sm font-semibold nav-active";
            currentView = btn.dataset.view;
            renderAll();
        });
    });

    renderAll();

    if (!isWeb) {
        const { ipcRenderer } = require('electron');
        document.getElementById('win-min-btn')?.addEventListener('click', () => ipcRenderer.send('window-min'));
        document.getElementById('win-max-btn')?.addEventListener('click', () => ipcRenderer.send('window-max'));
        document.getElementById('win-close-btn')?.addEventListener('click', () => ipcRenderer.send('window-close'));
    }

});
