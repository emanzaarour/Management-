export function validateDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Use a valid YYYY-MM-DD date");
  const date = new Date(`${value}T12:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new Error("Invalid calendar date");
  return value;
}
export function validateMonth(month, year) {
  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(year) ||
    year < 1900 ||
    year > 9999
  )
    throw new Error("Invalid month or year");
}
export function validateInterval(date, start, end) {
  validateDate(date);
  const time = (value) =>
    typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!time(start) || !time(end) || end <= start)
    throw new Error("End Time must be after Start Time on the same day");
}
export function validateRange(start, end) {
  if (start) validateDate(start);
  if (end) validateDate(end);
  if (start && end && start > end)
    throw new Error("Period end must be on or after its beginning");
}
