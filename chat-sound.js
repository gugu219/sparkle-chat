// Built-in alert motifs, with the same envelope and gain as alert.js.
(() => {
let context;

function playChatAlertSound(kind, magnitude = 1) {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) return false;
  try {
    context ||= new AudioContextClass();
    if (context.state === 'suspended') void context.resume();
    const start = context.currentTime;
    const note = (frequency, delay, duration = .13, volume = .08, type = 'square') => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start + delay);
      gain.gain.setValueAtTime(0, start + delay);
      // alert.js: note gain .5 × master .6 × event 80% × overall 70%.
      gain.gain.linearRampToValueAtTime(volume * .168, start + delay + .008);
      gain.gain.exponentialRampToValueAtTime(.001, start + delay + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start + delay);
      oscillator.stop(start + delay + duration + .05);
    };
    const chord = (frequencies, delay, duration, volume, type) => frequencies.forEach(f => note(f, delay, duration, volume, type));
    const N = {C5:523,E5:659,G5:784,B5:988,C6:1046,D6:1175,E6:1318,F6:1397,G6:1568,A6:1760,C7:2093,E7:2637};
    if (kind === 'cheer') {
      const level = magnitude >= 10000 ? 5 : magnitude >= 5000 ? 4 : magnitude >= 1000 ? 3 : magnitude >= 100 ? 2 : 1;
      const count = [1,2,4,6,9][level-1];
      const coin = (delay, volume) => {
        note(2490,delay,.07,volume*.5,'triangle');note(3140,delay+.022,.11,volume*.6,'triangle');
        note(4180,delay+.036,.09,volume*.32,'sine');note(6280,delay+.05,.05,volume*.14,'sine');
      };
      for(let i=0;i<count;i++)coin(i*.09,.78-i*.03);
      const end=count*.09;
      if(level>=3){coin(end+.04,.9);coin(end+.17,1);}
      if(level>=4)chord([N.C6,N.E6,N.G6],end+.34,.3,.26,'triangle');
      if(level>=5)[N.G6,N.C7,N.E7].forEach((f,i)=>note(f,end+.48+i*.08,.12,.24,'triangle'));
    } else if (kind === 'gift') {
      const level=magnitude>=50?5:magnitude>=20?4:magnitude>=10?3:magnitude>=5?2:1;
      [N.G5,N.C6,N.E6,N.G6].forEach((f,i)=>note(f,i*.075,.09,.68));
      [N.C7,N.E7].forEach((f,i)=>note(f,.34+i*.09,.1,.4,'triangle'));
      if(level>=2)[N.G6,N.C7,N.E7,N.C7].forEach((f,i)=>note(f,.55+i*.07,.075,.5));
      if(level>=3)[N.E7,N.C7,N.G6].forEach((f,i)=>note(f,.9+i*.065,.07,.42));
      if(level>=4)[N.C7,N.E7,N.C7,N.E7].forEach((f,i)=>note(f,1.15+i*.06,.065,.36));
      if(level>=5)note(N.E7,1.46,.22,.5,'triangle');
    } else if (kind === 'sub') {
      const level=magnitude>=24?5:magnitude>=12?4:magnitude>=6?3:magnitude>=3?2:1;
      [N.C5,N.E5,N.G5,N.C6].forEach((f,i)=>note(f,i*.065,.13,.6));
      chord([N.C5,N.E5,N.G5],.28,.3,.55);
      if(level>=2)chord([N.C6,N.E6,N.G6],.28,.3,.28,'triangle');
      if(level>=3)[N.E6,N.G6,N.C7].forEach((f,i)=>note(f,.46+i*.07,.1,.3,'triangle'));
      if(level>=4)chord([N.G5,N.B5,N.D6,N.G6],.6,.4,.5);
      if(level>=5)chord([N.C6,N.E6,N.G6,N.C7],.86,.6,.55);
    } else return false;
    return true;
  } catch (error) {
    console.warn('[sparklechat] alert sound could not start', error);
    return false;
  }
}
window.playChatAlertSound = playChatAlertSound;
})();
