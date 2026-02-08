
export type CardRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface DeckCounts {
  [key: number]: number;
}

export interface Payouts {
  banker: number;
  player: number;
  tie: number;
  playerPair: number;
  bankerPair: number;
  tieBonus: { [key: number]: number }; // 0 to 9 points
  tiger: { twoCards: number; threeCards: number };
  smallTiger: number;
  bigTiger: number;
  tigerTie: number;
  tigerPair: { same: number; dual: number; single: number };
  bankerMode: 'commission' | 'no-commission';
}

export interface EVResult {
  label: string;
  probability: number;
  ev: number;
  payout: number;
}

export interface CalculationResult {
  player: EVResult;
  banker: EVResult;
  tie: EVResult;
  playerPair: EVResult;
  bankerPair: EVResult;
  tieBonuses: EVResult[];
  tiger: EVResult;
  smallTiger: EVResult;
  bigTiger: EVResult;
  tigerTie: EVResult;
  tigerPair: EVResult;
  totalCards: number;
}
