const STORAGE_KEY = 'openclaw-muyu-v1';

const comfortMessages = [
  '先别急，缓一下再说。',
  '你不是机器，卡一下很正常。',
  '功德 +1，焦虑先退半步。',
  '今天已经够难了，先对自己好一点。',
  '敲一下，不代表认输，代表续命。',
  '先活过这一阵，再谈别的。',
  '世界很吵，你先稳住自己。',
  '别硬扛，先给情绪一点台阶。',
  '这一声下去，算是给自己一个交代。',
  '没关系，今天允许你状态一般。'
];

const todayCountEl = document.getElementById('todayCount');
const totalCountEl = document.getElementById('totalCount');
const comfortTextEl = document.getElementById('comfortText');
const soundToggleEl = document.getElementById('soundToggle');
const resetTodayEl = document.getElementById('resetToday');
const muyuButtonEl = document.getElementById('muyuButton');
const floatLayerEl = document.getElementById('floatLayer');

let audioContext;
let state = loadState();
normalizeToday();
render();

muyuButtonEl.addEventListener('click', handleKnock);
soundToggleEl.addEventListener('click', toggleSound);
resetTodayEl.addEventListener('click', resetToday);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    normalizeToday();
    render();
  }
});

function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultState();
    }
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch (error) {
    console.warn('读取本地记录失败，使用默认状态。', error);
    return defaultState();
  }
}

function defaultState() {
  return {
    todayMerit: 0,
    totalMerit: 0,
    lastDate: getTodayString(),
    soundEnabled: true,
    comfortText: '给自己一点缓冲，也算积德。'
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeToday() {
  const today = getTodayString();
  if (state.lastDate !== today) {
    state.todayMerit = 0;
    state.lastDate = today;
    saveState();
  }
}

function render() {
  todayCountEl.textContent = state.todayMerit;
  totalCountEl.textContent = state.totalMerit;
  comfortTextEl.textContent = state.comfortText;
  soundToggleEl.textContent = `音效：${state.soundEnabled ? '开' : '关'}`;
}

function handleKnock(event) {
  normalizeToday();
  state.todayMerit += 1;
  state.totalMerit += 1;
  state.comfortText = pickRandomMessage();
  saveState();
  render();
  animateCount(todayCountEl);
  animateCount(totalCountEl);
  animateKnock();
  spawnFloatText(event);
  if (state.soundEnabled) {
    playWoodSound();
  }
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  saveState();
  render();
  if (state.soundEnabled) {
    playWoodSound(0.4);
  }
}

function resetToday() {
  const confirmed = window.confirm('只重置今日功德，累计功德会保留。确定吗？');
  if (!confirmed) return;
  state.todayMerit = 0;
  state.lastDate = getTodayString();
  state.comfortText = '今天重新开始，也算一种功德。';
  saveState();
  render();
  animateCount(todayCountEl);
}

function animateCount(element) {
  element.classList.remove('bump');
  window.requestAnimationFrame(() => {
    element.classList.add('bump');
    window.setTimeout(() => element.classList.remove('bump'), 180);
  });
}

function animateKnock() {
  muyuButtonEl.classList.remove('is-hitting');
  window.requestAnimationFrame(() => {
    muyuButtonEl.classList.add('is-hitting');
    window.setTimeout(() => muyuButtonEl.classList.remove('is-hitting'), 260);
  });
}

function spawnFloatText(event) {
  const rect = floatLayerEl.getBoundingClientRect();
  const text = document.createElement('span');
  text.className = 'float-text';
  text.textContent = '功德 +1';

  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  text.style.left = `${x}px`;
  text.style.top = `${y}px`;
  floatLayerEl.appendChild(text);

  window.setTimeout(() => {
    text.remove();
  }, 920);
}

function pickRandomMessage() {
  const next = comfortMessages[Math.floor(Math.random() * comfortMessages.length)];
  if (comfortMessages.length === 1 || next !== state.comfortText) {
    return next;
  }
  return comfortMessages[(comfortMessages.indexOf(next) + 1) % comfortMessages.length];
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

function playWoodSound(volumeScale = 1) {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.22 * volumeScale, now + 0.01);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  master.connect(ctx.destination);

  const tone1 = ctx.createOscillator();
  tone1.type = 'triangle';
  tone1.frequency.setValueAtTime(560, now);
  tone1.frequency.exponentialRampToValueAtTime(260, now + 0.18);

  const tone2 = ctx.createOscillator();
  tone2.type = 'sine';
  tone2.frequency.setValueAtTime(880, now);
  tone2.frequency.exponentialRampToValueAtTime(420, now + 0.12);

  const partialGain = ctx.createGain();
  partialGain.gain.setValueAtTime(0.18 * volumeScale, now);
  partialGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i += 1) {
    noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseData.length);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 1300;
  noiseFilter.Q.value = 0.7;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.12 * volumeScale, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

  tone1.connect(master);
  tone2.connect(partialGain);
  partialGain.connect(master);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);

  tone1.start(now);
  tone2.start(now);
  noise.start(now);

  tone1.stop(now + 0.42);
  tone2.stop(now + 0.22);
  noise.stop(now + 0.07);
}
