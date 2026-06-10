/**
 * Shared term utilities used across all pages.
 * dedupeTerms: Removes duplicate term_numbers (keeps most recent year first
 * since the API returns terms ordered by year DESC).
 */
export const formatTerm = (term) => term ? `Term ${term.term_number}` : '-';

export const dedupeTerms = (terms = []) => {
  const seen = new Set();
  return terms.filter(t => {
    if (seen.has(t.term_number)) return false;
    seen.add(t.term_number);
    return true;
  });
};
