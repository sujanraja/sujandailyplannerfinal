// src/usePomodoro.js - FINAL PRODUCTION VERSION WITH NOTIFICATIONS
import { useRef, useState, useEffect } from 'react';

const WORK_AUDIO_DEFAULT =
  'https://raw.githubusercontent.com/sujanraja/sujandailyplannerfinal/c4c0a7d327d86e2c5f1d3c86abf9c21f3606cba0/audio/extreme_alarm_clock.mp3';
const REST_AUDIO_DEFAULT =
  'https://raw.githubusercontent.com/sujanraja/sujandailyplannerfinal/c4c0a7d327d86e2c5f1d3c86abf9c21f3606cba0/audio/alarm_2.mp3';

export const usePomodoro = (setTasks) => {
  const pomodoroRefs = useRef({});
  const [pomodoroState, setPomodoroState] = useState({});
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // 🔊 Reusable audio instances (IMPORTANT)
  const workAudioRef = useRef(new Audio(WORK_AUDIO_DEFAULT));
  const restAudioRef = useRef(new Audio(REST_AUDIO_DEFAULT));

  // ===== TIMINGS =====
  const PROD_WORK_MS = 25 * 60 * 1000;
  const PROD_REST_MS = 5 * 60 * 1000;

  // 🧪 TEST MODE (set to null in production)
  const WORK_TEST_MS = null; // Change to 10000 for 10-second testing
  const REST_TEST_MS = null; // Change to 10000 for 10-second testing

  const getWorkMs = () => WORK_TEST_MS || PROD_WORK_MS;
  const getRestMs = () => REST_TEST_MS || PROD_REST_MS;

  // ===== HELPERS =====
  const calculateRemaining = (startTime, duration) =>
    Math.max(0, duration - (Date.now() - startTime));

  const stopAudio = () => {
    [workAudioRef.current, restAudioRef.current].forEach((audio) => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    });
  };

  // 🔔 SHOW WINDOWS NOTIFICATION
  const showNotification = (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: '/favicon.ico', // Optional: add your app icon
        badge: '/favicon.ico',
        requireInteraction: false,
        silent: false
      });
    }
  };

  const playAudio = async (type) => {
    try {
      stopAudio();

      const audio =
        type === 'Work End'
          ? workAudioRef.current
          : restAudioRef.current;

      audio.currentTime = 0;
      await audio.play();

      // 🔔 Show notification when alarm plays
      if (type === 'Work End') {
        showNotification('🎯 Focus Session Complete!', 'Time for a break. Great work!');
      } else if (type === 'Rest End') {
        showNotification('☕ Break Time Over!', 'Ready to focus again?');
      }
    } catch (err) {
      // Ignore AbortError (normal)
      if (err?.name !== 'AbortError') {
        console.warn('[playAudio] failed:', err);
      }
    }
  };

  const unlockAudioForSession = () => {
    if (audioUnlocked) return;

    try {
      const audio = workAudioRef.current;
      audio.volume = 0.001;

      audio.play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1.0;
          setAudioUnlocked(true);
          console.log('Audio unlocked');
        })
        .catch(() => {});
    } catch {}
  };

  // ===== POMODORO CORE =====

  const startPomodoro = (task) => {
    unlockAudioForSession();
    stopAudio();

    const id = task.id;
    const durationMinutes = Number(task.duration) || 0;
    const totalCycles = Math.max(1, Math.ceil(durationMinutes / 30));
    const workMs = getWorkMs();

    clearInterval(pomodoroRefs.current[id]?.interval);

    const startTime = Date.now();

    setPomodoroState((p) => ({
      ...p,
      [id]: {
        running: true,
        phase: 'work',
        currentCycle: 1,
        totalCycles,
        startTime,
        duration: workMs,
        remainingMs: workMs,
      },
    }));

    pomodoroRefs.current[id] = {
      interval: setInterval(() => {
        setPomodoroState((prev) => {
          const s = prev[id];
          if (!s || !s.running) return prev;

          const remaining = calculateRemaining(s.startTime, s.duration);

          if (remaining <= 0) {
            clearInterval(pomodoroRefs.current[id].interval);
            playAudio('Work End');

            return {
              ...prev,
              [id]: { ...s, running: false, phase: 'restReady', remainingMs: 0 },
            };
          }

          return { ...prev, [id]: { ...s, remainingMs: remaining } };
        });
      }, 1000),
    };
  };

  const startRest = (task) => {
    unlockAudioForSession();
    stopAudio();

    const id = task.id;
    const restMs = getRestMs();
    const startTime = Date.now();

    setPomodoroState((p) => ({
      ...p,
      [id]: {
        ...p[id],
        running: true,
        phase: 'rest',
        startTime,
        duration: restMs,
        remainingMs: restMs,
      },
    }));

    pomodoroRefs.current[id] = {
      interval: setInterval(() => {
        setPomodoroState((prev) => {
          const s = prev[id];
          if (!s || !s.running) return prev;

          const remaining = calculateRemaining(s.startTime, s.duration);

          if (remaining <= 0) {
            clearInterval(pomodoroRefs.current[id].interval);
            playAudio('Rest End');

            const nextCycle = s.currentCycle + 1;
            const done = nextCycle > s.totalCycles;

            return {
              ...prev,
              [id]: {
                ...s,
                running: false,
                phase: done ? 'done' : 'nextReady',
                currentCycle: done ? s.currentCycle : nextCycle,
                remainingMs: 0,
              },
            };
          }

          return { ...prev, [id]: { ...s, remainingMs: remaining } };
        });
      }, 1000),
    };
  };

  const nextCycleStart = (task) => {
    unlockAudioForSession();
    stopAudio();

    const id = task.id;
    const workMs = getWorkMs();
    const startTime = Date.now();

    setPomodoroState((p) => ({
      ...p,
      [id]: {
        ...p[id],
        running: true,
        phase: 'work',
        startTime,
        duration: workMs,
        remainingMs: workMs,
      },
    }));

    pomodoroRefs.current[id] = {
      interval: setInterval(() => {
        setPomodoroState((prev) => {
          const s = prev[id];
          if (!s || !s.running) return prev;

          const remaining = calculateRemaining(s.startTime, s.duration);

          if (remaining <= 0) {
            clearInterval(pomodoroRefs.current[id].interval);
            playAudio('Work End');

            if (s.currentCycle >= s.totalCycles) {
              setTasks((t) =>
                t.map((x) => (x.id === id ? { ...x, completed: true } : x))
              );
              // 🔔 Show completion notification
              showNotification('🎉 All Cycles Complete!', 'Great job! Task completed successfully.');
              return { ...prev, [id]: { ...s, phase: 'done', running: false } };
            }

            return {
              ...prev,
              [id]: { ...s, phase: 'restReady', running: false },
            };
          }

          return { ...prev, [id]: { ...s, remainingMs: remaining } };
        });
      }, 1000),
    };
  };

  const stopPomodoro = (id) => {
    stopAudio();
    clearInterval(pomodoroRefs.current[id]?.interval);
    setPomodoroState((p) => ({
      ...p,
      [id]: { ...p[id], running: false },
    }));
  };

  const resetPomodoro = (id) => {
    stopAudio();
    clearInterval(pomodoroRefs.current[id]?.interval);
    setPomodoroState((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  };

  const forceRestartPomodoro = (id) => {
    stopAudio();
    clearInterval(pomodoroRefs.current[id]?.interval);
    setPomodoroState((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  };

  useEffect(() => () => {
    stopAudio();
    Object.values(pomodoroRefs.current).forEach((r) =>
      clearInterval(r.interval)
    );
  }, []);

  const msToMMSS = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  return {
    pomodoroState,
    startPomodoro,
    startRest,
    nextCycleStart,
    stopPomodoro,
    resetPomodoro,
    forceRestartPomodoro,
    msToMMSS,
  };
};