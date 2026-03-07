import { useState, useEffect } from 'react';
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBHl1Dw49IVli7P-BgPkGT_Z82NJuK_tLg",
  authDomain: "ton-fusion-lab.firebaseapp.com",
  databaseURL: "https://ton-fusion-lab-default-rtdb.firebaseio.com",
  projectId: "ton-fusion-lab",
  storageBucket: "ton-fusion-lab.firebasestorage.app",
  messagingSenderId: "759094438608",
  appId: "1:759094438608:web:05c7360fc503c80008ccd5"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
type Tab = 'title' | 'merge' | 'reactors' | 'donate' | 'profile';

interface Particle {
  id: string;
  level: number;
}

interface Reactor {
  particle: Particle | null;
  startTime: number | null;
  duration: number;
}

const FREE_SLOTS = 7;
const TOTAL_SLOTS = 20;
const SPAWN_INTERVAL_MS = 30 * 1000; // 30 секунд для теста
const REACTOR_DURATION_MS = 60 * 1000;

const FREE_REACTORS = 1;
const TOTAL_REACTORS = 3;
function App() {
  const [storage, setStorage] = useState<(Particle | null)[]>(() => {
  const saved = localStorage.getItem('ton_fusion_storage');
  return saved ? JSON.parse(saved) : Array(TOTAL_SLOTS).fill(null);
});

const [spawnSlots, setSpawnSlots] = useState<(Particle | null)[]>(() => {
  const saved = localStorage.getItem('ton_fusion_spawnSlots');
  return saved ? JSON.parse(saved) : [null, null];
});

const [tonBalance, setTonBalance] = useState<number>(() => {
  const saved = localStorage.getItem('ton_fusion_tonBalance');
  return saved ? Number(saved) : 0;
});

const [reactors, setReactors] = useState<Reactor[]>(() => {
  const saved = localStorage.getItem('ton_fusion_reactors');
  return saved ? JSON.parse(saved) : Array(TOTAL_REACTORS).fill({ particle: null, startTime: null, duration: 0 });
});

const [nextSpawnTime, setNextSpawnTime] = useState<number>(() => {
  const saved = localStorage.getItem('ton_fusion_nextSpawnTime');
  return saved ? Number(saved) : Date.now() + SPAWN_INTERVAL_MS;
});
useEffect(() => {
  localStorage.setItem('ton_fusion_storage', JSON.stringify(storage));
}, [storage]);

useEffect(() => {
  localStorage.setItem('ton_fusion_spawnSlots', JSON.stringify(spawnSlots));
}, [spawnSlots]);

useEffect(() => {
  localStorage.setItem('ton_fusion_tonBalance', tonBalance.toString());
}, [tonBalance]);

useEffect(() => {
  localStorage.setItem('ton_fusion_reactors', JSON.stringify(reactors));
}, [reactors]);

useEffect(() => {
  localStorage.setItem('ton_fusion_nextSpawnTime', nextSpawnTime.toString());
}, [nextSpawnTime]);
  const wallet = useTonWallet();

  const [activeTab, setActiveTab] = useState<Tab>('title');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showReactorModal, setShowReactorModal] = useState(false);
  const [selectedReactorIdx, setSelectedReactorIdx] = useState<number | null>(null);

  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = Math.max(0, nextSpawnTime - currentTime);
  const getColor = (level: number): string =>
    [
      '#4a90e2', '#50c878', '#f1c40f', '#e67e22', '#e74c3c',
      '#9b59b6', '#3498db', '#1abc9c', '#f39c12', '#ff4500',
    ][level - 1] || '#ffffff';

  const generateParticle = (): Particle => ({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    level: Math.random() < 0.7 ? 1 : Math.random() < 0.95 ? 2 : 3,
  });

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
  };

  const addTon = (amount: number) => {
    if (amount > 0) setTonBalance(prev => Number((prev + amount).toFixed(4)));
  };

  const getReward = (level: number): number => level * 0.0025;
  const collectToStorage = (spawnIdx: number) => {
    const particle = spawnSlots[spawnIdx];
    if (!particle) return;

    const emptyIdx = storage.findIndex((slot, i) => slot === null && i < FREE_SLOTS);
    if (emptyIdx === -1) {
      alert('Свободные слоты заполнены');
      return;
    }

    setStorage(prev => {
      const n = [...prev];
      n[emptyIdx] = { ...particle };
      return n;
    });

    setSpawnSlots(prev => {
      const n = [...prev];
      n[spawnIdx] = null;
      return n;
    });

    setSelectedIndex(null);
  };

  const handleCellClick = (idx: number, isSpawn: boolean) => {
    if (isSpawn) return collectToStorage(idx);
    if (idx >= FREE_SLOTS) return;

    if (selectedIndex === null) {
      if (storage[idx]) setSelectedIndex(idx);
      return;
    }

    const srcIdx = selectedIndex;
    const src = storage[srcIdx];
    if (!src) {
      setSelectedIndex(null);
      return;
    }

    const tgt = storage[idx];

    setStorage(prev => {
      const n = [...prev];
      if (tgt && tgt.level === src.level && src.level < 20) {
        n[idx] = { id: Date.now().toString(36) + Math.random().toString(36).slice(2), level: src.level + 1 };
        n[srcIdx] = null;
      } else if (!tgt) {
        n[idx] = { ...src };
        n[srcIdx] = null;
      }
      return n;
    });

    setSelectedIndex(null);
  };
  const openReactorInventory = (reactorIdx: number) => {
    setSelectedReactorIdx(reactorIdx);
    setShowReactorModal(true);
  };

  const insertIntoReactor = (storageIdx: number) => {
    const p = storage[storageIdx];
    if (!p || selectedReactorIdx === null) return;

    setReactors(prev => {
      const next = [...prev];
      if (next[selectedReactorIdx].particle) return next;
      next[selectedReactorIdx] = {
        particle: { ...p },
        startTime: Date.now(),
        duration: REACTOR_DURATION_MS,
      };
      return next;
    });

    setStorage(prev => {
      const n = [...prev];
      n[storageIdx] = null;
      return n;
    });

    setShowReactorModal(false);
    setSelectedReactorIdx(null);
  };

  // Спавн частиц
  useEffect(() => {
    const spawnMissedParticles = () => {
      const now = Date.now();
      if (nextSpawnTime > now) return;

      const missedIntervals = Math.floor((now - nextSpawnTime) / SPAWN_INTERVAL_MS) + 1;

      setSpawnSlots(prev => {
        let slots = [...prev];
        for (let i = 0; i < missedIntervals; i++) {
          const freeIndex = slots.findIndex(s => s === null);
          if (freeIndex !== -1) {
            slots[freeIndex] = generateParticle();
          }
        }
        return slots;
      });

      setNextSpawnTime(now + SPAWN_INTERVAL_MS);
    };

    spawnMissedParticles();
    const id = setInterval(spawnMissedParticles, 5000);
    return () => clearInterval(id);
  }, [nextSpawnTime]);
  // Проверка реакторов
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setReactors(prev => {
        const next = [...prev];
        next.forEach((r, i) => {
          if (!r.particle || !r.startTime) return;
          const end = r.startTime + r.duration;
          if (now >= end) {
            const reward = getReward(r.particle.level);
            addTon(reward);
            alert(`Реактор ${i + 1} завершён → +${reward.toFixed(4)} TON`);
            next[i] = { particle: null, startTime: null, duration: 0 };
          }
        });
        return next;
      });
    }, 15000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!wallet?.account?.address) return;

    const playerId = wallet.account.address.replace(/[^a-zA-Z0-9]/g, '_');
    const playerRef = ref(db, `players/${playerId}`);

    const unsubscribe = onValue(playerRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // setStorage(data.storage ?? Array(TOTAL_SLOTS).fill(null));
        // setSpawnSlots(data.spawnSlots ?? [null, null]);
        // setTonBalance(data.tonBalance ?? 0);
        // setReactors(data.reactors ?? Array(TOTAL_REACTORS).fill({ particle: null, startTime: null, duration: 0 }));
        // setNextSpawnTime(data.nextSpawnTime ?? Date.now() + SPAWN_INTERVAL_MS);
        // setSelectedIndex(data.selectedIndex ?? null);
      }
    });

    const saveInterval = setInterval(async () => {
      try {
        await set(playerRef, {
          storage,
          spawnSlots,
          tonBalance,
          reactors,
          nextSpawnTime,
          selectedIndex,
          lastSave: Date.now(),
        });
      } catch (err: any) {
        console.error("Firebase save error:", err.code, err.message);
      }
    }, 8000);

    return () => {
      unsubscribe();
      clearInterval(saveInterval);
    };
  }, [wallet?.account?.address]);
  const cardStyle = {
    background: 'rgba(15,20,45,0.65)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0e1f, #0f132e 50%, #0a0e1f)',
        color: '#e0e0ff',
        fontFamily: 'system-ui, sans-serif',
        paddingBottom: '100px',
      }}
    >
      <main style={{ padding: '20px', position: 'relative', zIndex: 1 }}>
        <div style={{ ...cardStyle, textAlign: 'center', padding: '16px' }}>
          <h1 style={{ margin: 0, fontSize: '26px' }}>TON Fusion Lab</h1>
        </div>

        {activeTab === 'title' && (
          <div style={{ ...cardStyle, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '120px', fontWeight: 'bold', background: 'linear-gradient(45deg, #40e0ff, #ff40c0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            TON
          </div>
        )}
        {activeTab === 'merge' && (
          <div style={cardStyle}>
            <h2>🧊 Сбор</h2>

            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ color: '#88ccff', marginBottom: 4, fontSize: 15 }}>
                Следующая частица через
              </div>
              <div
                style={{
                  fontSize: 48,
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  color: remainingMs / 1000 <= 60 ? '#ff4444' : '#40e0ff',
                }}
              >
                {formatTime(remainingMs)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 24 }}>
              {spawnSlots.map((p, i) => (
                <div
                  key={i}
                  onClick={() => handleCellClick(i, true)}
                  style={{
                    width: 88,
                    height: 88,
                    background: p ? getColor(p.level) : 'rgba(0,120,220,0.12)',
                    border: '2px dashed #4080ff44',
                    borderRadius: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32,
                    fontWeight: 'bold',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  {p ? p.level :` Слот ${i + 1}`}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, maxWidth: 420, margin: '0 auto' }}>
              {storage.map((p, i) => {
                const locked = i >= FREE_SLOTS;
                if (locked) {
                  return (
                    <div
                      key={i}
                      style={{
                        aspectRatio: 1,
                        background: 'rgba(20,25,50,0.7)',
                        border: '1px solid #6080c044',
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 40,
                        color: '#a0c0ff66',
                        cursor: 'not-allowed',
                      }}
                    >
                      🔒
                    </div>
                  );
                }
                return (
                  <div
                    key={i}
                    onClick={() => handleCellClick(i, false)}
                    style={{
                      aspectRatio: 1,
                      background: p ? getColor(p.level) : 'rgba(30,40,80,0.4)',
                      border: '1px solid #80a0ff33',
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 26,
                      fontWeight: 'bold',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    {p ? p.level : ''}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 20, textAlign: 'center', color: '#aaccff', fontSize: 14 }}>
              Свободно: {FREE_SLOTS} / Заблокировано: {TOTAL_SLOTS - FREE_SLOTS}
            </div>
          </div>
        )}
        {activeTab === 'reactors' && (
          <div style={cardStyle}>
            <h2>⚛️ Реакторы</h2>

            {reactors.map((r, i) => {
              const remMs = r.startTime ? Math.max(0, r.startTime + r.duration - currentTime) : 0;
              const isEmpty = !r.particle;
              const isActive = !!r.particle && remMs > 0;
              const locked = i >= FREE_REACTORS;

              if (locked) {
                return (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(20,25,50,0.7)',
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 12,
                      textAlign: 'center',
                      border: '1px solid #6080c044',
                      color: '#a0c0ff66',
                    }}
                  >
                    Реактор {i + 1}
                    <div style={{ marginTop: 8, fontSize: 40 }}>🔒</div>
                    <small>Разблокировать в Донате</small>
                  </div>
                );
              }

              return (
                <div
                  key={i}
                  onClick={() => isEmpty && openReactorInventory(i)}
                  style={{
                    background: 'rgba(25,35,70,0.55)',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    textAlign: 'center',
                    border: '1px solid rgba(0,140,255,0.25)',
                    cursor: isEmpty ? 'pointer' : 'default'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Реактор {i + 1}</div>

                  {isEmpty ? (
                    <div style={{ color: '#88aaff', marginTop: 8 }}>Пусто</div>
                  ) : isActive ? (
                    <div style={{ marginTop: 8, color: '#aaffff' }}>
                      Уровень: {r.particle!.level}
                      <br />
                      Осталось: {formatTime(remMs)}
                    </div>
                  ) : (
                    <div style={{ color: '#88ffaa', marginTop: 8 }}>Завершено — награда начислена</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {showReactorModal && (
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(15,20,45,0.9)',
            borderRadius: '12px',
            padding: '20px',
            zIndex: 200,
            maxWidth: 420,
            textAlign: 'center',
          }}>
            <h2>Выберите частицу</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, margin: '20px 0' }}>
              {storage.map((p, i) => p ? (
                <div
                  key={i}
                  onClick={() => insertIntoReactor(i)}
                  style={{
                    aspectRatio: 1,
                    background: getColor(p.level),
                    border: '1px solid #80a0ff33',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 26,
                    fontWeight: 'bold',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  {p.level}
                </div>
              ) : null)}
            </div>

            <button
              onClick={() => setShowReactorModal(false)}
              style={{ padding: '8px 16px', background: '#ff4444', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer' }}
            >
              Закрыть
            </button>
          </div>
        )}
        {activeTab === 'donate' && (
          <div style={cardStyle}>
            <h2>💎 Донат</h2>
            <p>От 2 TON</p>
            <ul style={{ paddingLeft: 24, lineHeight: 1.8 }}>
              <li>+16 слотов хранилища — 1.5 TON</li>
              <li>+2 реактора — 2 TON</li>
              <li>Буст редкости — 0.5 TON / 7 дней</li>
            </ul>
          </div>
        )}

        {activeTab === 'profile' && (
          <div style={cardStyle}>
            <h2>👤 Профиль</h2>
            <div style={{ textAlign: 'center', margin: '16px 0' }}>
              <div style={{ fontSize: 18, color: '#a0d0ff' }}>Баланс</div>
              <div style={{ fontSize: 36, fontWeight: 'bold', color: tonBalance > 0 ? '#40e0ff' : '#ffaaaa' }}>
                {tonBalance.toFixed(3)} TON
              </div>
            </div>
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <TonConnectButton />
            </div>
            {wallet?.account?.address && (
              <div style={{ fontSize: 14, wordBreak: 'break-all', textAlign: 'center', opacity: 0.9 }}>
                {wallet.account.address.slice(0, 8)}...{wallet.account.address.slice(-6)}
              </div>
            )}
          </div>
        )}
      </main>

      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 90,
          background: 'rgba(8,10,25,0.96)',
          borderTop: '1px solid rgba(0,140,255,0.35)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 100,
          padding: '0 10px',
        }}
      >
        {['title', 'merge', 'reactors', 'donate', 'profile'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as Tab)}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === tab ? '#40c0ff' : '#a0c0ff',
              fontSize: 14,
              padding: '12px 16px',
              minWidth: 70,
              cursor: 'pointer',
            }}
          >
            {tab === 'title' ? 'TON' :
             tab === 'merge' ? 'Сбор' :
             tab === 'reactors' ? 'Реакт.' :
             tab === 'donate' ? 'Донат' : 'Профиль'}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;