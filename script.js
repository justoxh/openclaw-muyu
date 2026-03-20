const APP_VERSION = 'v1.2.3';
const STORAGE_KEY = 'openclaw-muyu-v1';
const DAILY_GOAL = 18;
const AUDIO_FILES = [
  './assets/muyu-1.mp3',
  './assets/muyu-2.mp3',
  './assets/muyu-3.mp3',
  './assets/muyu-4.mp3'
];
const MAX_ACTIVE_SOURCES = 4;
const RAPID_CLICK_WINDOW_MS = 900;

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
  '没关系，今天允许你状态一般。',
  '别把自己逼太紧，今天先活着。',
  '你现在需要的，可能不是答案，是缓冲。'
];

const statusLevels = [
  { min: 0, badge: '平心静气', text: '刚刚开始，也算开始。' },
  { min: 5, badge: '稳住一点', text: '已经敲了几下，脑子没刚才那么吵了。' },
  { min: 12, badge: '功德上涨', text: '手感开始顺了，情绪也没那么扎手。' },
  { min: 18, badge: '今日达标', text: '今天的基础功德够了，先夸你一句。' },
  { min: 36, badge: '木鱼熟客', text: '你已经进入熟练积德状态，继续保持。' },
  { min: 72, badge: '电子禅修', text: '敲到这个数，至少说明你还没彻底放弃今天。' }
];

const todayCountEl = document.getElementById('todayCount');
const totalCountEl = document.getElementById('totalCount');
const comfortTextEl = document.getElementById('comfortText');
const soundToggleEl = document.getElementById('soundToggle');
const resetTodayEl = document.getElementById('resetToday');
const shareCopyEl = document.getElementById('shareCopy');
const muyuButtonEl = document.getElementById('muyuButton');
const floatLayerEl = document.getElementById('floatLayer');
const progressBarEl = document.getElementById('progressBar');
const goalTextEl = document.getElementById('goalText');
const todayDateEl = document.getElementById('todayDate');
const streakTextEl = document.getElementById('streakText');
const statusBadgeEl = document.getElementById('statusBadge');
const versionTextEl = document.getElementById('versionText');

let audioContext;
let audioBuffers = [];
let audioReady = false;
let audioLoadFailed = false;
let unlockTried = false;
let interactionLock = false;
let lastTouchEnd = 0;
let recentKnockTimes = [];
let activeSources = [];
let state = loadState();
normalizeToday();
render();
prepareAudio();
setupInteractionHandlers();

soundToggleEl.addEventListener('click', toggleSound);
shareCopyEl.addEventListener('click', copySummary);
resetTodayEl.addEventListener('click', resetToday);

for (const button of document.querySelectorAll('button')) {
  button.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    normalizeToday();
    render();
  }
});

document.addEventListener('keydown', (event) => {
  const tagName = document.activeElement?.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA') return;
  if (event.code === 'Space' || event.code === 'Enter') {
    event.preventDefault();
    triggerKnock(event);
  }
});

function setupInteractionHandlers() {
  muyuButtonEl.addEventListener('click', (event) => {
    event.preventDefault();
  });

  muyuButtonEl.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.pointerType === 'touch') {
      event.preventDefault();
    }
    triggerKnock(event);
  });

  muyuButtonEl.addEventListener('touchstart', (event) => {
    event.preventDefault();
    triggerKnock(event.touches[0] || event.changedTouches[0] || event);
  }, { passive: false });

  muyuButtonEl.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
}

function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTodayLabel() {
  const now = new Date();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${now.getMonth() + 1} 月 ${now.getDate()} 日 · ${weekdays[now.getDay()]}`;
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
    state.comfortText = '新的一天，重新积德。';
    saveState();
  }
}

function render() {
  todayCountEl.textContent = state.todayMerit;
  totalCountEl.textContent = state.totalMerit;
  comfortTextEl.textContent = state.comfortText;
  soundToggleEl.textContent = `音效：${state.soundEnabled ? '开' : '关'}`;
  todayDateEl.textContent = formatTodayLabel();
  versionTextEl.textContent = APP_VERSION;
  renderGoal();
  renderStatus();
}

function renderGoal() {
  const progress = Math.min(state.todayMerit / DAILY_GOAL, 1);
  progressBarEl.style.width = `${progress * 100}%`;
  if (state.todayMerit >= DAILY_GOAL) {
    goalTextEl.textContent = `今日 ${DAILY_GOAL} 下已达标，可以收手，也可以继续积。`;
    return;
  }
  const remain = DAILY_GOAL - state.todayMerit;
  goalTextEl.textContent = `再敲 ${remain} 下，给今天一点交代`;
}

function renderStatus() {
  const level = [...statusLevels].reverse().find((item) => state.todayMerit >= item.min) || statusLevels[0];
  streakTextEl.textContent = level.text;
  statusBadgeEl.textContent = level.badge;
}

function triggerKnock(event) {
  if (interactionLock) return;
  interactionLock = true;
  window.setTimeout(() => {
    interactionLock = false;
  }, 18);
  handleKnock(event);
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
    playKnockSound();
  }
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  saveState();
  render();
  if (state.soundEnabled) {
    playKnockSound(0.38);
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

async function copySummary() {
  const text = `我今天在赛博木鱼里已经敲了 ${state.todayMerit} 下，累计功德 ${state.totalMerit}。世界很吵，但我先稳住了。`;
  try {
    await navigator.clipboard.writeText(text);
    state.comfortText = '今日战绩已经复制好了，发不发随你。';
  } catch (error) {
    state.comfortText = '复制没成功。浏览器不配合，你就手动炫耀吧。';
  }
  saveState();
  render();
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
  const variants = ['功德 +1', '先稳住', '缓一缓', '别上头'];
  text.textContent = variants[Math.floor(Math.random() * variants.length)];

  const point = getEventPoint(event);
  const x = point.x - rect.left;
  const y = point.y - rect.top;

  text.style.left = `${x}px`;
  text.style.top = `${y}px`;
  floatLayerEl.appendChild(text);

  window.setTimeout(() => {
    text.remove();
  }, 920);
}

function getEventPoint(event) {
  if (event?.touches?.[0]) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  if (event?.changedTouches?.[0]) {
    return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
  }
  return {
    x: event?.clientX ?? floatLayerEl.getBoundingClientRect().width / 2,
    y: event?.clientY ?? floatLayerEl.getBoundingClientRect().height / 2
  };
}

function pickRandomMessage() {
  const next = comfortMessages[Math.floor(Math.random() * comfortMessages.length)];
  if (comfortMessages.length === 1 || next !== state.comfortText) {
    return next;
  }
  return comfortMessages[(comfortMessages.indexOf(next) + 1) % comfortMessages.length];
}

function preventDoubleTapZoom(event) {
  const now = Date.now();
  if (now - lastTouchEnd <= 320) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

async function prepareAudio() {
  try {
    const ctx = ensureAudioContext();
    const decoded = await Promise.all(
      AUDIO_FILES.map(async (src) => {
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error(`音频加载失败: ${src}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return await decodeAudioBuffer(ctx, arrayBuffer);
      })
    );
    audioBuffers = decoded;
    audioReady = decoded.length > 0;
    audioLoadFailed = !audioReady;
  } catch (error) {
    console.warn('真实音频预解码失败，回退到合成音效。', error);
    audioBuffers = [];
    audioReady = false;
    audioLoadFailed = true;
  }
}

function decodeAudioBuffer(ctx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    ctx.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
  });
}

function playKnockSound(volumeScale = 1) {
  recordKnockTime();
  const dynamicVolume = volumeScale * getDynamicVolumeScale();
  if (!unlockTried) {
    unlockTried = true;
    ensureAudioContext();
  }

  if (audioReady && audioBuffers.length) {
    try {
      playAudioBuffer(dynamicVolume);
      return;
    } catch (error) {
      console.warn('真实音频播放失败，回退到合成音效。', error);
    }
  }
  playWoodSound(dynamicVolume);
}

function playAudioBuffer(volumeScale = 1) {
  const ctx = ensureAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  if (activeSources.length >= MAX_ACTIVE_SOURCES) {
    const oldest = activeSources.shift();
    try {
      oldest.source.stop();
    } catch {}
  }

  const buffer = audioBuffers[Math.floor(Math.random() * audioBuffers.length)];
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gainNode = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 10;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.12;

  const randomized = 0.72 + (Math.random() * 0.12 - 0.06);
  gainNode.gain.value = Math.min(0.88, Math.max(0.12, randomized * volumeScale));

  source.connect(gainNode);
  gainNode.connect(compressor);
  compressor.connect(ctx.destination);

  const item = { source, startedAt: performance.now() };
  activeSources.push(item);
  source.onended = () => {
    activeSources = activeSources.filter((entry) => entry !== item);
  };

  source.start(0);
}

function recordKnockTime() {
  const now = performance.now();
  recentKnockTimes.push(now);
  recentKnockTimes = recentKnockTimes.filter((time) => now - time <= RAPID_CLICK_WINDOW_MS);
}

function getDynamicVolumeScale() {
  const density = recentKnockTimes.length;
  if (density <= 1) return 1;
  if (density === 2) return 0.9;
  if (density === 3) return 0.8;
  if (density === 4) return 0.72;
  return 0.64;
}

function playWoodSound(volumeScale = 1) {
  const ctx = ensureAudioContext();
  const now = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.24 * volumeScale, now + 0.008);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
  master.connect(ctx.destination);

  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(480, now);
  body.frequency.exponentialRampToValueAtTime(215, now + 0.18);

  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.19 * volumeScale, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

  const resonance = ctx.createOscillator();
  resonance.type = 'sine';
  resonance.frequency.setValueAtTime(760, now + 0.01);
  resonance.frequency.exponentialRampToValueAtTime(360, now + 0.22);

  const resonanceGain = ctx.createGain();
  resonanceGain.gain.setValueAtTime(0.0001, now);
  resonanceGain.gain.exponentialRampToValueAtTime(0.1 * volumeScale, now + 0.015);
  resonanceGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

  const tail = ctx.createOscillator();
  tail.type = 'sine';
  tail.frequency.setValueAtTime(235, now + 0.02);
  tail.frequency.exponentialRampToValueAtTime(180, now + 0.36);

  const tailGain = ctx.createGain();
  tailGain.gain.setValueAtTime(0.0001, now + 0.02);
  tailGain.gain.exponentialRampToValueAtTime(0.05 * volumeScale, now + 0.04);
  tailGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.44);

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i += 1) {
    noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseData.length);
  }

  const strike = ctx.createBufferSource();
  strike.buffer = noiseBuffer;

  const strikeFilter = ctx.createBiquadFilter();
  strikeFilter.type = 'bandpass';
  strikeFilter.frequency.value = 1800;
  strikeFilter.Q.value = 1.1;

  const strikeGain = ctx.createGain();
  strikeGain.gain.setValueAtTime(0.16 * volumeScale, now);
  strikeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 14;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.14;

  body.connect(bodyGain);
  bodyGain.connect(compressor);
  resonance.connect(resonanceGain);
  resonanceGain.connect(compressor);
  tail.connect(tailGain);
  tailGain.connect(compressor);
  strike.connect(strikeFilter);
  strikeFilter.connect(strikeGain);
  strikeGain.connect(compressor);
  compressor.connect(master);

  body.start(now);
  resonance.start(now);
  tail.start(now);
  strike.start(now);

  body.stop(now + 0.28);
  resonance.stop(now + 0.32);
  tail.stop(now + 0.46);
  strike.stop(now + 0.05);
}
