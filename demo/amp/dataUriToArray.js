// https://stackoverflow.com/questions/6850276/how-to-convert-dataurl-to-file-object-in-javascript
export default function(dataURI) {
  const byteString = atob(dataURI.split(',')[1]);

  const mimeString = dataURI
    .split(',')[0]
    .split(':')[1]
    .split(';')[0];

  // write the bytes of the string to an ArrayBuffer
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  return ia;
}
