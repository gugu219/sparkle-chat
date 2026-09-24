// Small versions of the original procedural alert motifs for chat-only overlays.
(() => {
let context;

function playChatAlertSound(kind) {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) return false;
  try {
    context ||= new AudioContextClass();
    if (context.state === 'suspended') void context.resume();
    const start = context.currentTime;
    const note = (frequency, delay, duration = .13, volume = .08, type = 'triangle') => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start + delay);
      gain.gain.setValueAtTime(0, start + delay);
      gain.gain.linearRampToValueAtTime(volume, start + delay + .008);
      gain.gain.exponentialRampToValueAtTime(.001, start + delay + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start + delay);
      oscillator.stop(start + delay + duration + .02);
    };
    if (kind === 'cheer') {
      // The original Bits sound is a bright two-coin chime.
      for (const delay of [0, .09]) {
        note(2490, delay, .07, .045);
        note(3140, delay + .022, .11, .055);
        note(4180, delay + .036, .09, .026, 'sine');
      }
    } else if (kind === 'gift') {
      [784, 1046, 1318, 1568].forEach((frequency, i) => note(frequency, i * .07, .14, .075));
    } else if (kind === 'sub') {
      [523, 659, 784, 1046].forEach((frequency, i) => note(frequency, i * .065, .13, .07));
    } else return false;
    return true;
  } catch (error) {
    console.warn('[sparklechat] alert sound could not start', error);
    return false;
  }
}
window.playChatAlertSound = playChatAlertSound;
})();
