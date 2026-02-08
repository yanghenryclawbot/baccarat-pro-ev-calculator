
import { DeckCounts, Payouts, CalculationResult, EVResult } from '../types';

const getVal = (rank: number) => (rank >= 10 ? 0 : rank);

/**
 * Combinatorial Baccarat Engine
 * Calculates exact probabilities by iterating through all possible card value sequences (0-9).
 */
export async function calculateEV(counts: DeckCounts, payouts: Payouts, rolling: number = 1.4): Promise<CalculationResult> {
  const totalCards = Object.values(counts).reduce((a, b) => a + b, 0);

  const rollingRebate = rolling / 100;
  const rollingBonus = rollingRebate / 2;

  if (totalCards < 6) {
    return {
      player: { label: '閒', probability: 0, payout: 0, ev: 0 },
      banker: { label: '莊', probability: 0, payout: 0, ev: 0 },
      tie: { label: '和', probability: 0, payout: 0, ev: 0 },
      playerPair: { label: '閒對', probability: 0, payout: 0, ev: 0 },
      bankerPair: { label: '莊對', probability: 0, payout: 0, ev: 0 },
      tieBonuses: [],
      tiger: { label: 'Tiger', probability: 0, payout: 0, ev: 0 },
      smallTiger: { label: 'Small Tiger', probability: 0, payout: 0, ev: 0 },
      bigTiger: { label: 'Big Tiger', probability: 0, payout: 0, ev: 0 },
      tigerTie: { label: 'Tiger Tie', probability: 0, payout: 0, ev: 0 },
      tigerPair: { label: 'Tiger對', probability: 0, payout: 0, ev: 0 },
      totalCards: totalCards
    };
  }

  // Group cards by Baccarat values (0-9)
  const valCounts = new Array(10).fill(0);
  for (let rank = 1; rank <= 13; rank++) {
    valCounts[getVal(rank)] += counts[rank];
  }

  // Exact outcomes
  let pWinProb = 0, bWinProb = 0, tieProb = 0;
  let pPairProb = calculatePairProbability(counts, totalCards);
  let bPairProb = pPairProb;
  const tiePointProbs = new Array(10).fill(0);

  // Tiger probabilities
  let tiger6_2_Prob = 0; // Banker win with 6 (2 cards)
  let tiger6_3_Prob = 0; // Banker win with 6 (3 cards)
  let tigerTie6Prob = 0; // Tie with 6

  // Helper to get probability of a specific card value being drawn at a specific step
  const getP = (val: number, currentCounts: number[], currentTotal: number) => {
    if (currentCounts[val] <= 0) return 0;
    return currentCounts[val] / currentTotal;
  };

  // Iterate through all 10,000 initial 4-card combinations (P1, B1, P2, B2)
  for (let p1 = 0; p1 <= 9; p1++) {
    const prob1 = getP(p1, valCounts, totalCards);
    if (prob1 === 0) continue;
    valCounts[p1]--;

    for (let b1 = 0; b1 <= 9; b1++) {
      const prob2 = prob1 * getP(b1, valCounts, totalCards - 1);
      if (prob2 === 0) continue;
      valCounts[b1]--;

      for (let p2 = 0; p2 <= 9; p2++) {
        const prob3 = prob2 * getP(p2, valCounts, totalCards - 2);
        if (prob3 === 0) continue;
        valCounts[p2]--;

        for (let b2 = 0; b2 <= 9; b2++) {
          const prob4 = prob3 * getP(b2, valCounts, totalCards - 3);
          if (prob4 === 0) continue;
          valCounts[b2]--;

          // Start Baccarat logic for this path
          const pInit = (p1 + p2) % 10;
          const bInit = (b1 + b2) % 10;

          if (pInit >= 8 || bInit >= 8) {
            // Natural
            tally(pInit, bInit, prob4, 2);
          } else {
            // Player draws?
            if (pInit <= 5) {
              for (let p3 = 0; p3 <= 9; p3++) {
                const prob5 = prob4 * getP(p3, valCounts, totalCards - 4);
                if (prob5 === 0) continue;
                valCounts[p3]--;
                const pFinal = (pInit + p3) % 10;

                // Banker draws? (Complex 3rd card rules)
                let bDraw = false;
                if (bInit <= 2) bDraw = true;
                else if (bInit === 3 && p3 !== 8) bDraw = true;
                else if (bInit === 4 && p3 >= 2 && p3 <= 7) bDraw = true;
                else if (bInit === 5 && p3 >= 4 && p3 <= 7) bDraw = true;
                else if (bInit === 6 && (p3 === 6 || p3 === 7)) bDraw = true;

                if (bDraw) {
                  for (let b3 = 0; b3 <= 9; b3++) {
                    const prob6 = prob5 * getP(b3, valCounts, totalCards - 5);
                    if (prob6 === 0) continue;
                    tally(pFinal, (bInit + b3) % 10, prob6, 3);
                  }
                } else {
                  tally(pFinal, bInit, prob5, 2);
                }
                valCounts[p3]++;
              }
            } else {
              // Player stands (6 or 7)
              if (bInit <= 5) {
                for (let b3 = 0; b3 <= 9; b3++) {
                  const prob5 = prob4 * getP(b3, valCounts, totalCards - 4);
                  if (prob5 === 0) continue;
                  tally(pInit, (bInit + b3) % 10, prob5, 3);
                }
              } else {
                tally(pInit, bInit, prob4, 2);
              }
            }
          }
          valCounts[b2]++;
        }
        valCounts[p2]++;
      }
      valCounts[b1]++;
    }
    valCounts[p1]++;
  }

  function tally(p: number, b: number, prob: number, bCards: number) {
    if (p > b) {
      pWinProb += prob;
    } else if (b > p) {
      bWinProb += prob;
      if (b === 6) {
        if (bCards === 2) tiger6_2_Prob += prob;
        else if (bCards === 3) tiger6_3_Prob += prob;
      }
    } else {
      tieProb += prob;
      tiePointProbs[p] += prob;
      if (p === 6) tigerTie6Prob += prob;
    }
  }

  // Banker/Player EV (Ties are Push)
  const evP = (pWinProb * payouts.player) - bWinProb + rollingBonus;

  let evB: number;
  if (payouts.bankerMode === 'no-commission') {
    // No Commission: Win with 6 pays 0.5, others pay 1.0. Loss pays -1.
    const bWinProb6 = tiger6_2_Prob + tiger6_3_Prob;
    const bWinProbNon6 = bWinProb - bWinProb6;
    evB = (bWinProbNon6 * 1.0) + (bWinProb6 * 0.5) - pWinProb + rollingBonus;
  } else {
    // Standard Commission: Win pays 0.95 (or whatever payouts.banker is set to). Loss pays -1.
    evB = (bWinProb * payouts.banker) - pWinProb + rollingBonus;
  }

  // Tie/Pairs EV
  const evT = (tieProb * (payouts.tie + 1)) - 1 + rollingBonus;
  const evPPair = (pPairProb * (payouts.playerPair + 1)) - 1 + rollingBonus;
  const evBPair = (bPairProb * (payouts.bankerPair + 1)) - 1 + rollingBonus;

  const tieBonuses: EVResult[] = [];
  for (let i = 0; i <= 9; i++) {
    tieBonuses.push({
      label: `${i}點和`,
      probability: tiePointProbs[i],
      payout: payouts.tieBonus[i],
      ev: (tiePointProbs[i] * (payouts.tieBonus[i] + 1)) - 1 + rollingBonus
    });
  }

  // Tiger EV
  const evTiger = (tiger6_2_Prob * (payouts.tiger.twoCards + 1)) + (tiger6_3_Prob * (payouts.tiger.threeCards + 1)) - (1 - tiger6_2_Prob - tiger6_3_Prob) + rollingBonus;
  // Actually, Tiger bet is separate. If Banker win with 6, payout. else loss?
  // Standard Tiger bet: Loss if not Banker 6 win.
  const evTigerFixed = (tiger6_2_Prob * (payouts.tiger.twoCards + 1)) + (tiger6_3_Prob * (payouts.tiger.threeCards + 1)) - 1 + rollingBonus;

  const evSmallTiger = (tiger6_2_Prob * (payouts.smallTiger + 1)) - 1 + rollingBonus;
  const evBigTiger = (tiger6_3_Prob * (payouts.bigTiger + 1)) - 1 + rollingBonus;
  const evTigerTie = (tigerTie6Prob * (payouts.tigerTie + 1)) - 1 + rollingBonus;

  // Tiger Pair
  const tigerPairResult = calculateTigerPairCombinedProbs(counts, totalCards, payouts.tigerPair, rollingBonus);

  return {
    player: { label: '閒', probability: pWinProb, payout: payouts.player, ev: evP },
    banker: { label: '莊', probability: bWinProb, payout: payouts.banker, ev: evB },
    tie: { label: '和', probability: tieProb, payout: payouts.tie, ev: evT },
    playerPair: { label: '閒對', probability: pPairProb, payout: payouts.playerPair, ev: evPPair },
    bankerPair: { label: '莊對', probability: bPairProb, payout: payouts.bankerPair, ev: evBPair },
    tieBonuses,
    tiger: { label: 'Tiger', probability: tiger6_2_Prob + tiger6_3_Prob, payout: 20, ev: evTigerFixed },
    smallTiger: { label: 'Small Tiger', probability: tiger6_2_Prob, payout: payouts.smallTiger, ev: evSmallTiger },
    bigTiger: { label: 'Big Tiger', probability: tiger6_3_Prob, payout: payouts.bigTiger, ev: evBigTiger },
    tigerTie: { label: 'Tiger Tie', probability: tigerTie6Prob, payout: payouts.tigerTie, ev: evTigerTie },
    tigerPair: { label: 'Tiger對', ...tigerPairResult },
    totalCards
  };
}

function calculateTigerPairCombinedProbs(counts: DeckCounts, total: number, payoutRates: { same: number; dual: number; single: number }, rollingBonus: number) {
  if (total < 4) return { probability: 0, payout: 0, ev: 0 };

  let waysSame = 0;
  let waysDual = 0;
  let waysSingle = 0;

  const P_total_4 = total * (total - 1) * (total - 2) * (total - 3);

  for (let r = 1; r <= 13; r++) {
    const cr = counts[r] || 0;
    if (cr >= 2) {
      const waysP_r = cr * (cr - 1);

      // Case: P has pair r.
      // What does B have?

      // 1. B has pair r?
      if (cr >= 4) {
        waysSame += waysP_r * (cr - 2) * (cr - 3);
      }

      // 2. B has pair s != r?
      for (let s = 1; s <= 13; s++) {
        if (s === r) continue;
        const cs = counts[s] || 0;
        if (cs >= 2) {
          waysDual += waysP_r * cs * (cs - 1);
        }
      }

      // 3. B has NO pair?
      // Remaining cards = total - 2.
      // Cards of rank k: ck' = cr-2 if k=r, else ck.
      // Total ways to pick 2 cards from remaining: (total-2)*(total-3)
      // Ways to pick a pair from remaining: sum_{k} ck'*(ck'-1)
      const totalWaysB = (total - 2) * (total - 3);
      let waysB_Pair = 0;
      for (let k = 1; k <= 13; k++) {
        const ck_prime = (k === r) ? counts[k] - 2 : (counts[k] || 0);
        if (ck_prime >= 2) {
          waysB_Pair += ck_prime * (ck_prime - 1);
        }
      }
      waysSingle += waysP_r * (totalWaysB - waysB_Pair);
    }
  }

  // Now add cases where B has pair and P doesn't.
  // This is symmetric to P has pair and B doesn't.
  // So we just calculated "Ways P has pair and B doesn't" as waysSingle.
  // Probability of "Exactly one side has a pair" = 2 * waysSingle / P(total, 4)
  // Probability of "Both sides have same pair" = waysSame / P(total, 4)
  // Probability of "Both sides have pairs, diff ranks" = waysDual / P(total, 4)

  const probSame = waysSame / P_total_4;
  const probDual = waysDual / P_total_4;
  const probSingle = (2 * waysSingle) / P_total_4;

  const totalProb = probSame + probDual + probSingle;
  const ev = (probSame * (payoutRates.same + 1)) + (probDual * (payoutRates.dual + 1)) + (probSingle * (payoutRates.single + 1)) - 1 + rollingBonus;

  return { probability: totalProb, payout: 0, ev: ev };
}

function calculatePairProbability(counts: DeckCounts, total: number): number {
  if (total < 2) return 0;
  let prob = 0;
  for (let rank = 1; rank <= 13; rank++) {
    const c = counts[rank];
    if (c >= 2) {
      // Pick two cards of the same rank from the shoe
      prob += (c / total) * ((c - 1) / (total - 1));
    }
  }
  return prob;
}
