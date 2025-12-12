// src/DailyPlanner.jsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Save,
  Download,
  Upload,
  CheckCircle,
  Bell,
  Play,
  Pause,
  RefreshCw,
  Coffee
} from 'lucide-react';

// ================= JSONBIN CONFIG =================
const JSONBIN_API_KEY = '$2a$10$nS.leAZvr93E8pr9xk/6recMfoV0yV5hVnl8iZeMlowppje96O7gC';
const JSONBIN_BIN_ID = '69317500d0ea881f40125b99';

// Default Beep Sound (Base64) - fallback if nothing else works
const DEFAULT_BEEP =
  'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU';

// ===== RAW GITHUB URLs (from your provided commit) =====
const WORK_AUDIO_DEFAULT =
  'https://raw.githubusercontent.com/sujanraja/sujandailyplannerfinal/de112869cdfbfa0044d016ff660cfee0fd71e431/audio/extreme_alarm_clock.mp3';
const REST_AUDIO_DEFAULT =
  'https://raw.githubusercontent.com/sujanraja/sujandailyplannerfinal/de112869cdfbfa0044d016ff660cfee0fd71e431/audio/alarm_2.mp3';

// small helper
const isBlobUrl = (url) => typeof url === 'string' && url.startsWith('blob:');

export default function DailyPlanner() {
  // Tasks & UI
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    title: '',
    time: '',
    duration: '30',
    priority: 'medium',
    category: 'work',
  });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterCategory, setFilterCategory] = useState('all');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const categories = ['work', 'personal', 'health', 'learning', 'other'];
  const priorities = ['low', 'medium', 'high'];

  // Pomodoro state
  const pomodoroRefs = useRef({});
  const [pomodoroState, setPomodoroState] = useState({});

  // Audio refs/state
  const currentAudioRef = useRef(null);
  const currentAudioBlobRef = useRef(null); // safe to keep if you later allow uploads
  const [workAudioUrl] = useState(WORK_AUDIO_DEFAULT); // fixed default (no upload)
  const [restAudioUrl] = useState(REST_AUDIO_DEFAULT); // fixed default (no upload)
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Alarm timers for notifications
  const alarmTimersRef = useRef([]);

  // Helper: ms -> MM:SS
  const msToMMSS = (ms) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const seconds = (totalSec % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  // ================= AUDIO CONTROLS =================

  const stopAudio = () => {
    try {
      const a = currentAudioRef.current;
      if (!a) return;

      // remove event handlers
      try { a.onended = null; a.onerror = null; a.oncanplay = null; a.onloadedmetadata = null; } catch (e) {}

      // pause/reset
      try { a.pause(); a.currentTime = 0; } catch (err) { console.warn('stopAudio pause/reset error', err); }

      // unload source
      try { a.src = ''; a.load?.(); } catch (err) { console.warn('stopAudio unload error', err); }

      // revoke blob url if we tracked one
      if (currentAudioBlobRef.current) {
        try { URL.revokeObjectURL(currentAudioBlobRef.current); } catch (err) { console.warn('revokeObjectURL failed', err); }
        currentAudioBlobRef.current = null;
      }
    } finally {
      currentAudioRef.current = null;
    }
  };

  // Enhanced playAudio with fallback and logging. Sets audioUnlocked=true when play actually starts.
  const playAudio = async (customUrl, type) => {
    stopAudio();
    const urlPrimary = customUrl || DEFAULT_BEEP;
    console.log(`[playAudio] requested type=${type}, url=${urlPrimary}, audioUnlocked=${audioUnlocked}`);

    const createAndPlay = (url) =>
      new Promise((resolve) => {
        try {
          const audio = new Audio(url);
          audio.loop = true;
          audio.volume = 1.0;

          audio.oncanplay = () => console.log(`[playAudio:oncanplay] url=${url}`);
          audio.onloadedmetadata = () => console.log(`[playAudio:onloadedmetadata] duration=${audio.duration} src=${audio.src}`);
          audio.onended = () => console.log(`[playAudio:onended] url=${url}`);
          audio.onerror = (e) => console.error(`[playAudio:onerror] url=${url}`, e);

          currentAudioRef.current = audio;
          if (url && url.startsWith('blob:')) currentAudioBlobRef.current = url;
          else currentAudioBlobRef.current = null;

          const p = audio.play();
          if (p && typeof p.then === 'function') {
            p.then(() => {
              console.log(`[playAudio] started playing url=${url}`);
              try { setAudioUnlocked(true); } catch (e) { /* no-op */ }
              resolve(true);
            }).catch((err) => {
              console.warn(`[playAudio] play() rejected for url=${url}`, err);
              try { audio.pause(); audio.src = ''; audio.load?.(); } catch (e) {}
              currentAudioRef.current = null;
              resolve(false);
            });
          } else {
            // fallback for older browsers
            console.log('[playAudio] play() returned no promise; assuming playing.');
            try { setAudioUnlocked(true); } catch (e) {}
            resolve(true);
          }
        } catch (err) {
          console.error('[playAudio] create/play error', err);
          resolve(false);
        }
      });

    // Try primary URL
    const ok = await createAndPlay(urlPrimary);
    if (ok) return;

    // Try fallback beep (if primary wasn't the beep)
    if (urlPrimary !== DEFAULT_BEEP) {
      console.warn(`[playAudio] primary url failed, trying DEFAULT_BEEP fallback. primary=${urlPrimary}`);
      const ok2 = await createAndPlay(DEFAULT_BEEP);
      if (ok2) return;
    }

    console.error(`[playAudio] ALL playback attempts failed for type=${type}, primary=${urlPrimary}`);
    alert('Audio playback error. See console for details.');
  };

  // Synchronous unlock attempt via a tiny inline beep; called inside user gesture handlers.
  const unlockAudioForSession = () => {
    if (audioUnlocked) return;
    try {
      const a = new Audio(DEFAULT_BEEP);
      a.volume = 0.001;
      const playPromise = a.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            try { a.pause(); a.currentTime = 0; } catch (e) {}
            setAudioUnlocked(true);
            console.log('Audio unlocked via direct user gesture (sync play).');
          })
          .catch((err) => {
            console.warn('unlock play() rejected:', err);
            // no alert here — unlocking may fail if autoplay policies are strict; actual user gesture play will set audioUnlocked later.
          });
      }
    } catch (err) {
      console.error('unlockAudioForSession error:', err);
    }
  };

  // ==================================================
  // ============ POMODORO LOGIC START ============
  // ==================================================

  // Production durations:
  const PROD_WORK_MS = 25 * 60 * 1000;
  const PROD_REST_MS = 5 * 60 * 1000;

  // For quick testing change WORK_TEST_MS / REST_TEST_MS and replace usage below.
  // Example test values: const WORK_TEST_MS = 200; const REST_TEST_MS = 200;
  const WORK_TEST_MS = null; // set to a number (ms) for testing, or null to use production
  const REST_TEST_MS = null; // set to a number (ms) for testing, or null to use production

  const getWorkMs = () => (WORK_TEST_MS || PROD_WORK_MS);
  const getRestMs = () => (REST_TEST_MS || PROD_REST_MS);

  const startPomodoro = (task) => {
    // call unlock synchronously inside the user gesture
    unlockAudioForSession();

    stopAudio();

    const id = task.id;
    const durationMinutes = Number(task.duration) || 0;
    const totalCycles = Math.max(1, Math.ceil(durationMinutes / 30));
    const workMs = getWorkMs();

    if (pomodoroRefs.current[id]) {
      clearInterval(pomodoroRefs.current[id].interval);
      pomodoroRefs.current[id].timeouts?.forEach((t) => clearTimeout(t));
    }

    setPomodoroState((prev) => ({
      ...prev,
      [id]: {
        running: true,
        phase: 'work',
        currentCycle: 1,
        totalCycles,
        remainingMs: workMs,
      },
    }));

    const tick = setInterval(() => {
      setPomodoroState((prev) => {
        const s = { ...(prev[id] || {}) };
        if (!s.running) return prev;
        s.remainingMs = Math.max(0, (s.remainingMs || 0) - 1000);
        return { ...prev, [id]: s };
      });
    }, 1000);

    const timeout = setTimeout(() => {
      playAudio(workAudioUrl, 'Work End');

      setPomodoroState((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] || {}),
          running: false,
          phase: 'restReady',
          remainingMs: 0,
        },
      }));

      clearInterval(tick);
    }, workMs);

    pomodoroRefs.current[id] = { interval: tick, timeouts: [timeout] };
  };

  const startRest = (task) => {
    unlockAudioForSession();
    stopAudio();

    const id = task.id;
    const restMs = getRestMs();

    setPomodoroState((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        running: true,
        phase: 'rest',
        remainingMs: restMs,
      },
    }));

    const tick = setInterval(() => {
      setPomodoroState((prev) => {
        const s = { ...(prev[id] || {}) };
        if (!s.running) return prev;
        s.remainingMs = Math.max(0, (s.remainingMs || 0) - 1000);
        return { ...prev, [id]: s };
      });
    }, 1000);

    const timeout = setTimeout(() => {
      playAudio(restAudioUrl, 'Rest End');

      setPomodoroState((prev) => {
        const s = prev[id] || {};
        const nextCycleVal = (s.currentCycle || 0) + 1;
        const isAllDone = nextCycleVal > (s.totalCycles || 0);

        return {
          ...prev,
          [id]: {
            ...s,
            running: false,
            phase: isAllDone ? 'done' : 'nextReady',
            currentCycle: isAllDone ? s.currentCycle : nextCycleVal,
            remainingMs: 0,
          },
        };
      });

      clearInterval(tick);
    }, restMs);

    pomodoroRefs.current[id] = { interval: tick, timeouts: [timeout] };
  };

  const nextCycleStart = (task) => {
    unlockAudioForSession();
    stopAudio();

    const id = task.id;
    const workMs = getWorkMs();

    const s = pomodoroState[id];
    if (!s) return;

    setPomodoroState((prev) => ({
      ...prev,
      [id]: {
        ...s,
        running: true,
        phase: 'work',
        remainingMs: workMs,
      },
    }));

    const tick = setInterval(() => {
      setPomodoroState((prev) => {
        const s2 = { ...(prev[id] || {}) };
        if (!s2.running) return prev;
        s2.remainingMs = Math.max(0, (s2.remainingMs || 0) - 1000);
        return { ...prev, [id]: s2 };
      });
    }, 1000);

    const timeout = setTimeout(() => {
      playAudio(workAudioUrl, 'Work End');

      setPomodoroState((prev) => {
        const s3 = prev[id];
        const isDone = s3.currentCycle >= s3.totalCycles;

        if (isDone) {
          setTasks((prevT) => prevT.map((t) => (t.id === id ? { ...t, completed: true } : t)));
          return { ...prev, [id]: { ...s3, running: false, phase: 'done', remainingMs: 0 } };
        }

        return { ...prev, [id]: { ...s3, running: false, phase: 'restReady', remainingMs: 0 } };
      });

      clearInterval(tick);
    }, workMs);

    pomodoroRefs.current[id] = { interval: tick, timeouts: [timeout] };
  };

  const stopPomodoro = (taskId) => {
    stopAudio();
    const r = pomodoroRefs.current[taskId];
    if (r) {
      if (r.interval) clearInterval(r.interval);
      (r.timeouts || []).forEach((t) => clearTimeout(t));
      delete pomodoroRefs.current[taskId];
    }
    setPomodoroState((prev) => {
      if (!prev[taskId]) return prev;
      return { ...prev, [taskId]: { ...prev[taskId], running: false } };
    });
  };

  // Reset won't revert 'done' tasks back to cycle 1
  const resetPomodoro = (taskId) => {
    stopAudio();
    const r = pomodoroRefs.current[taskId];
    if (r) {
      if (r.interval) clearInterval(r.interval);
      (r.timeouts || []).forEach((t) => clearTimeout(t));
      delete pomodoroRefs.current[taskId];
    }

    setPomodoroState((prev) => {
      const cur = prev ? prev[taskId] : undefined;
      if (cur && cur.phase === 'done') {
        return { ...prev, [taskId]: { ...cur, running: false } };
      }
      const newState = { ...(prev || {}) };
      if (newState[taskId]) delete newState[taskId];
      return newState;
    });
  };

  const forceRestartPomodoro = (taskId) => {
    const r = pomodoroRefs.current[taskId];
    if (r) {
      if (r.interval) clearInterval(r.interval);
      (r.timeouts || []).forEach((t) => clearTimeout(t));
      delete pomodoroRefs.current[taskId];
    }
    setPomodoroState((prev) => {
      const newState = { ...(prev || {}) };
      if (newState[taskId]) delete newState[taskId];
      return newState;
    });
  };

  // ==================================================
  // ============= POMODORO LOGIC END ================
  // ==================================================

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      Object.keys(pomodoroRefs.current).forEach((id) => {
        const r = pomodoroRefs.current[id];
        if (r) {
          (r.timeouts || []).forEach((t) => clearTimeout(t));
          if (r.interval) clearInterval(r.interval);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Schedule notification alarms
  useEffect(() => {
    if (!notificationsEnabled) return;

    alarmTimersRef.current.forEach((id) => clearTimeout(id));
    alarmTimersRef.current = [];

    const now = new Date();
    const today = new Date().toISOString().split('T')[0];
    const todaysTasks = tasks.filter((task) => task.date === today && task.time);

    todaysTasks.forEach((task) => {
      const [hours, minutes] = task.time.split(':').map(Number);
      const alarmTime = new Date();
      alarmTime.setHours(hours, minutes, 0, 0);

      const diff = alarmTime.getTime() - now.getTime();
      if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
        const id = setTimeout(() => {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Task Reminder', { body: task.title + ' at ' + task.time });
          }
          alert('Task time: ' + task.title + ' (' + task.time + ')');
        }, diff);
        alarmTimersRef.current.push(id);
      }
    });

    return () => {
      alarmTimersRef.current.forEach((id) => clearTimeout(id));
      alarmTimersRef.current = [];
    };
  }, [tasks, notificationsEnabled]);

  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Notifications not supported in this browser.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      alert("Notifications enabled for today's tasks.");
    } else {
      alert('Notifications are blocked. Please allow them in your browser.');
    }
  };

  // Tasks CRUD
  const addTask = () => {
    if (newTask.title && newTask.time) {
      setTasks([...tasks, { ...newTask, id: Date.now(), date: selectedDate, completed: false }]);
      setNewTask({ title: '', time: '', duration: '30', priority: 'medium', category: 'work' });
    } else alert('Please enter both title and time for the task.');
  };

  const deleteTask = (id) => setTasks(tasks.filter((t) => t.id !== id));
  const toggleComplete = (id) => setTasks(tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  const updateTaskScore = (id, value) => { const num = Number(value); setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, score: isNaN(num) ? 0 : num } : t))); };
  const clearAllTasks = () => { if (window.confirm('Clear all tasks for all days?')) setTasks([]); };

  // JSONBin and import/export
  const saveToJsonBin = async () => {
    if (!JSONBIN_API_KEY || !JSONBIN_BIN_ID) { alert('JSONBin not configured.'); return; }
    try {
      const url = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
      const response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY }, body: JSON.stringify({ tasks, savedDate: new Date().toISOString() }) });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      await response.json();
      alert('Tasks saved to JSONBin successfully!');
    } catch (error) { alert('Error saving to JSONBin: ' + error.message); }
  };

  const loadFromJsonBin = async () => {
    if (!JSONBIN_API_KEY || !JSONBIN_BIN_ID) { alert('JSONBin not configured.'); return; }
    try {
      const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, { headers: { 'X-Master-Key': JSONBIN_API_KEY } });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (data.record && data.record.tasks) { setTasks(data.record.tasks); alert('Tasks loaded successfully from JSONBin!'); } else alert('No tasks found in this bin.');
    } catch (error) { alert('Error loading from JSONBin: ' + error.message); }
  };

  const exportToJSON = () => {
    const dataStr = JSON.stringify({ tasks, exportDate: new Date().toISOString() }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a'); link.href = url; link.download = `daily-planner-${selectedDate}.json`; link.click();
  };

  const importFromJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.tasks) { setTasks(data.tasks); alert('Tasks imported successfully!'); } else alert('Invalid file format (no tasks field).');
      } catch (err) { alert('Error importing file: ' + err.message); }
    };
    reader.readAsText(file);
  };

  // Filtering & stats
  const filteredTasks = tasks.filter((task) => task.date === selectedDate && (filterCategory === 'all' || task.category === filterCategory)).sort((a, b) => a.time.localeCompare(b.time));
  const completedForSelected = filteredTasks.filter((t) => t.completed);
  const scoreTotal = completedForSelected.reduce((sum, t) => sum + (Number(t.score) || 0), 0);
  const scoreMax = filteredTasks.length * 100;
  const stats = { total: filteredTasks.length, completed: completedForSelected.length, scoreTotal, scoreMax };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      case 'low': return 'border-green-500 bg-green-50';
      default: return 'border-gray-300 bg-white';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-3 sm:p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600" />
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Daily Planner</h1>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={handleEnableNotifications} className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm sm:text-base transition-colors ${notificationsEnabled ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                <Bell className="w-4 h-4" />
                {notificationsEnabled ? 'Alerts On (Today)' : 'Enable Alerts (Today)'}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
            <div className="bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-600">Total Tasks</div>
              <div className="text-xl sm:text-2xl font-bold text-blue-700">{stats.total}</div>
            </div>
            <div className="bg-gradient-to-br from-green-100 to-green-50 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-600">Completed</div>
              <div className="text-xl sm:text-2xl font-bold text-green-700">{stats.completed}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-100 to-purple-50 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-600">Score Today</div>
              <div className="text-xl sm:text-2xl font-bold text-purple-700">{stats.scoreTotal} / {stats.scoreMax || 0}</div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex gap-2">
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm sm:text-base" />
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm sm:text-base">
                <option value="all">All</option>
                {categories.map((cat) => <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>)}
              </select>
            </div>

            {/* Removed Work/Rest upload controls per your request */}

            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <button onClick={saveToJsonBin} className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-indigo-600 text-white text-xs sm:text-sm rounded-lg hover:bg-indigo-700"><Save className="w-4 h-4" /> Save</button>
              <button onClick={loadFromJsonBin} className="flex items.center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 text-white text-xs sm:text-sm rounded-lg hover:bg-purple-700"><Upload className="w-4 h-4" /> Load</button>
              <button onClick={exportToJSON} className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white text-xs sm:text-sm rounded-lg hover:bg-green-700"><Download className="w-4 h-4" /> Export</button>
              <label className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-700 cursor-pointer"><Upload className="w-4 h-4" /> Import<input type="file" accept=".json" onChange={importFromJSON} className="hidden" /></label>
              <button onClick={clearAllTasks} className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-red-600 text-white text-xs sm:text-sm rounded-lg hover:bg-red-700"><Trash2 className="w-4 h-4" /> Clear</button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Add Task */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 lg:sticky lg:top-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2"><Plus className="w-5 h-5" /> Add New Task</h2>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Task Title</label>
                  <input type="text" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Enter task title" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Time</label>
                    <input type="time" value={newTask.time} onChange={(e) => setNewTask({ ...newTask, time: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                    <input type="number" value={newTask.duration} onChange={(e) => setNewTask({ ...newTask, duration: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select value={newTask.category} onChange={(e) => setNewTask({ ...newTask, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      {categories.map((cat) => <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      {priorities.map((pri) => <option key={pri} value={pri}>{pri.charAt(0).toUpperCase() + pri.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={addTask} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2.5 sm:py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 font-medium flex items-center justify-center gap-2 text-sm sm:text-base"><Plus className="w-5 h-5" /> Add Task</button>
              </div>
            </div>
          </div>

          {/* Task List */}
          <div className="lg:col-span-2">
            <div className="space-y-3 sm:space-y-4 mb-16 sm:mb-6">
              {filteredTasks.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-lg p-8 sm:p-12 text-center">
                  <Calendar className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
                  <p className="text-gray-500 text-base sm:text-lg">No tasks for this day.</p>
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const state = pomodoroState[task.id];
                  const isRunning = state?.running;
                  const phase = state?.phase;

                  return (
                    <div key={task.id} className={`bg-white rounded-xl shadow-md p-4 sm:p-5 border-l-4 transition-all hover:shadow-lg ${getPriorityColor(task.priority)} ${task.completed ? 'opacity-60' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <button onClick={() => toggleComplete(task.id)} className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-500'}`}>
                            {task.completed && <CheckCircle className="w-4 h-4 text-white" />}
                          </button>
                          <div className="flex-1">
                            <h3 className={`text-base sm:text-lg font-semibold text-gray-800 mb-1 ${task.completed ? 'line-through' : ''}`}>{task.title}</h3>
                            <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600">
                              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{task.time}</span>
                              <span className="bg-gray-100 px-2 py-1 rounded">{task.duration} min</span>
                              <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded capitalize">{task.category}</span>
                              <div className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-1 rounded">
                                <span className="text-[11px] sm:text-xs">Score:</span>
                                <input type="number" min="0" max="100" value={task.score === undefined ? '' : task.score} onChange={(e) => updateTaskScore(task.id, e.target.value)} disabled={!task.completed} className="w-16 px-1 py-0.5 border border-purple-300 rounded text-xs bg-white disabled:opacity-50" />
                              </div>
                            </div>
                          </div>
                        </div>
                        <button onClick={() => deleteTask(task.id)} className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                      </div>

                      {/* Pomodoro UI */}
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg flex flex-col sm:flex-row sm:items-center gap-3 text-xs sm:text-sm transition-all">
                        {!state ? (
                          <>
                            <button onClick={() => startPomodoro(task)} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors shadow-sm"><Play className="w-3 h-3" /> Start Focus</button>
                            <div className="text-gray-500">{task.duration} min → {Math.max(1, Math.ceil((Number(task.duration) || 0) / 30))} cycles</div>
                          </>
                        ) : (
                          <div className="flex flex-1 items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded font-medium ${phase === 'work' ? 'bg-indigo-100 text-indigo-700' : phase === 'rest' ? 'bg-green-100 text-green-700' : phase === 'restReady' ? 'bg-yellow-100 text-yellow-700' : phase === 'nextReady' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'}`}>
                                {phase === 'work' && 'Focussing'}
                                {phase === 'rest' && 'Resting'}
                                {phase === 'restReady' && 'Cycle Done!'}
                                {phase === 'nextReady' && 'Ready for Next'}
                                {phase === 'done' && 'All Done'}
                              </span>

                              <span className="px-2 py-1 rounded bg-white border border-gray-200 text-gray-600">Cycle: {state.currentCycle} / {state.totalCycles}</span>

                              {isRunning && <span className="px-2 py-1 rounded bg-gray-800 text-white font-mono shadow-sm">{msToMMSS(state.remainingMs || 0)}</span>}
                            </div>

                            <div className="flex items-center gap-2">
                              {phase === 'restReady' && <button onClick={() => startRest(task)} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 animate-pulse flex items-center gap-1"><Coffee className="w-3 h-3" /> Start Break</button>}
                              {phase === 'nextReady' && <button onClick={() => nextCycleStart(task)} className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 animate-pulse flex items-center gap-1"><Play className="w-3 h-3" /> Start Next Cycle</button>}

                              {isRunning ? (
                                <button onClick={() => stopPomodoro(task.id)} className="px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 border border-red-200"><Pause className="w-3 h-3" /> Stop</button>
                              ) : state?.phase === 'done' ? (
                                <div className="flex gap-2">
                                  <button onClick={() => resetPomodoro(task.id)} className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 border border-gray-300">Keep Done</button>
                                  <button onClick={() => forceRestartPomodoro(task.id)} className="px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">Restart from 1</button>
                                </div>
                              ) : (
                                <button onClick={() => resetPomodoro(task.id)} className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 border border-gray-300"><RefreshCw className="w-3 h-3" /> Reset</button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
