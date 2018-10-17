export function getEventData(event) {
  if (event.data) {
    return event.data;
  }

  return event;
}
