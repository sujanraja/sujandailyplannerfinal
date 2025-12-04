// src/DailyPlanner.jsx
import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Save,
  Download,
  Upload,
  CheckCircle,
  Settings,
} from 'lucide-react';

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
  const [jsonBinKey, setJsonBinKey] = useState('');
  const [binId, setBinId] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');

  const categories = ['work', 'personal', 'health', 'learning', 'other'];
  const priorities = ['low', 'medium', 'high'];

  // Load saved tasks & JSONBin settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dailyPlannerTasks');
    const savedKey = localStorage.getItem('jsonBinKey');
    const savedBinId = localStorage.getItem('binId');

    if (saved) setTasks(JSON.parse(saved));
    if (savedKey) setJsonBinKey(savedKey);
    if (savedBinId) setBinId(savedBinId);
  }, []);

  // Save tasks to localStorage whenever tasks change
  useEffect(() => {
    localStorage.setItem('dailyPlannerTasks', JSON.stringify(tasks));
  }, [tasks]);

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

  // Save tasks to JSONBin (cloud)
  const saveToJsonBin = async () => {
    if (!jsonBinKey) {
      alert('Please add your JSONBin API key in settings');
      return;
    }

    try {
      const url = binId
        ? `https://api.jsonbin.io/v3/b/${binId}`
        : 'https://api.jsonbin.io/v3/b';

      const method = binId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': jsonBinKey,
        },
        body: JSON.stringify({ tasks, savedDate: new Date().toISOString() }),
      });

      const data = await response.json();

      if (data.metadata?.id) {
        setBinId(data.metadata.id);
        localStorage.setItem('binId', data.metadata.id);
      }

      alert('Tasks saved to JSONBin successfully!');
    } catch (error) {
      alert('Error saving to JSONBin: ' + error.message);
    }
  };

  // Load tasks from JSONBin
  const loadFromJsonBin = async () => {
    if (!jsonBinKey || !binId) {
      alert('Please add your JSONBin API key and Bin ID in settings');
      return;
    }

    try {
      const response = await fetch(
        `https://api.jsonbin.io/v3/b/${binId}/latest`,
        {
          headers: {
            'X-Master-Key': jsonBinKey,
          },
        }
      );

      const data = await response.json();

      if (data.record?.tasks) {
        setTasks(data.record.tasks);
        alert('Tasks loaded successfully!');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-indigo-600" />
              <h1 className="text-3xl font-bold text-gray-800">Daily Planner</h1>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Settings className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-gray-700 mb-3">
                JSONBin Settings
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={jsonBinKey}
                    onChange={(e) => {
                      setJsonBinKey(e.target.value);
                      localStorage.setItem('jsonBinKey', e.target.value);
                    }}
                    placeholder="Enter your JSONBin API key"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bin ID (optional for first save)
                  </label>
                  <input
                    type="text"
                    value={binId}
                    onChange={(e) => {
                      setBinId(e.target.value);
                      localStorage.setItem('binId', e.target.value);
                    }}
                    placeholder="Will be auto-generated on first save"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total Tasks</div>
              <div className="text-2xl font-bold text-blue-700">
                {stats.total}
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-100 to-green-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Completed</div>
              <div className="text-2xl font-bold text-green-700">
                {stats.completed}
              </div>
            </div>
          </div>

          {/* Date and Filter Controls */}
          <div className="flex flex-wrap gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={saveToJsonBin}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save to Cloud
              </button>
              <button
                onClick={loadFromJsonBin}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Load
              </button>
              <button
                onClick={exportToJSON}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
                <Upload className="w-4 h-4" />
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={importFromJSON}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Add Task Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-4">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add New Task
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Task Title
                  </label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) =>
                      setNewTask({ ...newTask, title: e.target.value })
                    }
                    placeholder="Enter task title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={newTask.time}
                    onChange={(e) =>
                      setNewTask({ ...newTask, time: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={newTask.duration}
                    onChange={(e) =>
                      setNewTask({ ...newTask, duration: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={newTask.category}
                    onChange={(e) =>
                      setNewTask({ ...newTask, category: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) =>
                      setNewTask({ ...newTask, priority: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {priorities.map((pri) => (
                      <option key={pri} value={pri}>
                        {pri.charAt(0).toUpperCase() + pri.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={addTask}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Task
                </button>
              </div>
            </div>
          </div>

          {/* Task List */}
          <div className="lg:col-span-2">
            <div className="space-y-4">
              {filteredTasks.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">
                    No tasks for this day. Add your first task!
                  </p>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`bg-white rounded-xl shadow-md p-5 border-l-4 transition-all hover:shadow-lg ${getPriorityColor(
                      task.priority
                    )} ${task.completed ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
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
                            className={`text-lg font-semibold text-gray-800 mb-1 ${
                              task.completed ? 'line-through' : ''
                            }`}
                          >
                            {task.title}
                          </h3>
                          <div className="flex flex-wrap gap-3 text-sm text-gray-600">
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
                          <Trash2 className="w-5 h-5" />
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
