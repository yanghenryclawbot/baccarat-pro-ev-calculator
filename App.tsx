import React, { useState, useEffect } from 'react';
import { DeckCounts, Payouts, CalculationResult, EVResult } from './types';
import { INITIAL_DECK_COUNT, TOTAL_RANKS, DEFAULT_PAYOUTS, RANK_LABELS } from './constants';
import { calculateEV } from './logic/baccaratLogic';

const App: React.FC = () => {
  const [counts, setCounts] = useState<DeckCounts>(() => {
    const initial: DeckCounts = {};
    TOTAL_RANKS.forEach(r => {
      initial[r] = INITIAL_DECK_COUNT;
    });
    return initial;
  });

  const [bankroll, setBankroll] = useState<number>(1000); // 1000萬
  const [rolling, setRolling] = useState<number>(1.5);
  const [payouts, setPayouts] = useState<Payouts>(() => ({
    ...DEFAULT_PAYOUTS,
    bankerMode: 'commission',
    banker: 0.95
  }));
  const [results, setResults] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [cardHistory, setCardHistory] = useState<string[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);


  useEffect(() => {
    const runCalc = async () => {
      setIsCalculating(true);
      setTimeout(async () => {
        const res = await calculateEV(counts, payouts, rolling);
        setResults(res);
        setIsCalculating(false);
      }, 0);
    };
    runCalc();
  }, [counts, payouts, rolling]);

  // Keyboard shortcuts - only when not focused on input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果焦點在輸入框，不處理鍵盤扣牌
      if (isInputFocused) return;
      
      // Number keys 1-9, 0, J, Q, K
      const keyMap: Record<string, number> = {
        '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
        '6': 6, '7': 7, '8': 8, '9': 9, '0': 0,
        'j': 11, 'J': 11, 'q': 12, 'Q': 12, 'k': 13, 'K': 13
      };
      
      if (keyMap.hasOwnProperty(e.key)) {
        e.preventDefault();
        updateCount(keyMap[e.key], -1);
      }
      
      // Enter key adds separator
      if (e.key === 'Enter') {
        e.preventDefault();
        setCardHistory(h => ['|', ...h].slice(0, 100));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInputFocused, counts]);

  const updateCount = (rank: number, delta: number) => {
    const current = counts[rank];
    if (delta < 0 && current <= 0) return;

    setCounts(prev => ({
      ...prev,
      [rank]: Math.max(0, prev[rank] + delta)
    }));

    if (delta < 0) {
      setCardHistory(h => [RANK_LABELS[rank], ...h].slice(0, 100));
    } else if (delta > 0) {
      setCardHistory(h => {
        const index = h.indexOf(RANK_LABELS[rank]);
        if (index !== -1) {
          const newH = [...h];
          newH.splice(index, 1);
          return newH;
        }
        return h;
      });
    }
  };


  const handlePayoutChange = (key: string, value: string, bonusKey?: number) => {
    const num = parseFloat(value) || 0;
    setPayouts(prev => {
      if (key === 'tieBonus' && bonusKey !== undefined) {
        return { ...prev, tieBonus: { ...prev.tieBonus, [bonusKey]: num } };
      }
      if (key.startsWith('tiger.')) {
        const subKey = key.split('.')[1] as keyof Payouts['tiger'];
        return { ...prev, tiger: { ...prev.tiger, [subKey]: num } };
      }
      if (key.startsWith('tigerPair.')) {
        const subKey = key.split('.')[1] as keyof Payouts['tigerPair'];
        return { ...prev, tigerPair: { ...prev.tigerPair, [subKey]: num } };
      }
      return { ...prev, [key as keyof Payouts]: num };
    });
  };

  const resetShoe = () => {
    const initial: DeckCounts = {};
    TOTAL_RANKS.forEach(r => {
      initial[r] = INITIAL_DECK_COUNT;
    });
    setCounts(initial);
    setCardHistory([]);
  };


  const calculateKellyBet = (item: EVResult) => {
    if (item.ev <= 0 || item.payout <= 0) return 0;
    const fraction = item.ev / item.payout;
    // 本金顯示為"萬"，實際金額 = bankroll * 10000
    return Math.floor(bankroll * 10000 * fraction);
  };

  const getAllPositiveEVBets = (): EVResult[] => {
    if (!results) return [];
    const all = [
      results.player, results.banker, results.tie,
      results.playerPair, results.bankerPair, ...results.tieBonuses,
      results.tiger, results.smallTiger, results.bigTiger, results.tigerTie,
      results.tigerPair
    ];
    return all.filter(item => item.ev > 0).sort((a, b) => b.ev - a.ev);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col gap-6">
      {/* Strategic Recommendations - Moved to Top */}
      <footer className="bg-slate-800 border border-blue-900/50 p-6 rounded-2xl shadow-2xl">
        <div className="flex flex-col md:flex-row items-start justify-between gap-6">
          <div className="flex-1">
            <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isCalculating ? 'bg-blue-500 animate-ping' : 'bg-green-500'}`}></span>
              Strategic Recommendations (推薦)
            </h4>

            <div className="flex flex-wrap gap-3">
              {(() => {
                const positiveBets = getAllPositiveEVBets();
                if (positiveBets.length === 0) {
                  return (
                    <div className="bg-slate-900/50 border border-slate-700 px-4 py-3 rounded-xl flex items-center gap-3">
                      <span className="text-slate-500 font-bold uppercase text-xs tracking-widest">Mathematical Advantage Wait</span>
                    </div>
                  );
                }

                return positiveBets.map((bet, i) => {
                  const amt = calculateKellyBet(bet);
                  const isBanker = bet.label.includes('Banker') || bet.label.includes('莊');
                  const isPlayer = bet.label.includes('Player') || bet.label.includes('閒');
                  
                  let bgClass = 'bg-green-500/10 border-green-500/30';
                  if (isBanker) bgClass = 'bg-red-500/10 border-red-500/30';
                  else if (isPlayer) bgClass = 'bg-blue-500/10 border-blue-500/30';
                  
                  return (
                    <div key={i} className={`${bgClass} px-4 py-3 rounded-xl flex items-center gap-4 transition-all hover:bg-opacity-20 group`}>
                      <div className="flex flex-col">
                        <span className={`text-xs font-black uppercase tracking-tighter ${isBanker ? 'text-red-400' : isPlayer ? 'text-blue-400' : 'text-green-400'}`}>{bet.label}</span>
                        <span className="text-white text-xl font-black">${amt.toLocaleString()}</span>
                      </div>
                      <div className={`h-8 w-[1px] ${isBanker ? 'bg-red-500/20' : isPlayer ? 'bg-blue-500/20' : 'bg-green-500/20'}`}></div>
                      <div className="flex flex-col">
                        <span className="text-slate-500 text-[10px] uppercase font-bold tracking-tighter">Exact EV</span>
                        <span className="text-green-500 font-mono font-bold">{(bet.ev * 100).toFixed(4)}%</span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          <div className="flex flex-col items-end shrink-0">
          </div>
        </div>
      </footer>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        {/* Loading Overlay */}
        {isCalculating && (
          <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center rounded-xl">
            <div className="bg-slate-800 border border-blue-500/50 px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-blue-400 font-bold text-sm tracking-widest uppercase animate-pulse">Exact Calculation...</span>
            </div>
          </div>
        )}

        {/* Left Column - Only Card Inventory */}
        <div className="lg:col-span-5 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Card Inventory
          </h2>
          <p className="text-xs text-slate-500 mb-3">⌨️ 按鍵盤 0-9, J, Q, K 快速輸入</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-4 gap-3 mb-4">
            {TOTAL_RANKS.map(rank => (
              <div key={rank} className="bg-slate-900 p-2 rounded-lg border border-slate-700 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className={`text-xl font-black mono ${rank >= 10 ? 'text-purple-400' : 'text-slate-300'}`}>
                    {RANK_LABELS[rank]}
                  </span>
                  <span className="text-sm font-bold text-blue-400 mono">{counts[rank]}</span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => updateCount(rank, -1)}
                    className="flex-1 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 py-1 rounded transition-colors text-lg font-bold"
                  >-</button>
                  <button
                    onClick={() => updateCount(rank, 1)}
                    className="flex-1 bg-slate-800 hover:bg-blue-900/40 text-slate-400 hover:text-blue-400 py-1 rounded transition-colors text-lg font-bold"
                  >+</button>
                </div>
              </div>
            ))}
          </div>

          {/* Separator Button */}
          <div className="border-t border-slate-700 pt-4">
            <button
              onClick={() => setCardHistory(h => ['|', ...h].slice(0, 100))}
              className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white py-2 rounded text-sm font-bold uppercase tracking-widest transition-colors"
            >
              + 分隔線 (Enter)
            </button>
          </div>

          <div className="border-t border-slate-700 pt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Card History
              </h3>
              <button
                onClick={() => setCardHistory([])}
                className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-slate-300 uppercase transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 min-h-[60px] max-h-[150px] overflow-y-auto custom-scrollbar">
              {cardHistory.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
                  No cards clicked yet...
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1">
                  {cardHistory.map((item, i) => {
                    if (item === '|') {
                      return <span key={i} className="text-slate-600 text-lg font-bold mx-1">|</span>;
                    }
                    return (
                      <span key={i} className={`px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-sm font-bold mono ${item === '0' || item === '10' || item === 'J' || item === 'Q' || item === 'K' ? 'text-purple-400' : 'text-slate-300'}`}>
                        {item}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Settings + Analysis */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Top Row: Reset Shoe + Capital + Rolling */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex flex-wrap items-end gap-3">
              {/* Reset Shoe */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={resetShoe}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-sm font-bold uppercase tracking-widest transition-colors"
                >
                  Reset Shoe
                </button>
                <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700">
                  <span className="text-xs text-slate-500 uppercase">Remaining</span>
                  <span className="text-lg font-bold text-yellow-500 mono">{results?.totalCards || 0}</span>
                </div>
              </div>

              {/* Capital */}
              <div className="flex-1 min-w-[150px]">
                <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m.599-1.1c.53-.25 1.01-.603 1.411-1.031" />
                  </svg>
                  Capital
                </h2>
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                    <input
                      type="number"
                      value={bankroll}
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => setIsInputFocused(false)}
                      onChange={(e) => setBankroll(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded pl-6 pr-10 py-1.5 text-lg font-bold text-green-400 mono focus:ring-1 focus:ring-green-500 outline-none transition-all"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 font-bold">萬</span>
                  </div>
                </div>
              </div>

              {/* Rolling */}
              <div className="w-28">
                <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Rolling
                </h2>
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
                  <div className="relative">
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 font-bold">%</span>
                    <input
                      type="number"
                      step="0.1"
                      value={rolling}
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => setIsInputFocused(false)}
                      onChange={(e) => setRolling(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded pr-8 pl-2 py-1.5 text-lg font-bold text-blue-400 mono focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Banker Mode */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              莊規則
            </h2>
            <div className="bg-slate-900 p-2 rounded-lg border border-slate-700 flex gap-2">
              <button
                onClick={() => setPayouts(prev => ({ ...prev, bankerMode: 'commission', banker: 0.95 }))}
                className={`flex-1 py-1.5 rounded text-sm font-bold transition-all ${payouts.bankerMode === 'commission' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                1:0.95 抽水
              </button>
              <button
                onClick={() => setPayouts(prev => ({ ...prev, bankerMode: 'no-commission', banker: 1.0 }))}
                className={`flex-1 py-1.5 rounded text-sm font-bold transition-all ${payouts.bankerMode === 'no-commission' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                1:1 免傭
              </button>
            </div>
          </div>

          {/* Execution Analysis */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h2 className="text-sm font-semibold mb-4 flex justify-between items-center">
              <span>Execution Analysis (分析)</span>
              <span className="text-xs text-slate-500 font-normal uppercase">Exact Prob / EV</span>
            </h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {results && [
                results.player, results.banker, results.tie,
                results.playerPair, results.bankerPair,
                results.tiger, results.smallTiger, results.bigTiger, results.tigerTie,
                results.tigerPair
              ].map((item, idx) => {
                const kellyAmount = calculateKellyBet(item);
                const isPositive = item.ev > 0;
                return (
                  <div key={idx} className={`bg-slate-900/80 p-3 rounded-lg border ${isPositive ? 'border-green-500/50' : 'border-slate-700'}`}>
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-lg font-bold text-slate-200">{item.label}</span>
                      <div className="text-right">
                        <div className={`text-sm font-mono ${isPositive ? 'text-green-400 font-bold' : 'text-slate-400'}`}>
                          {(item.ev * 100).toFixed(4)}%
                        </div>
                        {isPositive && (
                          <div className="text-[10px] text-green-500 uppercase font-bold">
                            ${kellyAmount.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 uppercase">Exact Prob</span>
                      <span className="text-sm font-bold text-yellow-500">{(item.probability * 100).toFixed(4)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
