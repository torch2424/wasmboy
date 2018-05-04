// Modules
import fetch from 'unfetch';
import Promise from 'promise-polyfill';

// Collection of functions to parse roms
// Private function to fetch a game
export const fetchROMAsByteArray = (ROM, fetchHeaders) => {
  return new Promise((resolve, reject) => {
    if (ArrayBuffer.isView(ROM) && ROM.constructor === Uint8Array) {
      // Simply resolve with the input
      resolve(ROM);
      return;
    } else if (typeof ROM === 'object' && ROM.size) {
      // Read the file object
      // https://www.javascripture.com/FileReader#readAsArrayBuffer_Blob
      const fileReader = new FileReader();
      fileReader.onload = () => {
        getGameFromArrayBuffer(ROM.name, fileReader.result)
          .then(byteArray => {
            resolve(byteArray);
          })
          .catch(error => {
            reject(error);
          });
      };
      fileReader.readAsArrayBuffer(ROM);
    } else {
      // Fetch the file

      // First check if we have headers
      if (!fetchHeaders) {
        fetchHeaders = {};
      }

      fetch(ROM, fetchHeaders)
        .then(blob => {
          if (!blob.ok) {
            return Promise.reject(blob);
          }

          return blob.arrayBuffer();
        })
        .then(bytes => {
          getGameFromArrayBuffer(ROM, bytes)
            .then(byteArray => {
              resolve(byteArray);
            })
            .catch(error => {
              reject(error);
            });
        })
        .catch(error => {
          reject(error);
        });
    }
  });
};

// Private function to convert an ArrayBuffer from our file input, into our final Uint8Array
// Useful for wrapping around .zip files, and using JSZip
const getGameFromArrayBuffer = (fileName, ROMBuffer) => {
  return new Promise((resolve, reject) => {
    if (fileName.endsWith('.zip')) {
      const JSZip = require('jszip');
      JSZip.loadAsync(ROMBuffer).then(
        zip => {
          // Zip is not an array, but it's proto implements a custom forEach()
          let foundGame = false;
          zip.forEach((relativePath, zipEntry) => {
            if (!foundGame) {
              if (relativePath.endsWith('.gb') || relativePath.endsWith('.gbc')) {
                // Another function implemented on the proto
                foundGame = true;
                zip
                  .file(relativePath)
                  .async('uint8array')
                  .then(ROMBuffer => {
                    resolve(ROMBuffer);
                  });
              }
            }
          });
          if (!foundGame) {
            reject(new Error('The ".zip" did not contain a ".gb" or ".gbc" file!'));
          }
        },
        error => {
          reject(error);
        }
      );
    } else {
      const byteArray = new Uint8Array(ROMBuffer);
      resolve(byteArray);
    }
  });
};
