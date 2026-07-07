/**
 * Returns true if the category string looks like a valid CAP code
 * (starts with a letter, upper-case ASCII + digits only — no merit strings).
 */
function isValidCategory(cat) {
  if (!cat || typeof cat !== "string") return false;
  return /^[A-Z][A-Z0-9]*$/.test(cat.trim());
}

module.exports = { isValidCategory };
