// src/DailyPlanner.jsx
import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';

// ================= JSONBIN CONFIG =================
// Put your real values here (inside quotes)
const JSONBIN_API_KEY = '$2a$10$nS.leAZvr93E8pr9xk/6recMfoV0yV5hVnl8iZeMlowppje96O7gC';
const JSONBIN_BIN_ID = '69317500d0ea881f40125b99'; // e.g. 675f8e90acd16f3d88abcd12

export default function DailyPlanner() {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    title: '',
    time: '',
    duration: '30',
    priority: 'medium',
    category: 'work',
  });
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [filterCategory, setFilterCategory] = useState('all');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const alarmTimersRef = useRef([]);

  const categories = ['work', 'personal', 'health', 'learning', 'other'];
  const priorities = ['low', 'medium', 'high'];

  // ❌ NO localStorage usage
  // ✅ Only keep tasks in memory + JSONBin

  // Schedule alarms for today's tasks
  useEffect(() => {
    if (!notificationsEnabled) return;

    // Clear old timers
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
            new Notification('Task Reminder', {
              body: task.title + ' at ' + task.time,
            });
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
      alert('Notifications are not supported in this browser.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      alert('Notifications enabled for today\'s tasks.');
    } else {
      alert('Notifications are blocked. Please allow them in your browser.');
    }
  };

  const addTask = () => {
    if (newTask.title && newTask.time) {
      setTasks([
        ...tasks,
        {
          ...newTask,
          id: Date.now(),
          date: selectedDate,
          completed: false,
        },
      ]);
      setNewTask({
        title: '',
        time: '',
        duration: '30',
        priority: 'medium',
        category: 'work',
      });
    } else {
      alert('Please enter both title and time for the task.');
    }
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter((task) => task.id !== id));
  };

  const toggleComplete = (id) => {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const clearAllTasks = () => {
    const ok = window.confirm('Clear all tasks for all days?');
    if (!ok) return;
    setTasks([]);
  };

  // Save tasks to JSONBin (cloud) ONLY
  const saveToJsonBin = async () => {
    if (!JSONBIN_API_KEY || !JSONBIN_BIN_ID) {
      alert('JSONBin is not configured. Please set API key and Bin ID in the code.');
      return;
    }

    try {
      const url = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': JSONBIN_API_KEY,
        },
        body: JSON.stringify({ tasks, savedDate: new Date().toISOString() }),
      });

      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }

      await response.json();
      alert('Tasks saved to JSONBin successfully!');
    } catch (error) {
      alert('Error saving to JSONBin: ' + error.message);
    }
  };

  // Load tasks from JSONBin manually (when user clicks Load)
  const loadFromJsonBin = async () => {
    if (!JSONBIN_API_KEY || !JSONBIN_BIN_ID) {
      alert('JSONBin is not configured. Please set API key and Bin ID in the code.');
      return;
    }

    try {
      const response = await fetch(
        `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`,
        {
          headers: {
            'X-Master-Key': JSONBIN_API_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }

      const data = await response.json();

      if (data.record && data.record.tasks) {
        setTasks(data.record.tasks);
        alert('Tasks loaded successfully from JSONBin!');
      } else {
        alert('No tasks found in this bin.');
      }
    } catch (error) {
      alert('Error loading from JSONBin: ' + error.message);
    }
  };

  const exportToJSON = () => {
    const dataStr = JSON.stringify(
      { tasks, exportDate: new Date().toISOString() },
      null,
      2
    );
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daily-planner-${selectedDate}.json`;
    link.click();
  };

  const importFromJSON = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (data.tasks) {
            setTasks(data.tasks);
            alert('Tasks imported successfully!');
          } else {
            alert('Invalid file format (no tasks field).');
          }
        } catch (error) {
          alert('Error importing file: ' + error.message);
        }
      };
      reader.readAsText(file);
    }
  };

  const filteredTasks = tasks
    .filter(
      (task) =>
        task.date === selectedDate &&
        (filterCategory === 'all' || task.category === filterCategory)
    )
    .sort((a, b) => a.time.localeCompare(b.time));

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'border-red-500 bg-red-50';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50';
      case 'low':
        return 'border-green-500 bg-green-50';
      default:
        return 'border-gray-300 bg-white';
    }
  };

  const stats = {
    total: filteredTasks.length,
    completed: filteredTasks.filter((t) => t.completed).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-3 sm:p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600" />
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                Daily Planner
              </h1>
            </div>

            <button
              onClick={handleEnableNotifications}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm sm:text-base transition-colors ${
                notificationsEnabled
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              <Bell className="w-4 h-4" />
              {notificationsEnabled ? 'Alerts On (Today)' : 'Enable Alerts (Today)'}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
            <div className="bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-600">Total Tasks</div>
              <div className="text-xl sm:text-2xl font-bold text-blue-700">
                {stats.total}
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-100 to-green-50 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-600">Completed</div>
              <div className="text-xl sm:text-2xl font-bold text-green-700">
                {stats.completed}
              </div>
            </div>
          </div>

          {/* Date, Filter, Cloud & Import/Export Controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm sm:text-base"
              />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm sm:text-base"
              >
                <option value="all">All</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <button
                onClick={saveToJsonBin}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-indigo-600 text-white text-xs sm:text-sm rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={loadFromJsonBin}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 text-white text-xs sm:text-sm rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Load
              </button>
              <button
                onClick={exportToJSON}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white text-xs sm:text-sm rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <label className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
                <Upload className="w-4 h-4" />
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={importFromJSON}
                  className="hidden"
                />
              </label>
              <button
                onClick={clearAllTasks}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-red-600 text-white text-xs sm:text-sm rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </button>
            </div>
          </div>
        </div>

        {/* Main layout: Add Task + Task List */}
        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Add Task Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 lg:sticky lg:top-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add New Task
              </h2>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Task Title
                  </label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) =>
                      setNewTask({ ...newTask, title: e.target.value })
                    }
                    placeholder="Enter task title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Time
                    </label>
                    <input
                      type="time"
                      value={newTask.time}
                      onChange={(e) =>
                        setNewTask({ ...newTask, time: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={newTask.duration}
                      onChange={(e) =>
                        setNewTask({ ...newTask, duration: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={newTask.category}
                      onChange={(e) =>
                        setNewTask({ ...newTask, category: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <select
                      value={newTask.priority}
                      onChange={(e) =>
                        setNewTask({ ...newTask, priority: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    >
                      {priorities.map((pri) => (
                        <option key={pri} value={pri}>
                          {pri.charAt(0).toUpperCase() + pri.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={addTask}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2.5 sm:py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <Plus className="w-5 h-5" />
                  Add Task
                </button>
              </div>
            </div>
          </div>

          {/* Task List */}
          <div className="lg:col-span-2">
            <div className="space-y-3 sm:space-y-4 mb-16 sm:mb-6">
              {filteredTasks.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-lg p-8 sm:p-12 text-center">
                  <Calendar className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
                  <p className="text-gray-500 text-base sm:text-lg">
                    No tasks for this day. Add your first task!
                  </p>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`bg-white rounded-xl shadow-md p-4 sm:p-5 border-l-4 transition-all hover:shadow-lg ${getPriorityColor(
                      task.priority
                    )} ${task.completed ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          onClick={() => toggleComplete(task.id)}
                          className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            task.completed
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-300 hover:border-green-500'
                          }`}
                        >
                          {task.completed && (
                            <CheckCircle className="w-4 h-4 text-white" />
                          )}
                        </button>
                        <div className="flex-1">
                          <h3
                            className={`text-base sm:text-lg font-semibold text-gray-800 mb-1 ${
                              task.completed ? 'line-through' : ''
                            }`}
                          >
                            {task.title}
                          </h3>
                          <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {task.time}
                            </span>
                            <span className="bg-gray-100 px-2 py-1 rounded">
                              {task.duration} min
                            </span>
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded capitalize">
                              {task.category}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
