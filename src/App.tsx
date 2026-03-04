import { useState } from 'react';
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';

type Tab = 'instruction' | 'merge' | 'reactors' | 'donate' | 'profile';

interface Particle {
  id: string;
  level: number;
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('instruction');
  const wallet = useTonWallet();

  // Состояние игры
  const [storage, setStorage] = useState<(Particle | null)[]>(Array(48).fill(null));
  const [spawnSlots, setSpawnSlots] = useState<(Particle | null)[]>([null, null]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Цвет частиц по уровню
  const getParticleColor = (level: number): string => {
    const colors = [
      '#4a90e2', '#50c878', '#f1c40f', '#e67e22',
      '#e74c3c', '#9b59b6', '#3498db', '#1abc9c',
      '#f39c12', '#ff4500' // 10-й — ярко-оранжевый
    ];
    return colors[level - 1] || '#ffffff';
  };

  // Генерация частицы (вероятности 70% — 1, 25% — 2, 5% — 3)
  const generateParticle = (): Particle => {
    const rand = Math.random();

    let level: number;
    if (rand < 0.70) level = 1;
    else if (rand < 0.95) level = 2;
    else level = 3;

    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      level,
    };
  };

  // Сбор частицы из спавна в хранилище
  const collectToStorage = (spawnIndex: number) => {
    const particle = spawnSlots[spawnIndex];
    if (!particle) return;

    const emptyIndex = storage.findIndex((slot) => slot === null);

    if (emptyIndex === -1) {
      alert('Хранилище заполнено! Слей частицы или купи доп. ячейки.');
      return;
    }

    setStorage((prev) => {
      const newStorage = [...prev];
      newStorage[emptyIndex] = { ...particle };
      return newStorage;
    });

    setSpawnSlots((prev) => {
      const newSlots = [...prev];
      newSlots[spawnIndex] = null;
      return newSlots;
    });

    setSelectedIndex(null);
  };

  // Обработка кликов по ячейкам
  const handleCellClick = (index: number, isSpawn: boolean) => {
    const realIndex = isSpawn ? (index === 0 ? -2 : -1) : index;

    if (isSpawn) {
      collectToStorage(index);
      return;
    }

    // Клик по хранилищу
    if (selectedIndex === null) {
      const slot = storage[index];
      if (slot) setSelectedIndex(realIndex);
      return;
    }

    // Уже выбрана частица в хранилище
    const sourceIndex = selectedIndex;
    const sourceParticle = storage[sourceIndex];

    if (!sourceParticle) {
      setSelectedIndex(null);
      return;
    }

    const targetParticle = storage[index];

    if (targetParticle) {
      // Слияние
      if (targetParticle.level === sourceParticle.level && sourceParticle.level < 10) {
        const newLevel = sourceParticle.level + 1;

        setStorage((prev) => {
          const copy = [...prev];
          copy[index] = { id: Date.now().toString(36), level: newLevel };
          copy[sourceIndex] = null;
          return copy;
        });

        console.log(`Слияние: ${sourceParticle.level} → ${newLevel}`);
      }
    } else {
      // Перемещение в пустую ячейку
      setStorage((prev) => {
        const copy = [...prev];
        copy[index] = { ...sourceParticle };
        copy[sourceIndex] = null;
        return copy;
      });
    }

    setSelectedIndex(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0e1f 0%, #0f132e 50%, #0a0e1f 100%)',
        color: '#e0e0ff',
        fontFamily: 'system-ui, sans-serif',
        paddingBottom: '100px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Простой фон без анимации */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 15% 25%, rgba(15, 20, 50, 128) 0%, transparent 60%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <main style={{ padding: '20px', position: 'relative', zIndex: 1 }}>
        {/* Заголовок */}
        <div
          style={{
            background: 'rgba(15, 20, 50, 0.5)',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '24px',
            textAlign: 'center',
            border: '1px solid rgba(80, 160, 255, 0.12)',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '26px' }}>TON Fusion Lab</h1>
        </div>

        {/* Вкладка Инструкция */}
        {activeTab === 'instruction' && (
          <div style={{ background: 'rgba(15, 20, 45, 0.65)', borderRadius: '12px', padding: '20px' }}>
            <h2>📖 Как играть</h2>
            <ol style={{ lineHeight: '1.7', paddingLeft: '22px' }}>
              <li>Частицы появляются каждые 8 минут</li>
              <li>Объединяй одинаковые в хранилище (48 ячеек)</li>
              <li>Частицы уровня 6+ ставь в реакторы</li>
              <li>Через 18–24 часа частица сгорает → TON на кошелёк</li>
              <li>Приглашай друзей — 3–5% от их заработка</li>
            </ol>
          </div>
        )}

        {/* Вкладка Сбор */}
        {activeTab === 'merge' && (
          <div style={{ background: 'rgba(15, 20, 45, 0.65)', borderRadius: '12px', padding: '20px' }}>
            <h2>🧊 Сбор и объединение частиц</h2>

            {/* 2 слота спавна */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', justifyContent: 'center' }}>
              {spawnSlots.map((particle, i) => (
                <div
                  key={i}
                  onClick={() => handleCellClick(i, true)}
                  style={{
                    width: '90px',
                    height: '90px',
                    background: particle ? getParticleColor(particle.level) : 'rgba(0, 120, 220, 0.08)',
                    border: selectedIndex === (i === 0 ? -2 : -1)
                      ? '3px solid #40c0ff'
                      : '2px dashed rgba(0, 180, 255, 0.25)',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    fontWeight: 'bold',
                    color: '#fff',
                    cursor: 'pointer',
                    boxShadow: particle ? '0 0 15px rgba(255,255,255,0.4)' : 'none',
                  }}
                >
                  {particle ? particle.level : `Сбор ${i + 1}`}
                </div>
              ))}
            </div>

            {/* Кнопка теста спавна */}
            <button
              onClick={() => setSpawnSlots([generateParticle(), generateParticle()])}
              style={{
                display: 'block',
                margin: '0 auto 20px',
                padding: '10px 24px',
                background: '#40c0ff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              Тест: заспавнить 2 частицы
            </button>

            {/* Сетка хранилища */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '8px' }}>
              {storage.map((particle, i) => (
                <div
                  key={i}
                  onClick={() => handleCellClick(i, false)}
                  style={{
                    aspectRatio: '1',
                    background: particle ? getParticleColor(particle.level) : 'rgba(30, 40, 80, 0.3)',
                    border: selectedIndex === i
                      ? '3px solid #40c0ff'
                      : '1px solid rgba(80, 160, 255, 0.15)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '22px',
                    fontWeight: 'bold',
                    color: '#fff',
                    cursor: 'pointer',
                    boxShadow: particle ? '0 0 12px rgba(255,255,255,0.3)' : 'none',
                  }}
                >
                  {particle ? particle.level : ''}
                </div>
              ))}
            </div>

            <p style={{ marginTop: '20px', color: '#aaa', textAlign: 'center' }}>
              Донат → +16 ячеек хранилища навсегда
            </p>
          </div>
        )}

        {/* Вкладка Реакторы */}
        {activeTab === 'reactors' && (
          <div style={{
            background: 'rgba(15, 20, 45, 0.65)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <h2>⚛️ Реакторы (2 бесплатных)</h2>

            {[1, 2].map((i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(25, 35, 70, 0.5)',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '12px',
                  textAlign: 'center',
                  border: '1px solid rgba(0, 140, 255, 0.18)'
                }}
              >
                Реактор {i}
                <br />
                <small style={{ color: '#88aaff' }}>
                  Пусто — вставьте частицу ур. 6+
                </small>
              </div>
            ))}
          </div>
        )}

        {/* Вкладка Донат */}
        {activeTab === 'donate' && (
          <div style={{ background: 'rgba(15, 20, 45, 0.65)', borderRadius: '12px', padding: '20px' }}>
            <h2>💎 Донат</h2>
            <p>Пополнение от 2 TON</p>
            <ul style={{ paddingLeft: '24px', lineHeight: '1.8' }}>
              <li>+16 ячеек хранилища — 1.5 TON</li>
              <li>+1 реактор — 2 TON</li>
              <li>Повышение редкости — 0.5 TON / 7 дней</li>
            </ul>
          </div>
        )}

        {/* Вкладка Профиль */}
        {activeTab === 'profile' && (
          <div style={{ background: 'rgba(15, 20, 45, 0.65)', borderRadius: '12px', padding: '20px' }}>
            <h2>👤 Профиль</h2>
            <p>TON-кошелёк: {wallet ? 'Подключён' : 'Не подключён'}</p>
            {wallet && (
              <p style={{ wordBreak: 'break-all', fontSize: '14px' }}>
                Адрес: {wallet.account.address.slice(0, 6)}...{wallet.account.address.slice(-4)}
              </p>
            )}
            <div style={{ margin: '20px 0' }}>
              <TonConnectButton />
            </div>
            <p style={{ color: '#aaa', fontSize: '14px' }}>
              Подключение кошелька работает только в Telegram Mini App
            </p>
          </div>
        )}
      </main>

      {/* Нижнее меню */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '80px',
        background: 'rgba(8, 10, 25, 0.92)',
        borderTop: '1px solid rgba(0, 140, 255, 0.18)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 100
      }}>
        {['instruction', 'merge', 'reactors', 'donate', 'profile'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as Tab)}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === tab ? '#40c0ff' : '#777',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              padding: '8px 10px',
              borderRadius: '12px'
            }}
          >
            {tab === 'instruction' && '📖 Инстр.'}
            {tab === 'merge' && '🧊 Сбор'}
            {tab === 'reactors' && '⚛️ Реакт.'}
            {tab === 'donate' && '💎 Донат'}
            {tab === 'profile' && '👤 Проф.'}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;