const DEFAULT_BLOCKED_TERMS = "spam,scam,fake";

const getBlockedTerms = () =>
  (process.env.BLOCKED_TERMS || DEFAULT_BLOCKED_TERMS)
    .split(",")
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);

const toSearchableText = (value) => {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map(toSearchableText).join(" ");
  if (typeof value === "object") return Object.values(value).map(toSearchableText).join(" ");
  return String(value);
};

const containsBlockedContent = (value) => {
  const text = toSearchableText(value).toLowerCase();
  if (!text) return false;

  return getBlockedTerms().some((term) => text.includes(term));
};

const formatFieldName = (field) =>
  String(field || "field")
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();

const assertCleanFields = (fields = {}) => {
  Object.entries(fields).forEach(([field, value]) => {
    if (!containsBlockedContent(value)) return;

    const error = new Error(
      `Please remove blocked or unsafe content from ${formatFieldName(field)}.`
    );
    error.statusCode = 400;
    error.code = "BLOCKED_CONTENT";
    error.field = field;
    throw error;
  });
};

module.exports = {
  containsBlockedContent,
  assertCleanFields,
};
