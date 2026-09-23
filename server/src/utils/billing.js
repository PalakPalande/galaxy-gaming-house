export function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

export function calculateSubtotal(startTime, endTime, hourlyRate) {
  const ms = new Date(endTime) - new Date(startTime)
  const minutes = Math.ceil(ms / 60000)
  if (minutes <= 0) throw new Error('End time must be after start time.')
  return { minutes, subtotal: money((minutes / 60) * Number(hourlyRate)) }
}

export function applyOffer(subtotal, offer) {
  if (!offer) return { discount: 0, total: money(subtotal) }
  let discount = 0
  if (offer.discount_type === 'PERCENT') discount = subtotal * (Number(offer.discount_value) / 100)
  if (offer.discount_type === 'FLAT') discount = Number(offer.discount_value)
  discount = Math.min(discount, subtotal)
  return { discount: money(discount), total: money(subtotal - discount) }
}

export function calculateSessionAmount(startTime, endTime, hourlyRate) {
  const { minutes, subtotal } = calculateSubtotal(startTime, endTime, hourlyRate)
  return { billedMinutes: minutes, amount: subtotal }
}
