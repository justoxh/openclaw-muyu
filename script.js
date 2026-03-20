const APP_VERSION = 'v1.2.2';
const STORAGE_KEY = 'openclaw-muyu-v1';
const DAILY_GOAL = 18;
const AUDIO_FILES = [
  './assets/muyu-1.mp3',
  './assets/muyu-2.mp3',
  './assets/muyu-3.mp3',
  './assets/muyu-4.mp3'
];
const AUDIO_POOL_SIZE = 3;
const MAX_ACTIVE_AUDIO = 4;
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
let audioPools = [];
let audioReady = false;
let audioLoadFailed = false;
let audioUnlockBound = false;
let lastTouchEnd = 0;
let recentKnockTimes = [];
let state = loadState();
normalizeToday();
render();
prepareAudio();
bindAudioUnlock();

muyuButtonEl.addEventListener('click', handleKnock);
muyuButtonEl.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
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
    handleKnock(event);
  }
});

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

  const x = event.clientX ? event.clientX - rect.left : rect.width / 2;
  const y = event.clientY ? event.clientY - rect.top : rect.height / 2;

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

function preventDoubleTapZoom(event) {
  const now = Date.now();
  if (now - lastTouchEnd <= 320) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}

function bindAudioUnlock() {
  if (audioUnlockBound) return;
  audioUnlockBound = true;

  const unlock = () => {
    if (!state.soundEnabled) return;
    unlockAudioPlayback();
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('touchstart', unlock);
    document.removeEventListener('keydown', unlock);
  };

  document.addEventListener('pointerdown', unlock, { passive: true, once: true });
  document.addEventListener('touchstart', unlock, { passive: true, once: true });
  document.addEventListener('keydown', unlock, { passive: true, once: true });
}

function unlockAudioPlayback() {
  try {
    getAudioContext();
  } catch (error) {
    console.warn('AudioContext 初始化失败。', error);
  }

  for (const pool of audioPools) {
    for (const audio of pool.players) {
      audio.muted = true;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
          })
          .catch(() => {
            audio.muted = false;
          });
      } else {
        audio.muted = false;
      }
    }
  }
}

function prepareAudio() {
  audioPools = AUDIO_FILES.map((src) => ({
    src,
    players: Array.from({ length: AUDIO_POOL_SIZE }, () => {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.playsInline = true;
      audio.setAttribute('playsinline', '');
      audio.crossOrigin = 'anonymous';
      return audio;
    })
  }));

  if (!audioPools.length) {
    audioLoadFailed = true;
    return;
  }

  const uniquePlayers = audioPools.flatMap((pool) => pool.players.slice(0, 1));
  let settled = 0;
  let successCount = 0;
  const finish = () => {
    settled += 1;
    if (settled === uniquePlayers.length) {
      audioReady = successCount > 0;
      audioLoadFailed = successCount === 0;
    }
  };

  for (const audio of uniquePlayers) {
    audio.addEventListener('canplaythrough', () => {
      successCount += 1;
      finish();
    }, { once: true });

    audio.addEventListener('error', () => {
      finish();
    }, { once: true });

    audio.load();
  }
}

function playKnockSound(volumeScale = 1) {
  recordKnockTime();
  const dynamicVolume = volumeScale * getDynamicVolumeScale();

  if (audioReady && audioPools.length) {
    const pool = audioPools[Math.floor(Math.random() * audioPools.length)];
    const player = pickAudioPlayer(pool.players);
    if (player) {
      playAudioFile(player, dynamicVolume).catch((error) => {
        console.warn('音频文件播放失败，回退到合成音效。', error);
        playWoodSound(dynamicVolume);
      });
      return;
    }
  }

  playWoodSound(dynamicVolume);
}

function recordKnockTime() {
  const now = performance.now();
  recentKnockTimes.push(now);
  recentKnockTimes = recentKnockTimes.filter((time) => now - time <= RAPID_CLICK_WINDOW_MS);
}

function getDynamicVolumeScale() {
  const density = recentKnockTimes.length;
  if (density <= 1) return 1;
  if (density === 2) return 0.92;
  if (density === 3) return 0.84;
  if (density === 4) return 0.76;
  return 0.68;
}

function pickAudioPlayer(players) {
  const pausedPlayer = players.find((audio) => audio.paused || audio.ended);
  if (pausedPlayer) return pausedPlayer;

  const sortedActive = [...players].sort((a, b) => a.currentTime - b.currentTime);
  const totalActive = audioPools.flatMap((pool) => pool.players).filter((audio) => !audio.paused && !audio.ended).length;

  if (totalActive >= MAX_ACTIVE_AUDIO) {
    const oldest = sortedActive[0];
    oldest.pause();
    oldest.currentTime = 0;
    return oldest;
  }

  return sortedActive[0];
}

async function playAudioFile(audio, volumeScale = 1) {
  audio.pause();
  audio.currentTime = 0;
  const randomized = 0.72 + (Math.random() * 0.14 - 0.07);
  audio.volume = Math.min(0.92, Math.max(0.14, randomized * volumeScale));
  const playPromise = audio.play();
  if (playPromise && typeof playPromise.then === 'function') {
    await playPromise;
  }
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
