import { useState, useEffect } from 'react';
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";


// Замени на свой реальный конфиг из Firebase
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

type Tab = 'instruction' | 'merge' | 'reactors' | 'donate' | 'profile';

interface Particle {
  id: string;
  level: number;
}

interface Reactor {
  particle: Particle | null;
  startTime: number | null;
  duration: number;
}

function App() {
  // ─── Константы ────────────────────────────────────────────────
  const FREE_SLOTS = 7;
  const TOTAL_SLOTS = 20;
  const SPAWN_INTERVAL_MS = 10 * 60 * 1000; // 10 минут
  const HOLD_DELETE_MS = 1500;
  const REACTOR_MIN_MS = 18 * 3600 * 1000;
  const REACTOR_MAX_MS = 24 * 3600 * 1000;
  const FREE_REACTORS = 1;
  const TOTAL_REACTORS = 3;

  // ─── Состояния ────────────────────────────────────────────────
  const wallet = useTonWallet();

  const [activeTab, setActiveTab] = useState<Tab>('instruction');
  const [storage, setStorage] = useState<(Particle | null)[]>(Array(TOTAL_SLOTS).fill(null));
  const [spawnSlots, setSpawnSlots] = useState<(Particle | null)[]>([null, null]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [tonBalance, setTonBalance] = useState(0.000);

  const [nextSpawnTime, setNextSpawnTime] = useState<number>(Date.now() + SPAWN_INTERVAL_MS);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // long-press
  const [holdTimer, setHoldTimer] = useState<NodeJS.Timeout | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [holdTargetIndex, setHoldTargetIndex] = useState<number | null>(null);

  // реакторы
  const [reactors, setReactors] = useState<Reactor[]>(
    Array(TOTAL_REACTORS).fill({ particle: null, startTime: null, duration: 0 })
  );
  // ─── Вспомогательные функции ──────────────────────────────────
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
    if (amount > 0) setTonBalance(prev => Number((prev + amount).toFixed(3)));
  };

  // spendTon пока не используется — комментируем или удаляем, чтобы убрать TS6133
// Если позже понадобится — раскомментируй и вызови где-то
/*
const spendTon = (amount: number): boolean => {
  if (amount <= 0) return true;
  if (tonBalance < amount) {
    alert('Недостаточно TON\nНужно: ' + amount.toFixed(3) + ', есть: ' + tonBalance.toFixed(3));
    return false;
  }
  setTonBalance(prev => Number((prev - amount).toFixed(3)));
  return true;
};
*/
// ─── Логика игры ──────────────────────────────────────────────
  const collectToStorage = (spawnIdx: number) => {
    const particle = spawnSlots[spawnIdx];
    if (!particle) return;

    const emptyIdx = storage.findIndex((slot, i) => slot === null && i < FREE_SLOTS);
    if (emptyIdx === -1) {
      alert('Бесплатные ячейки заполнены');
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
      if (tgt && tgt.level === src.level && src.level < 10) {
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

  const startHoldDelete = (idx: number) => {
    if (holdTimer) clearTimeout(holdTimer);
    setHoldProgress(0);
    setHoldTargetIndex(idx);

    const interval = setInterval(() => {
      setHoldProgress(p => Math.min(p + 100 / (HOLD_DELETE_MS / 100), 100));
    }, 100);

    const timer = setTimeout(() => {
      clearInterval(interval);
      setStorage(prev => {
        const n = [...prev];
        n[idx] = null;
        return n;
      });
      setHoldTargetIndex(null);
      setHoldProgress(0);
    }, HOLD_DELETE_MS);

    setHoldTimer(timer);
  };

  const cancelHoldDelete = () => {
    if (holdTimer) clearTimeout(holdTimer);
    setHoldTargetIndex(null);
    setHoldProgress(0);
  };

  const placeInReactor = (reactorIdx: number, storageIdx: number) => {
    const p = storage[storageIdx];
    if (!p || p.level < 6) {
      alert('Нужна частица');
      return;
    }

    setReactors(prev => {
      const next = [...prev];
      if (next[reactorIdx].particle) return next;
      next[reactorIdx] = {
        particle: { ...p },
        startTime: Date.now(),
        duration: Math.floor(Math.random() * (REACTOR_MAX_MS - REACTOR_MIN_MS + 1)) + REACTOR_MIN_MS,
      };
      return next;
    });

    setStorage(prev => {
      const n = [...prev];
      n[storageIdx] = null;
      return n;
    });

    setSelectedIndex(null);
  };
  // ─── Эффекты ──────────────────────────────────────────────────

  // Плавное обновление времени каждую секунду
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Логика спавна частиц
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      if (nextSpawnTime <= now) {
        setSpawnSlots(prev => {
          const slots = [...prev];
          const free = slots.findIndex(s => s === null);
          if (free !== -1) {
            slots[free] = generateParticle();
          }
          return slots;
        });
        setNextSpawnTime(now + SPAWN_INTERVAL_MS);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
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
            const reward = r.particle.level * 0.12;
            addTon(reward);
            alert(`Реактор ${i + 1} завершён → +${reward.toFixed(3)} TON`);
            next[i] = { particle: null, startTime: null, duration: 0 };
          }
        });
        return next;
      });
    }, 15000);
    return () => clearInterval(id);
  }, []);

  // Синхронизация с Firebase по адресу кошелька
  useEffect(() => {
    if (!wallet?.account?.address) return;

    const playerId = wallet.account.address.replace(/[^a-zA-Z0-9]/g, '_'); // безопасный ключ для Firebase
    const playerRef = ref(db, `players/${playerId}`);

    // Загрузка данных из облака
    const unsubscribe = onValue(playerRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStorage(data.storage || Array(TOTAL_SLOTS).fill(null));
        setSpawnSlots(data.spawnSlots || [null, null]);
        setTonBalance(data.tonBalance || 0);
        setReactors(data.reactors || Array(TOTAL_REACTORS).fill({ particle: null, startTime: null, duration: 0 }));
        setNextSpawnTime(data.nextSpawnTime || Date.now() + SPAWN_INTERVAL_MS);
        setSelectedIndex(data.selectedIndex || null);
      } else {
        // Если данных нет — дефолт
        setNextSpawnTime(Date.now() + SPAWN_INTERVAL_MS);
      }
    });

    // Сохранение изменений (каждые 5 сек)
    const saveInterval = setInterval(() => {
      set(playerRef, {
        storage,
        spawnSlots,
        tonBalance,
        reactors,
        nextSpawnTime,
        selectedIndex,
        lastSave: Date.now(),
      }).catch(err => console.error('Firebase save error', err));
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(saveInterval);
    };
  }, [wallet?.account?.address, storage, spawnSlots, tonBalance, reactors, nextSpawnTime, selectedIndex]);
  // ─── Рендер ───────────────────────────────────────────────────

  const cardStyle = {
    background: 'rgba(15,20,45,0.65)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
  };

  const remainingMs = nextSpawnTime ? Math.max(0, nextSpawnTime - currentTime) : 0;

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

        {activeTab === 'instruction' && (
          <div style={cardStyle}>
            <h2>📖 Как играть</h2>
            <ol style={{ paddingLeft: '24px', lineHeight: 1.6 }}>
              <li>Частицы появляются каждые 10 минут</li>
              <li>Объединяйте одинаковые уровни</li>
              <li>Уровень 6+ → реакторы (1 бесплатный)</li>
              <li>Через 18–24 ч → TON на баланс</li>
              <li>Зажмите частицу → удаление</li>
            </ol>
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
                  fontSize: 32,
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  color: remainingMs / 1000 <= 60 ? '#ff4444' : '#40e0ff',
                  letterSpacing: '1px',
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
                    border: selectedIndex === i - 2 ? '3px solid #40c0ff' : '2px dashed #4080ff44',
                    borderRadius: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32,
                    fontWeight: 'bold',
                    color: '#fff',
                    cursor: p ? 'pointer' : 'default',
                    boxShadow: p ? '0 0 16px rgba(255,255,255,0.35)' : 'none',
                  }}
                >
                  {p ? p.level : `Слот ${i + 1}`}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, maxWidth: 420, margin: '0 auto' }}>
              {storage.map((p, i) => {
                const locked = i >= FREE_SLOTS;
                const selected = selectedIndex === i;
                const holding = holdTargetIndex === i;

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
                    onMouseDown={() => p && selected && startHoldDelete(i)}
                    onMouseUp={cancelHoldDelete}
                    onMouseLeave={cancelHoldDelete}
                    onTouchStart={() => p && selected && startHoldDelete(i)}
                    onTouchEnd={cancelHoldDelete}
                    style={{
                      aspectRatio: 1,
                      background: p ? getColor(p.level) : 'rgba(30,40,80,0.4)',
                      border: selected ? '3px solid #40c0ff' : '1px solid #80a0ff33',
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 26,
                      fontWeight: 'bold',
                      color: '#fff',
                      cursor: 'pointer',
                      position: 'relative',
                      boxShadow: p ? '0 0 12px rgba(255,255,255,0.25)' : 'none',
                    }}
                  >
                    {p ? p.level : ''}
                    {holding && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: 5,
                          background: 'rgba(200,0,0,0.4)',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${holdProgress}%`,
                            background: '#ff0000',
                            transition: 'width 0.08s linear',
                          }}
                        />
                      </div>
                    )}
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
              const remainingMs = r.startTime ? Math.max(0, r.startTime + r.duration - currentTime) : 0;
              const remainingSec = Math.floor(remainingMs / 1000);

              const isEmpty = !r.particle;
              const isActive = !!r.particle && remainingSec > 0;
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

              let selectedParticleLevel: number | undefined = undefined;
              if (selectedIndex !== null) {
                selectedParticleLevel = storage[selectedIndex]?.level;
              }
              return (
                <div
                  key={i}
                  style={{
                    background: 'rgba(25,35,70,0.55)',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    textAlign: 'center',
                    border: '1px solid rgba(0,140,255,0.25)',
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Реактор {i + 1}</div>

                  {isEmpty ? (
                    <div style={{ color: '#88aaff', marginTop: 8 }}>
                      Пусто
                      {selectedParticleLevel !== undefined && selectedParticleLevel >= 6 && (
                        <button
                          onClick={() => placeInReactor(i, selectedIndex!)}
                          style={{
                            marginLeft: 12,
                            padding: '4px 12px',
                            background: '#3060ff',
                            border: 'none',
                            borderRadius: 6,
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: 14,
                          }}
                        >
                          Вставить
                        </button>
                      )}
                    </div>
                  ) : isActive ? (
                    <div style={{ marginTop: 8, color: '#aaffff' }}>
                      Уровень: {r.particle!.level}
                      <br />
                      Осталось: {formatTime(remainingMs)}
                    </div>
                  ) : (
                    <div style={{ color: '#88ffaa', marginTop: 8 }}>Завершено — награда начислена</div>
                  )}
                </div>
              );
            })}
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
          boxShadow: '0 -4px 12px rgba(0,0,0,0.5)',
        }}
      >
        {['instruction', 'merge', 'reactors', 'donate', 'profile'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as Tab)}
            style={{
              background: activeTab === tab ? 'rgba(64,192,255,0.18)' : 'transparent',
              border: activeTab === tab 
                ? '2px solid #40c0ff' 
                : '1px solid rgba(64,192,255,0.25)',
              borderRadius: 16,
              color: activeTab === tab ? '#40c0ff' : '#a0c0ff',
              fontSize: 14,
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              padding: '12px 16px',
              minWidth: 70,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === tab 
                ? '0 4px 12px rgba(64,192,255,0.4)' 
                : 'none',
            }}
          >
            <span style={{ fontSize: 20 }}>
              {tab === 'instruction' && '📖'}
              {tab === 'merge' && '🧊'}
              {tab === 'reactors' && '⚛️'}
              {tab === 'donate' && '💎'}
              {tab === 'profile' && '👤'}
            </span>
            <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
              {tab === 'instruction' ? 'Инстр.' :
               tab === 'merge' ? 'Сбор' :
               tab === 'reactors' ? 'Реакт.' :
               tab === 'donate' ? 'Донат' : 'Профиль'}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;