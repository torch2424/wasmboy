export function getEventData(event) {
  return event || event.data;
}

export const isInBrowser = typeof self !== 'undefined';

// Function to read a base64 string as a buffer
export function readBase64String(base64String) {
  if (isInBrowser) {
    return base64String;
  } else {
    return readBase64Buffer(base64String).toString('utf8');
  }
}

export function readBase64Buffer(base64String) {
  return Buffer.from(base64String.split(',')[1], 'base64');
}
