/**
 * A presentation order for a set of options, guaranteed not to be the authored
 * one when there is more than one arrangement available.
 *
 * Authored order is a tell: correct answers cluster where the author put them,
 * and a learner who has seen a question once remembers the POSITION rather than
 * the physics. Shuffling on every presentation means a requeued question has to
 * be answered again rather than recognised.
 *
 * Shared rather than owned by one renderer, because the tell is identical
 * wherever an option list is drawn, and because the corpus makes it concrete:
 * all 26 picture questions put the answer at index 0, so an unshuffled grid of
 * photographs is answered by tapping the first card without looking at it.
 *
 * Note this is a PRESENTATION order only. `picked` and `step.correct` stay in
 * authored indices on both sides of it, so grading never has to know a shuffle
 * happened.
 */
export function shuffledOrder(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return order;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order.some((v, i) => v !== i)) break;
  }
  return order;
}
