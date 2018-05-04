// Modules
import fetch from 'unfetch';
import Promise from 'promise-polyfill';

// Collection of functions to parse roms
// Private function to fetch a game
export const fetchROMAsByteArray = (ROM, fetchHeaders) => {
  const fetchROMAsByteArrayTask = async () => {
    if (ArrayBuffer.isView(ROM) && ROM.constructor === Uint8Array) {
      return ROM;
    } else if (typeof ROM === 'object' && ROM.size) {
      const fileReaderByteArray = await new Promise((resolve, reject) => {
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
      });
      return fileReaderByteArray;
    } else {
      // Fetch the file
      // First check if we have headers
      if (!fetchHeaders) {
        fetchHeaders = {};
      }

      let bytes = await fetch(ROM, fetchHeaders).then(blob => {
        if (!blob.ok) {
          return Promise.reject(blob);
        }
        return blob.arrayBuffer();
      });

      return await getGameFromArrayBuffer(ROM, bytes);
    }
  };

  return fetchROMAsByteArrayTask();
};

// Private function to convert an ArrayBuffer from our file input, into our final Uint8Array
// Useful for wrapping around .zip files, and using JSZip
const getGameFromArrayBuffer = (fileName, ROMBuffer) => {
  const getGameFromArrayBufferTask = async () => {
    if (fileName.endsWith('.zip')) {
      // Use JSZip to get our Rom buffer
      const JSZip = require('jszip');
      let response = await new Promise((resolve, reject) => {
        // May be an implemented proto non-promise returning function
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
                    .then(ROMInZipBuffer => {
                      resolve(ROMInZipBuffer);
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
      });

      return response;
    }

    // Simply return the ROM Buffer
    return new Uint8Array(ROMBuffer);
  };

  return getGameFromArrayBufferTask();
};
