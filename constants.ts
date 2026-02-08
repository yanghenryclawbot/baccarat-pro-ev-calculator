
import { Payouts } from './types';

export const INITIAL_DECK_COUNT = 32; // 8 decks * 4 suits = 32 of each rank
export const TOTAL_RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export const DEFAULT_PAYOUTS: Payouts = {
  banker: 1.0, // Default to 1:1 for No Commission
  player: 1.0,  // 1:1
  tie: 8.0,     // 1:8
  playerPair: 11.0,
  bankerPair: 11.0,
  tieBonus: {
    0: 140,
    1: 200,
    2: 210,
    3: 190,
    4: 110,
    5: 100,
    6: 40,
    7: 40,
    8: 70,
    9: 70
  },
  tiger: { twoCards: 12, threeCards: 20 },
  smallTiger: 22,
  bigTiger: 50,
  tigerTie: 35,
  tigerPair: { same: 100, dual: 20, single: 4 },
  bankerMode: 'no-commission'
};

export const RANK_LABELS: Record<number, string> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K'
};
