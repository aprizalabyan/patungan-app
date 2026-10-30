export function publicEventPath(eventId: string): string {
  return `/public/events/${eventId}`
}

export function publicEventUrl(eventId: string, origin: string = window.location.origin): string {
  return `${origin}${publicEventPath(eventId)}`
}
