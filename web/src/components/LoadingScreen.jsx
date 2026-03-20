import { useState, useEffect } from 'react';

const DEFAULT_EMOJIS = ['🍽️','🎬','📚','🎮','🎨','🎵','🏆','🎲','🥂','🎉','🍿','🎭'];
const SWAP_INTERVAL = 700;
const ANIM_DURATION = 150;

export default function LoadingScreen({ message = 'Loading...', emojis = DEFAULT_EMOJIS }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState('idle'); // 'idle' | 'out' | 'in'

  useEffect(() => {
    const id = setInterval(() => {
      setPhase('out');
      setTimeout(() => {
        setIndex(i => (i + 1) % emojis.length);
        setPhase('in');
      }, ANIM_DURATION);
    }, SWAP_INTERVAL);
    return () => clearInterval(id);
  }, [emojis]);

  const emojiStyle = {
    fontSize: 36,
    position: 'absolute',
    top: '50%', left: '50%',
    transform: phase === 'out'
      ? 'translate(-50%, -50%) rotateY(90deg) scale(0.4)'
      : 'translate(-50%, -50%) rotateY(0deg) scale(1)',
    opacity: phase === 'out' ? 0 : 1,
    transition: `transform ${ANIM_DURATION}ms ease-in-out, opacity ${ANIM_DURATION}ms ease-in-out`,
  };

  return (
    <div style={styles.container}>
      <div style={styles.spinnerWrap}>
        <svg style={styles.ringBack} viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="36" fill="none" stroke="#fecdd3" strokeWidth="5"/>
        </svg>
        <svg style={styles.ringSpin} viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="36" fill="none" stroke="#f43f5e" strokeWidth="5"
            strokeDasharray="80 146" strokeLinecap="round"/>
        </svg>
        <div style={emojiStyle}>{emojis[index]}</div>
      </div>

      <div style={styles.label}>
        {message}
        <span style={styles.dotWrap}>
          {[0, 0.2, 0.4].map((delay, i) => (
            <span key={i} style={{ ...styles.dot, animationDelay: `${delay}s` }}/>
          ))}
        </span>
      </div>

      <div style={styles.logo}>clubPal</div>

      <style>{`
        @keyframes cp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes cp-dot { 0%,80%,100% { opacity:0.3; transform:scale(0.8); } 40% { opacity:1; transform:scale(1); } }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed', inset: 0, zIndex: 9999,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(160deg, #fff1f2 0%, #ffe4e6 100%)',
  },
  spinnerWrap: { position: 'relative', width: 90, height: 90, marginBottom: 20 },
  ringBack: { position: 'absolute', top: 0, left: 0, width: 90, height: 90 },
  ringSpin: {
    position: 'absolute', top: 0, left: 0, width: 90, height: 90,
    animation: 'cp-spin 1.4s linear infinite',
  },
  label: {
    fontSize: 14, fontWeight: 600, color: '#f43f5e',
    display: 'flex', alignItems: 'center', gap: 4,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  dotWrap: { display: 'inline-flex', gap: 3, marginLeft: 2 },
  dot: {
    display: 'inline-block', width: 4, height: 4, borderRadius: '50%',
    background: '#f43f5e', animation: 'cp-dot 1.2s ease-in-out infinite',
  },
  logo: {
    position: 'absolute', bottom: 32,
    fontSize: 14, fontWeight: 700, color: '#f43f5e', letterSpacing: '-0.02em',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
};
