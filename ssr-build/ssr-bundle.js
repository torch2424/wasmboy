module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "/wasmBoy/";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "JkW7");
/******/ })
/************************************************************************/
/******/ ({

/***/ "/0aV":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var Readable = __webpack_require__("CpFU").Readable;

var utils = __webpack_require__("71nt");
utils.inherits(NodejsStreamOutputAdapter, Readable);

/**
* A nodejs stream using a worker as source.
* @see the SourceWrapper in http://nodejs.org/api/stream.html
* @constructor
* @param {StreamHelper} helper the helper wrapping the worker
* @param {Object} options the nodejs stream options
* @param {Function} updateCb the update callback.
*/
function NodejsStreamOutputAdapter(helper, options, updateCb) {
    Readable.call(this, options);
    this._helper = helper;

    var self = this;
    helper.on("data", function (data, meta) {
        if (!self.push(data)) {
            self._helper.pause();
        }
        if (updateCb) {
            updateCb(meta);
        }
    }).on("error", function (e) {
        self.emit('error', e);
    }).on("end", function () {
        self.push(null);
    });
}

NodejsStreamOutputAdapter.prototype._read = function () {
    this._helper.resume();
};

module.exports = NodejsStreamOutputAdapter;

/***/ }),

/***/ "0jOE":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

module.exports = {

  /* Allowed flush values; see deflate() and inflate() below for details */
  Z_NO_FLUSH: 0,
  Z_PARTIAL_FLUSH: 1,
  Z_SYNC_FLUSH: 2,
  Z_FULL_FLUSH: 3,
  Z_FINISH: 4,
  Z_BLOCK: 5,
  Z_TREES: 6,

  /* Return codes for the compression/decompression functions. Negative values
  * are errors, positive values are used for special but normal events.
  */
  Z_OK: 0,
  Z_STREAM_END: 1,
  Z_NEED_DICT: 2,
  Z_ERRNO: -1,
  Z_STREAM_ERROR: -2,
  Z_DATA_ERROR: -3,
  //Z_MEM_ERROR:     -4,
  Z_BUF_ERROR: -5,
  //Z_VERSION_ERROR: -6,

  /* compression levels */
  Z_NO_COMPRESSION: 0,
  Z_BEST_SPEED: 1,
  Z_BEST_COMPRESSION: 9,
  Z_DEFAULT_COMPRESSION: -1,

  Z_FILTERED: 1,
  Z_HUFFMAN_ONLY: 2,
  Z_RLE: 3,
  Z_FIXED: 4,
  Z_DEFAULT_STRATEGY: 0,

  /* Possible values of the data_type field (though see inflate()) */
  Z_BINARY: 0,
  Z_TEXT: 1,
  //Z_ASCII:                1, // = Z_TEXT (deprecated)
  Z_UNKNOWN: 2,

  /* The deflate compression method */
  Z_DEFLATED: 8
  //Z_NULL:                 null // Use -1 or null inline, depending on var type
};

/***/ }),

/***/ "1TsE":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__("71nt");
var GenericWorker = __webpack_require__("bxoG");

/**
 * A worker that use a nodejs stream as source.
 * @constructor
 * @param {String} filename the name of the file entry for this stream.
 * @param {Readable} stream the nodejs stream.
 */
function NodejsStreamInputAdapter(filename, stream) {
    GenericWorker.call(this, "Nodejs stream input adapter for " + filename);
    this._upstreamEnded = false;
    this._bindStream(stream);
}

utils.inherits(NodejsStreamInputAdapter, GenericWorker);

/**
 * Prepare the stream and bind the callbacks on it.
 * Do this ASAP on node 0.10 ! A lazy binding doesn't always work.
 * @param {Stream} stream the nodejs stream to use.
 */
NodejsStreamInputAdapter.prototype._bindStream = function (stream) {
    var self = this;
    this._stream = stream;
    stream.pause();
    stream.on("data", function (chunk) {
        self.push({
            data: chunk,
            meta: {
                percent: 0
            }
        });
    }).on("error", function (e) {
        if (self.isPaused) {
            this.generatedError = e;
        } else {
            self.error(e);
        }
    }).on("end", function () {
        if (self.isPaused) {
            self._upstreamEnded = true;
        } else {
            self.end();
        }
    });
};
NodejsStreamInputAdapter.prototype.pause = function () {
    if (!GenericWorker.prototype.pause.call(this)) {
        return false;
    }
    this._stream.pause();
    return true;
};
NodejsStreamInputAdapter.prototype.resume = function () {
    if (!GenericWorker.prototype.resume.call(this)) {
        return false;
    }

    if (this._upstreamEnded) {
        this.end();
    } else {
        this._stream.resume();
    }

    return true;
};

module.exports = NodejsStreamInputAdapter;

/***/ }),

/***/ "1kib":
/***/ (function(module, exports) {

module.exports = function (bitmap, value) {
  return {
    enumerable: !(bitmap & 1),
    configurable: !(bitmap & 2),
    writable: !(bitmap & 4),
    value: value
  };
};

/***/ }),

/***/ "2A+V":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

module.exports = {
  2: 'need dictionary', /* Z_NEED_DICT       2  */
  1: 'stream end', /* Z_STREAM_END      1  */
  0: '', /* Z_OK              0  */
  '-1': 'file error', /* Z_ERRNO         (-1) */
  '-2': 'stream error', /* Z_STREAM_ERROR  (-2) */
  '-3': 'data error', /* Z_DATA_ERROR    (-3) */
  '-4': 'insufficient memory', /* Z_MEM_ERROR     (-4) */
  '-5': 'buffer error', /* Z_BUF_ERROR     (-5) */
  '-6': 'incompatible version' /* Z_VERSION_ERROR (-6) */
};

/***/ }),

/***/ "2SaJ":
/***/ (function(module, exports) {

module.exports = function (it) {
  if (typeof it != 'function') throw TypeError(it + ' is not a function!');
  return it;
};

/***/ }),

/***/ "2WCG":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


// Note: we can't get significant speed boost here.
// So write code to minimize size - no pregenerated tables
// and array tools dependencies.

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

// Use ordinary array, since untyped makes no boost here

function makeTable() {
  var c,
      table = [];

  for (var n = 0; n < 256; n++) {
    c = n;
    for (var k = 0; k < 8; k++) {
      c = c & 1 ? 0xEDB88320 ^ c >>> 1 : c >>> 1;
    }
    table[n] = c;
  }

  return table;
}

// Create table on load. Just 255 signed longs. Not a problem.
var crcTable = makeTable();

function crc32(crc, buf, len, pos) {
  var t = crcTable,
      end = pos + len;

  crc ^= -1;

  for (var i = pos; i < end; i++) {
    crc = crc >>> 8 ^ t[(crc ^ buf[i]) & 0xFF];
  }

  return crc ^ -1; // >>> 0;
}

module.exports = crc32;

/***/ }),

/***/ "2cs7":
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__("39Rf"),
    core = __webpack_require__("eX64"),
    ctx = __webpack_require__("hutl"),
    hide = __webpack_require__("FSVj"),
    PROTOTYPE = 'prototype';

var $export = function $export(type, name, source) {
  var IS_FORCED = type & $export.F,
      IS_GLOBAL = type & $export.G,
      IS_STATIC = type & $export.S,
      IS_PROTO = type & $export.P,
      IS_BIND = type & $export.B,
      IS_WRAP = type & $export.W,
      exports = IS_GLOBAL ? core : core[name] || (core[name] = {}),
      expProto = exports[PROTOTYPE],
      target = IS_GLOBAL ? global : IS_STATIC ? global[name] : (global[name] || {})[PROTOTYPE],
      key,
      own,
      out;
  if (IS_GLOBAL) source = name;
  for (key in source) {
    // contains in native
    own = !IS_FORCED && target && target[key] !== undefined;
    if (own && key in exports) continue;
    // export native or passed
    out = own ? target[key] : source[key];
    // prevent global pollution for namespaces
    exports[key] = IS_GLOBAL && typeof target[key] != 'function' ? source[key]
    // bind timers to global for call from export context
    : IS_BIND && own ? ctx(out, global)
    // wrap global constructors for prevent change them in library
    : IS_WRAP && target[key] == out ? function (C) {
      var F = function F(a, b, c) {
        if (this instanceof C) {
          switch (arguments.length) {
            case 0:
              return new C();
            case 1:
              return new C(a);
            case 2:
              return new C(a, b);
          }return new C(a, b, c);
        }return C.apply(this, arguments);
      };
      F[PROTOTYPE] = C[PROTOTYPE];
      return F;
      // make static versions for prototype methods
    }(out) : IS_PROTO && typeof out == 'function' ? ctx(Function.call, out) : out;
    // export proto methods to core.%CONSTRUCTOR%.methods.%NAME%
    if (IS_PROTO) {
      (exports.virtual || (exports.virtual = {}))[key] = out;
      // export proto methods to core.%CONSTRUCTOR%.prototype.%NAME%
      if (type & $export.R && expProto && !expProto[key]) hide(expProto, key, out);
    }
  }
};
// type bitmap
$export.F = 1; // forced
$export.G = 2; // global
$export.S = 4; // static
$export.P = 8; // proto
$export.B = 16; // bind
$export.W = 32; // wrap
$export.U = 64; // safe
$export.R = 128; // real proto method for `library` 
module.exports = $export;

/***/ }),

/***/ "2hay":
/***/ (function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ }),

/***/ "39Rf":
/***/ (function(module, exports) {

// https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
var global = module.exports = typeof window != 'undefined' && window.Math == Math ? window : typeof self != 'undefined' && self.Math == Math ? self : Function('return this')();
if (typeof __g == 'number') __g = global; // eslint-disable-line no-undef

/***/ }),

/***/ "3vxC":
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.



module.exports = PassThrough;

var Transform = __webpack_require__("UfYs");

/*<replacement>*/
var util = __webpack_require__("jOgh");
util.inherits = __webpack_require__("ihNc");
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough)) return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function (chunk, encoding, cb) {
  cb(null, chunk);
};

/***/ }),

/***/ "5EQ/":
/***/ (function(module, exports, __webpack_require__) {

if (typeof indexedDB != 'undefined') {
  module.exports = __webpack_require__("a4gv");
} else {
  module.exports = {
    open: function open() {
      return Promise.reject('IDB requires a browser environment');
    },
    delete: function _delete() {
      return Promise.reject('IDB requires a browser environment');
    }
  };
}

/***/ }),

/***/ "5c6Q":
/***/ (function(module, exports, __webpack_require__) {

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var Buffer = __webpack_require__("fy20").Buffer;

var isBufferEncoding = Buffer.isEncoding || function (encoding) {
  switch (encoding && encoding.toLowerCase()) {
    case 'hex':case 'utf8':case 'utf-8':case 'ascii':case 'binary':case 'base64':case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':case 'raw':
      return true;
    default:
      return false;
  }
};

function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters. CESU-8 is handled as part of the UTF-8 encoding.
//
// @TODO Handling all encodings inside a single object makes it very difficult
// to reason about this code, so it should be split up in the future.
// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
// points as used by CESU-8.
var StringDecoder = exports.StringDecoder = function (encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  // Enough space to store all bytes of a single character. UTF-8 needs 4
  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
  this.charBuffer = new Buffer(6);
  // Number of bytes received for the current incomplete multi-byte character.
  this.charReceived = 0;
  // Number of bytes expected for the current incomplete multi-byte character.
  this.charLength = 0;
};

// write decodes the given buffer and returns it as JS string that is
// guaranteed to not contain any partial multi-byte characters. Any partial
// character found at the end of the buffer is buffered up, and will be
// returned when calling write again with the remaining bytes.
//
// Note: Converting a Buffer containing an orphan surrogate to a String
// currently works, but converting a String to a Buffer (via `new Buffer`, or
// Buffer#write) will replace incomplete surrogates with the unicode
// replacement character. See https://codereview.chromium.org/121173009/ .
StringDecoder.prototype.write = function (buffer) {
  var charStr = '';
  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var available = buffer.length >= this.charLength - this.charReceived ? this.charLength - this.charReceived : buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, 0, available);
    this.charReceived += available;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // remove bytes belonging to the current character from the buffer
    buffer = buffer.slice(available, buffer.length);

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (buffer.length === 0) {
      return charStr;
    }
    break;
  }

  // determine and set charLength / charReceived
  this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
    end -= this.charReceived;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    buffer.copy(this.charBuffer, 0, 0, size);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

// detectIncompleteChar determines if there is an incomplete UTF-8 character at
// the end of the given buffer. If so, it sets this.charLength to the byte
// length that character, and sets this.charReceived to the number of bytes
// that are available for this character.
StringDecoder.prototype.detectIncompleteChar = function (buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = buffer.length >= 3 ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }
  this.charReceived = i;
};

StringDecoder.prototype.end = function (buffer) {
  var res = '';
  if (buffer && buffer.length) res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 2;
  this.charLength = this.charReceived ? 2 : 0;
}

function base64DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 3;
  this.charLength = this.charReceived ? 3 : 0;
}

/***/ }),

/***/ "65V/":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var readerFor = __webpack_require__("Gquf");
var utils = __webpack_require__("71nt");
var CompressedObject = __webpack_require__("jbop");
var crc32fn = __webpack_require__("hKHw");
var utf8 = __webpack_require__("Ed4+");
var compressions = __webpack_require__("GfW5");
var support = __webpack_require__("oKij");

var MADE_BY_DOS = 0x00;
var MADE_BY_UNIX = 0x03;

/**
 * Find a compression registered in JSZip.
 * @param {string} compressionMethod the method magic to find.
 * @return {Object|null} the JSZip compression object, null if none found.
 */
var findCompression = function findCompression(compressionMethod) {
    for (var method in compressions) {
        if (!compressions.hasOwnProperty(method)) {
            continue;
        }
        if (compressions[method].magic === compressionMethod) {
            return compressions[method];
        }
    }
    return null;
};

// class ZipEntry {{{
/**
 * An entry in the zip file.
 * @constructor
 * @param {Object} options Options of the current file.
 * @param {Object} loadOptions Options for loading the stream.
 */
function ZipEntry(options, loadOptions) {
    this.options = options;
    this.loadOptions = loadOptions;
}
ZipEntry.prototype = {
    /**
     * say if the file is encrypted.
     * @return {boolean} true if the file is encrypted, false otherwise.
     */
    isEncrypted: function isEncrypted() {
        // bit 1 is set
        return (this.bitFlag & 0x0001) === 0x0001;
    },
    /**
     * say if the file has utf-8 filename/comment.
     * @return {boolean} true if the filename/comment is in utf-8, false otherwise.
     */
    useUTF8: function useUTF8() {
        // bit 11 is set
        return (this.bitFlag & 0x0800) === 0x0800;
    },
    /**
     * Read the local part of a zip file and add the info in this object.
     * @param {DataReader} reader the reader to use.
     */
    readLocalPart: function readLocalPart(reader) {
        var compression, localExtraFieldsLength;

        // we already know everything from the central dir !
        // If the central dir data are false, we are doomed.
        // On the bright side, the local part is scary  : zip64, data descriptors, both, etc.
        // The less data we get here, the more reliable this should be.
        // Let's skip the whole header and dash to the data !
        reader.skip(22);
        // in some zip created on windows, the filename stored in the central dir contains \ instead of /.
        // Strangely, the filename here is OK.
        // I would love to treat these zip files as corrupted (see http://www.info-zip.org/FAQ.html#backslashes
        // or APPNOTE#4.4.17.1, "All slashes MUST be forward slashes '/'") but there are a lot of bad zip generators...
        // Search "unzip mismatching "local" filename continuing with "central" filename version" on
        // the internet.
        //
        // I think I see the logic here : the central directory is used to display
        // content and the local directory is used to extract the files. Mixing / and \
        // may be used to display \ to windows users and use / when extracting the files.
        // Unfortunately, this lead also to some issues : http://seclists.org/fulldisclosure/2009/Sep/394
        this.fileNameLength = reader.readInt(2);
        localExtraFieldsLength = reader.readInt(2); // can't be sure this will be the same as the central dir
        // the fileName is stored as binary data, the handleUTF8 method will take care of the encoding.
        this.fileName = reader.readData(this.fileNameLength);
        reader.skip(localExtraFieldsLength);

        if (this.compressedSize === -1 || this.uncompressedSize === -1) {
            throw new Error("Bug or corrupted zip : didn't get enough informations from the central directory " + "(compressedSize === -1 || uncompressedSize === -1)");
        }

        compression = findCompression(this.compressionMethod);
        if (compression === null) {
            // no compression found
            throw new Error("Corrupted zip : compression " + utils.pretty(this.compressionMethod) + " unknown (inner file : " + utils.transformTo("string", this.fileName) + ")");
        }
        this.decompressed = new CompressedObject(this.compressedSize, this.uncompressedSize, this.crc32, compression, reader.readData(this.compressedSize));
    },

    /**
     * Read the central part of a zip file and add the info in this object.
     * @param {DataReader} reader the reader to use.
     */
    readCentralPart: function readCentralPart(reader) {
        this.versionMadeBy = reader.readInt(2);
        reader.skip(2);
        // this.versionNeeded = reader.readInt(2);
        this.bitFlag = reader.readInt(2);
        this.compressionMethod = reader.readString(2);
        this.date = reader.readDate();
        this.crc32 = reader.readInt(4);
        this.compressedSize = reader.readInt(4);
        this.uncompressedSize = reader.readInt(4);
        var fileNameLength = reader.readInt(2);
        this.extraFieldsLength = reader.readInt(2);
        this.fileCommentLength = reader.readInt(2);
        this.diskNumberStart = reader.readInt(2);
        this.internalFileAttributes = reader.readInt(2);
        this.externalFileAttributes = reader.readInt(4);
        this.localHeaderOffset = reader.readInt(4);

        if (this.isEncrypted()) {
            throw new Error("Encrypted zip are not supported");
        }

        // will be read in the local part, see the comments there
        reader.skip(fileNameLength);
        this.readExtraFields(reader);
        this.parseZIP64ExtraField(reader);
        this.fileComment = reader.readData(this.fileCommentLength);
    },

    /**
     * Parse the external file attributes and get the unix/dos permissions.
     */
    processAttributes: function processAttributes() {
        this.unixPermissions = null;
        this.dosPermissions = null;
        var madeBy = this.versionMadeBy >> 8;

        // Check if we have the DOS directory flag set.
        // We look for it in the DOS and UNIX permissions
        // but some unknown platform could set it as a compatibility flag.
        this.dir = this.externalFileAttributes & 0x0010 ? true : false;

        if (madeBy === MADE_BY_DOS) {
            // first 6 bits (0 to 5)
            this.dosPermissions = this.externalFileAttributes & 0x3F;
        }

        if (madeBy === MADE_BY_UNIX) {
            this.unixPermissions = this.externalFileAttributes >> 16 & 0xFFFF;
            // the octal permissions are in (this.unixPermissions & 0x01FF).toString(8);
        }

        // fail safe : if the name ends with a / it probably means a folder
        if (!this.dir && this.fileNameStr.slice(-1) === '/') {
            this.dir = true;
        }
    },

    /**
     * Parse the ZIP64 extra field and merge the info in the current ZipEntry.
     * @param {DataReader} reader the reader to use.
     */
    parseZIP64ExtraField: function parseZIP64ExtraField(reader) {

        if (!this.extraFields[0x0001]) {
            return;
        }

        // should be something, preparing the extra reader
        var extraReader = readerFor(this.extraFields[0x0001].value);

        // I really hope that these 64bits integer can fit in 32 bits integer, because js
        // won't let us have more.
        if (this.uncompressedSize === utils.MAX_VALUE_32BITS) {
            this.uncompressedSize = extraReader.readInt(8);
        }
        if (this.compressedSize === utils.MAX_VALUE_32BITS) {
            this.compressedSize = extraReader.readInt(8);
        }
        if (this.localHeaderOffset === utils.MAX_VALUE_32BITS) {
            this.localHeaderOffset = extraReader.readInt(8);
        }
        if (this.diskNumberStart === utils.MAX_VALUE_32BITS) {
            this.diskNumberStart = extraReader.readInt(4);
        }
    },
    /**
     * Read the central part of a zip file and add the info in this object.
     * @param {DataReader} reader the reader to use.
     */
    readExtraFields: function readExtraFields(reader) {
        var end = reader.index + this.extraFieldsLength,
            extraFieldId,
            extraFieldLength,
            extraFieldValue;

        if (!this.extraFields) {
            this.extraFields = {};
        }

        while (reader.index < end) {
            extraFieldId = reader.readInt(2);
            extraFieldLength = reader.readInt(2);
            extraFieldValue = reader.readData(extraFieldLength);

            this.extraFields[extraFieldId] = {
                id: extraFieldId,
                length: extraFieldLength,
                value: extraFieldValue
            };
        }
    },
    /**
     * Apply an UTF8 transformation if needed.
     */
    handleUTF8: function handleUTF8() {
        var decodeParamType = support.uint8array ? "uint8array" : "array";
        if (this.useUTF8()) {
            this.fileNameStr = utf8.utf8decode(this.fileName);
            this.fileCommentStr = utf8.utf8decode(this.fileComment);
        } else {
            var upath = this.findExtraFieldUnicodePath();
            if (upath !== null) {
                this.fileNameStr = upath;
            } else {
                // ASCII text or unsupported code page
                var fileNameByteArray = utils.transformTo(decodeParamType, this.fileName);
                this.fileNameStr = this.loadOptions.decodeFileName(fileNameByteArray);
            }

            var ucomment = this.findExtraFieldUnicodeComment();
            if (ucomment !== null) {
                this.fileCommentStr = ucomment;
            } else {
                // ASCII text or unsupported code page
                var commentByteArray = utils.transformTo(decodeParamType, this.fileComment);
                this.fileCommentStr = this.loadOptions.decodeFileName(commentByteArray);
            }
        }
    },

    /**
     * Find the unicode path declared in the extra field, if any.
     * @return {String} the unicode path, null otherwise.
     */
    findExtraFieldUnicodePath: function findExtraFieldUnicodePath() {
        var upathField = this.extraFields[0x7075];
        if (upathField) {
            var extraReader = readerFor(upathField.value);

            // wrong version
            if (extraReader.readInt(1) !== 1) {
                return null;
            }

            // the crc of the filename changed, this field is out of date.
            if (crc32fn(this.fileName) !== extraReader.readInt(4)) {
                return null;
            }

            return utf8.utf8decode(extraReader.readData(upathField.length - 5));
        }
        return null;
    },

    /**
     * Find the unicode comment declared in the extra field, if any.
     * @return {String} the unicode comment, null otherwise.
     */
    findExtraFieldUnicodeComment: function findExtraFieldUnicodeComment() {
        var ucommentField = this.extraFields[0x6375];
        if (ucommentField) {
            var extraReader = readerFor(ucommentField.value);

            // wrong version
            if (extraReader.readInt(1) !== 1) {
                return null;
            }

            // the crc of the comment changed, this field is out of date.
            if (crc32fn(this.fileComment) !== extraReader.readInt(4)) {
                return null;
            }

            return utf8.utf8decode(extraReader.readData(ucommentField.length - 5));
        }
        return null;
    }
};
module.exports = ZipEntry;

/***/ }),

/***/ "6ktE":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function GZheader() {
  /* true if compressed data believed to be text */
  this.text = 0;
  /* modification time */
  this.time = 0;
  /* extra flags (not used when writing a gzip file) */
  this.xflags = 0;
  /* operating system */
  this.os = 0;
  /* pointer to extra field or Z_NULL if none */
  this.extra = null;
  /* extra field length (valid if extra != Z_NULL) */
  this.extra_len = 0; // Actually, we don't need it in JS,
  // but leave for few code modifications

  //
  // Setup limits is not necessary because in js we should not preallocate memory
  // for inflate use constant limit in 65536 bytes
  //

  /* space at extra (only when reading header) */
  // this.extra_max  = 0;
  /* pointer to zero-terminated file name or Z_NULL */
  this.name = '';
  /* space at name (only when reading header) */
  // this.name_max   = 0;
  /* pointer to zero-terminated comment or Z_NULL */
  this.comment = '';
  /* space at comment (only when reading header) */
  // this.comm_max   = 0;
  /* true if there was or will be a header crc */
  this.hcrc = 0;
  /* true when done reading gzip header (not used when writing a gzip file) */
  this.done = false;
}

module.exports = GZheader;

/***/ }),

/***/ "71nt":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var support = __webpack_require__("oKij");
var base64 = __webpack_require__("hbB+");
var nodejsUtils = __webpack_require__("zgxx");
var setImmediate = __webpack_require__("yvBL");
var external = __webpack_require__("vVrn");

/**
 * Convert a string that pass as a "binary string": it should represent a byte
 * array but may have > 255 char codes. Be sure to take only the first byte
 * and returns the byte array.
 * @param {String} str the string to transform.
 * @return {Array|Uint8Array} the string in a binary format.
 */
function string2binary(str) {
    var result = null;
    if (support.uint8array) {
        result = new Uint8Array(str.length);
    } else {
        result = new Array(str.length);
    }
    return stringToArrayLike(str, result);
}

/**
 * Create a new blob with the given content and the given type.
 * @param {String|ArrayBuffer} part the content to put in the blob. DO NOT use
 * an Uint8Array because the stock browser of android 4 won't accept it (it
 * will be silently converted to a string, "[object Uint8Array]").
 *
 * Use only ONE part to build the blob to avoid a memory leak in IE11 / Edge:
 * when a large amount of Array is used to create the Blob, the amount of
 * memory consumed is nearly 100 times the original data amount.
 *
 * @param {String} type the mime type of the blob.
 * @return {Blob} the created blob.
 */
exports.newBlob = function (part, type) {
    exports.checkSupport("blob");

    try {
        // Blob constructor
        return new Blob([part], {
            type: type
        });
    } catch (e) {

        try {
            // deprecated, browser only, old way
            var Builder = self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder;
            var builder = new Builder();
            builder.append(part);
            return builder.getBlob(type);
        } catch (e) {

            // well, fuck ?!
            throw new Error("Bug : can't construct the Blob.");
        }
    }
};
/**
 * The identity function.
 * @param {Object} input the input.
 * @return {Object} the same input.
 */
function identity(input) {
    return input;
}

/**
 * Fill in an array with a string.
 * @param {String} str the string to use.
 * @param {Array|ArrayBuffer|Uint8Array|Buffer} array the array to fill in (will be mutated).
 * @return {Array|ArrayBuffer|Uint8Array|Buffer} the updated array.
 */
function stringToArrayLike(str, array) {
    for (var i = 0; i < str.length; ++i) {
        array[i] = str.charCodeAt(i) & 0xFF;
    }
    return array;
}

/**
 * An helper for the function arrayLikeToString.
 * This contains static informations and functions that
 * can be optimized by the browser JIT compiler.
 */
var arrayToStringHelper = {
    /**
     * Transform an array of int into a string, chunk by chunk.
     * See the performances notes on arrayLikeToString.
     * @param {Array|ArrayBuffer|Uint8Array|Buffer} array the array to transform.
     * @param {String} type the type of the array.
     * @param {Integer} chunk the chunk size.
     * @return {String} the resulting string.
     * @throws Error if the chunk is too big for the stack.
     */
    stringifyByChunk: function stringifyByChunk(array, type, chunk) {
        var result = [],
            k = 0,
            len = array.length;
        // shortcut
        if (len <= chunk) {
            return String.fromCharCode.apply(null, array);
        }
        while (k < len) {
            if (type === "array" || type === "nodebuffer") {
                result.push(String.fromCharCode.apply(null, array.slice(k, Math.min(k + chunk, len))));
            } else {
                result.push(String.fromCharCode.apply(null, array.subarray(k, Math.min(k + chunk, len))));
            }
            k += chunk;
        }
        return result.join("");
    },
    /**
     * Call String.fromCharCode on every item in the array.
     * This is the naive implementation, which generate A LOT of intermediate string.
     * This should be used when everything else fail.
     * @param {Array|ArrayBuffer|Uint8Array|Buffer} array the array to transform.
     * @return {String} the result.
     */
    stringifyByChar: function stringifyByChar(array) {
        var resultStr = "";
        for (var i = 0; i < array.length; i++) {
            resultStr += String.fromCharCode(array[i]);
        }
        return resultStr;
    },
    applyCanBeUsed: {
        /**
         * true if the browser accepts to use String.fromCharCode on Uint8Array
         */
        uint8array: function () {
            try {
                return support.uint8array && String.fromCharCode.apply(null, new Uint8Array(1)).length === 1;
            } catch (e) {
                return false;
            }
        }(),
        /**
         * true if the browser accepts to use String.fromCharCode on nodejs Buffer.
         */
        nodebuffer: function () {
            try {
                return support.nodebuffer && String.fromCharCode.apply(null, nodejsUtils.allocBuffer(1)).length === 1;
            } catch (e) {
                return false;
            }
        }()
    }
};

/**
 * Transform an array-like object to a string.
 * @param {Array|ArrayBuffer|Uint8Array|Buffer} array the array to transform.
 * @return {String} the result.
 */
function arrayLikeToString(array) {
    // Performances notes :
    // --------------------
    // String.fromCharCode.apply(null, array) is the fastest, see
    // see http://jsperf.com/converting-a-uint8array-to-a-string/2
    // but the stack is limited (and we can get huge arrays !).
    //
    // result += String.fromCharCode(array[i]); generate too many strings !
    //
    // This code is inspired by http://jsperf.com/arraybuffer-to-string-apply-performance/2
    // TODO : we now have workers that split the work. Do we still need that ?
    var chunk = 65536,
        type = exports.getTypeOf(array),
        canUseApply = true;
    if (type === "uint8array") {
        canUseApply = arrayToStringHelper.applyCanBeUsed.uint8array;
    } else if (type === "nodebuffer") {
        canUseApply = arrayToStringHelper.applyCanBeUsed.nodebuffer;
    }

    if (canUseApply) {
        while (chunk > 1) {
            try {
                return arrayToStringHelper.stringifyByChunk(array, type, chunk);
            } catch (e) {
                chunk = Math.floor(chunk / 2);
            }
        }
    }

    // no apply or chunk error : slow and painful algorithm
    // default browser on android 4.*
    return arrayToStringHelper.stringifyByChar(array);
}

exports.applyFromCharCode = arrayLikeToString;

/**
 * Copy the data from an array-like to an other array-like.
 * @param {Array|ArrayBuffer|Uint8Array|Buffer} arrayFrom the origin array.
 * @param {Array|ArrayBuffer|Uint8Array|Buffer} arrayTo the destination array which will be mutated.
 * @return {Array|ArrayBuffer|Uint8Array|Buffer} the updated destination array.
 */
function arrayLikeToArrayLike(arrayFrom, arrayTo) {
    for (var i = 0; i < arrayFrom.length; i++) {
        arrayTo[i] = arrayFrom[i];
    }
    return arrayTo;
}

// a matrix containing functions to transform everything into everything.
var transform = {};

// string to ?
transform["string"] = {
    "string": identity,
    "array": function array(input) {
        return stringToArrayLike(input, new Array(input.length));
    },
    "arraybuffer": function arraybuffer(input) {
        return transform["string"]["uint8array"](input).buffer;
    },
    "uint8array": function uint8array(input) {
        return stringToArrayLike(input, new Uint8Array(input.length));
    },
    "nodebuffer": function nodebuffer(input) {
        return stringToArrayLike(input, nodejsUtils.allocBuffer(input.length));
    }
};

// array to ?
transform["array"] = {
    "string": arrayLikeToString,
    "array": identity,
    "arraybuffer": function arraybuffer(input) {
        return new Uint8Array(input).buffer;
    },
    "uint8array": function uint8array(input) {
        return new Uint8Array(input);
    },
    "nodebuffer": function nodebuffer(input) {
        return nodejsUtils.newBufferFrom(input);
    }
};

// arraybuffer to ?
transform["arraybuffer"] = {
    "string": function string(input) {
        return arrayLikeToString(new Uint8Array(input));
    },
    "array": function array(input) {
        return arrayLikeToArrayLike(new Uint8Array(input), new Array(input.byteLength));
    },
    "arraybuffer": identity,
    "uint8array": function uint8array(input) {
        return new Uint8Array(input);
    },
    "nodebuffer": function nodebuffer(input) {
        return nodejsUtils.newBufferFrom(new Uint8Array(input));
    }
};

// uint8array to ?
transform["uint8array"] = {
    "string": arrayLikeToString,
    "array": function array(input) {
        return arrayLikeToArrayLike(input, new Array(input.length));
    },
    "arraybuffer": function arraybuffer(input) {
        return input.buffer;
    },
    "uint8array": identity,
    "nodebuffer": function nodebuffer(input) {
        return nodejsUtils.newBufferFrom(input);
    }
};

// nodebuffer to ?
transform["nodebuffer"] = {
    "string": arrayLikeToString,
    "array": function array(input) {
        return arrayLikeToArrayLike(input, new Array(input.length));
    },
    "arraybuffer": function arraybuffer(input) {
        return transform["nodebuffer"]["uint8array"](input).buffer;
    },
    "uint8array": function uint8array(input) {
        return arrayLikeToArrayLike(input, new Uint8Array(input.length));
    },
    "nodebuffer": identity
};

/**
 * Transform an input into any type.
 * The supported output type are : string, array, uint8array, arraybuffer, nodebuffer.
 * If no output type is specified, the unmodified input will be returned.
 * @param {String} outputType the output type.
 * @param {String|Array|ArrayBuffer|Uint8Array|Buffer} input the input to convert.
 * @throws {Error} an Error if the browser doesn't support the requested output type.
 */
exports.transformTo = function (outputType, input) {
    if (!input) {
        // undefined, null, etc
        // an empty string won't harm.
        input = "";
    }
    if (!outputType) {
        return input;
    }
    exports.checkSupport(outputType);
    var inputType = exports.getTypeOf(input);
    var result = transform[inputType][outputType](input);
    return result;
};

/**
 * Return the type of the input.
 * The type will be in a format valid for JSZip.utils.transformTo : string, array, uint8array, arraybuffer.
 * @param {Object} input the input to identify.
 * @return {String} the (lowercase) type of the input.
 */
exports.getTypeOf = function (input) {
    if (typeof input === "string") {
        return "string";
    }
    if (Object.prototype.toString.call(input) === "[object Array]") {
        return "array";
    }
    if (support.nodebuffer && nodejsUtils.isBuffer(input)) {
        return "nodebuffer";
    }
    if (support.uint8array && input instanceof Uint8Array) {
        return "uint8array";
    }
    if (support.arraybuffer && input instanceof ArrayBuffer) {
        return "arraybuffer";
    }
};

/**
 * Throw an exception if the type is not supported.
 * @param {String} type the type to check.
 * @throws {Error} an Error if the browser doesn't support the requested type.
 */
exports.checkSupport = function (type) {
    var supported = support[type.toLowerCase()];
    if (!supported) {
        throw new Error(type + " is not supported by this platform");
    }
};

exports.MAX_VALUE_16BITS = 65535;
exports.MAX_VALUE_32BITS = -1; // well, "\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF" is parsed as -1

/**
 * Prettify a string read as binary.
 * @param {string} str the string to prettify.
 * @return {string} a pretty string.
 */
exports.pretty = function (str) {
    var res = '',
        code,
        i;
    for (i = 0; i < (str || "").length; i++) {
        code = str.charCodeAt(i);
        res += '\\x' + (code < 16 ? "0" : "") + code.toString(16).toUpperCase();
    }
    return res;
};

/**
 * Defer the call of a function.
 * @param {Function} callback the function to call asynchronously.
 * @param {Array} args the arguments to give to the callback.
 */
exports.delay = function (callback, args, self) {
    setImmediate(function () {
        callback.apply(self || null, args || []);
    });
};

/**
 * Extends a prototype with an other, without calling a constructor with
 * side effects. Inspired by nodejs' `utils.inherits`
 * @param {Function} ctor the constructor to augment
 * @param {Function} superCtor the parent constructor to use
 */
exports.inherits = function (ctor, superCtor) {
    var Obj = function Obj() {};
    Obj.prototype = superCtor.prototype;
    ctor.prototype = new Obj();
};

/**
 * Merge the objects passed as parameters into a new one.
 * @private
 * @param {...Object} var_args All objects to merge.
 * @return {Object} a new object with the data of the others.
 */
exports.extend = function () {
    var result = {},
        i,
        attr;
    for (i = 0; i < arguments.length; i++) {
        // arguments is not enumerable in some browsers
        for (attr in arguments[i]) {
            if (arguments[i].hasOwnProperty(attr) && typeof result[attr] === "undefined") {
                result[attr] = arguments[i][attr];
            }
        }
    }
    return result;
};

/**
 * Transform arbitrary content into a Promise.
 * @param {String} name a name for the content being processed.
 * @param {Object} inputData the content to process.
 * @param {Boolean} isBinary true if the content is not an unicode string
 * @param {Boolean} isOptimizedBinaryString true if the string content only has one byte per character.
 * @param {Boolean} isBase64 true if the string content is encoded with base64.
 * @return {Promise} a promise in a format usable by JSZip.
 */
exports.prepareContent = function (name, inputData, isBinary, isOptimizedBinaryString, isBase64) {

    // if inputData is already a promise, this flatten it.
    var promise = external.Promise.resolve(inputData).then(function (data) {

        var isBlob = support.blob && (data instanceof Blob || ['[object File]', '[object Blob]'].indexOf(Object.prototype.toString.call(data)) !== -1);

        if (isBlob && typeof FileReader !== "undefined") {
            return new external.Promise(function (resolve, reject) {
                var reader = new FileReader();

                reader.onload = function (e) {
                    resolve(e.target.result);
                };
                reader.onerror = function (e) {
                    reject(e.target.error);
                };
                reader.readAsArrayBuffer(data);
            });
        } else {
            return data;
        }
    });

    return promise.then(function (data) {
        var dataType = exports.getTypeOf(data);

        if (!dataType) {
            return external.Promise.reject(new Error("Can't read the data of '" + name + "'. Is it " + "in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"));
        }
        // special case : it's way easier to work with Uint8Array than with ArrayBuffer
        if (dataType === "arraybuffer") {
            data = exports.transformTo("uint8array", data);
        } else if (dataType === "string") {
            if (isBase64) {
                data = base64.decode(data);
            } else if (isBinary) {
                // optimizedBinaryString === true means that the file has already been filtered with a 0xFF mask
                if (isOptimizedBinaryString !== true) {
                    // this is a string, not in a base64 format.
                    // Be sure that this is a correct "binary string"
                    data = string2binary(data);
                }
            }
        }
        return data;
    });
};

/***/ }),

/***/ "8FNI":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var USE_TYPEDARRAY = typeof Uint8Array !== 'undefined' && typeof Uint16Array !== 'undefined' && typeof Uint32Array !== 'undefined';

var pako = __webpack_require__("xe4/");
var utils = __webpack_require__("71nt");
var GenericWorker = __webpack_require__("bxoG");

var ARRAY_TYPE = USE_TYPEDARRAY ? "uint8array" : "array";

exports.magic = "\x08\x00";

/**
 * Create a worker that uses pako to inflate/deflate.
 * @constructor
 * @param {String} action the name of the pako function to call : either "Deflate" or "Inflate".
 * @param {Object} options the options to use when (de)compressing.
 */
function FlateWorker(action, options) {
    GenericWorker.call(this, "FlateWorker/" + action);

    this._pako = null;
    this._pakoAction = action;
    this._pakoOptions = options;
    // the `meta` object from the last chunk received
    // this allow this worker to pass around metadata
    this.meta = {};
}

utils.inherits(FlateWorker, GenericWorker);

/**
 * @see GenericWorker.processChunk
 */
FlateWorker.prototype.processChunk = function (chunk) {
    this.meta = chunk.meta;
    if (this._pako === null) {
        this._createPako();
    }
    this._pako.push(utils.transformTo(ARRAY_TYPE, chunk.data), false);
};

/**
 * @see GenericWorker.flush
 */
FlateWorker.prototype.flush = function () {
    GenericWorker.prototype.flush.call(this);
    if (this._pako === null) {
        this._createPako();
    }
    this._pako.push([], true);
};
/**
 * @see GenericWorker.cleanUp
 */
FlateWorker.prototype.cleanUp = function () {
    GenericWorker.prototype.cleanUp.call(this);
    this._pako = null;
};

/**
 * Create the _pako object.
 * TODO: lazy-loading this object isn't the best solution but it's the
 * quickest. The best solution is to lazy-load the worker list. See also the
 * issue #446.
 */
FlateWorker.prototype._createPako = function () {
    this._pako = new pako[this._pakoAction]({
        raw: true,
        level: this._pakoOptions.level || -1 // default compression
    });
    var self = this;
    this._pako.onData = function (data) {
        self.push({
            data: data,
            meta: self.meta
        });
    };
};

exports.compressWorker = function (compressionOptions) {
    return new FlateWorker("Deflate", compressionOptions);
};
exports.uncompressWorker = function () {
    return new FlateWorker("Inflate", {});
};

/***/ }),

/***/ "8vkY":
/***/ (function(module, exports, __webpack_require__) {

var isObject = __webpack_require__("LFbK"),
    document = __webpack_require__("39Rf").document
// in old IE typeof document.createElement is 'object'
,
    is = isObject(document) && isObject(document.createElement);
module.exports = function (it) {
  return is ? document.createElement(it) : {};
};

/***/ }),

/***/ "97RM":
/***/ (function(module, exports) {

module.exports = require("stream");

/***/ }),

/***/ "9F63":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var DataReader = __webpack_require__("MXSK");
var utils = __webpack_require__("71nt");

function StringReader(data) {
    DataReader.call(this, data);
}
utils.inherits(StringReader, DataReader);
/**
 * @see DataReader.byteAt
 */
StringReader.prototype.byteAt = function (i) {
    return this.data.charCodeAt(this.zero + i);
};
/**
 * @see DataReader.lastIndexOfSignature
 */
StringReader.prototype.lastIndexOfSignature = function (sig) {
    return this.data.lastIndexOf(sig) - this.zero;
};
/**
 * @see DataReader.readAndCheckSignature
 */
StringReader.prototype.readAndCheckSignature = function (sig) {
    var data = this.readData(4);
    return sig === data;
};
/**
 * @see DataReader.readData
 */
StringReader.prototype.readData = function (size) {
    this.checkOffset(size);
    // this will work because the constructor applied the "& 0xff" mask.
    var result = this.data.slice(this.zero + this.index, this.zero + this.index + size);
    this.index += size;
    return result;
};
module.exports = StringReader;

/***/ }),

/***/ "AI/p":
/***/ (function(module, exports, __webpack_require__) {

// 7.1.1 ToPrimitive(input [, PreferredType])
var isObject = __webpack_require__("LFbK");
// instead of the ES6 spec version, we didn't implement @@toPrimitive case
// and the second argument - flag - preferred type is a string
module.exports = function (it, S) {
  if (!isObject(it)) return it;
  var fn, val;
  if (S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it))) return val;
  if (typeof (fn = it.valueOf) == 'function' && !isObject(val = fn.call(it))) return val;
  if (!S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it))) return val;
  throw TypeError("Can't convert object to primitive value");
};

/***/ }),

/***/ "BT+d":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__("71nt");
var external = __webpack_require__("vVrn");
var utf8 = __webpack_require__("Ed4+");
var utils = __webpack_require__("71nt");
var ZipEntries = __webpack_require__("f1Cs");
var Crc32Probe = __webpack_require__("u5ky");
var nodejsUtils = __webpack_require__("zgxx");

/**
 * Check the CRC32 of an entry.
 * @param {ZipEntry} zipEntry the zip entry to check.
 * @return {Promise} the result.
 */
function checkEntryCRC32(zipEntry) {
    return new external.Promise(function (resolve, reject) {
        var worker = zipEntry.decompressed.getContentWorker().pipe(new Crc32Probe());
        worker.on("error", function (e) {
            reject(e);
        }).on("end", function () {
            if (worker.streamInfo.crc32 !== zipEntry.decompressed.crc32) {
                reject(new Error("Corrupted zip : CRC32 mismatch"));
            } else {
                resolve();
            }
        }).resume();
    });
}

module.exports = function (data, options) {
    var zip = this;
    options = utils.extend(options || {}, {
        base64: false,
        checkCRC32: false,
        optimizedBinaryString: false,
        createFolders: false,
        decodeFileName: utf8.utf8decode
    });

    if (nodejsUtils.isNode && nodejsUtils.isStream(data)) {
        return external.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file."));
    }

    return utils.prepareContent("the loaded zip file", data, true, options.optimizedBinaryString, options.base64).then(function (data) {
        var zipEntries = new ZipEntries(options);
        zipEntries.load(data);
        return zipEntries;
    }).then(function checkCRC32(zipEntries) {
        var promises = [external.Promise.resolve(zipEntries)];
        var files = zipEntries.files;
        if (options.checkCRC32) {
            for (var i = 0; i < files.length; i++) {
                promises.push(checkEntryCRC32(files[i]));
            }
        }
        return external.Promise.all(promises);
    }).then(function addFiles(results) {
        var zipEntries = results.shift();
        var files = zipEntries.files;
        for (var i = 0; i < files.length; i++) {
            var input = files[i];
            zip.file(input.fileNameStr, input.decompressed, {
                binary: true,
                optimizedBinaryString: true,
                date: input.date,
                dir: input.dir,
                comment: input.fileCommentStr.length ? input.fileCommentStr : null,
                unixPermissions: input.unixPermissions,
                dosPermissions: input.dosPermissions,
                createFolders: options.createFolders
            });
        }
        if (zipEntries.zipComment.length) {
            zip.comment = zipEntries.zipComment;
        }

        return zip;
    });
};

/***/ }),

/***/ "Bcfi":
/***/ (function(module, exports) {

module.exports = require("util");

/***/ }),

/***/ "CcWG":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__("71nt");
var GenericWorker = __webpack_require__("bxoG");
var utf8 = __webpack_require__("Ed4+");
var crc32 = __webpack_require__("hKHw");
var signature = __webpack_require__("j3u2");

/**
 * Transform an integer into a string in hexadecimal.
 * @private
 * @param {number} dec the number to convert.
 * @param {number} bytes the number of bytes to generate.
 * @returns {string} the result.
 */
var decToHex = function decToHex(dec, bytes) {
    var hex = "",
        i;
    for (i = 0; i < bytes; i++) {
        hex += String.fromCharCode(dec & 0xff);
        dec = dec >>> 8;
    }
    return hex;
};

/**
 * Generate the UNIX part of the external file attributes.
 * @param {Object} unixPermissions the unix permissions or null.
 * @param {Boolean} isDir true if the entry is a directory, false otherwise.
 * @return {Number} a 32 bit integer.
 *
 * adapted from http://unix.stackexchange.com/questions/14705/the-zip-formats-external-file-attribute :
 *
 * TTTTsstrwxrwxrwx0000000000ADVSHR
 * ^^^^____________________________ file type, see zipinfo.c (UNX_*)
 *     ^^^_________________________ setuid, setgid, sticky
 *        ^^^^^^^^^________________ permissions
 *                 ^^^^^^^^^^______ not used ?
 *                           ^^^^^^ DOS attribute bits : Archive, Directory, Volume label, System file, Hidden, Read only
 */
var generateUnixExternalFileAttr = function generateUnixExternalFileAttr(unixPermissions, isDir) {

    var result = unixPermissions;
    if (!unixPermissions) {
        // I can't use octal values in strict mode, hence the hexa.
        //  040775 => 0x41fd
        // 0100664 => 0x81b4
        result = isDir ? 0x41fd : 0x81b4;
    }
    return (result & 0xFFFF) << 16;
};

/**
 * Generate the DOS part of the external file attributes.
 * @param {Object} dosPermissions the dos permissions or null.
 * @param {Boolean} isDir true if the entry is a directory, false otherwise.
 * @return {Number} a 32 bit integer.
 *
 * Bit 0     Read-Only
 * Bit 1     Hidden
 * Bit 2     System
 * Bit 3     Volume Label
 * Bit 4     Directory
 * Bit 5     Archive
 */
var generateDosExternalFileAttr = function generateDosExternalFileAttr(dosPermissions, isDir) {

    // the dir flag is already set for compatibility
    return (dosPermissions || 0) & 0x3F;
};

/**
 * Generate the various parts used in the construction of the final zip file.
 * @param {Object} streamInfo the hash with informations about the compressed file.
 * @param {Boolean} streamedContent is the content streamed ?
 * @param {Boolean} streamingEnded is the stream finished ?
 * @param {number} offset the current offset from the start of the zip file.
 * @param {String} platform let's pretend we are this platform (change platform dependents fields)
 * @param {Function} encodeFileName the function to encode the file name / comment.
 * @return {Object} the zip parts.
 */
var generateZipParts = function generateZipParts(streamInfo, streamedContent, streamingEnded, offset, platform, encodeFileName) {
    var file = streamInfo['file'],
        compression = streamInfo['compression'],
        useCustomEncoding = encodeFileName !== utf8.utf8encode,
        encodedFileName = utils.transformTo("string", encodeFileName(file.name)),
        utfEncodedFileName = utils.transformTo("string", utf8.utf8encode(file.name)),
        comment = file.comment,
        encodedComment = utils.transformTo("string", encodeFileName(comment)),
        utfEncodedComment = utils.transformTo("string", utf8.utf8encode(comment)),
        useUTF8ForFileName = utfEncodedFileName.length !== file.name.length,
        useUTF8ForComment = utfEncodedComment.length !== comment.length,
        dosTime,
        dosDate,
        extraFields = "",
        unicodePathExtraField = "",
        unicodeCommentExtraField = "",
        dir = file.dir,
        date = file.date;

    var dataInfo = {
        crc32: 0,
        compressedSize: 0,
        uncompressedSize: 0
    };

    // if the content is streamed, the sizes/crc32 are only available AFTER
    // the end of the stream.
    if (!streamedContent || streamingEnded) {
        dataInfo.crc32 = streamInfo['crc32'];
        dataInfo.compressedSize = streamInfo['compressedSize'];
        dataInfo.uncompressedSize = streamInfo['uncompressedSize'];
    }

    var bitflag = 0;
    if (streamedContent) {
        // Bit 3: the sizes/crc32 are set to zero in the local header.
        // The correct values are put in the data descriptor immediately
        // following the compressed data.
        bitflag |= 0x0008;
    }
    if (!useCustomEncoding && (useUTF8ForFileName || useUTF8ForComment)) {
        // Bit 11: Language encoding flag (EFS).
        bitflag |= 0x0800;
    }

    var extFileAttr = 0;
    var versionMadeBy = 0;
    if (dir) {
        // dos or unix, we set the dos dir flag
        extFileAttr |= 0x00010;
    }
    if (platform === "UNIX") {
        versionMadeBy = 0x031E; // UNIX, version 3.0
        extFileAttr |= generateUnixExternalFileAttr(file.unixPermissions, dir);
    } else {
        // DOS or other, fallback to DOS
        versionMadeBy = 0x0014; // DOS, version 2.0
        extFileAttr |= generateDosExternalFileAttr(file.dosPermissions, dir);
    }

    // date
    // @see http://www.delorie.com/djgpp/doc/rbinter/it/52/13.html
    // @see http://www.delorie.com/djgpp/doc/rbinter/it/65/16.html
    // @see http://www.delorie.com/djgpp/doc/rbinter/it/66/16.html

    dosTime = date.getUTCHours();
    dosTime = dosTime << 6;
    dosTime = dosTime | date.getUTCMinutes();
    dosTime = dosTime << 5;
    dosTime = dosTime | date.getUTCSeconds() / 2;

    dosDate = date.getUTCFullYear() - 1980;
    dosDate = dosDate << 4;
    dosDate = dosDate | date.getUTCMonth() + 1;
    dosDate = dosDate << 5;
    dosDate = dosDate | date.getUTCDate();

    if (useUTF8ForFileName) {
        // set the unicode path extra field. unzip needs at least one extra
        // field to correctly handle unicode path, so using the path is as good
        // as any other information. This could improve the situation with
        // other archive managers too.
        // This field is usually used without the utf8 flag, with a non
        // unicode path in the header (winrar, winzip). This helps (a bit)
        // with the messy Windows' default compressed folders feature but
        // breaks on p7zip which doesn't seek the unicode path extra field.
        // So for now, UTF-8 everywhere !
        unicodePathExtraField =
        // Version
        decToHex(1, 1) +
        // NameCRC32
        decToHex(crc32(encodedFileName), 4) +
        // UnicodeName
        utfEncodedFileName;

        extraFields +=
        // Info-ZIP Unicode Path Extra Field
        "\x75\x70" +
        // size
        decToHex(unicodePathExtraField.length, 2) +
        // content
        unicodePathExtraField;
    }

    if (useUTF8ForComment) {

        unicodeCommentExtraField =
        // Version
        decToHex(1, 1) +
        // CommentCRC32
        decToHex(crc32(encodedComment), 4) +
        // UnicodeName
        utfEncodedComment;

        extraFields +=
        // Info-ZIP Unicode Path Extra Field
        "\x75\x63" +
        // size
        decToHex(unicodeCommentExtraField.length, 2) +
        // content
        unicodeCommentExtraField;
    }

    var header = "";

    // version needed to extract
    header += "\x0A\x00";
    // general purpose bit flag
    header += decToHex(bitflag, 2);
    // compression method
    header += compression.magic;
    // last mod file time
    header += decToHex(dosTime, 2);
    // last mod file date
    header += decToHex(dosDate, 2);
    // crc-32
    header += decToHex(dataInfo.crc32, 4);
    // compressed size
    header += decToHex(dataInfo.compressedSize, 4);
    // uncompressed size
    header += decToHex(dataInfo.uncompressedSize, 4);
    // file name length
    header += decToHex(encodedFileName.length, 2);
    // extra field length
    header += decToHex(extraFields.length, 2);

    var fileRecord = signature.LOCAL_FILE_HEADER + header + encodedFileName + extraFields;

    var dirRecord = signature.CENTRAL_FILE_HEADER +
    // version made by (00: DOS)
    decToHex(versionMadeBy, 2) +
    // file header (common to file and central directory)
    header +
    // file comment length
    decToHex(encodedComment.length, 2) +
    // disk number start
    "\x00\x00" +
    // internal file attributes TODO
    "\x00\x00" +
    // external file attributes
    decToHex(extFileAttr, 4) +
    // relative offset of local header
    decToHex(offset, 4) +
    // file name
    encodedFileName +
    // extra field
    extraFields +
    // file comment
    encodedComment;

    return {
        fileRecord: fileRecord,
        dirRecord: dirRecord
    };
};

/**
 * Generate the EOCD record.
 * @param {Number} entriesCount the number of entries in the zip file.
 * @param {Number} centralDirLength the length (in bytes) of the central dir.
 * @param {Number} localDirLength the length (in bytes) of the local dir.
 * @param {String} comment the zip file comment as a binary string.
 * @param {Function} encodeFileName the function to encode the comment.
 * @return {String} the EOCD record.
 */
var generateCentralDirectoryEnd = function generateCentralDirectoryEnd(entriesCount, centralDirLength, localDirLength, comment, encodeFileName) {
    var dirEnd = "";
    var encodedComment = utils.transformTo("string", encodeFileName(comment));

    // end of central dir signature
    dirEnd = signature.CENTRAL_DIRECTORY_END +
    // number of this disk
    "\x00\x00" +
    // number of the disk with the start of the central directory
    "\x00\x00" +
    // total number of entries in the central directory on this disk
    decToHex(entriesCount, 2) +
    // total number of entries in the central directory
    decToHex(entriesCount, 2) +
    // size of the central directory   4 bytes
    decToHex(centralDirLength, 4) +
    // offset of start of central directory with respect to the starting disk number
    decToHex(localDirLength, 4) +
    // .ZIP file comment length
    decToHex(encodedComment.length, 2) +
    // .ZIP file comment
    encodedComment;

    return dirEnd;
};

/**
 * Generate data descriptors for a file entry.
 * @param {Object} streamInfo the hash generated by a worker, containing informations
 * on the file entry.
 * @return {String} the data descriptors.
 */
var generateDataDescriptors = function generateDataDescriptors(streamInfo) {
    var descriptor = "";
    descriptor = signature.DATA_DESCRIPTOR +
    // crc-32                          4 bytes
    decToHex(streamInfo['crc32'], 4) +
    // compressed size                 4 bytes
    decToHex(streamInfo['compressedSize'], 4) +
    // uncompressed size               4 bytes
    decToHex(streamInfo['uncompressedSize'], 4);

    return descriptor;
};

/**
 * A worker to concatenate other workers to create a zip file.
 * @param {Boolean} streamFiles `true` to stream the content of the files,
 * `false` to accumulate it.
 * @param {String} comment the comment to use.
 * @param {String} platform the platform to use, "UNIX" or "DOS".
 * @param {Function} encodeFileName the function to encode file names and comments.
 */
function ZipFileWorker(streamFiles, comment, platform, encodeFileName) {
    GenericWorker.call(this, "ZipFileWorker");
    // The number of bytes written so far. This doesn't count accumulated chunks.
    this.bytesWritten = 0;
    // The comment of the zip file
    this.zipComment = comment;
    // The platform "generating" the zip file.
    this.zipPlatform = platform;
    // the function to encode file names and comments.
    this.encodeFileName = encodeFileName;
    // Should we stream the content of the files ?
    this.streamFiles = streamFiles;
    // If `streamFiles` is false, we will need to accumulate the content of the
    // files to calculate sizes / crc32 (and write them *before* the content).
    // This boolean indicates if we are accumulating chunks (it will change a lot
    // during the lifetime of this worker).
    this.accumulate = false;
    // The buffer receiving chunks when accumulating content.
    this.contentBuffer = [];
    // The list of generated directory records.
    this.dirRecords = [];
    // The offset (in bytes) from the beginning of the zip file for the current source.
    this.currentSourceOffset = 0;
    // The total number of entries in this zip file.
    this.entriesCount = 0;
    // the name of the file currently being added, null when handling the end of the zip file.
    // Used for the emited metadata.
    this.currentFile = null;

    this._sources = [];
}
utils.inherits(ZipFileWorker, GenericWorker);

/**
 * @see GenericWorker.push
 */
ZipFileWorker.prototype.push = function (chunk) {

    var currentFilePercent = chunk.meta.percent || 0;
    var entriesCount = this.entriesCount;
    var remainingFiles = this._sources.length;

    if (this.accumulate) {
        this.contentBuffer.push(chunk);
    } else {
        this.bytesWritten += chunk.data.length;

        GenericWorker.prototype.push.call(this, {
            data: chunk.data,
            meta: {
                currentFile: this.currentFile,
                percent: entriesCount ? (currentFilePercent + 100 * (entriesCount - remainingFiles - 1)) / entriesCount : 100
            }
        });
    }
};

/**
 * The worker started a new source (an other worker).
 * @param {Object} streamInfo the streamInfo object from the new source.
 */
ZipFileWorker.prototype.openedSource = function (streamInfo) {
    this.currentSourceOffset = this.bytesWritten;
    this.currentFile = streamInfo['file'].name;

    var streamedContent = this.streamFiles && !streamInfo['file'].dir;

    // don't stream folders (because they don't have any content)
    if (streamedContent) {
        var record = generateZipParts(streamInfo, streamedContent, false, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
        this.push({
            data: record.fileRecord,
            meta: { percent: 0 }
        });
    } else {
        // we need to wait for the whole file before pushing anything
        this.accumulate = true;
    }
};

/**
 * The worker finished a source (an other worker).
 * @param {Object} streamInfo the streamInfo object from the finished source.
 */
ZipFileWorker.prototype.closedSource = function (streamInfo) {
    this.accumulate = false;
    var streamedContent = this.streamFiles && !streamInfo['file'].dir;
    var record = generateZipParts(streamInfo, streamedContent, true, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);

    this.dirRecords.push(record.dirRecord);
    if (streamedContent) {
        // after the streamed file, we put data descriptors
        this.push({
            data: generateDataDescriptors(streamInfo),
            meta: { percent: 100 }
        });
    } else {
        // the content wasn't streamed, we need to push everything now
        // first the file record, then the content
        this.push({
            data: record.fileRecord,
            meta: { percent: 0 }
        });
        while (this.contentBuffer.length) {
            this.push(this.contentBuffer.shift());
        }
    }
    this.currentFile = null;
};

/**
 * @see GenericWorker.flush
 */
ZipFileWorker.prototype.flush = function () {

    var localDirLength = this.bytesWritten;
    for (var i = 0; i < this.dirRecords.length; i++) {
        this.push({
            data: this.dirRecords[i],
            meta: { percent: 100 }
        });
    }
    var centralDirLength = this.bytesWritten - localDirLength;

    var dirEnd = generateCentralDirectoryEnd(this.dirRecords.length, centralDirLength, localDirLength, this.zipComment, this.encodeFileName);

    this.push({
        data: dirEnd,
        meta: { percent: 100 }
    });
};

/**
 * Prepare the next source to be read.
 */
ZipFileWorker.prototype.prepareNextSource = function () {
    this.previous = this._sources.shift();
    this.openedSource(this.previous.streamInfo);
    if (this.isPaused) {
        this.previous.pause();
    } else {
        this.previous.resume();
    }
};

/**
 * @see GenericWorker.registerPrevious
 */
ZipFileWorker.prototype.registerPrevious = function (previous) {
    this._sources.push(previous);
    var self = this;

    previous.on('data', function (chunk) {
        self.processChunk(chunk);
    });
    previous.on('end', function () {
        self.closedSource(self.previous.streamInfo);
        if (self._sources.length) {
            self.prepareNextSource();
        } else {
            self.end();
        }
    });
    previous.on('error', function (e) {
        self.error(e);
    });
    return this;
};

/**
 * @see GenericWorker.resume
 */
ZipFileWorker.prototype.resume = function () {
    if (!GenericWorker.prototype.resume.call(this)) {
        return false;
    }

    if (!this.previous && this._sources.length) {
        this.prepareNextSource();
        return true;
    }
    if (!this.previous && !this._sources.length && !this.generatedError) {
        this.end();
        return true;
    }
};

/**
 * @see GenericWorker.error
 */
ZipFileWorker.prototype.error = function (e) {
    var sources = this._sources;
    if (!GenericWorker.prototype.error.call(this, e)) {
        return false;
    }
    for (var i = 0; i < sources.length; i++) {
        try {
            sources[i].error(e);
        } catch (e) {
            // the `error` exploded, nothing to do
        }
    }
    return true;
};

/**
 * @see GenericWorker.lock
 */
ZipFileWorker.prototype.lock = function () {
    GenericWorker.prototype.lock.call(this);
    var sources = this._sources;
    for (var i = 0; i < sources.length; i++) {
        sources[i].lock();
    }
};

module.exports = ZipFileWorker;

/***/ }),

/***/ "CpFU":
/***/ (function(module, exports, __webpack_require__) {

var Stream = function () {
  try {
    return __webpack_require__("97RM"); // hack to fix a circular dependency issue when used with browserify
  } catch (_) {}
}();
exports = module.exports = __webpack_require__("aw5X");
exports.Stream = Stream || exports;
exports.Readable = exports;
exports.Writable = __webpack_require__("xTyK");
exports.Duplex = __webpack_require__("g3Lj");
exports.Transform = __webpack_require__("UfYs");
exports.PassThrough = __webpack_require__("3vxC");

/***/ }),

/***/ "D8Rn":
/***/ (function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ }),

/***/ "EBst":
/***/ (function(module, exports, __webpack_require__) {

!function () {
  "use strict";
  function e() {}function t(t, n) {
    var o,
        r,
        i,
        l,
        a = E;for (l = arguments.length; l-- > 2;) {
      W.push(arguments[l]);
    }n && null != n.children && (W.length || W.push(n.children), delete n.children);while (W.length) {
      if ((r = W.pop()) && void 0 !== r.pop) for (l = r.length; l--;) {
        W.push(r[l]);
      } else "boolean" == typeof r && (r = null), (i = "function" != typeof t) && (null == r ? r = "" : "number" == typeof r ? r += "" : "string" != typeof r && (i = !1)), i && o ? a[a.length - 1] += r : a === E ? a = [r] : a.push(r), o = i;
    }var u = new e();return u.nodeName = t, u.children = a, u.attributes = null == n ? void 0 : n, u.key = null == n ? void 0 : n.key, void 0 !== S.vnode && S.vnode(u), u;
  }function n(e, t) {
    for (var n in t) {
      e[n] = t[n];
    }return e;
  }function o(e, o) {
    return t(e.nodeName, n(n({}, e.attributes), o), arguments.length > 2 ? [].slice.call(arguments, 2) : e.children);
  }function r(e) {
    !e.__d && (e.__d = !0) && 1 == A.push(e) && (S.debounceRendering || P)(i);
  }function i() {
    var e,
        t = A;A = [];while (e = t.pop()) {
      e.__d && k(e);
    }
  }function l(e, t, n) {
    return "string" == typeof t || "number" == typeof t ? void 0 !== e.splitText : "string" == typeof t.nodeName ? !e._componentConstructor && a(e, t.nodeName) : n || e._componentConstructor === t.nodeName;
  }function a(e, t) {
    return e.__n === t || e.nodeName.toLowerCase() === t.toLowerCase();
  }function u(e) {
    var t = n({}, e.attributes);t.children = e.children;var o = e.nodeName.defaultProps;if (void 0 !== o) for (var r in o) {
      void 0 === t[r] && (t[r] = o[r]);
    }return t;
  }function _(e, t) {
    var n = t ? document.createElementNS("http://www.w3.org/2000/svg", e) : document.createElement(e);return n.__n = e, n;
  }function p(e) {
    var t = e.parentNode;t && t.removeChild(e);
  }function c(e, t, n, o, r) {
    if ("className" === t && (t = "class"), "key" === t) ;else if ("ref" === t) n && n(null), o && o(e);else if ("class" !== t || r) {
      if ("style" === t) {
        if (o && "string" != typeof o && "string" != typeof n || (e.style.cssText = o || ""), o && "object" == typeof o) {
          if ("string" != typeof n) for (var i in n) {
            i in o || (e.style[i] = "");
          }for (var i in o) {
            e.style[i] = "number" == typeof o[i] && !1 === V.test(i) ? o[i] + "px" : o[i];
          }
        }
      } else if ("dangerouslySetInnerHTML" === t) o && (e.innerHTML = o.__html || "");else if ("o" == t[0] && "n" == t[1]) {
        var l = t !== (t = t.replace(/Capture$/, ""));t = t.toLowerCase().substring(2), o ? n || e.addEventListener(t, f, l) : e.removeEventListener(t, f, l), (e.__l || (e.__l = {}))[t] = o;
      } else if ("list" !== t && "type" !== t && !r && t in e) s(e, t, null == o ? "" : o), null != o && !1 !== o || e.removeAttribute(t);else {
        var a = r && t !== (t = t.replace(/^xlink\:?/, ""));null == o || !1 === o ? a ? e.removeAttributeNS("http://www.w3.org/1999/xlink", t.toLowerCase()) : e.removeAttribute(t) : "function" != typeof o && (a ? e.setAttributeNS("http://www.w3.org/1999/xlink", t.toLowerCase(), o) : e.setAttribute(t, o));
      }
    } else e.className = o || "";
  }function s(e, t, n) {
    try {
      e[t] = n;
    } catch (e) {}
  }function f(e) {
    return this.__l[e.type](S.event && S.event(e) || e);
  }function d() {
    var e;while (e = D.pop()) {
      S.afterMount && S.afterMount(e), e.componentDidMount && e.componentDidMount();
    }
  }function h(e, t, n, o, r, i) {
    H++ || (R = null != r && void 0 !== r.ownerSVGElement, j = null != e && !("__preactattr_" in e));var l = m(e, t, n, o, i);return r && l.parentNode !== r && r.appendChild(l), --H || (j = !1, i || d()), l;
  }function m(e, t, n, o, r) {
    var i = e,
        l = R;if (null != t && "boolean" != typeof t || (t = ""), "string" == typeof t || "number" == typeof t) return e && void 0 !== e.splitText && e.parentNode && (!e._component || r) ? e.nodeValue != t && (e.nodeValue = t) : (i = document.createTextNode(t), e && (e.parentNode && e.parentNode.replaceChild(i, e), b(e, !0))), i.__preactattr_ = !0, i;var u = t.nodeName;if ("function" == typeof u) return U(e, t, n, o);if (R = "svg" === u || "foreignObject" !== u && R, u += "", (!e || !a(e, u)) && (i = _(u, R), e)) {
      while (e.firstChild) {
        i.appendChild(e.firstChild);
      }e.parentNode && e.parentNode.replaceChild(i, e), b(e, !0);
    }var p = i.firstChild,
        c = i.__preactattr_,
        s = t.children;if (null == c) {
      c = i.__preactattr_ = {};for (var f = i.attributes, d = f.length; d--;) {
        c[f[d].name] = f[d].value;
      }
    }return !j && s && 1 === s.length && "string" == typeof s[0] && null != p && void 0 !== p.splitText && null == p.nextSibling ? p.nodeValue != s[0] && (p.nodeValue = s[0]) : (s && s.length || null != p) && v(i, s, n, o, j || null != c.dangerouslySetInnerHTML), g(i, t.attributes, c), R = l, i;
  }function v(e, t, n, o, r) {
    var i,
        a,
        u,
        _,
        c,
        s = e.childNodes,
        f = [],
        d = {},
        h = 0,
        v = 0,
        y = s.length,
        g = 0,
        w = t ? t.length : 0;if (0 !== y) for (var C = 0; C < y; C++) {
      var x = s[C],
          N = x.__preactattr_,
          k = w && N ? x._component ? x._component.__k : N.key : null;null != k ? (h++, d[k] = x) : (N || (void 0 !== x.splitText ? !r || x.nodeValue.trim() : r)) && (f[g++] = x);
    }if (0 !== w) for (var C = 0; C < w; C++) {
      _ = t[C], c = null;var k = _.key;if (null != k) h && void 0 !== d[k] && (c = d[k], d[k] = void 0, h--);else if (!c && v < g) for (i = v; i < g; i++) {
        if (void 0 !== f[i] && l(a = f[i], _, r)) {
          c = a, f[i] = void 0, i === g - 1 && g--, i === v && v++;break;
        }
      }c = m(c, _, n, o), u = s[C], c && c !== e && c !== u && (null == u ? e.appendChild(c) : c === u.nextSibling ? p(u) : e.insertBefore(c, u));
    }if (h) for (var C in d) {
      void 0 !== d[C] && b(d[C], !1);
    }while (v <= g) {
      void 0 !== (c = f[g--]) && b(c, !1);
    }
  }function b(e, t) {
    var n = e._component;n ? L(n) : (null != e.__preactattr_ && e.__preactattr_.ref && e.__preactattr_.ref(null), !1 !== t && null != e.__preactattr_ || p(e), y(e));
  }function y(e) {
    e = e.lastChild;while (e) {
      var t = e.previousSibling;b(e, !0), e = t;
    }
  }function g(e, t, n) {
    var o;for (o in n) {
      t && null != t[o] || null == n[o] || c(e, o, n[o], n[o] = void 0, R);
    }for (o in t) {
      "children" === o || "innerHTML" === o || o in n && t[o] === ("value" === o || "checked" === o ? e[o] : n[o]) || c(e, o, n[o], n[o] = t[o], R);
    }
  }function w(e) {
    var t = e.constructor.name;(I[t] || (I[t] = [])).push(e);
  }function C(e, t, n) {
    var o,
        r = I[e.name];if (e.prototype && e.prototype.render ? (o = new e(t, n), T.call(o, t, n)) : (o = new T(t, n), o.constructor = e, o.render = x), r) for (var i = r.length; i--;) {
      if (r[i].constructor === e) {
        o.__b = r[i].__b, r.splice(i, 1);break;
      }
    }return o;
  }function x(e, t, n) {
    return this.constructor(e, n);
  }function N(e, t, n, o, i) {
    e.__x || (e.__x = !0, (e.__r = t.ref) && delete t.ref, (e.__k = t.key) && delete t.key, !e.base || i ? e.componentWillMount && e.componentWillMount() : e.componentWillReceiveProps && e.componentWillReceiveProps(t, o), o && o !== e.context && (e.__c || (e.__c = e.context), e.context = o), e.__p || (e.__p = e.props), e.props = t, e.__x = !1, 0 !== n && (1 !== n && !1 === S.syncComponentUpdates && e.base ? r(e) : k(e, 1, i)), e.__r && e.__r(e));
  }function k(e, t, o, r) {
    if (!e.__x) {
      var i,
          l,
          a,
          _ = e.props,
          p = e.state,
          c = e.context,
          s = e.__p || _,
          f = e.__s || p,
          m = e.__c || c,
          v = e.base,
          y = e.__b,
          g = v || y,
          w = e._component,
          x = !1;if (v && (e.props = s, e.state = f, e.context = m, 2 !== t && e.shouldComponentUpdate && !1 === e.shouldComponentUpdate(_, p, c) ? x = !0 : e.componentWillUpdate && e.componentWillUpdate(_, p, c), e.props = _, e.state = p, e.context = c), e.__p = e.__s = e.__c = e.__b = null, e.__d = !1, !x) {
        i = e.render(_, p, c), e.getChildContext && (c = n(n({}, c), e.getChildContext()));var U,
            T,
            M = i && i.nodeName;if ("function" == typeof M) {
          var W = u(i);l = w, l && l.constructor === M && W.key == l.__k ? N(l, W, 1, c, !1) : (U = l, e._component = l = C(M, W, c), l.__b = l.__b || y, l.__u = e, N(l, W, 0, c, !1), k(l, 1, o, !0)), T = l.base;
        } else a = g, U = w, U && (a = e._component = null), (g || 1 === t) && (a && (a._component = null), T = h(a, i, c, o || !v, g && g.parentNode, !0));if (g && T !== g && l !== w) {
          var E = g.parentNode;E && T !== E && (E.replaceChild(T, g), U || (g._component = null, b(g, !1)));
        }if (U && L(U), e.base = T, T && !r) {
          var P = e,
              V = e;while (V = V.__u) {
            (P = V).base = T;
          }T._component = P, T._componentConstructor = P.constructor;
        }
      }if (!v || o ? D.unshift(e) : x || (e.componentDidUpdate && e.componentDidUpdate(s, f, m), S.afterUpdate && S.afterUpdate(e)), null != e.__h) while (e.__h.length) {
        e.__h.pop().call(e);
      }H || r || d();
    }
  }function U(e, t, n, o) {
    var r = e && e._component,
        i = r,
        l = e,
        a = r && e._componentConstructor === t.nodeName,
        _ = a,
        p = u(t);while (r && !_ && (r = r.__u)) {
      _ = r.constructor === t.nodeName;
    }return r && _ && (!o || r._component) ? (N(r, p, 3, n, o), e = r.base) : (i && !a && (L(i), e = l = null), r = C(t.nodeName, p, n), e && !r.__b && (r.__b = e, l = null), N(r, p, 1, n, o), e = r.base, l && e !== l && (l._component = null, b(l, !1))), e;
  }function L(e) {
    S.beforeUnmount && S.beforeUnmount(e);var t = e.base;e.__x = !0, e.componentWillUnmount && e.componentWillUnmount(), e.base = null;var n = e._component;n ? L(n) : t && (t.__preactattr_ && t.__preactattr_.ref && t.__preactattr_.ref(null), e.__b = t, p(t), w(e), y(t)), e.__r && e.__r(null);
  }function T(e, t) {
    this.__d = !0, this.context = t, this.props = e, this.state = this.state || {};
  }function M(e, t, n) {
    return h(n, e, {}, !1, t, !1);
  }var S = {},
      W = [],
      E = [],
      P = "function" == typeof Promise ? Promise.resolve().then.bind(Promise.resolve()) : setTimeout,
      V = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i,
      A = [],
      D = [],
      H = 0,
      R = !1,
      j = !1,
      I = {};n(T.prototype, { setState: function setState(e, t) {
      var o = this.state;this.__s || (this.__s = n({}, o)), n(o, "function" == typeof e ? e(o, this.props) : e), t && (this.__h = this.__h || []).push(t), r(this);
    }, forceUpdate: function forceUpdate(e) {
      e && (this.__h = this.__h || []).push(e), k(this, 2);
    }, render: function render() {} });var $ = { h: t, createElement: t, cloneElement: o, Component: T, render: M, rerender: i, options: S }; true ? module.exports = $ : self.preact = $;
}();
//# sourceMappingURL=preact.min.js.map

/***/ }),

/***/ "EKQi":
/***/ (function(module, exports, __webpack_require__) {

var anObject = __webpack_require__("IPqK"),
    IE8_DOM_DEFINE = __webpack_require__("bNE/"),
    toPrimitive = __webpack_require__("AI/p"),
    dP = Object.defineProperty;

exports.f = __webpack_require__("ismg") ? Object.defineProperty : function defineProperty(O, P, Attributes) {
  anObject(O);
  P = toPrimitive(P, true);
  anObject(Attributes);
  if (IE8_DOM_DEFINE) try {
    return dP(O, P, Attributes);
  } catch (e) {/* empty */}
  if ('get' in Attributes || 'set' in Attributes) throw TypeError('Accessors not supported!');
  if ('value' in Attributes) O[P] = Attributes.value;
  return O;
};

/***/ }),

/***/ "Ed4+":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__("71nt");
var support = __webpack_require__("oKij");
var nodejsUtils = __webpack_require__("zgxx");
var GenericWorker = __webpack_require__("bxoG");

/**
 * The following functions come from pako, from pako/lib/utils/strings
 * released under the MIT license, see pako https://github.com/nodeca/pako/
 */

// Table with utf8 lengths (calculated by first byte of sequence)
// Note, that 5 & 6-byte values and some 4-byte values can not be represented in JS,
// because max possible codepoint is 0x10ffff
var _utf8len = new Array(256);
for (var i = 0; i < 256; i++) {
    _utf8len[i] = i >= 252 ? 6 : i >= 248 ? 5 : i >= 240 ? 4 : i >= 224 ? 3 : i >= 192 ? 2 : 1;
}
_utf8len[254] = _utf8len[254] = 1; // Invalid sequence start

// convert string to array (typed, when possible)
var string2buf = function string2buf(str) {
    var buf,
        c,
        c2,
        m_pos,
        i,
        str_len = str.length,
        buf_len = 0;

    // count binary size
    for (m_pos = 0; m_pos < str_len; m_pos++) {
        c = str.charCodeAt(m_pos);
        if ((c & 0xfc00) === 0xd800 && m_pos + 1 < str_len) {
            c2 = str.charCodeAt(m_pos + 1);
            if ((c2 & 0xfc00) === 0xdc00) {
                c = 0x10000 + (c - 0xd800 << 10) + (c2 - 0xdc00);
                m_pos++;
            }
        }
        buf_len += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    }

    // allocate buffer
    if (support.uint8array) {
        buf = new Uint8Array(buf_len);
    } else {
        buf = new Array(buf_len);
    }

    // convert
    for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
        c = str.charCodeAt(m_pos);
        if ((c & 0xfc00) === 0xd800 && m_pos + 1 < str_len) {
            c2 = str.charCodeAt(m_pos + 1);
            if ((c2 & 0xfc00) === 0xdc00) {
                c = 0x10000 + (c - 0xd800 << 10) + (c2 - 0xdc00);
                m_pos++;
            }
        }
        if (c < 0x80) {
            /* one byte */
            buf[i++] = c;
        } else if (c < 0x800) {
            /* two bytes */
            buf[i++] = 0xC0 | c >>> 6;
            buf[i++] = 0x80 | c & 0x3f;
        } else if (c < 0x10000) {
            /* three bytes */
            buf[i++] = 0xE0 | c >>> 12;
            buf[i++] = 0x80 | c >>> 6 & 0x3f;
            buf[i++] = 0x80 | c & 0x3f;
        } else {
            /* four bytes */
            buf[i++] = 0xf0 | c >>> 18;
            buf[i++] = 0x80 | c >>> 12 & 0x3f;
            buf[i++] = 0x80 | c >>> 6 & 0x3f;
            buf[i++] = 0x80 | c & 0x3f;
        }
    }

    return buf;
};

// Calculate max possible position in utf8 buffer,
// that will not break sequence. If that's not possible
// - (very small limits) return max size as is.
//
// buf[] - utf8 bytes array
// max   - length limit (mandatory);
var utf8border = function utf8border(buf, max) {
    var pos;

    max = max || buf.length;
    if (max > buf.length) {
        max = buf.length;
    }

    // go back from last position, until start of sequence found
    pos = max - 1;
    while (pos >= 0 && (buf[pos] & 0xC0) === 0x80) {
        pos--;
    }

    // Fuckup - very small and broken sequence,
    // return max, because we should return something anyway.
    if (pos < 0) {
        return max;
    }

    // If we came to start of buffer - that means vuffer is too small,
    // return max too.
    if (pos === 0) {
        return max;
    }

    return pos + _utf8len[buf[pos]] > max ? pos : max;
};

// convert array to string
var buf2string = function buf2string(buf) {
    var str, i, out, c, c_len;
    var len = buf.length;

    // Reserve max possible length (2 words per char)
    // NB: by unknown reasons, Array is significantly faster for
    //     String.fromCharCode.apply than Uint16Array.
    var utf16buf = new Array(len * 2);

    for (out = 0, i = 0; i < len;) {
        c = buf[i++];
        // quick process ascii
        if (c < 0x80) {
            utf16buf[out++] = c;continue;
        }

        c_len = _utf8len[c];
        // skip 5 & 6 byte codes
        if (c_len > 4) {
            utf16buf[out++] = 0xfffd;i += c_len - 1;continue;
        }

        // apply mask on first byte
        c &= c_len === 2 ? 0x1f : c_len === 3 ? 0x0f : 0x07;
        // join the rest
        while (c_len > 1 && i < len) {
            c = c << 6 | buf[i++] & 0x3f;
            c_len--;
        }

        // terminated by end of string?
        if (c_len > 1) {
            utf16buf[out++] = 0xfffd;continue;
        }

        if (c < 0x10000) {
            utf16buf[out++] = c;
        } else {
            c -= 0x10000;
            utf16buf[out++] = 0xd800 | c >> 10 & 0x3ff;
            utf16buf[out++] = 0xdc00 | c & 0x3ff;
        }
    }

    // shrinkBuf(utf16buf, out)
    if (utf16buf.length !== out) {
        if (utf16buf.subarray) {
            utf16buf = utf16buf.subarray(0, out);
        } else {
            utf16buf.length = out;
        }
    }

    // return String.fromCharCode.apply(null, utf16buf);
    return utils.applyFromCharCode(utf16buf);
};

// That's all for the pako functions.


/**
 * Transform a javascript string into an array (typed if possible) of bytes,
 * UTF-8 encoded.
 * @param {String} str the string to encode
 * @return {Array|Uint8Array|Buffer} the UTF-8 encoded string.
 */
exports.utf8encode = function utf8encode(str) {
    if (support.nodebuffer) {
        return nodejsUtils.newBufferFrom(str, "utf-8");
    }

    return string2buf(str);
};

/**
 * Transform a bytes array (or a representation) representing an UTF-8 encoded
 * string into a javascript string.
 * @param {Array|Uint8Array|Buffer} buf the data de decode
 * @return {String} the decoded string.
 */
exports.utf8decode = function utf8decode(buf) {
    if (support.nodebuffer) {
        return utils.transformTo("nodebuffer", buf).toString("utf-8");
    }

    buf = utils.transformTo(support.uint8array ? "uint8array" : "array", buf);

    return buf2string(buf);
};

/**
 * A worker to decode utf8 encoded binary chunks into string chunks.
 * @constructor
 */
function Utf8DecodeWorker() {
    GenericWorker.call(this, "utf-8 decode");
    // the last bytes if a chunk didn't end with a complete codepoint.
    this.leftOver = null;
}
utils.inherits(Utf8DecodeWorker, GenericWorker);

/**
 * @see GenericWorker.processChunk
 */
Utf8DecodeWorker.prototype.processChunk = function (chunk) {

    var data = utils.transformTo(support.uint8array ? "uint8array" : "array", chunk.data);

    // 1st step, re-use what's left of the previous chunk
    if (this.leftOver && this.leftOver.length) {
        if (support.uint8array) {
            var previousData = data;
            data = new Uint8Array(previousData.length + this.leftOver.length);
            data.set(this.leftOver, 0);
            data.set(previousData, this.leftOver.length);
        } else {
            data = this.leftOver.concat(data);
        }
        this.leftOver = null;
    }

    var nextBoundary = utf8border(data);
    var usableData = data;
    if (nextBoundary !== data.length) {
        if (support.uint8array) {
            usableData = data.subarray(0, nextBoundary);
            this.leftOver = data.subarray(nextBoundary, data.length);
        } else {
            usableData = data.slice(0, nextBoundary);
            this.leftOver = data.slice(nextBoundary, data.length);
        }
    }

    this.push({
        data: exports.utf8decode(usableData),
        meta: chunk.meta
    });
};

/**
 * @see GenericWorker.flush
 */
Utf8DecodeWorker.prototype.flush = function () {
    if (this.leftOver && this.leftOver.length) {
        this.push({
            data: exports.utf8decode(this.leftOver),
            meta: {}
        });
        this.leftOver = null;
    }
};
exports.Utf8DecodeWorker = Utf8DecodeWorker;

/**
 * A worker to endcode string chunks into utf8 encoded binary chunks.
 * @constructor
 */
function Utf8EncodeWorker() {
    GenericWorker.call(this, "utf-8 encode");
}
utils.inherits(Utf8EncodeWorker, GenericWorker);

/**
 * @see GenericWorker.processChunk
 */
Utf8EncodeWorker.prototype.processChunk = function (chunk) {
    this.push({
        data: exports.utf8encode(chunk.data),
        meta: chunk.meta
    });
};
exports.Utf8EncodeWorker = Utf8EncodeWorker;

/***/ }),

/***/ "FLm2":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utf8 = __webpack_require__("Ed4+");
var utils = __webpack_require__("71nt");
var GenericWorker = __webpack_require__("bxoG");
var StreamHelper = __webpack_require__("GE67");
var defaults = __webpack_require__("e3b7");
var CompressedObject = __webpack_require__("jbop");
var ZipObject = __webpack_require__("aIUk");
var generate = __webpack_require__("tJQH");
var nodejsUtils = __webpack_require__("zgxx");
var NodejsStreamInputAdapter = __webpack_require__("1TsE");

/**
 * Add a file in the current folder.
 * @private
 * @param {string} name the name of the file
 * @param {String|ArrayBuffer|Uint8Array|Buffer} data the data of the file
 * @param {Object} originalOptions the options of the file
 * @return {Object} the new file.
 */
var fileAdd = function fileAdd(name, data, originalOptions) {
    // be sure sub folders exist
    var dataType = utils.getTypeOf(data),
        parent;

    /*
     * Correct options.
     */

    var o = utils.extend(originalOptions || {}, defaults);
    o.date = o.date || new Date();
    if (o.compression !== null) {
        o.compression = o.compression.toUpperCase();
    }

    if (typeof o.unixPermissions === "string") {
        o.unixPermissions = parseInt(o.unixPermissions, 8);
    }

    // UNX_IFDIR  0040000 see zipinfo.c
    if (o.unixPermissions && o.unixPermissions & 0x4000) {
        o.dir = true;
    }
    // Bit 4    Directory
    if (o.dosPermissions && o.dosPermissions & 0x0010) {
        o.dir = true;
    }

    if (o.dir) {
        name = forceTrailingSlash(name);
    }
    if (o.createFolders && (parent = parentFolder(name))) {
        folderAdd.call(this, parent, true);
    }

    var isUnicodeString = dataType === "string" && o.binary === false && o.base64 === false;
    if (!originalOptions || typeof originalOptions.binary === "undefined") {
        o.binary = !isUnicodeString;
    }

    var isCompressedEmpty = data instanceof CompressedObject && data.uncompressedSize === 0;

    if (isCompressedEmpty || o.dir || !data || data.length === 0) {
        o.base64 = false;
        o.binary = true;
        data = "";
        o.compression = "STORE";
        dataType = "string";
    }

    /*
     * Convert content to fit.
     */

    var zipObjectContent = null;
    if (data instanceof CompressedObject || data instanceof GenericWorker) {
        zipObjectContent = data;
    } else if (nodejsUtils.isNode && nodejsUtils.isStream(data)) {
        zipObjectContent = new NodejsStreamInputAdapter(name, data);
    } else {
        zipObjectContent = utils.prepareContent(name, data, o.binary, o.optimizedBinaryString, o.base64);
    }

    var object = new ZipObject(name, zipObjectContent, o);
    this.files[name] = object;
    /*
    TODO: we can't throw an exception because we have async promises
    (we can have a promise of a Date() for example) but returning a
    promise is useless because file(name, data) returns the JSZip
    object for chaining. Should we break that to allow the user
    to catch the error ?
     return external.Promise.resolve(zipObjectContent)
    .then(function () {
        return object;
    });
    */
};

/**
 * Find the parent folder of the path.
 * @private
 * @param {string} path the path to use
 * @return {string} the parent folder, or ""
 */
var parentFolder = function parentFolder(path) {
    if (path.slice(-1) === '/') {
        path = path.substring(0, path.length - 1);
    }
    var lastSlash = path.lastIndexOf('/');
    return lastSlash > 0 ? path.substring(0, lastSlash) : "";
};

/**
 * Returns the path with a slash at the end.
 * @private
 * @param {String} path the path to check.
 * @return {String} the path with a trailing slash.
 */
var forceTrailingSlash = function forceTrailingSlash(path) {
    // Check the name ends with a /
    if (path.slice(-1) !== "/") {
        path += "/"; // IE doesn't like substr(-1)
    }
    return path;
};

/**
 * Add a (sub) folder in the current folder.
 * @private
 * @param {string} name the folder's name
 * @param {boolean=} [createFolders] If true, automatically create sub
 *  folders. Defaults to false.
 * @return {Object} the new folder.
 */
var folderAdd = function folderAdd(name, createFolders) {
    createFolders = typeof createFolders !== 'undefined' ? createFolders : defaults.createFolders;

    name = forceTrailingSlash(name);

    // Does this folder already exist?
    if (!this.files[name]) {
        fileAdd.call(this, name, null, {
            dir: true,
            createFolders: createFolders
        });
    }
    return this.files[name];
};

/**
* Cross-window, cross-Node-context regular expression detection
* @param  {Object}  object Anything
* @return {Boolean}        true if the object is a regular expression,
* false otherwise
*/
function isRegExp(object) {
    return Object.prototype.toString.call(object) === "[object RegExp]";
}

// return the actual prototype of JSZip
var out = {
    /**
     * @see loadAsync
     */
    load: function load() {
        throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
    },

    /**
     * Call a callback function for each entry at this folder level.
     * @param {Function} cb the callback function:
     * function (relativePath, file) {...}
     * It takes 2 arguments : the relative path and the file.
     */
    forEach: function forEach(cb) {
        var filename, relativePath, file;
        for (filename in this.files) {
            if (!this.files.hasOwnProperty(filename)) {
                continue;
            }
            file = this.files[filename];
            relativePath = filename.slice(this.root.length, filename.length);
            if (relativePath && filename.slice(0, this.root.length) === this.root) {
                // the file is in the current root
                cb(relativePath, file); // TODO reverse the parameters ? need to be clean AND consistent with the filter search fn...
            }
        }
    },

    /**
     * Filter nested files/folders with the specified function.
     * @param {Function} search the predicate to use :
     * function (relativePath, file) {...}
     * It takes 2 arguments : the relative path and the file.
     * @return {Array} An array of matching elements.
     */
    filter: function filter(search) {
        var result = [];
        this.forEach(function (relativePath, entry) {
            if (search(relativePath, entry)) {
                // the file matches the function
                result.push(entry);
            }
        });
        return result;
    },

    /**
     * Add a file to the zip file, or search a file.
     * @param   {string|RegExp} name The name of the file to add (if data is defined),
     * the name of the file to find (if no data) or a regex to match files.
     * @param   {String|ArrayBuffer|Uint8Array|Buffer} data  The file data, either raw or base64 encoded
     * @param   {Object} o     File options
     * @return  {JSZip|Object|Array} this JSZip object (when adding a file),
     * a file (when searching by string) or an array of files (when searching by regex).
     */
    file: function file(name, data, o) {
        if (arguments.length === 1) {
            if (isRegExp(name)) {
                var regexp = name;
                return this.filter(function (relativePath, file) {
                    return !file.dir && regexp.test(relativePath);
                });
            } else {
                // text
                var obj = this.files[this.root + name];
                if (obj && !obj.dir) {
                    return obj;
                } else {
                    return null;
                }
            }
        } else {
            // more than one argument : we have data !
            name = this.root + name;
            fileAdd.call(this, name, data, o);
        }
        return this;
    },

    /**
     * Add a directory to the zip file, or search.
     * @param   {String|RegExp} arg The name of the directory to add, or a regex to search folders.
     * @return  {JSZip} an object with the new directory as the root, or an array containing matching folders.
     */
    folder: function folder(arg) {
        if (!arg) {
            return this;
        }

        if (isRegExp(arg)) {
            return this.filter(function (relativePath, file) {
                return file.dir && arg.test(relativePath);
            });
        }

        // else, name is a new folder
        var name = this.root + arg;
        var newFolder = folderAdd.call(this, name);

        // Allow chaining by returning a new object with this folder as the root
        var ret = this.clone();
        ret.root = newFolder.name;
        return ret;
    },

    /**
     * Delete a file, or a directory and all sub-files, from the zip
     * @param {string} name the name of the file to delete
     * @return {JSZip} this JSZip object
     */
    remove: function remove(name) {
        name = this.root + name;
        var file = this.files[name];
        if (!file) {
            // Look for any folders
            if (name.slice(-1) !== "/") {
                name += "/";
            }
            file = this.files[name];
        }

        if (file && !file.dir) {
            // file
            delete this.files[name];
        } else {
            // maybe a folder, delete recursively
            var kids = this.filter(function (relativePath, file) {
                return file.name.slice(0, name.length) === name;
            });
            for (var i = 0; i < kids.length; i++) {
                delete this.files[kids[i].name];
            }
        }

        return this;
    },

    /**
     * Generate the complete zip file
     * @param {Object} options the options to generate the zip file :
     * - compression, "STORE" by default.
     * - type, "base64" by default. Values are : string, base64, uint8array, arraybuffer, blob.
     * @return {String|Uint8Array|ArrayBuffer|Buffer|Blob} the zip file
     */
    generate: function generate(options) {
        throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
    },

    /**
     * Generate the complete zip file as an internal stream.
     * @param {Object} options the options to generate the zip file :
     * - compression, "STORE" by default.
     * - type, "base64" by default. Values are : string, base64, uint8array, arraybuffer, blob.
     * @return {StreamHelper} the streamed zip file.
     */
    generateInternalStream: function generateInternalStream(options) {
        var worker,
            opts = {};
        try {
            opts = utils.extend(options || {}, {
                streamFiles: false,
                compression: "STORE",
                compressionOptions: null,
                type: "",
                platform: "DOS",
                comment: null,
                mimeType: 'application/zip',
                encodeFileName: utf8.utf8encode
            });

            opts.type = opts.type.toLowerCase();
            opts.compression = opts.compression.toUpperCase();

            // "binarystring" is prefered but the internals use "string".
            if (opts.type === "binarystring") {
                opts.type = "string";
            }

            if (!opts.type) {
                throw new Error("No output type specified.");
            }

            utils.checkSupport(opts.type);

            // accept nodejs `process.platform`
            if (opts.platform === 'darwin' || opts.platform === 'freebsd' || opts.platform === 'linux' || opts.platform === 'sunos') {
                opts.platform = "UNIX";
            }
            if (opts.platform === 'win32') {
                opts.platform = "DOS";
            }

            var comment = opts.comment || this.comment || "";
            worker = generate.generateWorker(this, opts, comment);
        } catch (e) {
            worker = new GenericWorker("error");
            worker.error(e);
        }
        return new StreamHelper(worker, opts.type || "string", opts.mimeType);
    },
    /**
     * Generate the complete zip file asynchronously.
     * @see generateInternalStream
     */
    generateAsync: function generateAsync(options, onUpdate) {
        return this.generateInternalStream(options).accumulate(onUpdate);
    },
    /**
     * Generate the complete zip file asynchronously.
     * @see generateInternalStream
     */
    generateNodeStream: function generateNodeStream(options, onUpdate) {
        options = options || {};
        if (!options.type) {
            options.type = "nodebuffer";
        }
        return this.generateInternalStream(options).toNodejsStream(onUpdate);
    }
};
module.exports = out;

/***/ }),

/***/ "FSVj":
/***/ (function(module, exports, __webpack_require__) {

var dP = __webpack_require__("EKQi"),
    createDesc = __webpack_require__("1kib");
module.exports = __webpack_require__("ismg") ? function (object, key, value) {
  return dP.f(object, key, createDesc(1, value));
} : function (object, key, value) {
  object[key] = value;
  return object;
};

/***/ }),

/***/ "FWi5":
/***/ (function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ }),

/***/ "FpCL":
/***/ (function(module, exports) {

module.exports = require("events");

/***/ }),

/***/ "GE67":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__("71nt");
var ConvertWorker = __webpack_require__("l3VN");
var GenericWorker = __webpack_require__("bxoG");
var base64 = __webpack_require__("hbB+");
var support = __webpack_require__("oKij");
var external = __webpack_require__("vVrn");

var NodejsStreamOutputAdapter = null;
if (support.nodestream) {
    try {
        NodejsStreamOutputAdapter = __webpack_require__("/0aV");
    } catch (e) {}
}

/**
 * Apply the final transformation of the data. If the user wants a Blob for
 * example, it's easier to work with an U8intArray and finally do the
 * ArrayBuffer/Blob conversion.
 * @param {String} type the name of the final type
 * @param {String|Uint8Array|Buffer} content the content to transform
 * @param {String} mimeType the mime type of the content, if applicable.
 * @return {String|Uint8Array|ArrayBuffer|Buffer|Blob} the content in the right format.
 */
function transformZipOutput(type, content, mimeType) {
    switch (type) {
        case "blob":
            return utils.newBlob(utils.transformTo("arraybuffer", content), mimeType);
        case "base64":
            return base64.encode(content);
        default:
            return utils.transformTo(type, content);
    }
}

/**
 * Concatenate an array of data of the given type.
 * @param {String} type the type of the data in the given array.
 * @param {Array} dataArray the array containing the data chunks to concatenate
 * @return {String|Uint8Array|Buffer} the concatenated data
 * @throws Error if the asked type is unsupported
 */
function concat(type, dataArray) {
    var i,
        index = 0,
        res = null,
        totalLength = 0;
    for (i = 0; i < dataArray.length; i++) {
        totalLength += dataArray[i].length;
    }
    switch (type) {
        case "string":
            return dataArray.join("");
        case "array":
            return Array.prototype.concat.apply([], dataArray);
        case "uint8array":
            res = new Uint8Array(totalLength);
            for (i = 0; i < dataArray.length; i++) {
                res.set(dataArray[i], index);
                index += dataArray[i].length;
            }
            return res;
        case "nodebuffer":
            return Buffer.concat(dataArray);
        default:
            throw new Error("concat : unsupported type '" + type + "'");
    }
}

/**
 * Listen a StreamHelper, accumulate its content and concatenate it into a
 * complete block.
 * @param {StreamHelper} helper the helper to use.
 * @param {Function} updateCallback a callback called on each update. Called
 * with one arg :
 * - the metadata linked to the update received.
 * @return Promise the promise for the accumulation.
 */
function _accumulate(helper, updateCallback) {
    return new external.Promise(function (resolve, reject) {
        var dataArray = [];
        var chunkType = helper._internalType,
            resultType = helper._outputType,
            mimeType = helper._mimeType;
        helper.on('data', function (data, meta) {
            dataArray.push(data);
            if (updateCallback) {
                updateCallback(meta);
            }
        }).on('error', function (err) {
            dataArray = [];
            reject(err);
        }).on('end', function () {
            try {
                var result = transformZipOutput(resultType, concat(chunkType, dataArray), mimeType);
                resolve(result);
            } catch (e) {
                reject(e);
            }
            dataArray = [];
        }).resume();
    });
}

/**
 * An helper to easily use workers outside of JSZip.
 * @constructor
 * @param {Worker} worker the worker to wrap
 * @param {String} outputType the type of data expected by the use
 * @param {String} mimeType the mime type of the content, if applicable.
 */
function StreamHelper(worker, outputType, mimeType) {
    var internalType = outputType;
    switch (outputType) {
        case "blob":
        case "arraybuffer":
            internalType = "uint8array";
            break;
        case "base64":
            internalType = "string";
            break;
    }

    try {
        // the type used internally
        this._internalType = internalType;
        // the type used to output results
        this._outputType = outputType;
        // the mime type
        this._mimeType = mimeType;
        utils.checkSupport(internalType);
        this._worker = worker.pipe(new ConvertWorker(internalType));
        // the last workers can be rewired without issues but we need to
        // prevent any updates on previous workers.
        worker.lock();
    } catch (e) {
        this._worker = new GenericWorker("error");
        this._worker.error(e);
    }
}

StreamHelper.prototype = {
    /**
     * Listen a StreamHelper, accumulate its content and concatenate it into a
     * complete block.
     * @param {Function} updateCb the update callback.
     * @return Promise the promise for the accumulation.
     */
    accumulate: function accumulate(updateCb) {
        return _accumulate(this, updateCb);
    },
    /**
     * Add a listener on an event triggered on a stream.
     * @param {String} evt the name of the event
     * @param {Function} fn the listener
     * @return {StreamHelper} the current helper.
     */
    on: function on(evt, fn) {
        var self = this;

        if (evt === "data") {
            this._worker.on(evt, function (chunk) {
                fn.call(self, chunk.data, chunk.meta);
            });
        } else {
            this._worker.on(evt, function () {
                utils.delay(fn, arguments, self);
            });
        }
        return this;
    },
    /**
     * Resume the flow of chunks.
     * @return {StreamHelper} the current helper.
     */
    resume: function resume() {
        utils.delay(this._worker.resume, [], this._worker);
        return this;
    },
    /**
     * Pause the flow of chunks.
     * @return {StreamHelper} the current helper.
     */
    pause: function pause() {
        this._worker.pause();
        return this;
    },
    /**
     * Return a nodejs stream for this helper.
     * @param {Function} updateCb the update callback.
     * @return {NodejsStreamOutputAdapter} the nodejs stream.
     */
    toNodejsStream: function toNodejsStream(updateCb) {
        utils.checkSupport("nodestream");
        if (this._outputType !== "nodebuffer") {
            // an object stream containing blob/arraybuffer/uint8array/string
            // is strange and I don't know if it would be useful.
            // I you find this comment and have a good usecase, please open a
            // bug report !
            throw new Error(this._outputType + " is not supported by this method");
        }

        return new NodejsStreamOutputAdapter(this, {
            objectMode: this._outputType !== "nodebuffer"
        }, updateCb);
    }
};

module.exports = StreamHelper;

/***/ }),

/***/ "GK12":
/***/ (function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ }),

/***/ "GfW5":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var GenericWorker = __webpack_require__("bxoG");

exports.STORE = {
    magic: "\x00\x00",
    compressWorker: function compressWorker(compressionOptions) {
        return new GenericWorker("STORE compression");
    },
    uncompressWorker: function uncompressWorker() {
        return new GenericWorker("STORE decompression");
    }
};
exports.DEFLATE = __webpack_require__("8FNI");

/***/ }),

/***/ "Gquf":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__("71nt");
var support = __webpack_require__("oKij");
var ArrayReader = __webpack_require__("hjG0");
var StringReader = __webpack_require__("9F63");
var NodeBufferReader = __webpack_require__("rBub");
var Uint8ArrayReader = __webpack_require__("dL6i");

/**
 * Create a reader adapted to the data.
 * @param {String|ArrayBuffer|Uint8Array|Buffer} data the data to read.
 * @return {DataReader} the data reader.
 */
module.exports = function (data) {
    var type = utils.getTypeOf(data);
    utils.checkSupport(type);
    if (type === "string" && !support.uint8array) {
        return new StringReader(data);
    }
    if (type === "nodebuffer") {
        return new NodeBufferReader(data);
    }
    if (support.uint8array) {
        return new Uint8ArrayReader(utils.transformTo("uint8array", data));
    }
    return new ArrayReader(utils.transformTo("array", data));
};

/***/ }),

/***/ "H4yk":
/***/ (function(module, exports) {

module.exports = audioBufferToWav;
function audioBufferToWav(buffer, opt) {
  opt = opt || {};

  var numChannels = buffer.numberOfChannels;
  var sampleRate = buffer.sampleRate;
  var format = opt.float32 ? 3 : 1;
  var bitDepth = format === 3 ? 32 : 16;

  var result;
  if (numChannels === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }

  return encodeWAV(result, format, sampleRate, numChannels, bitDepth);
}

function encodeWAV(samples, format, sampleRate, numChannels, bitDepth) {
  var bytesPerSample = bitDepth / 8;
  var blockAlign = numChannels * bytesPerSample;

  var buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  var view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * bytesPerSample, true);
  if (format === 1) {
    // Raw PCM
    floatTo16BitPCM(view, 44, samples);
  } else {
    writeFloat32(view, 44, samples);
  }

  return buffer;
}

function interleave(inputL, inputR) {
  var length = inputL.length + inputR.length;
  var result = new Float32Array(length);

  var index = 0;
  var inputIndex = 0;

  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function writeFloat32(output, offset, input) {
  for (var i = 0; i < input.length; i++, offset += 4) {
    output.setFloat32(offset, input[i], true);
  }
}

function floatTo16BitPCM(output, offset, input) {
  for (var i = 0; i < input.length; i++, offset += 2) {
    var s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view, offset, string) {
  for (var i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/***/ }),

/***/ "HAf2":
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__("39Rf").document && document.documentElement;

/***/ }),

/***/ "IPqK":
/***/ (function(module, exports, __webpack_require__) {

var isObject = __webpack_require__("LFbK");
module.exports = function (it) {
  if (!isObject(it)) throw TypeError(it + ' is not an object!');
  return it;
};

/***/ }),

/***/ "IVFP":
/***/ (function(module, exports, __webpack_require__) {

var ctx = __webpack_require__("hutl"),
    invoke = __webpack_require__("lP8e"),
    html = __webpack_require__("HAf2"),
    cel = __webpack_require__("8vkY"),
    global = __webpack_require__("39Rf"),
    process = global.process,
    setTask = global.setImmediate,
    clearTask = global.clearImmediate,
    MessageChannel = global.MessageChannel,
    counter = 0,
    queue = {},
    ONREADYSTATECHANGE = 'onreadystatechange',
    defer,
    channel,
    port;
var run = function run() {
  var id = +this;
  if (queue.hasOwnProperty(id)) {
    var fn = queue[id];
    delete queue[id];
    fn();
  }
};
var listener = function listener(event) {
  run.call(event.data);
};
// Node.js 0.9+ & IE10+ has setImmediate, otherwise:
if (!setTask || !clearTask) {
  setTask = function setImmediate(fn) {
    var args = [],
        i = 1;
    while (arguments.length > i) {
      args.push(arguments[i++]);
    }queue[++counter] = function () {
      invoke(typeof fn == 'function' ? fn : Function(fn), args);
    };
    defer(counter);
    return counter;
  };
  clearTask = function clearImmediate(id) {
    delete queue[id];
  };
  // Node.js 0.8-
  if (__webpack_require__("OmGh")(process) == 'process') {
    defer = function defer(id) {
      process.nextTick(ctx(run, id, 1));
    };
    // Browsers with MessageChannel, includes WebWorkers
  } else if (MessageChannel) {
    channel = new MessageChannel();
    port = channel.port2;
    channel.port1.onmessage = listener;
    defer = ctx(port.postMessage, port, 1);
    // Browsers with postMessage, skip WebWorkers
    // IE8 has postMessage, but it's sync & typeof its postMessage is 'object'
  } else if (global.addEventListener && typeof postMessage == 'function' && !global.importScripts) {
    defer = function defer(id) {
      global.postMessage(id + '', '*');
    };
    global.addEventListener('message', listener, false);
    // IE8-
  } else if (ONREADYSTATECHANGE in cel('script')) {
    defer = function defer(id) {
      html.appendChild(cel('script'))[ONREADYSTATECHANGE] = function () {
        html.removeChild(this);
        run.call(id);
      };
    };
    // Rest old browsers
  } else {
    defer = function defer(id) {
      setTimeout(ctx(run, id, 1), 0);
    };
  }
}
module.exports = {
  set: setTask,
  clear: clearTask
};

/***/ }),

/***/ "Ji/z":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


if (!process.version || process.version.indexOf('v0.') === 0 || process.version.indexOf('v1.') === 0 && process.version.indexOf('v1.8.') !== 0) {
  module.exports = nextTick;
} else {
  module.exports = process.nextTick;
}

function nextTick(fn, arg1, arg2, arg3) {
  if (typeof fn !== 'function') {
    throw new TypeError('"callback" argument must be a function');
  }
  var len = arguments.length;
  var args, i;
  switch (len) {
    case 0:
    case 1:
      return process.nextTick(fn);
    case 2:
      return process.nextTick(function afterTickOne() {
        fn.call(null, arg1);
      });
    case 3:
      return process.nextTick(function afterTickTwo() {
        fn.call(null, arg1, arg2);
      });
    case 4:
      return process.nextTick(function afterTickThree() {
        fn.call(null, arg1, arg2, arg3);
      });
    default:
      args = new Array(len - 1);
      i = 0;
      while (i < args.length) {
        args[i++] = arguments[i];
      }
      return process.nextTick(function afterTick() {
        fn.apply(null, args);
      });
  }
}

/***/ }),

/***/ "JkW7":
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
Object.defineProperty(__webpack_exports__, "__esModule", { value: true });

// EXTERNAL MODULE: ./node_modules/preact/dist/preact.min.js
var preact_min = __webpack_require__("EBst");
var preact_min_default = /*#__PURE__*/__webpack_require__.n(preact_min);

// EXTERNAL MODULE: ./style.css
var style = __webpack_require__("FWi5");
var style_default = /*#__PURE__*/__webpack_require__.n(style);

// EXTERNAL MODULE: ./node_modules/bulma/css/bulma.css
var bulma = __webpack_require__("GK12");
var bulma_default = /*#__PURE__*/__webpack_require__.n(bulma);

// CONCATENATED MODULE: ./node_modules/unfetch/dist/unfetch.es.js
var index = typeof fetch == 'function' ? fetch.bind() : function (url, options) {
	options = options || {};
	return new Promise(function (resolve, reject) {
		var request = new XMLHttpRequest();

		request.open(options.method || 'get', url);

		for (var i in options.headers) {
			request.setRequestHeader(i, options.headers[i]);
		}

		request.withCredentials = options.credentials == 'include';

		request.onload = function () {
			resolve(response());
		};

		request.onerror = reject;

		request.send(options.body);

		function response() {
			var _keys = [],
			    all = [],
			    headers = {},
			    header;

			request.getAllResponseHeaders().replace(/^(.*?):\s*([\s\S]*?)$/gm, function (m, key, value) {
				_keys.push(key = key.toLowerCase());
				all.push([key, value]);
				header = headers[key];
				headers[key] = header ? header + "," + value : value;
			});

			return {
				ok: (request.status / 200 | 0) == 1, // 200-299
				status: request.status,
				statusText: request.statusText,
				url: request.responseURL,
				clone: response,
				text: function text() {
					return Promise.resolve(request.responseText);
				},
				json: function json() {
					return Promise.resolve(request.responseText).then(JSON.parse);
				},
				blob: function blob() {
					return Promise.resolve(new Blob([request.response]));
				},
				headers: {
					keys: function keys() {
						return _keys;
					},
					entries: function entries() {
						return all;
					},
					get: function get(n) {
						return headers[n.toLowerCase()];
					},
					has: function has(n) {
						return n.toLowerCase() in headers;
					}
				}
			};
		}
	});
};

/* harmony default export */ var unfetch_es = (index);
//# sourceMappingURL=unfetch.es.js.map
// CONCATENATED MODULE: ./node_modules/promise-polyfill/src/index.js
// Store setTimeout reference so promise-polyfill will be unaffected by
// other code modifying setTimeout (like sinon.useFakeTimers())
var setTimeoutFunc = setTimeout;

function noop() {}

// Polyfill for Function.prototype.bind
function bind(fn, thisArg) {
  return function () {
    fn.apply(thisArg, arguments);
  };
}

function handle(self, deferred) {
  while (self._state === 3) {
    self = self._value;
  }
  if (self._state === 0) {
    self._deferreds.push(deferred);
    return;
  }
  self._handled = true;
  src_Promise._immediateFn(function () {
    var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
    if (cb === null) {
      (self._state === 1 ? src_resolve : src_reject)(deferred.promise, self._value);
      return;
    }
    var ret;
    try {
      ret = cb(self._value);
    } catch (e) {
      src_reject(deferred.promise, e);
      return;
    }
    src_resolve(deferred.promise, ret);
  });
}

function src_resolve(self, newValue) {
  try {
    // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
    if (newValue === self) throw new TypeError('A promise cannot be resolved with itself.');
    if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
      var then = newValue.then;
      if (newValue instanceof src_Promise) {
        self._state = 3;
        self._value = newValue;
        finale(self);
        return;
      } else if (typeof then === 'function') {
        doResolve(bind(then, newValue), self);
        return;
      }
    }
    self._state = 1;
    self._value = newValue;
    finale(self);
  } catch (e) {
    src_reject(self, e);
  }
}

function src_reject(self, newValue) {
  self._state = 2;
  self._value = newValue;
  finale(self);
}

function finale(self) {
  if (self._state === 2 && self._deferreds.length === 0) {
    src_Promise._immediateFn(function () {
      if (!self._handled) {
        src_Promise._unhandledRejectionFn(self._value);
      }
    });
  }

  for (var i = 0, len = self._deferreds.length; i < len; i++) {
    handle(self, self._deferreds[i]);
  }
  self._deferreds = null;
}

function Handler(onFulfilled, onRejected, promise) {
  this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
  this.onRejected = typeof onRejected === 'function' ? onRejected : null;
  this.promise = promise;
}

/**
 * Take a potentially misbehaving resolver function and make sure
 * onFulfilled and onRejected are only called once.
 *
 * Makes no guarantees about asynchrony.
 */
function doResolve(fn, self) {
  var done = false;
  try {
    fn(function (value) {
      if (done) return;
      done = true;
      src_resolve(self, value);
    }, function (reason) {
      if (done) return;
      done = true;
      src_reject(self, reason);
    });
  } catch (ex) {
    if (done) return;
    done = true;
    src_reject(self, ex);
  }
}

function src_Promise(fn) {
  if (!(this instanceof src_Promise)) throw new TypeError('Promises must be constructed via new');
  if (typeof fn !== 'function') throw new TypeError('not a function');
  this._state = 0;
  this._handled = false;
  this._value = undefined;
  this._deferreds = [];

  doResolve(fn, this);
}

var _proto = src_Promise.prototype;
_proto.catch = function (onRejected) {
  return this.then(null, onRejected);
};

_proto.then = function (onFulfilled, onRejected) {
  var prom = new this.constructor(noop);

  handle(this, new Handler(onFulfilled, onRejected, prom));
  return prom;
};

src_Promise.all = function (arr) {
  return new src_Promise(function (resolve, reject) {
    if (!arr || typeof arr.length === 'undefined') throw new TypeError('Promise.all accepts an array');
    var args = Array.prototype.slice.call(arr);
    if (args.length === 0) return resolve([]);
    var remaining = args.length;

    function res(i, val) {
      try {
        if (val && (typeof val === 'object' || typeof val === 'function')) {
          var then = val.then;
          if (typeof then === 'function') {
            then.call(val, function (val) {
              res(i, val);
            }, reject);
            return;
          }
        }
        args[i] = val;
        if (--remaining === 0) {
          resolve(args);
        }
      } catch (ex) {
        reject(ex);
      }
    }

    for (var i = 0; i < args.length; i++) {
      res(i, args[i]);
    }
  });
};

src_Promise.resolve = function (value) {
  if (value && typeof value === 'object' && value.constructor === src_Promise) {
    return value;
  }

  return new src_Promise(function (resolve) {
    resolve(value);
  });
};

src_Promise.reject = function (value) {
  return new src_Promise(function (resolve, reject) {
    reject(value);
  });
};

src_Promise.race = function (values) {
  return new src_Promise(function (resolve, reject) {
    for (var i = 0, len = values.length; i < len; i++) {
      values[i].then(resolve, reject);
    }
  });
};

// Use polyfill for setImmediate for performance gains
src_Promise._immediateFn = typeof setImmediate === 'function' && function (fn) {
  setImmediate(fn);
} || function (fn) {
  setTimeoutFunc(fn, 0);
};

src_Promise._unhandledRejectionFn = function _unhandledRejectionFn(err) {
  if (typeof console !== 'undefined' && console) {
    console.warn('Possible Unhandled Promise Rejection:', err); // eslint-disable-line no-console
  }
};

/* harmony default export */ var src = (src_Promise);
// EXTERNAL MODULE: ./dist/wasm/index.untouched.wasm
var index_untouched = __webpack_require__("toTQ");
var index_untouched_default = /*#__PURE__*/__webpack_require__.n(index_untouched);

// CONCATENATED MODULE: ./lib/graphics/graphics.js
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }



// Performance tips with canvas:
// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas

// Declare Our Constants
var GAMEBOY_CAMERA_WIDTH = 160;
var GAMEBOY_CAMERA_HEIGHT = 144;

// Must be greater than 4, or else will have really weird performance
// noticed you get about 4 frames for every 4096 samples
var WASMBOY_MAX_FRAMES_IN_QUEUE = 6;

// Cached Current Frame output location, since call to wasm is expensive
var WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION = 0;

var graphics_WasmBoyGraphicsService = function () {
  function WasmBoyGraphicsService() {
    _classCallCheck(this, WasmBoyGraphicsService);

    this.wasmInstance = undefined;
    this.wasmByteMemory = undefined;

    this.frameQueue = undefined;
    this.frameQueueRenderPromise = undefined;

    this.canvasElement = undefined;
    this.canvasContext = undefined;
    this.canvasImageData = undefined;
  }

  WasmBoyGraphicsService.prototype.initialize = function initialize(canvasElement, wasmInstance, wasmByteMemory) {
    var _this = this;

    this.wasmInstance = wasmInstance;
    this.wasmByteMemory = wasmByteMemory;

    // Initialiuze our cached wasm constants
    WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION = this.wasmInstance.exports.frameInProgressVideoOutputLocation;

    // Reset our frame queue and render promises
    this.frameQueue = [];

    return new src(function (resolve, reject) {
      try {
        // Prepare our canvas
        _this.canvasElement = canvasElement;
        _this.canvasContext = _this.canvasElement.getContext('2d');
        _this.canvasElement.width = GAMEBOY_CAMERA_WIDTH;
        _this.canvasElement.height = GAMEBOY_CAMERA_HEIGHT;
        _this.canvasImageData = _this.canvasContext.createImageData(GAMEBOY_CAMERA_WIDTH, GAMEBOY_CAMERA_HEIGHT);

        // Add some css for smooth 8-bit canvas scaling
        // https://stackoverflow.com/questions/7615009/disable-interpolation-when-scaling-a-canvas
        // https://caniuse.com/#feat=css-crisp-edges
        _this.canvasElement.style = '\n          image-rendering: optimizeSpeed;\n          image-rendering: -moz-crisp-edges;\n          image-rendering: -webkit-optimize-contrast;\n          image-rendering: -o-crisp-edges;\n          image-rendering: pixelated;\n          -ms-interpolation-mode: nearest-neighbor;\n        ';

        // Fill the canvas with a blank screen
        // using client width since we are not requiring a width and height oin the canvas
        // https://developer.mozilla.org/en-US/docs/Web/API/Element/clientWidth
        // TODO: Mention respopnsive canvas scaling in the docs
        _this.canvasContext.clearRect(0, 0, _this.canvasElement.width, _this.canvasElement.height);

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  };

  // Function to render a frame
  // Will add the frame to the frame queue to be rendered
  // Returns the promise from this.drawFrameQueue
  // Which resolves once all frames are rendered


  WasmBoyGraphicsService.prototype.renderFrame = function renderFrame() {
    var _this2 = this;

    return new src(function (resolve) {
      // Draw the pixels
      // 160x144
      // Split off our image Data
      var imageDataArray = new Uint8ClampedArray(GAMEBOY_CAMERA_HEIGHT * GAMEBOY_CAMERA_WIDTH * 4);
      var rgbColor = new Uint8ClampedArray(3);

      for (var y = 0; y < GAMEBOY_CAMERA_HEIGHT; y++) {
        for (var x = 0; x < GAMEBOY_CAMERA_WIDTH; x++) {

          // Each color has an R G B component
          var pixelStart = (y * 160 + x) * 3;

          for (var color = 0; color < 3; color++) {
            rgbColor[color] = _this2.wasmByteMemory[WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION + pixelStart + color];
          }

          // Doing graphics using second answer on:
          // https://stackoverflow.com/questions/4899799/whats-the-best-way-to-set-a-single-pixel-in-an-html5-canvas
          // Image Data mapping
          var imageDataIndex = (x + y * GAMEBOY_CAMERA_WIDTH) * 4;

          imageDataArray[imageDataIndex] = rgbColor[0];
          imageDataArray[imageDataIndex + 1] = rgbColor[1];
          imageDataArray[imageDataIndex + 2] = rgbColor[2];
          // Alpha, no transparency
          imageDataArray[imageDataIndex + 3] = 255;
        }
      }

      // Add our new imageData
      for (var i = 0; i < imageDataArray.length; i++) {
        _this2.canvasImageData.data[i] = imageDataArray[i];
      }

      // TODO: Allow changing gameboy background color
      // https://designpieces.com/palette/game-boy-original-color-palette-hex-and-rgb/
      //this.canvasContext.fillStyle = "#9bbc0f";
      //this.canvasContext.fillRect(0, 0, this.canvasElement.clientWidth, this.canvasElement.clientHeight);

      _this2.canvasContext.clearRect(0, 0, GAMEBOY_CAMERA_WIDTH, GAMEBOY_CAMERA_HEIGHT);
      _this2.canvasContext.putImageData(_this2.canvasImageData, 0, 0);

      resolve();
    });
  };

  return WasmBoyGraphicsService;
}();

var WasmBoyGraphics = new graphics_WasmBoyGraphicsService();
// CONCATENATED MODULE: ./lib/audio/audio.js
function audio__classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Tons of help from:
// https://binji.github.io/2017/02/27/binjgb-on-the-web-part-2.html
// https://github.com/binji/binjgb/blob/master/demo/demo.js
// Web Audio API is tricky!



// Define our performance constants
// Both of these make it sound off
// Latency controls how much delay audio has, larger = more delay, goal is to be as small as possible
// Time remaining controls how far ahead we can be., larger = more frames rendered before playing a new set of samples. goal is to be as small as possible. May want to adjust this number according to performance of device
// These magic numbers just come from preference, can be set as options
var DEFAULT_AUDIO_LATENCY_IN_MILLI = 100;
var WASMBOY_MIN_TIME_REMAINING_IN_MILLI = 75;
var WASMBOY_SAMPLE_RATE = 48000;

// Some canstants that use the ones above that will allow for faster performance
var DEFAULT_AUDIO_LATENCY_IN_SECONDS = DEFAULT_AUDIO_LATENCY_IN_MILLI / 1000;
var WASMBOY_MIN_TIME_REMAINING_IN_SECONDS = WASMBOY_MIN_TIME_REMAINING_IN_MILLI / 1000;

// Our sound output Location, we will initialize this in init
var WASMBOY_SOUND_OUTPUT_LOCATION = 0;

var getUnsignedAudioSampleAsFloat = function getUnsignedAudioSampleAsFloat(audioSample) {
  // Subtract 1 as it is added so the value is not empty
  audioSample -= 1;
  // Divide by 127 to get back to our float scale
  audioSample = audioSample / 127;
  // Subtract 1 to regain our sign
  audioSample -= 1;

  // Because of the innacuracy of converting an unsigned int to a signed float
  // We will have some leftovers when doing the conversion.
  // When testing with Pokemon blue, when it is supposed to be complete silence in the intro,
  // It shows 0.007874015748031482, meaning we want to cut our values lower than this
  if (Math.abs(audioSample) < 0.008) {
    audioSample = 0;
  }

  // Return, but divide by lower volume, PCM is loouuuuddd
  return audioSample / 2.5;
};

var audio_WasmBoyAudioService = function () {
  function WasmBoyAudioService() {
    audio__classCallCheck(this, WasmBoyAudioService);

    // Wasmboy instance and memory
    this.wasmInstance = undefined;
    this.wasmByteMemory = undefined;

    this.audioContext = undefined;
    this.audioBuffer = undefined;
    // The play time for our audio samples
    this.audioPlaytime = undefined;
    this.audioSources = [];

    // Average fps for time stretching
    this.averageTimeStretchFps = [];
  }

  WasmBoyAudioService.prototype.initialize = function initialize(wasmInstance, wasmByteMemory) {
    this.wasmInstance = wasmInstance;
    this.wasmByteMemory = wasmByteMemory;

    // Initialiuze our cached wasm constants
    WASMBOY_SOUND_OUTPUT_LOCATION = this.wasmInstance.exports.soundOutputLocation;

    this.audioSources = [];
    this.averageTimeStretchFps = [];

    // Get our Audio context
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return src.resolve();
  };

  // Function to queue up and audio buyffer to be played
  // Returns a promise so that we may "sync by audio"
  // https://www.reddit.com/r/EmuDev/comments/5gkwi5/gb_apu_sound_emulation/dau8e2w/


  WasmBoyAudioService.prototype.playAudio = function playAudio(currentFps, allowFastSpeedStretching) {
    var _this = this;

    return new src(function (resolve) {

      // Find our averageFps
      var fps = currentFps || 60;
      // TODO Make this a constant
      var fpsCap = 59;

      // Find our average fps for time stretching
      _this.averageTimeStretchFps.push(currentFps);
      // TODO Make the multiplier Const the timeshift speed
      if (_this.averageTimeStretchFps.length > Math.floor(fpsCap * 3)) {
        _this.averageTimeStretchFps.shift();
      }

      // Make sure we have a minimum number of time stretch fps timestamps to judge the average time
      if (_this.averageTimeStretchFps.length >= fpsCap) {
        fps = _this.averageTimeStretchFps.reduce(function (accumulator, currentValue) {
          return accumulator + currentValue;
        });
        fps = Math.floor(fps / _this.averageTimeStretchFps.length);
      }

      // Find if we should time stretch this sample or not from our current fps
      var playbackRate = 1.0;
      if (fps < fpsCap || allowFastSpeedStretching) {
        // Has to be 60 to get accurent playback regarless of fps cap
        playbackRate = playbackRate * (fps / 60);
        if (playbackRate <= 0) {
          playbackRate = 0.01;
        }
      }

      // Check if we need more samples yet
      var timeUntilNextSample = void 0;
      if (_this.audioPlaytime) {
        timeUntilNextSample = _this.audioPlaytime - _this.audioContext.currentTime;
        if (timeUntilNextSample > WASMBOY_MIN_TIME_REMAINING_IN_SECONDS) {
          resolve();
          return;
        }
      }

      // Check if we made it in time
      // Idea from: https://github.com/binji/binjgb/blob/master/demo/demo.js
      var audioContextCurrentTime = _this.audioContext.currentTime;
      var audioContextCurrentTimeWithLatency = audioContextCurrentTime + DEFAULT_AUDIO_LATENCY_IN_SECONDS;
      _this.audioPlaytime = _this.audioPlaytime || audioContextCurrentTimeWithLatency;

      if (_this.audioPlaytime < audioContextCurrentTime) {
        // We took too long, or something happen and hiccup'd the emulator, reset audio playback times
        //console.log(`[Wasmboy] Reseting Audio Playback time: ${this.audioPlaytime.toFixed(2)} < ${audioContextCurrentTimeWithLatency.toFixed(2)}, Audio Queue Index: ${this.wasmInstance.exports.getAudioQueueIndex()}`);
        _this.cancelAllAudio();
        _this.audioPlaytime = audioContextCurrentTimeWithLatency;
        resolve();
        return;
      }

      // Cache the audio queue indec here, jumping to wasm is expensive
      var wasmAudioQueueIndex = _this.wasmInstance.exports.getAudioQueueIndex();

      // Lastly, check if we even have any samples we can play
      if (wasmAudioQueueIndex < 4) {
        resolve();
        return true;
      }

      // We made it! Go ahead and grab and play the pcm samples
      var wasmBoyNumberOfSamples = wasmAudioQueueIndex;

      _this.audioBuffer = _this.audioContext.createBuffer(2, wasmBoyNumberOfSamples, WASMBOY_SAMPLE_RATE);
      var leftChannelBuffer = _this.audioBuffer.getChannelData(0);
      var rightChannelBuffer = _this.audioBuffer.getChannelData(1);

      // Our index on our left/right buffers
      var bufferIndex = 0;

      // Our total number of stereo samples
      var wasmBoyNumberOfSamplesForStereo = wasmBoyNumberOfSamples * 2;

      // Left Channel
      for (var i = 0; i < wasmBoyNumberOfSamplesForStereo; i = i + 2) {
        leftChannelBuffer[bufferIndex] = getUnsignedAudioSampleAsFloat(_this.wasmByteMemory[i + WASMBOY_SOUND_OUTPUT_LOCATION]);
        bufferIndex++;
      }

      // Reset the buffer index
      bufferIndex = 0;

      // Right Channel
      for (var _i = 1; _i < wasmBoyNumberOfSamplesForStereo; _i = _i + 2) {
        rightChannelBuffer[bufferIndex] = getUnsignedAudioSampleAsFloat(_this.wasmByteMemory[_i + WASMBOY_SOUND_OUTPUT_LOCATION]);
        bufferIndex++;
      }

      // Reset the Audio Queue
      _this.wasmInstance.exports.resetAudioQueue();

      // Get an AudioBufferSourceNode.
      // This is the AudioNode to use when we want to play an AudioBuffer
      var source = _this.audioContext.createBufferSource();

      // set the buffer in the AudioBufferSourceNode
      source.buffer = _this.audioBuffer;

      // Set our playback rate for time resetretching
      source.playbackRate.setValueAtTime(playbackRate, _this.audioContext.currentTime);

      // connect the AudioBufferSourceNode to the
      // destination so we can hear the sound
      source.connect(_this.audioContext.destination);

      // start the source playing
      source.start(_this.audioPlaytime);

      // Set our new audio playtime goal
      var sourcePlaybackLength = wasmBoyNumberOfSamples / (WASMBOY_SAMPLE_RATE * playbackRate);
      _this.audioPlaytime = _this.audioPlaytime + sourcePlaybackLength;

      // Cancel all audio sources on the tail that play before us
      while (_this.audioSources[_this.audioSources.length - 1] && _this.audioSources[_this.audioSources.length - 1].playtime <= _this.audioPlaytime) {
        _this.audioSources[_this.audioSources.length - 1].source.stop();
        _this.audioSources.pop();
      }

      // Add the source so we can stop this if needed
      _this.audioSources.push({
        source: source,
        playTime: _this.audioPlaytime,
        fps: fps
      });

      // Shift ourselves out when finished
      var timeUntilSourceEnds = _this.audioPlaytime - _this.audioContext.currentTime + 500;
      setTimeout(function () {
        _this.audioSources.shift();
      }, timeUntilSourceEnds);

      resolve();
    });
  };

  WasmBoyAudioService.prototype.cancelAllAudio = function cancelAllAudio() {
    // Cancel all audio That was queued to play
    for (var i = 0; i < this.audioSources.length; i++) {
      if (this.audioSources[i].playTime > this.audioPlaytime) {
        this.audioSources[i].source.stop();
      }
    }

    // Reset our audioPlaytime
    this.audioPlaytime = this.audioContext.currentTime + DEFAULT_AUDIO_LATENCY_IN_SECONDS;
  };

  WasmBoyAudioService.prototype.debugSaveCurrentAudioBufferToWav = function debugSaveCurrentAudioBufferToWav() {

    if (!this.audioBuffer) {
      return;
    }

    // https://www.npmjs.com/package/audiobuffer-to-wav
    var toWav = __webpack_require__("H4yk");
    // https://github.com/Jam3/audiobuffer-to-wav/blob/master/demo/index.js

    var wav = toWav(this.audioBuffer);
    var blob = new window.Blob([new DataView(wav)], {
      type: 'audio/wav'
    });

    var url = window.URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    document.body.appendChild(anchor);
    anchor.style = 'display: none';
    anchor.href = url;
    anchor.download = 'audio.wav';
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  return WasmBoyAudioService;
}();

var WasmBoyAudio = new audio_WasmBoyAudioService();
// CONCATENATED MODULE: ./node_modules/responsive-gamepad/dist/responsive-gamepad.esm.js
var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

// Define a keyboard key schema
var keyInputSchema = {
  ACTIVE: false,
  KEY_CODE: undefined

  // Define a gamepad button schema
  // https://w3c.github.io/gamepad/#remapping
};var gamepadInputSchema = {
  ACTIVE: false,
  BUTTON_ID: undefined,
  JOYSTICK: {
    AXIS_ID: undefined,
    IS_POSITIVE: undefined
  }
};

var touchInputSchema = {
  ACTIVE: false,
  ELEMENT: undefined,
  TYPE: undefined,
  DIRECTION: undefined,
  EVENT_HANDLER: undefined,
  BOUNDING_RECT: undefined

  // Define our finaly kerboard schema here
};var keyMapSchema = {
  UP: {
    KEYBOARD: [],
    GAMEPAD: [],
    TOUCHPAD: []
  },
  RIGHT: {
    KEYBOARD: [],
    GAMEPAD: [],
    TOUCHPAD: []
  },
  DOWN: {
    KEYBOARD: [],
    GAMEPAD: [],
    TOUCHPAD: []
  },
  LEFT: {
    KEYBOARD: [],
    GAMEPAD: [],
    TOUCHPAD: []
  },
  A: {
    KEYBOARD: [],
    GAMEPAD: [],
    TOUCHPAD: []
  },
  B: {
    KEYBOARD: [],
    GAMEPAD: [],
    TOUCHPAD: []
  },
  SELECT: {
    KEYBOARD: [],
    GAMEPAD: [],
    TOUCHPAD: []
  },
  START: {
    KEYBOARD: [],
    GAMEPAD: [],
    TOUCHPAD: []
  }
};

function getKeyInput(keyCode) {
  var input = _extends({}, keyInputSchema);
  input.KEY_CODE = keyCode;
  return input;
}

function getGamepadInput(gamepadButtonId, axisId, axisIsPositive) {
  var input = _extends({}, gamepadInputSchema);
  input.JOYSTICK = _extends({}, gamepadInputSchema.JOYSTICK);
  if (gamepadButtonId || gamepadButtonId === 0) {
    input.BUTTON_ID = gamepadButtonId;
  } else if (axisId !== undefined && axisIsPositive !== undefined) {
    input.JOYSTICK.AXIS_ID = axisId;
    input.JOYSTICK.IS_POSITIVE = axisIsPositive;
  }
  return input;
}

function getTouchInput(element, type, direction, eventHandler) {
  var input = _extends({}, touchInputSchema);

  // TODO: Check the type for a valid type

  // Add our passed parameters
  input.ELEMENT = element;
  input.TYPE = type;
  input.DIRECTION = direction;
  input.EVENT_HANDLER = eventHandler;

  // Add our bounding rect
  var boundingRect = input.ELEMENT.getBoundingClientRect();
  input.BOUNDING_RECT = boundingRect;

  // Define our eventListener functions
  var eventListenerCallback = function eventListenerCallback(event) {
    if (input.EVENT_HANDLER) {
      input.EVENT_HANDLER(event);
    }
  };

  // Add event listeners to the element
  input.ELEMENT.addEventListener("touchstart", eventListenerCallback);
  input.ELEMENT.addEventListener("touchmove", eventListenerCallback);
  input.ELEMENT.addEventListener("touchend", eventListenerCallback);
  input.ELEMENT.addEventListener("mousedown", eventListenerCallback);
  input.ELEMENT.addEventListener("mouseup", eventListenerCallback);

  return input;
}

function KeyMapSchema() {
  return _extends({}, keyMapSchema);
}

var Key = {

  BACKSPACE: 8,
  TAB: 9,
  RETURN: 13,
  SHIFT: 16,
  CTRL: 17,
  ALT: 18,
  ESCAPE: 27,
  SPACE: 32,
  PAGE_UP: 33,
  PAGE_DOWN: 34,
  END: 35,
  HOME: 36,

  ARROW_LEFT: 37,
  ARROW_UP: 38,
  ARROW_RIGHT: 39,
  ARROW_DOWN: 40,

  W: 87,
  A: 65,
  S: 83,
  D: 68,
  Q: 81,
  E: 69,
  X: 88,
  Z: 90,

  SEMI_COLON: 186,
  SINGLE_QUOTE: 222,
  BACK_SLASH: 220,

  NUMPAD_0: 96,
  NUMPAD_1: 97,
  NUMPAD_2: 98,
  NUMPAD_3: 99,
  NUMPAD_4: 100,
  NUMPAD_5: 101,
  NUMPAD_6: 102,
  NUMPAD_7: 103,
  NUMPAD_8: 104,
  NUMPAD_9: 105
};

var keymap = KeyMapSchema();

// Up
keymap.UP.KEYBOARD.push(getKeyInput(Key.ARROW_UP));
keymap.UP.KEYBOARD.push(getKeyInput(Key.W));
keymap.UP.KEYBOARD.push(getKeyInput(Key.NUMPAD_8));
keymap.UP.GAMEPAD.push(getGamepadInput(12));
keymap.UP.GAMEPAD.push(getGamepadInput(false, 1, false));
keymap.UP.GAMEPAD.push(getGamepadInput(false, 3, false));

// Right
keymap.RIGHT.KEYBOARD.push(getKeyInput(Key.ARROW_RIGHT));
keymap.RIGHT.KEYBOARD.push(getKeyInput(Key.D));
keymap.RIGHT.KEYBOARD.push(getKeyInput(Key.NUMPAD_6));
keymap.RIGHT.GAMEPAD.push(getGamepadInput(15));
keymap.RIGHT.GAMEPAD.push(getGamepadInput(false, 0, true));
keymap.RIGHT.GAMEPAD.push(getGamepadInput(false, 2, true));

// Down
keymap.DOWN.KEYBOARD.push(getKeyInput(Key.ARROW_DOWN));
keymap.DOWN.KEYBOARD.push(getKeyInput(Key.S));
keymap.DOWN.KEYBOARD.push(getKeyInput(Key.NUMPAD_5));
keymap.DOWN.KEYBOARD.push(getKeyInput(Key.NUMPAD_2));
keymap.DOWN.GAMEPAD.push(getGamepadInput(13));
keymap.DOWN.GAMEPAD.push(getGamepadInput(false, 1, true));
keymap.DOWN.GAMEPAD.push(getGamepadInput(false, 3, true));

// Left
keymap.LEFT.KEYBOARD.push(getKeyInput(Key.ARROW_LEFT));
keymap.LEFT.KEYBOARD.push(getKeyInput(Key.A));
keymap.LEFT.KEYBOARD.push(getKeyInput(Key.NUMPAD_4));
keymap.LEFT.GAMEPAD.push(getGamepadInput(14));
keymap.LEFT.GAMEPAD.push(getGamepadInput(false, 0, false));
keymap.LEFT.GAMEPAD.push(getGamepadInput(false, 2, false));

// A
keymap.A.KEYBOARD.push(getKeyInput(Key.X));
keymap.A.KEYBOARD.push(getKeyInput(Key.SEMI_COLON));
keymap.A.KEYBOARD.push(getKeyInput(Key.NUMPAD_7));
keymap.A.GAMEPAD.push(getGamepadInput(0));
keymap.A.GAMEPAD.push(getGamepadInput(1));

// B
keymap.B.KEYBOARD.push(getKeyInput(Key.Z));
keymap.B.KEYBOARD.push(getKeyInput(Key.ESCAPE));
keymap.B.KEYBOARD.push(getKeyInput(Key.SINGLE_QUOTE));
keymap.B.KEYBOARD.push(getKeyInput(Key.BACKSPACE));
keymap.B.KEYBOARD.push(getKeyInput(Key.NUMPAD_9));
keymap.B.GAMEPAD.push(getGamepadInput(2));
keymap.B.GAMEPAD.push(getGamepadInput(3));

// Start
keymap.START.KEYBOARD.push(getKeyInput(Key.RETURN));
keymap.START.KEYBOARD.push(getKeyInput(Key.SPACE));
keymap.START.KEYBOARD.push(getKeyInput(Key.NUMPAD_3));
keymap.START.GAMEPAD.push(getGamepadInput(9));

// Select
keymap.SELECT.KEYBOARD.push(getKeyInput(Key.SHIFT));
keymap.SELECT.KEYBOARD.push(getKeyInput(Key.TAB));
keymap.SELECT.KEYBOARD.push(getKeyInput(Key.BACK_SLASH));
keymap.SELECT.KEYBOARD.push(getKeyInput(Key.NUMPAD_1));
keymap.SELECT.GAMEPAD.push(getGamepadInput(8));

var KEYMAP = keymap;

var classCallCheck = function classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

// HTML Tags that can be focused on, where the library should be disabled
// https://www.w3schools.com/tags/ref_byfunc.asp
var INPUT_HTML_TAGS = ['input', 'textarea', 'button', 'select', 'option', 'optgroup', 'label', 'datalist'];

// Helpers for accessing gamepad
// Similar to: https://github.com/torch2424/picoDeploy/blob/master/src/assets/3pLibs/pico8gamepad/pico8gamepad.js
function getAnalogStickAxis(gamepad, axisId) {
  return gamepad.axes[axisId] || 0.0;
}

function isButtonPressed(gamepad, buttonId) {
  return gamepad.buttons[buttonId] ? gamepad.buttons[buttonId].pressed : false;
}

var ResponsiveGamepadService = function () {
  function ResponsiveGamepadService() {
    classCallCheck(this, ResponsiveGamepadService);

    // Our settings
    this.gamepadAnalogStickDeadZone = 0.25;
    this.keyMapKeys = Object.keys(KeyMapSchema());
    this.keyMap = KEYMAP;
  }

  createClass(ResponsiveGamepadService, [{
    key: 'initialize',
    value: function initialize(keyMap) {
      var _this = this;

      // Add our key event listeners
      window.addEventListener('keyup', function (event) {
        _this.updateKeyboard(event);
      });
      window.addEventListener('keydown', function (event) {
        _this.updateKeyboard(event);
      });

      // Add a resize listen to update the gamepad rect on resize
      window.addEventListener("resize", function () {
        _this.updateTouchpadRect();
      });

      if (keyMap) {
        this.keyMap = keyMap;
      }
    }
  }, {
    key: 'addTouchInput',
    value: function addTouchInput(keyMapKey, element, type, direction) {
      var _this2 = this;

      // Declare our touch input
      // TODO: May have to add the event handler after getting the input
      var touchInput = void 0;
      touchInput = getTouchInput(element, type, direction, function (event) {
        _this2.updateTouchpad(keyMapKey, touchInput, event);
      });

      // Add the input to our keymap
      this.keyMap[keyMapKey].TOUCHPAD.push(touchInput);
    }
  }, {
    key: 'getState',
    value: function getState() {
      var _this3 = this;

      // Keyboard handled by listeners on window

      // Update the gamepad state
      this.updateGamepad();

      // Touch Handled by listeners on touchInputs

      // Create an abstracted controller state
      var controllerState = {};

      // Loop through our Keys, and quickly build our controller state
      this.keyMapKeys.forEach(function (key) {

        // Find if any of the keyboard, gamepad or touchpad buttons are pressed
        var keyboardState = _this3.keyMap[key].KEYBOARD.some(function (keyInput) {
          return keyInput.ACTIVE;
        });

        if (keyboardState) {
          controllerState[key] = true;
          return;
        }

        // Find if any of the keyboard, gamepad or touchpad buttons are pressed
        var gamepadState = _this3.keyMap[key].GAMEPAD.some(function (gamepadInput) {
          return gamepadInput.ACTIVE;
        });

        if (gamepadState) {
          controllerState[key] = true;
          return;
        }

        // Find if any of the keyboard, gamepad or touchpad buttons are pressed
        var touchState = _this3.keyMap[key].TOUCHPAD.some(function (touchInput) {
          return touchInput.ACTIVE;
        });

        if (touchState) {
          controllerState[key] = true;
          return;
        }

        controllerState[key] = false;
      });

      // Return the controller state in case we need something from it
      return controllerState;
    }

    // Function to handle keyboard update events

  }, {
    key: 'updateKeyboard',
    value: function updateKeyboard(keyEvent) {
      var _this4 = this;

      // Ignore the event if focus on a input-table field
      // https://www.w3schools.com/tags/ref_byfunc.asp
      if (keyEvent && keyEvent.target && keyEvent.target.tagName) {
        var isTargetInputField = INPUT_HTML_TAGS.some(function (htmlTag) {
          if (keyEvent && keyEvent.target.tagName.toLowerCase() === htmlTag.toLowerCase()) {
            return true;
          }
          return false;
        });

        if (isTargetInputField) {
          return;
        }
      }

      // Get the new state of the key
      var isPressed = false;
      if (keyEvent.type === 'keydown') {
        isPressed = true;
      }

      // Loop through our keys
      this.keyMapKeys.forEach(function (key) {
        _this4.keyMap[key].KEYBOARD.forEach(function (keyInput, index) {
          if (keyInput.KEY_CODE === keyEvent.keyCode) {
            _this4.keyMap[key].KEYBOARD[index].ACTIVE = isPressed;
          }
        });
      });

      // If we found a key, prevent default so page wont scroll and things
      keyEvent.preventDefault();
    }

    // Function to check the gamepad API for the gamepad state

  }, {
    key: 'updateGamepad',
    value: function updateGamepad() {
      var _this5 = this;

      // Similar to: https://github.com/torch2424/picoDeploy/blob/master/src/assets/3pLibs/pico8gamepad/pico8gamepad.js
      // Gampad Diagram: https://www.html5rocks.com/en/tutorials/doodles/gamepad/#toc-gamepadinfo
      var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

      var _loop = function _loop(i) {

        // Get our current gamepad
        var gamepad = gamepads[i];

        if (!gamepad) {
          return 'continue';
        }

        // Loop through our keys
        _this5.keyMapKeys.forEach(function (key) {
          _this5.keyMap[key].GAMEPAD.forEach(function (gamepadInput, index) {

            // Check if we are a gamepad button
            if (_this5.keyMap[key].GAMEPAD[index].BUTTON_ID || _this5.keyMap[key].GAMEPAD[index].BUTTON_ID === 0) {
              _this5.keyMap[key].GAMEPAD[index].ACTIVE = isButtonPressed(gamepad, _this5.keyMap[key].GAMEPAD[index].BUTTON_ID);
            }

            // Check if we are an axis
            if (_this5.keyMap[key].GAMEPAD[index].JOYSTICK.AXIS_ID !== undefined && _this5.keyMap[key].GAMEPAD[index].JOYSTICK.IS_POSITIVE !== undefined) {
              if (_this5.keyMap[key].GAMEPAD[index].JOYSTICK.IS_POSITIVE) {
                _this5.keyMap[key].GAMEPAD[index].ACTIVE = getAnalogStickAxis(gamepad, _this5.keyMap[key].GAMEPAD[index].JOYSTICK.AXIS_ID) > +_this5.gamepadAnalogStickDeadZone;
              } else {
                _this5.keyMap[key].GAMEPAD[index].ACTIVE = getAnalogStickAxis(gamepad, _this5.keyMap[key].GAMEPAD[index].JOYSTICK.AXIS_ID) < -_this5.gamepadAnalogStickDeadZone;
              }
            }
          });
        });
      };

      for (var i = 0; i < gamepads.length; i++) {
        var _ret = _loop(i);

        if (_ret === 'continue') continue;
      }
    }

    // Function to update button position and size

  }, {
    key: 'updateTouchpadRect',
    value: function updateTouchpadRect() {
      var _this6 = this;

      // Read from the DOM, and get each of our elements position, doing this here, as it is best to read from the dom in sequence
      // use element.getBoundingRect() top, bottom, left, right to get clientX and clientY in touch events :)
      // https://stackoverflow.com/questions/442404/retrieve-the-position-x-y-of-an-html-element
      //console.log("GamepadComponent: Updating Rect()...");
      this.keyMapKeys.forEach(function (key) {
        _this6.keyMap[key].TOUCHPAD.forEach(function (touchInput, index) {
          var boundingRect = _this6.keyMap[key].TOUCHPAD[index].ELEMENT.getBoundingClientRect();
          _this6.keyMap[key].TOUCHPAD[index].BOUNDING_RECT = boundingRect;
        });
      });
    }

    // Reset all Diretion keys for a DPAD for touch Inputs

  }, {
    key: 'resetTouchDpad',
    value: function resetTouchDpad() {
      var _this7 = this;

      var dpadKeys = ['UP', 'RIGHT', 'DOWN', 'LEFT'];

      dpadKeys.forEach(function (dpadKey) {
        _this7.keyMap[dpadKey].TOUCHPAD.forEach(function (touchInput) {
          touchInput.ACTIVE = false;
        });
      });
    }

    // Function called on an event of a touchInput SVG Element

  }, {
    key: 'updateTouchpad',
    value: function updateTouchpad(keyMapKey, touchInput, event) {

      if (!event || event.type.includes('touch') && !event.touches) return;

      //event.stopPropagation();
      event.preventDefault();

      //this.debugCurrentTouch(event);

      // Check for active event types
      if (event.type === "touchstart" || event.type === "touchmove" || event.type === "mousedown") {
        // Active

        if (touchInput.TYPE === 'DPAD') {

          // Calculate for the correct key
          // Only using the first touch, since we shouldn't be having two fingers on the dpad
          var touch = void 0;
          if (event.type.includes('touch')) {
            touch = event.touches[0];
          } else if (event.type.includes('mouse')) {
            touch = event;
          }

          // Find if the horizontal or vertical influence is greater
          // Find our centers of our rectangles, and our unbiased X Y values on the rect
          var rectCenterX = (touchInput.BOUNDING_RECT.right - touchInput.BOUNDING_RECT.left) / 2;
          var rectCenterY = (touchInput.BOUNDING_RECT.bottom - touchInput.BOUNDING_RECT.top) / 2;
          var touchX = touch.clientX - touchInput.BOUNDING_RECT.left;
          var touchY = touch.clientY - touchInput.BOUNDING_RECT.top;

          // Lesson From: picoDeploy
          // Fix for shoot button causing the character to move right on multi touch error
          // + 50 for some buffer
          if (touchX > rectCenterX + touchInput.BOUNDING_RECT.width / 2 + 50) {
            // Ignore the event
            return;
          }

          // Create an additonal influece for horizontal, to make it feel better
          var horizontalInfluence = touchInput.BOUNDING_RECT.width / 8;

          // Determine if we are horizontal or vertical
          var isHorizontal = Math.abs(rectCenterX - touchX) + horizontalInfluence > Math.abs(rectCenterY - touchY);

          // Find if left or right from width, vice versa for height
          if (isHorizontal) {
            // Add a horizontal dead zone
            var deadzoneSize = touchInput.BOUNDING_RECT.width / 20;
            if (Math.abs(touchInput.BOUNDING_RECT.width / 2 - touchX) > deadzoneSize) {

              var isLeft = touchX < touchInput.BOUNDING_RECT.width / 2;

              if (isLeft && touchInput.DIRECTION === 'LEFT') {
                touchInput.ACTIVE = true;
              } else if (!isLeft && touchInput.DIRECTION === 'RIGHT') {
                touchInput.ACTIVE = true;
              } else {
                touchInput.ACTIVE = false;
              }
            }
          } else {
            var isUp = touchY < touchInput.BOUNDING_RECT.height / 2;
            if (isUp && touchInput.DIRECTION === 'UP') {
              touchInput.ACTIVE = true;
            } else if (!isUp && touchInput.DIRECTION === 'DOWN') {
              touchInput.ACTIVE = true;
            } else {
              touchInput.ACTIVE = false;
            }
          }
        }

        // Button Type
        if (touchInput.TYPE === 'BUTTON') {
          touchInput.ACTIVE = true;
        }
      } else {
        // Not active

        // Handle Dpad Type
        if (touchInput.TYPE === 'DPAD') {
          this.resetTouchDpad();
        }

        // Button Type
        if (touchInput.TYPE === 'BUTTON') {
          touchInput.ACTIVE = false;
        }
      }
    }
  }]);
  return ResponsiveGamepadService;
}();

// Exports


var ResponsiveGamepad = new ResponsiveGamepadService();


// CONCATENATED MODULE: ./lib/controller/controller.js
function controller__classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }


// https://github.com/torch2424/responsive-gamepad


var controller_WasmBoyControllerService = function () {
  function WasmBoyControllerService() {
    controller__classCallCheck(this, WasmBoyControllerService);

    // Our wasm instance
    this.wasmInstance = undefined;
  }

  WasmBoyControllerService.prototype.initialize = function initialize(wasmInstance) {
    this.wasmInstance = wasmInstance;

    ResponsiveGamepad.initialize();

    return src.resolve();
  };

  WasmBoyControllerService.prototype.addTouchInput = function addTouchInput(keyMapKey, element, type, direction) {
    ResponsiveGamepad.addTouchInput(keyMapKey, element, type, direction);
  };

  WasmBoyControllerService.prototype.updateController = function updateController() {

    // Create an abstracted controller state
    var controllerState = ResponsiveGamepad.getState();

    // Set the new controller state on the instance
    this.wasmInstance.exports.setJoypadState(controllerState.UP ? 1 : 0, controllerState.RIGHT ? 1 : 0, controllerState.DOWN ? 1 : 0, controllerState.LEFT ? 1 : 0, controllerState.A ? 1 : 0, controllerState.B ? 1 : 0, controllerState.SELECT ? 1 : 0, controllerState.START ? 1 : 0);

    // Return the controller state in case we need something from it
    return controllerState;
  };

  return WasmBoyControllerService;
}();

var WasmBoyController = new controller_WasmBoyControllerService();
// CONCATENATED MODULE: ./lib/memory/idb.js
// Get our idb instance, and initialize to asn idb-keyval
// This is so we don't get the default keyval DB name. And will allow
// Parent projects to use the slimmer idb keyval
// https://www.npmjs.com/package/idb
var idb = __webpack_require__("5EQ/");

var keyval = false;

// Get our idb dPromise
if (typeof window !== 'undefined') {
  var dbPromise = idb.open('wasmboy', 1, function (upgradeDB) {
    upgradeDB.createObjectStore('keyval');
  });

  // Get our idb-keyval instance
  keyval = {
    get: function get(key) {
      return dbPromise.then(function (db) {
        return db.transaction('keyval').objectStore('keyval').get(key);
      });
    },
    set: function set(key, val) {
      return dbPromise.then(function (db) {
        var tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').put(val, key);
        return tx.complete;
      });
    },
    delete: function _delete(key) {
      return dbPromise.then(function (db) {
        var tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').delete(key);
        return tx.complete;
      });
    },
    clear: function clear() {
      return dbPromise.then(function (db) {
        var tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').clear();
        return tx.complete;
      });
    },
    keys: function keys() {
      return dbPromise.then(function (db) {
        var tx = db.transaction('keyval');
        var keys = [];
        var store = tx.objectStore('keyval');

        // This would be store.getAllKeys(), but it isn't supported by Edge or Safari.
        // openKeyCursor isn't supported by Safari, so we fall back
        (store.iterateKeyCursor || store.iterateCursor).call(store, function (cursor) {
          if (!cursor) return;
          keys.push(cursor.key);
          cursor.continue();
        });

        return tx.complete.then(function () {
          return keys;
        });
      });
    }
  };
}

var idbKeyval = keyval;
// CONCATENATED MODULE: ./lib/memory/memory.js
var memory__extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function memory__classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }




// Going to set the key for idbKeyval as the cartridge header.
// Then, for each cartridge, it will return an object.
// there will be a cartridgeRam Key, settings Key, and a saveState key
// Not going to make one giant object, as we want to keep idb transactions light and fast

var WASMBOY_UNLOAD_STORAGE = 'WASMBOY_UNLOAD_STORAGE';

//  Will save the state in parts, to easy memory map changes:
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
var WASMBOY_SAVE_STATE_SCHEMA = {
  wasmBoyMemory: {
    wasmBoyInternalState: [],
    wasmBoyPaletteMemory: [],
    gameBoyMemory: [],
    cartridgeRam: []
  },
  date: undefined,
  name: undefined,
  isAuto: undefined

  // Define some constants since calls to wasm are expensive
};var WASMBOY_GAME_BYTES_LOCATION = 0;
var WASMBOY_GAME_RAM_BANKS_LOCATION = 0;
var WASMBOY_INTERNAL_STATE_SIZE = 0;
var WASMBOY_INTERNAL_STATE_LOCATION = 0;
var WASMBOY_INTERNAL_MEMORY_SIZE = 0;
var WASMBOY_INTERNAL_MEMORY_LOCATION = 0;
var WASMBOY_PALETTE_MEMORY_SIZE = 0;
var WASMBOY_PALETTE_MEMORY_LOCATION = 0;

// Private function to get the cartridge header
var getCartridgeHeader = function getCartridgeHeader(wasmInstance, wasmByteMemory) {

  if (!wasmByteMemory) {
    return false;
  }

  // Header is at 0x0134 - 0x014F
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  var headerLength = 0x014F - 0x0134;
  var headerArray = new Uint8Array(headerLength);
  for (var i = 0; i <= headerLength; i++) {
    // Get the CARTRIDGE_ROM + the offset to point us at the header, plus the current byte
    headerArray[i] = wasmByteMemory[WASMBOY_GAME_BYTES_LOCATION + 0x0134 + i];
  }

  return headerArray;
};

// Private function to get the caretridge ram
var getCartridgeRam = function getCartridgeRam(wasmInstance, wasmByteMemory) {

  if (!wasmByteMemory) {
    return false;
  }

  // Depening on the rom type, we will have different ram sizes.
  // Due memory restrictions described in:
  // https://developers.google.com/web/fundamentals/instant-and-offline/web-storage/offline-for-pwa
  // We will make sure to only store as much as we need per ROM :)

  // Similar to `initializeCartridgeType()` in `wasm/memory/memory.ts`
  // We will determine our cartridge type
  // Get our game MBC type from the cartridge header
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  var cartridgeType = wasmByteMemory[WASMBOY_GAME_BYTES_LOCATION + 0x0147];

  var ramSize = undefined;
  if (cartridgeType === 0x00) {
    // No memory for this rom type
    return false;
  } else if (cartridgeType >= 0x01 && cartridgeType <= 0x03) {
    // MBC1 32KB of Ram
    ramSize = 0x8000;
  } else if (cartridgeType >= 0x05 && cartridgeType <= 0x06) {
    // MBC2 512X4 Bytes, 2KB
    ramSize = 0x800;
  } else if (cartridgeType >= 0x0F && cartridgeType <= 0x13) {
    // MBC3 32KB of Ram
    ramSize = 0x8000;
  } else if (cartridgeType >= 0x19 && cartridgeType <= 0x1E) {
    // MBC5 128KB of Ram
    ramSize = 0x20000;
  }

  if (!ramSize) {
    return false;
  }

  // Finally fill our cartridgeRam from the ram in memory
  var cartridgeRam = new Uint8Array(ramSize);

  for (var i = 0; i < ramSize; i++) {
    cartridgeRam[i] = wasmByteMemory[WASMBOY_GAME_RAM_BANKS_LOCATION + i];
  }

  return cartridgeRam;
};

// Function to return a save state of the current memory
var getSaveState = function getSaveState(wasmInstance, wasmByteMemory, saveStateCallback, saveStateName) {

  var cartridgeRam = getCartridgeRam(wasmInstance, wasmByteMemory);

  var wasmBoyInternalState = new Uint8Array(WASMBOY_INTERNAL_STATE_SIZE);
  var wasmBoyPaletteMemory = new Uint8Array(WASMBOY_PALETTE_MEMORY_SIZE);
  var gameBoyMemory = new Uint8Array(WASMBOY_INTERNAL_MEMORY_SIZE);

  for (var i = 0; i < WASMBOY_INTERNAL_STATE_SIZE; i++) {
    wasmBoyInternalState[i] = wasmByteMemory[i + WASMBOY_INTERNAL_STATE_LOCATION];
  }

  for (var _i = 0; _i < WASMBOY_PALETTE_MEMORY_SIZE; _i++) {
    wasmBoyPaletteMemory[_i] = wasmByteMemory[_i + WASMBOY_PALETTE_MEMORY_LOCATION];
  }

  for (var _i2 = 0; _i2 < WASMBOY_INTERNAL_MEMORY_SIZE; _i2++) {
    gameBoyMemory[_i2] = wasmByteMemory[_i2 + WASMBOY_INTERNAL_MEMORY_LOCATION];
  }

  var saveState = memory__extends({}, WASMBOY_SAVE_STATE_SCHEMA);

  saveState.wasmBoyMemory.wasmBoyInternalState = wasmBoyInternalState;
  saveState.wasmBoyMemory.wasmBoyPaletteMemory = wasmBoyPaletteMemory;
  saveState.wasmBoyMemory.gameBoyMemory = gameBoyMemory;
  saveState.wasmBoyMemory.cartridgeRam = cartridgeRam;
  saveState.date = Date.now();
  saveState.isAuto = false;
  saveState.name = saveStateName;

  if (saveStateCallback) {
    saveState = saveStateCallback(saveState);
  }

  return saveState;
};

var loadSaveState = function loadSaveState(wasmInstance, wasmByteMemory, saveState) {

  for (var i = 0; i < WASMBOY_INTERNAL_STATE_SIZE; i++) {
    wasmByteMemory[i + WASMBOY_INTERNAL_STATE_LOCATION] = saveState.wasmBoyMemory.wasmBoyInternalState[i];
  }

  for (var _i3 = 0; _i3 < WASMBOY_PALETTE_MEMORY_SIZE; _i3++) {
    wasmByteMemory[_i3 + WASMBOY_PALETTE_MEMORY_LOCATION] = saveState.wasmBoyMemory.wasmBoyPaletteMemory[_i3];
  }

  for (var _i4 = 0; _i4 < WASMBOY_INTERNAL_MEMORY_SIZE; _i4++) {
    wasmByteMemory[_i4 + WASMBOY_INTERNAL_MEMORY_LOCATION] = saveState.wasmBoyMemory.gameBoyMemory[_i4];
  }

  for (var _i5 = 0; _i5 < saveState.wasmBoyMemory.cartridgeRam.length; _i5++) {
    wasmByteMemory[_i5 + WASMBOY_GAME_RAM_BANKS_LOCATION] = saveState.wasmBoyMemory.cartridgeRam[_i5];
  }

  return true;
};

var memory_WasmBoyMemoryService = function () {
  function WasmBoyMemoryService() {
    memory__classCallCheck(this, WasmBoyMemoryService);

    this.wasmInstance = undefined;
    this.wasmByteMemory = undefined;
    this.saveStateCallback = undefined;
    this.loadedCartridgeMemoryState = {
      ROM: false,
      RAM: false
    };
  }

  WasmBoyMemoryService.prototype.initialize = function initialize(wasmInstance, wasmByteMemory, saveStateCallback) {
    var _this = this;

    this.wasmInstance = wasmInstance;
    this.wasmByteMemory = wasmByteMemory;
    this.saveStateCallback = saveStateCallback;

    this._initializeConstants();

    // Set listeners to ensure we save our cartridge ram before closing
    window.addEventListener("beforeunload", function () {
      // Need to add a retrun value, and force all code in the block to be sync
      // https://stackoverflow.com/questions/7255649/window-onbeforeunload-not-working
      // http://vaughnroyko.com/idbonbeforeunload/
      // https://bugzilla.mozilla.org/show_bug.cgi?id=870645

      // Solution:
      // ~~Try to force sync: https://www.npmjs.com/package/deasync~~ Didn't work, requires fs
      // Save to local storage, and pick it back up in init: https://bugs.chromium.org/p/chromium/issues/detail?id=144862

      // Check if the game is currently playing
      if (_this.wasmInstance.exports.hasCoreStarted() <= 0) {
        return null;
      }

      // Get our cartridge ram and header
      var header = getCartridgeHeader(_this.wasmInstance, _this.wasmByteMemory);
      var cartridgeRam = getCartridgeRam(_this.wasmInstance, _this.wasmByteMemory);

      // Get our save state, and un type our arrays
      var saveState = getSaveState(_this.wasmInstance, _this.wasmByteMemory, _this.saveStateCallback);
      var saveStateMemoryKeys = Object.keys(saveState.wasmBoyMemory);
      for (var i = 0; i < saveStateMemoryKeys.length; i++) {
        saveState.wasmBoyMemory[saveStateMemoryKeys[i]] = Array.prototype.slice.call(saveState.wasmBoyMemory[saveStateMemoryKeys[i]]);
      }

      // Set isAuto
      saveState.isAuto = true;

      // Need to vonert types arrays, and back, or selse wll get indexed JSON
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays
      localStorage.setItem(WASMBOY_UNLOAD_STORAGE, JSON.stringify({
        header: Array.prototype.slice.call(header),
        cartridgeRam: Array.prototype.slice.call(cartridgeRam),
        saveState: saveState
      }));

      return null;
    }, false);

    return new src(function (resolve, reject) {
      // Load any unloaded storage in our localStorage
      var unloadStorage = localStorage.getItem(WASMBOY_UNLOAD_STORAGE);
      if (unloadStorage) {

        var unloadStorageObject = JSON.parse(unloadStorage);
        localStorage.removeItem(WASMBOY_UNLOAD_STORAGE);

        var header = new Uint8Array(unloadStorageObject.header);
        var cartridgeRam = new Uint8Array(unloadStorageObject.cartridgeRam);

        // Get our save state, and re-type our array
        var saveState = unloadStorageObject.saveState;
        if (saveState) {
          var saveStateMemoryKeys = Object.keys(saveState.wasmBoyMemory);
          for (var i = 0; i < saveStateMemoryKeys.length; i++) {
            saveState.wasmBoyMemory[saveStateMemoryKeys[i]] = new Uint8Array(saveState.wasmBoyMemory[saveStateMemoryKeys[i]]);
          }
        }

        _this.saveCartridgeRam(header, cartridgeRam).then(function () {
          _this.saveState(header, saveState).then(function () {
            return resolve();
          }).catch(function (error) {
            return reject(error);
          });
        }).catch(function (error) {
          return reject(error);
        });
      } else {
        return resolve();
      }
    });
  };

  WasmBoyMemoryService.prototype.initializeHeadless = function initializeHeadless(wasmInstance, wasmByteMemory, saveStateCallback) {
    this.wasmInstance = wasmInstance;
    this.wasmByteMemory = wasmByteMemory;
    this.saveStateCallback = saveStateCallback;

    this._initializeConstants();
  };

  WasmBoyMemoryService.prototype._initializeConstants = function _initializeConstants() {
    // Initialiuze our cached wasm constants
    WASMBOY_GAME_BYTES_LOCATION = this.wasmInstance.exports.gameBytesLocation;
    WASMBOY_GAME_RAM_BANKS_LOCATION = this.wasmInstance.exports.gameRamBanksLocation;
    WASMBOY_INTERNAL_STATE_SIZE = this.wasmInstance.exports.wasmBoyInternalStateSize;
    WASMBOY_INTERNAL_STATE_LOCATION = this.wasmInstance.exports.wasmBoyInternalStateLocation;
    WASMBOY_INTERNAL_MEMORY_SIZE = this.wasmInstance.exports.gameBoyInternalMemorySize;
    WASMBOY_INTERNAL_MEMORY_LOCATION = this.wasmInstance.exports.gameBoyInternalMemoryLocation;
    WASMBOY_PALETTE_MEMORY_SIZE = this.wasmInstance.exports.gameboyColorPaletteSize;
    WASMBOY_PALETTE_MEMORY_LOCATION = this.wasmInstance.exports.gameboyColorPaletteLocation;
  };

  WasmBoyMemoryService.prototype.getLoadedCartridgeMemoryState = function getLoadedCartridgeMemoryState() {
    return this.loadedCartridgeMemoryState;
  };

  WasmBoyMemoryService.prototype.clearMemory = function clearMemory() {
    // Clear Wasm memory
    // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
    for (var i = 0; i <= this.wasmByteMemory.length; i++) {
      this.wasmByteMemory[i] = 0;
    }

    this.loadedCartridgeMemoryState.ROM = false;
    this.loadedCartridgeMemoryState.RAM = false;
  };

  // Function to reset stateful sections of memory


  WasmBoyMemoryService.prototype.resetMemory = function resetMemory() {
    for (var i = 0; i <= WASMBOY_GAME_BYTES_LOCATION; i++) {
      this.wasmByteMemory[i] = 0;
    }

    this.loadedCartridgeMemoryState.RAM = false;
  };

  WasmBoyMemoryService.prototype.loadCartridgeRom = function loadCartridgeRom(gameBytes, isGbcEnabled, bootRom) {

    // Load the game data into actual memory
    for (var i = 0; i < gameBytes.length; i++) {
      if (gameBytes[i]) {
        this.wasmByteMemory[WASMBOY_GAME_BYTES_LOCATION + i] = gameBytes[i];
      }
    }

    // TODO: Handle getting a boot rom
    this.wasmInstance.exports.initialize(isGbcEnabled ? 1 : 0, 0);

    this.loadedCartridgeMemoryState.ROM = true;
  };

  // Function to save the cartridge ram
  // This emulates the cartridge having a battery to
  // Keep things like Pokemon Save data in memory
  // Also allows passing in a a Uint8Array header and ram to be set manually


  WasmBoyMemoryService.prototype.saveCartridgeRam = function saveCartridgeRam(passedHeader, passedCartridgeRam) {
    var _this2 = this;

    return new src(function (resolve, reject) {
      // Get the entire header in byte memory
      // Each version of a rom can have similar title and checksums
      // Therefore comparing all of it should help with this :)
      // https://drive.google.com/file/d/0B7y-o-Uytiv9OThXWXFCM1FPbGs/view
      var header = void 0;
      var cartridgeRam = void 0;
      if (passedHeader && passedCartridgeRam) {
        header = passedHeader;
        cartridgeRam = passedCartridgeRam;
      } else {
        header = getCartridgeHeader(_this2.wasmInstance, _this2.wasmByteMemory);
        cartridgeRam = getCartridgeRam(_this2.wasmInstance, _this2.wasmByteMemory);
      }

      if (!header || !cartridgeRam) {
        console.error('Error parsing the cartridgeRam or cartridge header', header, cartridgeRam);
        reject('Error parsing the cartridgeRam or cartridge header');
      }

      // Get our cartridge object
      idbKeyval.get(header).then(function (cartridgeObject) {

        if (!cartridgeObject) {
          cartridgeObject = {};
        }

        // Set the cartridgeRam to our cartridgeObject
        cartridgeObject.cartridgeRam = cartridgeRam;

        idbKeyval.set(header, cartridgeObject).then(function () {
          resolve();
        }).catch(function (error) {
          reject(error);
        });
      }).catch(function (error) {
        reject(error);
      });
    });
  };

  // function to load the cartridge ram
  // opposite of above


  WasmBoyMemoryService.prototype.loadCartridgeRam = function loadCartridgeRam() {
    var _this3 = this;

    return new src(function (resolve, reject) {
      // Get the entire header in byte memory
      // Each version of a rom can have similar title and checksums
      // Therefore comparing all of it should help with this :)
      // https://drive.google.com/file/d/0B7y-o-Uytiv9OThXWXFCM1FPbGs/view
      var header = getCartridgeHeader(_this3.wasmInstance, _this3.wasmByteMemory);

      if (!header) {
        reject('Error parsing the cartridge header');
      }

      idbKeyval.get(header).then(function (cartridgeObject) {

        if (!cartridgeObject || !cartridgeObject.cartridgeRam) {
          resolve();
          return;
        }

        // Set the cartridgeRam
        for (var i = 0; i < cartridgeObject.cartridgeRam.length; i++) {
          _this3.wasmByteMemory[WASMBOY_GAME_RAM_BANKS_LOCATION + i] = cartridgeObject.cartridgeRam[i];
        }
        _this3.loadedCartridgeMemoryState.RAM = true;
        resolve();
      }).catch(function (error) {
        reject(error);
      });
    });
  };

  // Function to save the state to the indexeddb


  WasmBoyMemoryService.prototype.saveState = function saveState(passedHeader, passedSaveState) {
    var _this4 = this;

    return new src(function (resolve, reject) {

      // Save our internal wasmboy state to memory
      _this4.wasmInstance.exports.saveState();

      // Get our save state
      var saveState = void 0;
      var header = void 0;
      if (passedHeader && passedSaveState) {
        saveState = passedSaveState;
        header = passedHeader;
      } else {
        saveState = getSaveState(_this4.wasmInstance, _this4.wasmByteMemory, _this4.saveStateCallback);
        header = getCartridgeHeader(_this4.wasmInstance, _this4.wasmByteMemory);
      }

      if (!header) {
        reject('Error parsing the cartridge header');
      }

      idbKeyval.get(header).then(function (cartridgeObject) {

        if (!cartridgeObject) {
          cartridgeObject = {};
        }

        if (!cartridgeObject.saveStates) {
          cartridgeObject.saveStates = [];
        }

        cartridgeObject.saveStates.push(saveState);

        idbKeyval.set(header, cartridgeObject).then(function () {
          resolve();
        }).catch(function (error) {
          reject(error);
        });
      }).catch(function (error) {
        reject(error);
      });
    });
  };

  WasmBoyMemoryService.prototype.loadState = function loadState(saveState) {
    var _this5 = this;

    return new src(function (resolve, reject) {

      var header = getCartridgeHeader(_this5.wasmInstance, _this5.wasmByteMemory);

      if (!header) {
        reject('Error parsing the cartridge header');
      }

      if (saveState) {
        loadSaveState(_this5.wasmInstance, _this5.wasmByteMemory, saveState);

        // Load back out internal wasmboy state from memory
        _this5.wasmInstance.exports.loadState();

        resolve();
      } else {
        idbKeyval.get(header).then(function (cartridgeObject) {

          if (!cartridgeObject || !cartridgeObject.saveStates) {
            reject('No Save State passed, and no cartridge object found');
            return;
          }

          // Load the last save state
          loadSaveState(_this5.wasmInstance, _this5.wasmByteMemory, cartridgeObject.saveStates[0]);

          // Load back out internal wasmboy state from memory
          _this5.wasmInstance.exports.loadState();

          resolve();
        }).catch(function (error) {
          reject(error);
        });
      }
    });
  };

  // Function to reset the state of the wasm core


  WasmBoyMemoryService.prototype.resetState = function resetState(isGbcEnabled, bootRom) {
    this.resetMemory();

    // TODO: Handle getting a boot rom
    this.wasmInstance.exports.initialize(isGbcEnabled ? 1 : 0, 0);
  };

  // Function to return the current cartridge object


  WasmBoyMemoryService.prototype.getCartridgeObject = function getCartridgeObject() {
    var header = getCartridgeHeader(this.wasmInstance, this.wasmByteMemory);
    return idbKeyval.get(header);
  };

  return WasmBoyMemoryService;
}();

// Create a singleton to export


var WasmBoyMemory = new memory_WasmBoyMemoryService();
// CONCATENATED MODULE: ./lib/wasmboy.js
function wasmboy__classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }









// requestAnimationFrame() for headless mode
var raf = __webpack_require__("ommR");

// Function to get performance timestamp
// This is to support node vs. Browser
var getPerformanceTimestamp = function getPerformanceTimestamp() {
  if (typeof window !== 'undefined') {
    return performance.now();
  }
  return Date.now();
};

var wasmboy_WasmBoyLib = function () {

  // Start the request to our wasm module
  function WasmBoyLib() {
    wasmboy__classCallCheck(this, WasmBoyLib);

    this.wasmInstance = undefined;
    this.wasmByteMemory = undefined;
    this.canvasElement = undefined;
    this.paused = false;
    this.pauseFpsThrottle = false;
    this.ready = false;
    this.renderId = false;
    this.updateId = false;
    this.loadedGame = false;

    // Options, can't be undefined
    this.headless = false;
    this.isGbcEnabled = true;
    this.isAudioEnabled = true;
    this.gameboyFrameRate = 60;
    this.fpsTimeStamps = [];
    this.frameSkip = 0;
    this.frameSkipCounter = 0;
    this.saveStateCallback = false;

    // Options for wasm
    this.audioBatchProcessing = false;
    this.graphicsBatchProcessing = false;
    this.timersBatchProcessing = false;
    this.graphicsDisableScanlineRendering = false;
    this.audioAccumulateSamples = false;
    this.tileRendering = false;
    this.tileCaching = false;

    // Debug code
    this.logRequest = false;
    this.performanceTimestamps = {};
  }

  // Function to initialize our Wasmboy


  WasmBoyLib.prototype.initialize = function initialize(canvasElement, wasmBoyOptions) {
    var _this = this;

    // Get our canvas elements
    this.canvasElement = canvasElement;

    // Set our defaults
    this.headless = false;
    this.isAudioEnabled = true;
    this.gameboyFrameRate = 60;
    this.fpsTimeStamps = [];
    this.frameSkip = 0;
    this.frameSkipCounter = 0;

    // Defaults for wasm
    this.audioBatchProcessing = false;
    this.graphicsBatchProcessing = false;
    this.timersBatchProcessing = false;
    this.graphicsDisableScanlineRendering = false;
    this.audioAccumulateSamples = false;

    // Defaults for action callbacks
    this.saveStateCallback = false;

    // set our options
    if (wasmBoyOptions) {

      // Set all options
      Object.keys(wasmBoyOptions).forEach(function (key) {
        if (_this[key] !== undefined) {
          _this[key] = wasmBoyOptions[key];
        }
      });

      // Aliases
      // Gameboy Speed / Framerate
      if (wasmBoyOptions.gameboySpeed) {
        var gameboyFrameRate = Math.floor(wasmBoyOptions.gameboySpeed * 60);
        if (gameboyFrameRate <= 0) {
          gameboyFrameRate = 1;
        }
        this.gameboyFrameRate = gameboyFrameRate;
      }
    }
  };

  // Finish request for wasm module, and fetch game


  WasmBoyLib.prototype.loadGame = function loadGame(game) {
    var _this2 = this;

    // Getting started with wasm
    // http://webassembly.org/getting-started/js-api/
    this.ready = false;
    return new src(function (resolve, reject) {

      // Pause the game in case it was running
      _this2.pauseGame().then(function () {
        // Get our promises
        var initPromises = [_this2._fetchGameAsByteArray(game), _this2._getWasmInstance()];

        if (!_this2.headless && WasmBoyMemory.getLoadedCartridgeMemoryState().RAM) {
          initPromises.push(WasmBoyMemory.saveCartridgeRam());
        }

        src.all(initPromises).then(function (responses) {

          // Save the game that we loaded if we need to reload the game
          _this2.loadedGame = game;

          // Check if we are running headless
          if (_this2.headless) {

            WasmBoyMemory.initializeHeadless(_this2.wasmInstance, _this2.wasmByteMemory, _this2.saveStateCallback);

            // Clear what is currently in memory, then load the cartridge memory
            WasmBoyMemory.clearMemory();
            WasmBoyMemory.resetState();

            // TODO: Handle passing a boot rom
            WasmBoyMemory.loadCartridgeRom(responses[0], false, false);
            _this2.ready = true;

            resolve();
          } else {
            // Finally intialize all of our services
            // Initialize our services
            src.all([WasmBoyGraphics.initialize(_this2.canvasElement, _this2.wasmInstance, _this2.wasmByteMemory), WasmBoyAudio.initialize(_this2.wasmInstance, _this2.wasmByteMemory), WasmBoyController.initialize(_this2.wasmInstance), WasmBoyMemory.initialize(_this2.wasmInstance, _this2.wasmByteMemory, _this2.saveStateCallback)]).then(function () {

              // Clear what is currently in memory, then load the carttridge memory
              WasmBoyMemory.clearMemory();
              WasmBoyMemory.resetState();

              // TODO: Handle passing a boot rom
              WasmBoyMemory.loadCartridgeRom(responses[0], _this2.isGbcEnabled, false);

              // Load the game's cartridge ram
              WasmBoyMemory.loadCartridgeRam().then(function () {
                _this2.ready = true;
                resolve();
              }).catch(function (error) {
                reject(error);
              });
            }).catch(function (error) {
              reject(error);
            });
          }
        }).catch(function (error) {
          reject(error);
        });
      });
    });
  };

  // Function to reset wasmBoy, with an optional set of options


  WasmBoyLib.prototype.reset = function reset(wasmBoyOptions) {

    this.initialize(this.canvasElement, wasmBoyOptions);
    WasmBoyMemory.resetState();
    if (this.wasmInstance) {
      // Run our initialization on the core
      this.wasmInstance.exports.config(this.audioBatchProcessing ? 1 : 0, this.graphicsBatchProcessing ? 1 : 0, this.timersBatchProcessing ? 1 : 0, this.graphicsDisableScanlineRendering ? 1 : 0, this.audioAccumulateSamples ? 1 : 0, this.tileRendering ? 1 : 0, this.tileCaching ? 1 : 0);
    }

    // Reload the game if one was already loaded
    if (this.loadedGame && !this.headless) {
      this.loadGame(this.loadedGame);
    }
  };

  // Function to start the game


  WasmBoyLib.prototype.startGame = function startGame() {
    return this.resumeGame();
  };

  WasmBoyLib.prototype.resumeGame = function resumeGame() {
    var _this3 = this;

    if (!this.ready) {
      return false;
    }

    // Reset the audio queue index to stop weird pauses when trying to load a game
    this.wasmInstance.exports.resetAudioQueue();

    // Start our update and render process
    // Can't time by raf, as raf is not garunteed to be 60fps
    // Need to run like a web game, where updates to the state of the core are done a 60 fps
    // but we can render whenever the user would actually see the changes browser side in a raf
    // https://developer.mozilla.org/en-US/docs/Games/Anatomy
    this._emulatorUpdate();

    // Undo any pause
    this.paused = false;

    if (!this.updateId) {

      var intervalRate = 1000 / this.gameboyFrameRate;

      // Reset the frameTimeStamps
      this.fpsTimeStamps = [];

      // 1000 / 60 = 60fps
      this.updateId = setInterval(function () {
        _this3._emulatorUpdate();
      }, intervalRate);
    }

    if (!this.renderId && !this.headless) {
      this.renderId = raf(function () {
        _this3._emulatorRender();
      });
    }

    // Finally set up out pause fps throttle
    // This will allow us to know if we just un paused
    this.pauseFpsThrottle = true;
    setTimeout(function () {
      _this3.pauseFpsThrottle = false;
    }, 1000);
  };

  // Function to pause the game, returns a promise
  // Will try to wait until the emulation sync is returned, and then will
  // Allow any actions


  WasmBoyLib.prototype.pauseGame = function pauseGame() {
    this.paused = true;

    // Cancel our update and render loop
    raf.cancel(this.renderId);
    this.renderId = false;
    clearInterval(this.updateId);
    this.updateId = false;

    // Wait a raf to ensure everything is done
    return new src(function (resolve) {
      raf(function () {
        resolve();
      });
    });
  };

  // http://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html


  WasmBoyLib.prototype.getFps = function getFps() {
    if (this.pauseFpsThrottle) {
      return this.gameboyFrameRate;
    }
    return this.fpsTimeStamps.length;
  };

  // Function to return the current game object in memory


  WasmBoyLib.prototype.getWasmBoyMemoryForLoadedGame = function getWasmBoyMemoryForLoadedGame() {
    return WasmBoyMemory.getCartridgeObject();
  };

  WasmBoyLib.prototype.saveState = function saveState() {
    var _this4 = this;

    var wasPaused = this.paused;
    // Pause the game in case it was running
    this.pauseGame().then(function () {
      // Save our state to wasmMemory
      WasmBoyMemory.saveState().then(function () {
        if (!wasPaused) {
          _this4.resumeGame();
        }
      });
    });
  };

  WasmBoyLib.prototype.loadState = function loadState(saveState) {
    var _this5 = this;

    var wasPaused = this.paused;
    // Pause the game in case it was running, and set to not ready
    this.pauseGame().then(function () {
      WasmBoyMemory.loadState(saveState).then(function () {
        if (!wasPaused) {
          _this5.resumeGame();
        }
      });
    });
  };

  // Function to run an update on the emulator itself


  WasmBoyLib.prototype._emulatorUpdate = function _emulatorUpdate() {

    // Don't run if paused
    if (this.paused) {
      return true;
    }

    // Track our Fps
    // http://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html
    var currentHighResTime = getPerformanceTimestamp();
    while (this.fpsTimeStamps[0] < currentHighResTime - 1000) {
      this.fpsTimeStamps.shift();
    }

    // Framecap at 60fps
    var currentFps = this.getFps();
    if (currentFps > this.gameboyFrameRate) {
      return true;
    } else {
      this.fpsTimeStamps.push(currentHighResTime);
    }

    // If audio is enabled, sync by audio
    // Check how many samples we have, and if we are getting too ahead, need to skip the update
    // Magic number is from experimenting and this seems to go good
    // TODO: Make this a preference, or calculate from perfrmance.now()
    // TODO Make audio que ocnstant in wasmboy audio, and make itr a function to be callsed in wasmboy audiio
    if (!this.headless && !this.pauseFpsThrottle && this.isAudioEnabled && this.wasmInstance.exports.getAudioQueueIndex() > 6000 * (this.gameboyFrameRate / 120) && this.gameboyFrameRate <= 60) {
      // TODO: Waiting for time stretching to resolve may be causing this
      console.log('Waiting for audio...');
      return true;
    }

    // Update (Execute a frame)
    var response = this.wasmInstance.exports.update();

    // Handle our update() response
    if (response > 0) {
      // See: wasm/cpu/opcodes update() function
      // 1 = render a frame
      // 2 = replace boot rom
      // TODO: Find what should go here
      switch (response) {
        case 1:
        case 2:
          break;
      }

      return true;
    } else {
      console.log('Wasmboy Crashed!');
      console.log('Program Counter: 0x' + this.wasmInstance.exports.getProgramCounter().toString(16));
      console.log('Opcode: 0x' + this.wasmByteMemory[this.wasmInstance.exports.getProgramCounter()].toString(16));
      this.pauseGame();
      return false;
    }
  };

  // Function to render our emulator output


  WasmBoyLib.prototype._emulatorRender = function _emulatorRender() {
    var _this6 = this;

    // Don't run if paused
    if (this.paused) {
      return true;
    }

    // Check if we have frameskip
    var shouldSkipRenderingFrame = false;
    if (this.frameSkip && this.frameSkip > 0) {
      this.frameSkipCounter++;

      if (this.frameSkipCounter < this.frameSkip) {
        shouldSkipRenderingFrame = true;
      } else {
        this.frameSkipCounter = 0;
      }
    }

    // Render the display
    if (!shouldSkipRenderingFrame) {
      WasmBoyGraphics.renderFrame();
    }

    // Play the audio
    if (this.isAudioEnabled) {
      WasmBoyAudio.playAudio(this.getFps(), this.gameboyFrameRate > 60);
    }

    // Update our controller
    WasmBoyController.updateController();

    this.renderId = raf(function () {
      _this6._emulatorRender();
    });
  };

  // Private funciton to returna promise to our wasmModule
  // This allow will re-load the wasm module, that way we can obtain a new wasm instance
  // For each time we load a game


  WasmBoyLib.prototype._getWasmInstance = function _getWasmInstance() {
    var _this7 = this;

    return new src(function (resolve, reject) {

      // Get our wasm instance from our wasmModule
      var memoryBase = index_untouched_default()({
        env: {
          log: function log(message, arg0, arg1, arg2, arg3, arg4, arg5) {
            // Grab our string
            var len = new Uint32Array(_this7.wasmInstance.exports.memory.buffer, message, 1)[0];
            var str = String.fromCharCode.apply(null, new Uint16Array(_this7.wasmInstance.exports.memory.buffer, message + 4, len));
            if (arg0 !== -9999) str = str.replace("$0", arg0);
            if (arg1 !== -9999) str = str.replace("$1", arg1);
            if (arg2 !== -9999) str = str.replace("$2", arg2);
            if (arg3 !== -9999) str = str.replace("$3", arg3);
            if (arg4 !== -9999) str = str.replace("$4", arg4);
            if (arg5 !== -9999) str = str.replace("$5", arg5);

            console.log("[WasmBoy] " + str);
          },
          hexLog: function hexLog(arg0, arg1, arg2, arg3, arg4, arg5) {

            if (!_this7.logRequest) {

              // Grab our arguments, and log as hex
              var logString = '[WasmBoy]';
              if (arg0 !== -9999) logString += ' 0x' + arg0.toString(16) + ' ';
              if (arg1 !== -9999) logString += ' 0x' + arg1.toString(16) + ' ';
              if (arg2 !== -9999) logString += ' 0x' + arg2.toString(16) + ' ';
              if (arg3 !== -9999) logString += ' 0x' + arg3.toString(16) + ' ';
              if (arg4 !== -9999) logString += ' 0x' + arg4.toString(16) + ' ';
              if (arg5 !== -9999) logString += ' 0x' + arg5.toString(16) + ' ';

              // Uncomment to unthrottle
              //console.log(logString);

              // Comment the lines below to disable throttle
              _this7.logRequest = true;
              setTimeout(function () {
                console.log(logString);
                _this7.logRequest = false;
              }, Math.floor(Math.random() * 500));
            }
          },
          performanceTimestamp: function performanceTimestamp(id, value) {

            if (id === -9999) {
              id = 0;
            }

            if (value === -9999) {
              value = 0;
            }

            if (!_this7.performanceTimestamps[id]) {
              _this7.performanceTimestamps[id] = {};
              _this7.performanceTimestamps[id].throttle = false;
              _this7.performanceTimestamps[id].totalTime = 0;
              _this7.performanceTimestamps[id].value = 0;
            }
            if (!_this7.performanceTimestamps[id].throttle) {
              if (_this7.performanceTimestamps[id].timestamp) {
                // sleep a millisecond for hopefully more accurate times
                var endTime = getPerformanceTimestamp();
                var timeDifference = endTime - _this7.performanceTimestamps[id].timestamp;
                _this7.performanceTimestamps[id].throttle = true;
                _this7.performanceTimestamps[id].totalTime += timeDifference;
                console.log('[WasmBoy] Performance Timestamp. ID: ' + id + ', Time: ' + timeDifference + ', value difference: ' + (value - _this7.performanceTimestamps[id].value) + ', total time: ' + _this7.performanceTimestamps[id].totalTime);
                _this7.performanceTimestamps[id].timestamp = false;
                setTimeout(function () {
                  _this7.performanceTimestamps[id].throttle = false;
                }, 100);
              } else {
                _this7.performanceTimestamps[id].timestamp = getPerformanceTimestamp();
                _this7.performanceTimestamps[id].value = value;
              }
            }
          }
        }
      }).then(function (instantiatedWasm) {
        // Using || since rollup and webpack wasm loaders will return differently
        var instance = _this7.wasmInstance = instantiatedWasm.instance || instantiatedWasm;
        var module = instantiatedWasm.module;

        // Get our memory from our wasm instance
        var memory = instance.exports.memory;

        // NOTE: Memory growing is now done in the wasm itself
        // Grow memory to wasmboy memory map
        // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
        // if (memory.buffer.byteLength < this.wasmInstance.exports.wasmMemorySize) {
        //   // Scale to the maximum needed pages
        //   memory.grow(Math.ceil(this.wasmInstance.exports.wasmMemorySize / 1024 / 64));
        // }

        // Will stay in sync
        _this7.wasmByteMemory = new Uint8Array(_this7.wasmInstance.exports.memory.buffer);

        // Run our initialization on the core
        _this7.wasmInstance.exports.config(_this7.audioBatchProcessing ? 1 : 0, _this7.graphicsBatchProcessing ? 1 : 0, _this7.timersBatchProcessing ? 1 : 0, _this7.graphicsDisableScanlineRendering ? 1 : 0, _this7.audioAccumulateSamples ? 1 : 0, _this7.tileRendering ? 1 : 0, _this7.tileCaching ? 1 : 0);
        resolve(_this7.wasmInstance);
      });
    });
  };

  // Private function to fetch a game


  WasmBoyLib.prototype._fetchGameAsByteArray = function _fetchGameAsByteArray(game) {
    var _this8 = this;

    return new src(function (resolve, reject) {
      if (ArrayBuffer.isView(game) && game.constructor === Uint8Array) {
        // Simply resolve with the input
        resolve(game);
        return;
      } else if (typeof game === 'object' && game.size) {
        // Read the file object
        // https://www.javascripture.com/FileReader#readAsArrayBuffer_Blob
        var fileReader = new FileReader();
        fileReader.onload = function () {
          _this8._getGameFromArrayBuffer(game.name, fileReader.result).then(function (byteArray) {
            resolve(byteArray);
          }).catch(function (error) {
            reject(error);
          });
        };
        fileReader.readAsArrayBuffer(game);
      } else {
        // Fetch the file
        unfetch_es(game).then(function (blob) {
          if (!blob.ok) {
            return src.reject(blob);
          }

          return blob.arrayBuffer();
        }).then(function (bytes) {
          _this8._getGameFromArrayBuffer(game, bytes).then(function (byteArray) {
            resolve(byteArray);
          }).catch(function (error) {
            reject(error);
          });
        }).catch(function (error) {
          reject(error);
        });
      }
    });
  };

  // Private function to convert an ArrayBuffer from our file input, into our final Uint8Array
  // Useful for wrapping around .zip files, and using JSZip


  WasmBoyLib.prototype._getGameFromArrayBuffer = function _getGameFromArrayBuffer(fileName, gameBuffer) {
    return new src(function (resolve, reject) {
      if (fileName.endsWith('.zip')) {
        var JSZip = __webpack_require__("WgY6");
        JSZip.loadAsync(gameBuffer).then(function (zip) {
          // Zip is not an array, but it's proto implements a custom forEach()
          var foundGame = false;
          zip.forEach(function (relativePath, zipEntry) {
            if (!foundGame) {
              if (relativePath.endsWith('.gb') || relativePath.endsWith('.gbc')) {
                // Another function implemented on the proto
                foundGame = true;
                zip.file(relativePath).async('uint8array').then(function (gameBuffer) {
                  resolve(gameBuffer);
                });
              }
            }
          });
          if (!foundGame) {
            reject(new Error('The ".zip" did not contain a ".gb" or ".gbc" file!'));
          }
        }, function (error) {
          reject(error);
        });
      } else {
        var byteArray = new Uint8Array(gameBuffer);
        resolve(byteArray);
      }
    });
  };

  return WasmBoyLib;
}();

var WasmBoy = new wasmboy_WasmBoyLib();



// TODO: Remove this, and consolidate public api in Wasmboy

// EXTERNAL MODULE: ./node_modules/load-script/index.js
var load_script = __webpack_require__("PirY");
var load_script_default = /*#__PURE__*/__webpack_require__.n(load_script);

// CONCATENATED MODULE: ./debugger/wasmboyFilePicker/googlePicker/googlePicker.js
var _class, _temp;



function googlePicker__classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// Taken & Preact-ified from: https://github.com/sdoomz/react-google-picker
// And only using OAuth: https://stackoverflow.com/questions/22435410/google-drive-picker-developer-key-is-invalid-error?utm_medium=organic&utm_source=google_rich_qa&utm_campaign=google_rich_qa
// Picker API is super out of date :p




var GOOGLE_SDK_URL = 'https://apis.google.com/js/api.js';

var scriptLoadingStarted = false;

var _ref2 = Object(preact_min["h"])(
  'button',
  null,
  'Open google chooser'
);

var googlePicker_GooglePicker = (_temp = _class = function (_Component) {
  _inherits(GooglePicker, _Component);

  function GooglePicker(props) {
    googlePicker__classCallCheck(this, GooglePicker);

    var _this = _possibleConstructorReturn(this, _Component.call(this, props));

    _this.onApiLoad = _this.onApiLoad.bind(_this);
    _this.onChoose = _this.onChoose.bind(_this);
    return _this;
  }

  GooglePicker.prototype.componentDidMount = function componentDidMount() {
    if (this.isGoogleReady()) {
      // google api is already exists
      // init immediately
      this.onApiLoad();
    } else if (!scriptLoadingStarted) {
      // load google api and the init
      scriptLoadingStarted = true;
      load_script_default()(GOOGLE_SDK_URL, this.onApiLoad);
    } else {
      // is loading
    }
  };

  GooglePicker.prototype.isGoogleReady = function isGoogleReady() {
    return !!window.gapi;
  };

  GooglePicker.prototype.isGoogleAuthReady = function isGoogleAuthReady() {
    return !!window.gapi.auth;
  };

  GooglePicker.prototype.isGooglePickerReady = function isGooglePickerReady() {
    return !!window.google.picker;
  };

  GooglePicker.prototype.onApiLoad = function onApiLoad() {
    window.gapi.load('auth');
    window.gapi.load('picker');
  };

  GooglePicker.prototype.doAuth = function doAuth(callback) {
    window.gapi.auth.authorize({
      client_id: this.props.clientId,
      scope: this.props.scope,
      immediate: this.props.authImmediate
    }, callback);
  };

  GooglePicker.prototype.onChoose = function onChoose(event) {
    var _this2 = this;

    if (!this.isGoogleReady() || !this.isGoogleAuthReady() || !this.isGooglePickerReady() || this.props.disabled) {
      return null;
    }

    var token = window.gapi.auth.getToken();
    var oauthToken = token && token.access_token;

    if (oauthToken) {
      this.createPicker(oauthToken);
    } else {
      this.doAuth(function (_ref) {
        var access_token = _ref.access_token;
        return _this2.createPicker(access_token);
      });
    }
  };

  GooglePicker.prototype.createPicker = function createPicker(oauthToken) {

    this.props.onAuthenticate(oauthToken);

    if (this.props.createPicker) {
      return this.props.createPicker(google, oauthToken);
    }

    var googleViewId = google.picker.ViewId[this.props.viewId];
    var view = new window.google.picker.View(googleViewId);

    if (this.props.mimeTypes) {
      view.setMimeTypes(this.props.mimeTypes.join(','));
    }

    if (!view) {
      throw new Error('Can\'t find view by viewId');
    }

    var picker = new window.google.picker.PickerBuilder().addView(view).setOAuthToken(oauthToken).setCallback(this.props.onChange);

    if (this.props.origin) {
      picker.setOrigin(this.props.origin);
    }

    if (this.props.navHidden) {
      picker.enableFeature(window.google.picker.Feature.NAV_HIDDEN);
    }

    if (this.props.multiselect) {
      picker.enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED);
    }

    picker.build().setVisible(true);
  };

  GooglePicker.prototype.render = function render() {
    return Object(preact_min["h"])(
      'div',
      { onClick: this.onChoose },
      this.props.children ? this.props.children : _ref2
    );
  };

  return GooglePicker;
}(preact_min["Component"]), _class.defaultProps = {
  onChange: function onChange() {},
  onAuthenticate: function onAuthenticate() {},
  scope: ['https://www.googleapis.com/auth/drive.readonly'],
  viewId: 'DOCS',
  authImmediate: false,
  multiselect: false,
  navHidden: false,
  disabled: false
}, _temp);

// EXTERNAL MODULE: ./debugger/wasmboyFilePicker/wasmboyFilePicker.css
var wasmboyFilePicker = __webpack_require__("uCBp");
var wasmboyFilePicker_default = /*#__PURE__*/__webpack_require__.n(wasmboyFilePicker);

// CONCATENATED MODULE: ./debugger/wasmboyFilePicker/wasmboyFilePicker.js
var wasmboyFilePicker__extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };



function wasmboyFilePicker__classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function wasmboyFilePicker__possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function wasmboyFilePicker__inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }






// Public Keys for Google Drive API
var WASMBOY_DEBUGGER_GOOGLE_PICKER_CLIENT_ID = '427833658710-bntpbmf6pimh8trt0n4c36gteomseg61.apps.googleusercontent.com';

// OAuth Key for Google Drive
var googlePickerOAuthToken = '';

var _ref = Object(preact_min["h"])(
  'div',
  { 'class': 'wasmboy__filePicker__services' },
  Object(preact_min["h"])('div', { 'class': 'donut' })
);

var wasmboyFilePicker__ref2 = Object(preact_min["h"])(
  'svg',
  { fill: '#020202', height: '24', viewBox: '0 0 24 24', width: '24', xmlns: 'http://www.w3.org/2000/svg' },
  Object(preact_min["h"])('path', { d: 'M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z' }),
  Object(preact_min["h"])('path', { d: 'M0 0h24v24H0z', fill: 'none' })
);

var _ref3 = Object(preact_min["h"])(
  'span',
  { 'class': 'file-label' },
  'Upload from Device'
);

var _ref4 = Object(preact_min["h"])(
  'svg',
  { fill: '#020202', height: '24', viewBox: '0 0 24 24', width: '24', xmlns: 'http://www.w3.org/2000/svg' },
  Object(preact_min["h"])('path', { d: 'M0 0h24v24H0z', fill: 'none' }),
  Object(preact_min["h"])('path', { d: 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z' })
);

var _ref5 = Object(preact_min["h"])(
  'span',
  { 'class': 'file-label' },
  'Get from Google Drive'
);

var _ref6 = Object(preact_min["h"])(
  'h1',
  null,
  'Load Game'
);

var _ref7 = Object(preact_min["h"])(
  'h2',
  null,
  'Supported file types: ".gb", ".gbc", ".zip"'
);

var wasmboyFilePicker_WasmBoyFilePicker = function (_Component) {
  wasmboyFilePicker__inherits(WasmBoyFilePicker, _Component);

  function WasmBoyFilePicker(props) {
    wasmboyFilePicker__classCallCheck(this, WasmBoyFilePicker);

    // set our state to if we are initialized or not
    var _this = wasmboyFilePicker__possibleConstructorReturn(this, _Component.call(this, props));

    _this.state = {
      currentFileName: 'No Game Selected...',
      isFileLoading: false
    };
    return _this;
  }

  // Allow passing a file
  // https://gist.github.com/AshikNesin/e44b1950f6a24cfcd85330ffc1713513


  WasmBoyFilePicker.prototype.loadLocalFile = function loadLocalFile(event) {
    var _this2 = this;

    this.setFileLoadingStatus(true);
    this.props.wasmboy.loadGame(event.target.files[0]).then(function () {
      console.log('Wasmboy Ready!');
      _this2.props.showNotification('Game Loaded! 🎉');
      _this2.setFileLoadingStatus(false);
    }).catch(function (error) {
      console.log('Load Game Error:', error);
      _this2.props.showNotification('Game Load Error! 😞');
      _this2.setFileLoadingStatus(false);
    });

    // Set our file name
    var newState = wasmboyFilePicker__extends({}, this.state);
    newState.currentFileName = event.target.files[0].name;
    this.setState(newState);
  };

  WasmBoyFilePicker.prototype.loadGoogleDriveFile = function loadGoogleDriveFile(data) {
    var _this3 = this;

    if (data.action === 'picked') {
      // Fetch from the drive api to download the file
      // https://developers.google.com/drive/v3/web/picker
      // https://developers.google.com/drive/v2/reference/files/get

      var googlePickerFileObject = data.docs[0];
      var oAuthHeaders = new Headers({
        'Authorization': 'Bearer ' + googlePickerOAuthToken
      });

      this.setFileLoadingStatus(true);

      // First Fetch the Information about the file
      unfetch_es('https://www.googleapis.com/drive/v2/files/' + googlePickerFileObject.id, {
        headers: oAuthHeaders
      }).then(function (response) {
        return response.json();
      }).then(function (responseJson) {

        // Finally fetch the file
        unfetch_es(responseJson.downloadUrl, {
          headers: oAuthHeaders
        }).then(function (blob) {
          if (!blob.ok) {
            return Promise.reject(blob);
          }

          return blob.arrayBuffer();
        }).then(function (bytes) {

          // Use Wasm Boy to possibly Unzip, and then pass the bytes to be loaded
          _this3.props.wasmboy._getGameFromArrayBuffer(googlePickerFileObject.name, bytes).then(function (byteArray) {
            _this3.props.wasmboy.loadGame(byteArray).then(function () {
              console.log('Wasmboy Ready!');
              _this3.props.showNotification('Game Loaded! 🎉');
              _this3.setFileLoadingStatus(false);

              // Set our file name
              var newState = wasmboyFilePicker__extends({}, _this3.state);
              newState.currentFileName = googlePickerFileObject.name;
              _this3.setState(newState);
            }).catch(function (error) {
              console.log('Load Game Error:', error);
              _this3.props.showNotification('Game Load Error! 😞');
              _this3.setFileLoadingStatus(false);
            });
          }).catch(function (error) {
            _this3.props.showNotification('Error getting file from google drive 💔');
            _this3.setFileLoadingStatus(true);
          });
        }).catch(function (error) {
          _this3.props.showNotification('Error getting file from google drive 💔');
          _this3.setFileLoadingStatus(true);
        });
      }).catch(function (error) {
        _this3.props.showNotification('Error getting file from google drive 💔');
        _this3.setFileLoadingStatus(true);
      });
    }
  };

  WasmBoyFilePicker.prototype.setFileLoadingStatus = function setFileLoadingStatus(isLoading) {
    var newState = wasmboyFilePicker__extends({}, this.state);
    newState.isFileLoading = isLoading;
    this.setState(newState);
  };

  WasmBoyFilePicker.prototype.render = function render() {
    var _this4 = this;

    var fileInput = _ref;
    if (!this.state.isFileLoading) {
      fileInput = Object(preact_min["h"])(
        'div',
        { 'class': 'wasmboy__filePicker__services' },
        Object(preact_min["h"])(
          'div',
          { 'class': 'file' },
          Object(preact_min["h"])(
            'label',
            { 'class': 'file-label' },
            Object(preact_min["h"])('input', { 'class': 'file-input', type: 'file', accept: '.gb, .gbc, .zip', name: 'resume', onChange: function onChange(event) {
                _this4.loadLocalFile(event);
              } }),
            Object(preact_min["h"])(
              'span',
              { 'class': 'file-cta' },
              Object(preact_min["h"])(
                'span',
                { 'class': 'file-icon' },
                wasmboyFilePicker__ref2
              ),
              _ref3
            )
          )
        ),
        Object(preact_min["h"])(
          googlePicker_GooglePicker,
          { clientId: WASMBOY_DEBUGGER_GOOGLE_PICKER_CLIENT_ID,
            scope: ['https://www.googleapis.com/auth/drive.readonly'],
            onChange: function onChange(data) {
              _this4.loadGoogleDriveFile(data);
            },
            onAuthenticate: function onAuthenticate(token) {
              googlePickerOAuthToken = token;
            },
            multiselect: false,
            navHidden: true,
            authImmediate: false,
            viewId: 'DOCS' },
          Object(preact_min["h"])(
            'div',
            { 'class': 'file' },
            Object(preact_min["h"])(
              'label',
              { 'class': 'file-label' },
              Object(preact_min["h"])(
                'span',
                { 'class': 'file-cta' },
                Object(preact_min["h"])(
                  'span',
                  { 'class': 'file-icon' },
                  _ref4
                ),
                _ref5
              )
            )
          )
        )
      );
    }

    return Object(preact_min["h"])(
      'div',
      { 'class': 'wasmboy__filePicker' },
      _ref6,
      _ref7,
      Object(preact_min["h"])(
        'h2',
        null,
        this.state.currentFileName
      ),
      fileInput
    );
  };

  return WasmBoyFilePicker;
}(preact_min["Component"]);
// EXTERNAL MODULE: ./node_modules/preact-portal/dist/preact-portal.js
var preact_portal = __webpack_require__("JsWE");
var preact_portal_default = /*#__PURE__*/__webpack_require__.n(preact_portal);

// EXTERNAL MODULE: ./debugger/wasmboySystemControls/wasmBoySystemControls.css
var wasmBoySystemControls = __webpack_require__("dUfp");
var wasmBoySystemControls_default = /*#__PURE__*/__webpack_require__.n(wasmBoySystemControls);

// CONCATENATED MODULE: ./debugger/wasmboySystemControls/wasmboySystemControls.js
var wasmboySystemControls__extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };



function wasmboySystemControls__classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function wasmboySystemControls__possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function wasmboySystemControls__inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }





var wasmboySystemControls__ref = Object(preact_min["h"])('div', { 'class': 'donut' });

var wasmboySystemControls__ref2 = Object(preact_min["h"])(
  'h3',
  null,
  'Date:'
);

var wasmboySystemControls__ref3 = Object(preact_min["h"])(
  'h3',
  null,
  'Auto:'
);

var wasmboySystemControls__ref4 = Object(preact_min["h"])(
  'h1',
  null,
  'No Save States Found \uD83D\uDE1E'
);

var wasmboySystemControls__ref5 = Object(preact_min["h"])(
  'h1',
  null,
  'Load Save State For Current Game'
);

var wasmboySystemControls_WasmBoySystemControls = function (_Component) {
  wasmboySystemControls__inherits(WasmBoySystemControls, _Component);

  function WasmBoySystemControls(props) {
    wasmboySystemControls__classCallCheck(this, WasmBoySystemControls);

    // set our state to if we are initialized or not
    var _this = wasmboySystemControls__possibleConstructorReturn(this, _Component.call(this, props));

    _this.state = {
      showSaveStates: false,
      currentFileName: 'No Game Selected...',
      saveStates: [],
      saveStateError: false
    };

    var _fpsCounter = void 0;
    _fpsCounter = function fpsCounter() {
      _this.setState({
        fps: props.wasmboy.getFps()
      });
      setTimeout(function () {
        _fpsCounter();
      }, 500);
    };
    _fpsCounter();
    return _this;
  }

  // Toggle showing all save states


  WasmBoySystemControls.prototype.openSaveStates = function openSaveStates() {
    var _this2 = this;

    if (this.state.showSaveStates) {
      return;
    }

    var newState = wasmboySystemControls__extends({}, this.state);
    newState.showSaveStates = true;
    this.setState(newState);

    // Get our save states
    this.props.wasmboyMemory.getCartridgeObject().then(function (cartridgeObject) {
      newState.saveStates = cartridgeObject.saveStates;
      _this2.setState(newState);
    }).catch(function () {
      newState.saveStateError = true;
      _this2.setState(newState);
    });
  };

  WasmBoySystemControls.prototype.closeSaveStates = function closeSaveStates() {
    var newState = wasmboySystemControls__extends({}, this.state);
    newState.showSaveStates = false;
    newState.saveStates = [];
    newState.saveStateError = false;
    this.setState(newState);
  };

  WasmBoySystemControls.prototype.startGame = function startGame() {
    if (!this.props.wasmboy.ready) {
      this.props.showNotification('Please load a game. ⏏️');
    } else {
      this.props.wasmboy.startGame();
    }
  };

  WasmBoySystemControls.prototype.saveState = function saveState() {
    this.props.wasmboy.saveState();
    this.props.showNotification('State Saved! 💾');
  };

  WasmBoySystemControls.prototype.loadState = function loadState(saveState) {
    this.closeSaveStates();
    this.props.wasmboy.loadState(saveState);
    this.props.showNotification('State Loaded! 😀');
  };

  WasmBoySystemControls.prototype.getStartButtonClass = function getStartButtonClass() {
    if (this.props.wasmboy && this.props.wasmboy.ready) {
      return "is-success";
    }

    return "is-danger";
  };

  WasmBoySystemControls.prototype.render = function render(props) {
    var _this3 = this;

    var saveStateElements = wasmboySystemControls__ref;
    if (this.state.showSaveStates) {
      if (this.state.saveStates.length > 0) {
        // Loop through save states
        saveStateElements = [];
        this.state.saveStates.forEach(function (saveState) {
          var saveStateDateString = new Date(saveState.date);
          saveStateDateString = saveStateDateString.toLocaleString();
          saveStateElements.unshift(Object(preact_min["h"])(
            'div',
            { 'class': 'saveState', onClick: function onClick() {
                _this3.loadState(saveState);
              } },
            Object(preact_min["h"])('img', { src: saveState.screenshotCanvasDataURL }),
            wasmboySystemControls__ref2,
            saveStateDateString,
            wasmboySystemControls__ref3,
            saveState.isAuto ? "true" : "false"
          ));
        });
      }

      if (this.state.saveStateError) {
        saveStateElements = wasmboySystemControls__ref4;
      }
    }

    return Object(preact_min["h"])(
      'div',
      { className: 'wasmboy__systemControls system-controls' },
      Object(preact_min["h"])(
        'button',
        { className: this.getStartButtonClass() + " button", onclick: function onclick() {
            _this3.startGame();
          } },
        'Start Game'
      ),
      Object(preact_min["h"])(
        'button',
        { 'class': 'button', onclick: function onclick() {
            props.wasmboy.pauseGame();
          } },
        'Pause Game'
      ),
      Object(preact_min["h"])(
        'button',
        { 'class': 'button', onclick: function onclick() {
            props.wasmboy.resumeGame();
          } },
        'Resume Game'
      ),
      Object(preact_min["h"])(
        'button',
        { 'class': 'button', onclick: function onclick() {
            _this3.saveState();
          } },
        'Save State'
      ),
      Object(preact_min["h"])(
        'button',
        { 'class': 'button', onclick: function onclick() {
            _this3.openSaveStates();
          } },
        'Load State'
      ),
      Object(preact_min["h"])(
        'div',
        null,
        'Gameboy FPS: ',
        this.state.fps
      ),
      this.state.showSaveStates ? Object(preact_min["h"])(
        preact_portal_default.a,
        { into: 'body' },
        Object(preact_min["h"])(
          'div',
          { 'class': 'modal is-active' },
          Object(preact_min["h"])(
            'div',
            { 'class': 'modal-background', onClick: function onClick() {
                _this3.closeSaveStates();
              } },
            Object(preact_min["h"])(
              'div',
              { 'class': 'modal-content' },
              wasmboySystemControls__ref5,
              Object(preact_min["h"])(
                'div',
                { 'class': 'saveStateContainer' },
                saveStateElements
              )
            ),
            Object(preact_min["h"])('button', { 'class': 'modal-close is-large', 'aria-label': 'close', onClick: function onClick() {
                _this3.closeSaveStates();
              } })
          )
        )
      ) : null
    );
  };

  return WasmBoySystemControls;
}(preact_min["Component"]);
// EXTERNAL MODULE: ./debugger/wasmboyDebugger/numberBaseTable/numberBaseTable.css
var numberBaseTable = __webpack_require__("D8Rn");
var numberBaseTable_default = /*#__PURE__*/__webpack_require__.n(numberBaseTable);

// CONCATENATED MODULE: ./debugger/wasmboyDebugger/numberBaseTable/numberBaseTable.js


function numberBaseTable__classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function numberBaseTable__possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function numberBaseTable__inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }




// Component that takes in a JSON object, where the Keys are the column name,
// And the Rows will represent each base value of the number in the value of the key

var numberBaseTable__ref = Object(preact_min["h"])('div', null);

var numberBaseTable__ref2 = Object(preact_min["h"])('div', null);

var numberBaseTable__ref3 = Object(preact_min["h"])(
  'th',
  null,
  'Value Base'
);

var numberBaseTable__ref4 = Object(preact_min["h"])(
  'td',
  null,
  'Hexadecimal:'
);

var numberBaseTable__ref5 = Object(preact_min["h"])(
  'td',
  null,
  'Decimal:'
);

var numberBaseTable__ref6 = Object(preact_min["h"])(
  'td',
  null,
  'Binary:'
);

var numberBaseTable_NumberBaseTable = function (_Component) {
  numberBaseTable__inherits(NumberBaseTable, _Component);

  function NumberBaseTable() {
    numberBaseTable__classCallCheck(this, NumberBaseTable);

    var _this = numberBaseTable__possibleConstructorReturn(this, _Component.call(this));

    _this.state = {
      object: {}
    };
    return _this;
  }

  NumberBaseTable.prototype.componentWillReceiveProps = function componentWillReceiveProps(nextProps) {
    this.setState({
      object: nextProps.object
    });
  };

  // Modifed from: https://ourcodeworld.com/articles/read/380/how-to-convert-a-binary-string-into-a-readable-string-and-vice-versa-with-javascript


  NumberBaseTable.prototype.numberToBinaryString = function numberToBinaryString(number) {

    // Simply Convert each place in hex to binary
    var hexString = number.toString(16);

    var binaryString = '';
    for (var i = 0; i < hexString.length; i++) {
      var valueAtIncrementer = parseInt(hexString.charAt(i), 16).toString(2);
      var paddedValueAtIncrementer = valueAtIncrementer;
      // Pad to 4 bits
      while (paddedValueAtIncrementer.length < 4) {
        paddedValueAtIncrementer = '0' + paddedValueAtIncrementer;
      }

      binaryString += paddedValueAtIncrementer;

      if (i !== hexString.length - 1) {
        binaryString += ' ';
      }
    }

    // Padd out to 8 bit increments
    if (!(binaryString.length & 1)) {
      binaryString = '0000 ' + binaryString;
    }

    return binaryString;
  };

  NumberBaseTable.prototype.getTableCellsForValueWithBase = function getTableCellsForValueWithBase(valueBase) {
    var _this2 = this;

    var tableCells = [];
    Object.keys(this.state.object).forEach(function (key) {
      if (valueBase === 16) {
        tableCells.push(Object(preact_min["h"])(
          'td',
          null,
          '0x',
          _this2.state.object[key].toString(16)
        ));
      } else if (valueBase === 2) {
        tableCells.push(Object(preact_min["h"])(
          'td',
          null,
          _this2.numberToBinaryString(_this2.state.object[key])
        ));
      } else {
        tableCells.push(Object(preact_min["h"])(
          'td',
          null,
          _this2.state.object[key]
        ));
      }
    });

    return tableCells;
  };

  NumberBaseTable.prototype.getTableCellsForObjectKeys = function getTableCellsForObjectKeys() {
    if (!this.state.object) {
      return numberBaseTable__ref;
    }

    var objectKeysAsTableCells = [];

    Object.keys(this.state.object).forEach(function (key) {
      objectKeysAsTableCells.push(Object(preact_min["h"])(
        'th',
        null,
        key
      ));
    });

    return objectKeysAsTableCells;
  };

  NumberBaseTable.prototype.render = function render() {

    if (!this.state.object || Object.keys(this.state.object).length < 1) {
      return numberBaseTable__ref2;
    }

    return Object(preact_min["h"])(
      'div',
      { className: 'number-base-table-container' },
      Object(preact_min["h"])(
        'table',
        { className: 'number-base-table' },
        Object(preact_min["h"])(
          'tr',
          null,
          numberBaseTable__ref3,
          this.getTableCellsForObjectKeys()
        ),
        Object(preact_min["h"])(
          'tr',
          null,
          numberBaseTable__ref4,
          this.getTableCellsForValueWithBase(16)
        ),
        Object(preact_min["h"])(
          'tr',
          null,
          numberBaseTable__ref5,
          this.getTableCellsForValueWithBase(10)
        ),
        Object(preact_min["h"])(
          'tr',
          null,
          numberBaseTable__ref6,
          this.getTableCellsForValueWithBase(2)
        )
      )
    );
  };

  return NumberBaseTable;
}(preact_min["Component"]);
// EXTERNAL MODULE: ./debugger/wasmboyDebugger/wasmboyBackgroundMap/wasmboyBackgroundMap.css
var wasmboyBackgroundMap = __webpack_require__("PPgq");
var wasmboyBackgroundMap_default = /*#__PURE__*/__webpack_require__.n(wasmboyBackgroundMap);

// CONCATENATED MODULE: ./debugger/wasmboyDebugger/wasmboyBackgroundMap/wasmboyBackgroundMap.js


function wasmboyBackgroundMap__classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function wasmboyBackgroundMap__possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function wasmboyBackgroundMap__inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }





var wasmboyBackgroundMap__ref = Object(preact_min["h"])(
  'div',
  null,
  Object(preact_min["h"])(
    'h1',
    null,
    'Background Map'
  ),
  Object(preact_min["h"])(
    'div',
    { 'class': 'wasmboy__backgroundMap' },
    Object(preact_min["h"])('canvas', { id: 'WasmBoyBackgroundMap', width: '256', height: '256' })
  )
);

var wasmboyBackgroundMap_WasmBoyBackgroundMap = function (_Component) {
  wasmboyBackgroundMap__inherits(WasmBoyBackgroundMap, _Component);

  function WasmBoyBackgroundMap(props) {
    wasmboyBackgroundMap__classCallCheck(this, WasmBoyBackgroundMap);

    return wasmboyBackgroundMap__possibleConstructorReturn(this, _Component.call(this, props));
  }

  WasmBoyBackgroundMap.prototype.componentDidMount = function componentDidMount() {
    var _this2 = this;

    var canvasElement = document.getElementById('WasmBoyBackgroundMap');
    var canvasContext = canvasElement.getContext('2d');
    var canvasImageData = canvasContext.createImageData(256, 256);

    // Add some css for smooth 8-bit canvas scaling
    // https://stackoverflow.com/questions/7615009/disable-interpolation-when-scaling-a-canvas
    // https://caniuse.com/#feat=css-crisp-edges
    canvasElement.style = '\n      image-rendering: optimizeSpeed;\n      image-rendering: -moz-crisp-edges;\n      image-rendering: -webkit-optimize-contrast;\n      image-rendering: -o-crisp-edges;\n      image-rendering: pixelated;\n      -ms-interpolation-mode: nearest-neighbor;\n    ';

    // Fill the canvas with a blank screen
    // using client width since we are not requiring a width and height oin the canvas
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/clientWidth
    // TODO: Mention respopnsive canvas scaling in the docs
    canvasContext.clearRect(0, 0, canvasElement.width, canvasElement.height);

    var updateBackgroundMap = function updateBackgroundMap() {
      _this2.updateBackgroundMap(canvasElement, canvasContext, canvasImageData).then(function () {
        setTimeout(function () {
          updateBackgroundMap();
        }, 500);
      });
    };
    updateBackgroundMap();
  };

  WasmBoyBackgroundMap.prototype.updateBackgroundMap = function updateBackgroundMap(canvasElement, canvasContext, canvasImageData) {
    var _this3 = this;

    return new src(function (resolve) {

      // Dont update for the following
      if (!_this3.props.wasmboy.wasmByteMemory || !_this3.props.wasmboy.wasmInstance || !_this3.props.wasmboy.ready || _this3.props.wasmboy.paused || !_this3.props.shouldUpdate) {
        resolve();
        return;
      }

      _this3.props.wasmboy.wasmInstance.exports.drawBackgroundMapToWasmMemory(1);

      var imageDataArray = new Uint8ClampedArray(256 * 256 * 4);
      var rgbColor = new Uint8ClampedArray(3);

      for (var y = 0; y < 256; y++) {
        for (var x = 0; x < 256; x++) {

          // Each color has an R G B component
          var pixelStart = (y * 256 + x) * 3;

          for (var color = 0; color < 3; color++) {
            rgbColor[color] = _this3.props.wasmboy.wasmByteMemory[_this3.props.wasmboy.wasmInstance.exports.backgroundMapLocation + pixelStart + color];
          }

          // Doing graphics using second answer on:
          // https://stackoverflow.com/questions/4899799/whats-the-best-way-to-set-a-single-pixel-in-an-html5-canvas
          // Image Data mapping
          var imageDataIndex = (x + y * 256) * 4;

          imageDataArray[imageDataIndex] = rgbColor[0];
          imageDataArray[imageDataIndex + 1] = rgbColor[1];
          imageDataArray[imageDataIndex + 2] = rgbColor[2];
          // Alpha, no transparency
          imageDataArray[imageDataIndex + 3] = 255;
        }
      }

      // Add our new imageData
      for (var i = 0; i < imageDataArray.length; i++) {
        canvasImageData.data[i] = imageDataArray[i];
      }

      canvasContext.beginPath();
      canvasContext.clearRect(0, 0, 256, 256);
      canvasContext.putImageData(canvasImageData, 0, 0);

      // Draw a semi Transparent camera thing over the imagedata
      // https://www.html5canvastutorials.com/tutorials/html5-canvas-rectangles/
      // Get the scroll X and Y
      var scrollX = _this3.props.wasmboy.wasmByteMemory[_this3.props.getWasmBoyOffsetFromGameBoyOffset(0xFF43, _this3.props.wasmboy)];
      var scrollY = _this3.props.wasmboy.wasmByteMemory[_this3.props.getWasmBoyOffsetFromGameBoyOffset(0xFF42, _this3.props.wasmboy)];

      var lineWidth = 2;
      var strokeStyle = 'rgba(173, 140, 255, 200)';

      // Need to wrap by the four corners, not the 4 edges

      // Upper left corner
      canvasContext.rect(scrollX, scrollY, 160, 144);
      canvasContext.lineWidth = lineWidth;
      canvasContext.strokeStyle = strokeStyle;
      canvasContext.stroke();

      // Upper right corner
      if (scrollX + 160 > 256) {
        canvasContext.rect(0, scrollY, scrollX + 160 - 256, 144);
        canvasContext.lineWidth = lineWidth;
        canvasContext.strokeStyle = strokeStyle;
        canvasContext.stroke();
      }

      // Bottom left corner
      if (scrollY + 144 > 256) {
        canvasContext.rect(scrollX, 0, 160, scrollY + 144 - 256);
        canvasContext.lineWidth = lineWidth;
        canvasContext.strokeStyle = strokeStyle;
        canvasContext.stroke();
      }

      // Bottom right corner
      if (scrollX + 160 > 256 && scrollY + 144 > 256) {
        canvasContext.rect(0, 0, scrollX + 160 - 256, scrollY + 144 - 256);
        canvasContext.lineWidth = lineWidth;
        canvasContext.strokeStyle = strokeStyle;
        canvasContext.stroke();
      }

      resolve();
    });
  };

  WasmBoyBackgroundMap.prototype.render = function render() {
    return wasmboyBackgroundMap__ref;
  };

  return WasmBoyBackgroundMap;
}(preact_min["Component"]);
// EXTERNAL MODULE: ./debugger/wasmboyDebugger/wasmboyTileData/wasmboyTileData.css
var wasmboyTileData = __webpack_require__("2hay");
var wasmboyTileData_default = /*#__PURE__*/__webpack_require__.n(wasmboyTileData);

// CONCATENATED MODULE: ./debugger/wasmboyDebugger/wasmboyTileData/wasmboyTileData.js


function wasmboyTileData__classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function wasmboyTileData__possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function wasmboyTileData__inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }





var canvasId = 'WasmBoyTileData';
var tileDataXPixels = 0x1F * 8;
var tileDataYPixels = 0x17 * 8;

var wasmboyTileData__ref = Object(preact_min["h"])(
  'div',
  null,
  Object(preact_min["h"])(
    'h1',
    null,
    'Tile Data'
  ),
  Object(preact_min["h"])(
    'div',
    { 'class': 'wasmboy__tileData' },
    Object(preact_min["h"])('canvas', { id: canvasId, width: tileDataXPixels, height: tileDataYPixels })
  )
);

var wasmboyTileData_WasmBoyTileData = function (_Component) {
  wasmboyTileData__inherits(WasmBoyTileData, _Component);

  function WasmBoyTileData(props) {
    wasmboyTileData__classCallCheck(this, WasmBoyTileData);

    return wasmboyTileData__possibleConstructorReturn(this, _Component.call(this, props));
  }

  WasmBoyTileData.prototype.componentDidMount = function componentDidMount() {
    var _this2 = this;

    var canvasElement = document.getElementById(canvasId);
    var canvasContext = canvasElement.getContext('2d');
    var canvasImageData = canvasContext.createImageData(tileDataXPixels, tileDataYPixels);

    // Add some css for smooth 8-bit canvas scaling
    // https://stackoverflow.com/questions/7615009/disable-interpolation-when-scaling-a-canvas
    // https://caniuse.com/#feat=css-crisp-edges
    canvasElement.style = '\n      image-rendering: optimizeSpeed;\n      image-rendering: -moz-crisp-edges;\n      image-rendering: -webkit-optimize-contrast;\n      image-rendering: -o-crisp-edges;\n      image-rendering: pixelated;\n      -ms-interpolation-mode: nearest-neighbor;\n    ';

    // Fill the canvas with a blank screen
    // using client width since we are not requiring a width and height oin the canvas
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/clientWidth
    // TODO: Mention respopnsive canvas scaling in the docs
    canvasContext.clearRect(0, 0, canvasElement.width, canvasElement.height);

    var updateCanvas = function updateCanvas() {
      _this2.updateCanvas(canvasElement, canvasContext, canvasImageData).then(function () {
        setTimeout(function () {
          updateCanvas();
        }, 500);
      });
    };
    updateCanvas();
  };

  WasmBoyTileData.prototype.updateCanvas = function updateCanvas(canvasElement, canvasContext, canvasImageData) {
    var _this3 = this;

    return new src(function (resolve) {

      // Dont update for the following
      if (!_this3.props.wasmboy.wasmByteMemory || !_this3.props.wasmboy.wasmInstance || !_this3.props.wasmboy.ready || _this3.props.wasmboy.paused || !_this3.props.shouldUpdate) {
        resolve();
        return;
      }

      _this3.props.wasmboy.wasmInstance.exports.drawTileDataToWasmMemory();

      var imageDataArray = new Uint8ClampedArray(tileDataYPixels * tileDataXPixels * 4);
      var rgbColor = new Uint8ClampedArray(3);

      for (var y = 0; y < tileDataYPixels; y++) {
        for (var x = 0; x < tileDataXPixels; x++) {

          // Each color has an R G B component
          var pixelStart = (y * tileDataXPixels + x) * 3;

          for (var color = 0; color < 3; color++) {
            rgbColor[color] = _this3.props.wasmboy.wasmByteMemory[_this3.props.wasmboy.wasmInstance.exports.tileDataMap + pixelStart + color];
          }

          // Doing graphics using second answer on:
          // https://stackoverflow.com/questions/4899799/whats-the-best-way-to-set-a-single-pixel-in-an-html5-canvas
          // Image Data mapping
          var imageDataIndex = (x + y * tileDataXPixels) * 4;

          imageDataArray[imageDataIndex] = rgbColor[0];
          imageDataArray[imageDataIndex + 1] = rgbColor[1];
          imageDataArray[imageDataIndex + 2] = rgbColor[2];
          // Alpha, no transparency
          imageDataArray[imageDataIndex + 3] = 255;
        }
      }

      // Add our new imageData
      for (var i = 0; i < imageDataArray.length; i++) {
        canvasImageData.data[i] = imageDataArray[i];
      }

      canvasContext.beginPath();
      canvasContext.clearRect(0, 0, tileDataXPixels, tileDataYPixels);
      canvasContext.putImageData(canvasImageData, 0, 0);

      resolve();
    });
  };

  WasmBoyTileData.prototype.render = function render() {
    return wasmboyTileData__ref;
  };

  return WasmBoyTileData;
}(preact_min["Component"]);
// EXTERNAL MODULE: ./debugger/wasmboyDebugger/wasmboyDebugger.css
var wasmboyDebugger = __webpack_require__("hR8J");
var wasmboyDebugger_default = /*#__PURE__*/__webpack_require__.n(wasmboyDebugger);

// CONCATENATED MODULE: ./debugger/wasmboyDebugger/wasmboyDebugger.js
var wasmboyDebugger__extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };



function wasmboyDebugger__classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function wasmboyDebugger__possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function wasmboyDebugger__inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }







// Function to get a value in gameboy memory, to wasmboy memory
var getWasmBoyOffsetFromGameBoyOffset = function getWasmBoyOffsetFromGameBoyOffset(gameboyOffset, wasmboy) {
  return wasmboy.wasmInstance.exports.getWasmBoyOffsetFromGameBoyOffset(gameboyOffset);
};

var autoUpdateValueTableId = false;

var wasmboyDebugger__ref = Object(preact_min["h"])(
  'h1',
  null,
  'Debugger'
);

var wasmboyDebugger__ref2 = Object(preact_min["h"])(
  'h2',
  null,
  'Control Flow Actions:'
);

var wasmboyDebugger__ref3 = Object(preact_min["h"])(
  'h2',
  null,
  'Wasmboy State Actions:'
);

var wasmboyDebugger__ref4 = Object(preact_min["h"])(
  'h2',
  null,
  'Debugger Elements:'
);

var wasmboyDebugger__ref5 = Object(preact_min["h"])(
  'h2',
  null,
  'Value Table'
);

var wasmboyDebugger__ref6 = Object(preact_min["h"])(
  'h3',
  null,
  'Cpu Info:'
);

var wasmboyDebugger__ref7 = Object(preact_min["h"])(
  'a',
  { href: 'http://gbdev.gg8.se/wiki/articles/Pan_Docs#CPU_Specifications', target: 'blank' },
  Object(preact_min["h"])(
    'i',
    null,
    'Reference Doc'
  )
);

var _ref8 = Object(preact_min["h"])(
  'h3',
  null,
  'PPU Info:'
);

var _ref9 = Object(preact_min["h"])(
  'a',
  { href: 'http://gbdev.gg8.se/wiki/articles/Video_Display', target: 'blank' },
  Object(preact_min["h"])(
    'i',
    null,
    'Reference Doc'
  )
);

var _ref10 = Object(preact_min["h"])(
  'h3',
  null,
  'APU Info:'
);

var _ref11 = Object(preact_min["h"])(
  'a',
  { href: 'http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware', target: 'blank' },
  Object(preact_min["h"])(
    'i',
    null,
    'Reference Doc'
  )
);

var _ref12 = Object(preact_min["h"])(
  'h3',
  null,
  'Timer Info:'
);

var _ref13 = Object(preact_min["h"])(
  'a',
  { href: 'http://gbdev.gg8.se/wiki/articles/Timer_and_Divider_Registers', target: 'blank' },
  Object(preact_min["h"])(
    'i',
    null,
    'Reference Doc'
  )
);

var _ref14 = Object(preact_min["h"])(
  'h3',
  null,
  'Interrupt Info:'
);

var _ref15 = Object(preact_min["h"])(
  'a',
  { href: 'http://gbdev.gg8.se/wiki/articles/Interrupts', target: 'blank' },
  Object(preact_min["h"])(
    'i',
    null,
    'Reference Doc'
  )
);

var wasmboyDebugger_WasmBoyDebugger = function (_Component) {
  wasmboyDebugger__inherits(WasmBoyDebugger, _Component);

  function WasmBoyDebugger() {
    wasmboyDebugger__classCallCheck(this, WasmBoyDebugger);

    // set our state to if we are initialized or not
    var _this = wasmboyDebugger__possibleConstructorReturn(this, _Component.call(this));

    _this.state = {
      showValueTable: false,
      autoUpdateValueTable: false,
      showBackgroundMap: false,
      showTileData: false,
      breakPoint: "40",
      opcodesToRun: 2000,
      valueTable: {
        cpu: {},
        ppu: {},
        apu: {},
        timers: {},
        interrupts: {}
      }
    };
    return _this;
  }

  // Function to simply flip a boolean on the state


  WasmBoyDebugger.prototype.flipShowStatus = function flipShowStatus(stateKey, wasmboy) {
    var _this2 = this;

    var newState = wasmboyDebugger__extends({}, this.state);
    newState[stateKey] = !newState[stateKey];
    this.setState(newState);

    // Fireoff a a raf for updating the value table
    if (stateKey === 'autoUpdateValueTable') {
      if (this.state.autoUpdateValueTable) {
        var _autoUpdateValueTable = function _autoUpdateValueTable() {
          _this2.updateValueTable(wasmboy);
          if (autoUpdateValueTableId) {
            autoUpdateValueTableId = requestAnimationFrame(function () {
              _autoUpdateValueTable();
            });
          }
        };
        autoUpdateValueTableId = true;
        _autoUpdateValueTable();
      } else {
        cancelAnimationFrame(autoUpdateValueTable);
        autoUpdateValueTableId = false;
      }
    }
  };

  // Function to return the hidden class deoending oin a boolean in state


  WasmBoyDebugger.prototype.getStateClass = function getStateClass(stateKey) {
    return this.state[stateKey] ? '' : 'hide';
  };

  // Function to runa  single opcode


  WasmBoyDebugger.prototype.stepOpcode = function stepOpcode(wasmboy, wasmboyGraphics, skipDebugOutput) {
    var _this3 = this;

    return new Promise(function (resolve) {
      var numberOfCycles = wasmboy.wasmInstance.exports.emulationStep();

      if (numberOfCycles <= 0) {
        console.error('Opcode not recognized! Check wasm logs.');
        _this3.updateDebugInfo(wasmboy);
        throw new Error();
      }

      if (skipDebugOutput) {
        resolve();
        return;
      }
      wasmboyGraphics.renderFrame();
      _this3.updateValueTable(wasmboy);

      resolve();
    });
  };

  // Function to run a specifed number of opcodes for faster stepping


  WasmBoyDebugger.prototype.runNumberOfOpcodes = function runNumberOfOpcodes(wasmboy, wasmboyGraphics, numberOfOpcodes, breakPoint, skipDebugOutput) {
    var _this4 = this;

    // Keep stepping until highest opcode increases
    var opcodesToRun = this.state.opcodesToRun;
    if (numberOfOpcodes) {
      opcodesToRun = numberOfOpcodes;
    }

    return new Promise(function (resolve) {

      var opcodesRan = 0;

      var runOpcode = function runOpcode() {
        _this4.stepOpcode(wasmboy, wasmboyGraphics, true).then(function () {
          if (breakPoint && breakPoint === wasmboy.wasmInstance.exports.getProgramCounter()) {
            resolve();
            return;
          }

          if (opcodesRan < opcodesToRun) {
            opcodesRan++;
            runOpcode();
            return;
          }

          if (skipDebugOutput) {
            resolve();
            return;
          }

          wasmboyGraphics.renderFrame();
          _this4.updateValueTable(wasmboy);

          resolve();
        });
      };
      runOpcode();
    });
  };

  // Function to keep running opcodes until a breakpoint is reached


  WasmBoyDebugger.prototype.breakPoint = function breakPoint(wasmboy, wasmboyGraphics, skipInitialStep) {
    var _this5 = this;

    // Set our opcode breakpoint
    var breakPoint = parseInt(this.state.breakPoint, 16);

    var initialStepPromise = Promise.resolve();
    if (!skipInitialStep) {
      initialStepPromise = this.runNumberOfOpcodes(wasmboy, wasmboyGraphics, 1, breakPoint);
    }

    initialStepPromise.then(function () {
      if (wasmboy.wasmInstance.exports.getProgramCounter() !== breakPoint) {
        requestAnimationFrame(function () {
          _this5.runNumberOfOpcodes(wasmboy, wasmboyGraphics, 2000 + Math.floor(Math.random() * 10), breakPoint, true).then(function () {
            wasmboyGraphics.renderFrame();
            _this5.updateValueTable(wasmboy);
            _this5.breakPoint(wasmboy, wasmboyGraphics, true);
          });
        });
      } else {
        console.log('Reached Breakpoint, that satisfies test inside runNumberOfOpcodes');
        wasmboyGraphics.renderFrame();
        _this5.updateValueTable(wasmboy);
      }
    });
  };

  WasmBoyDebugger.prototype.logWasmBoyMemory = function logWasmBoyMemory(wasmBoy) {
    console.log('[WasmBoy Debugger] Memory:', wasmBoy.wasmByteMemory);
  };

  WasmBoyDebugger.prototype.updateValueTable = function updateValueTable(wasmboy) {

    // Create our new valueTable object
    var valueTable = {
      cpu: {},
      ppu: {},
      apu: {},
      timers: {},
      interrupts: {}
    };

    // Update CPU valueTable
    valueTable.cpu['Program Counter (PC)'] = wasmboy.wasmInstance.exports.getProgramCounter();
    valueTable.cpu['Opcode at PC'] = wasmboy.wasmInstance.exports.getOpcodeAtProgramCounter();
    valueTable.cpu['Stack Pointer'] = wasmboy.wasmInstance.exports.getStackPointer();
    valueTable.cpu['Register A'] = wasmboy.wasmInstance.exports.getRegisterA();
    valueTable.cpu['Register F'] = wasmboy.wasmInstance.exports.getRegisterF();
    valueTable.cpu['Register B'] = wasmboy.wasmInstance.exports.getRegisterB();
    valueTable.cpu['Register C'] = wasmboy.wasmInstance.exports.getRegisterC();
    valueTable.cpu['Register D'] = wasmboy.wasmInstance.exports.getRegisterD();
    valueTable.cpu['Register E'] = wasmboy.wasmInstance.exports.getRegisterE();
    valueTable.cpu['Register H'] = wasmboy.wasmInstance.exports.getRegisterH();
    valueTable.cpu['Register L'] = wasmboy.wasmInstance.exports.getRegisterL();
    valueTable.cpu = wasmboyDebugger__extends({}, valueTable.cpu);

    // Update PPU valueTable
    valueTable.ppu['Scanline Register (LY) - 0xFF44'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF44, wasmboy)];
    valueTable.ppu['LCD Status (STAT) - 0xFF41'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF41, wasmboy)];
    valueTable.ppu['LCD Control (LCDC) - 0xFF40'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF40, wasmboy)];
    valueTable.ppu['Scroll X - 0xFF43'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF43, wasmboy)];
    valueTable.ppu['Scroll Y - 0xFF42'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF42, wasmboy)];
    valueTable.ppu['Window X - 0xFF4B'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF4B, wasmboy)];
    valueTable.ppu['Window Y - 0xFF4A'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF4A, wasmboy)];

    // Update Timers valueTable
    valueTable.timers['TIMA - 0xFF05'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF05, wasmboy)];
    valueTable.timers['TMA - 0xFF06'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF06, wasmboy)];
    valueTable.timers['TIMC/TAC - 0xFF07'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF07, wasmboy)];
    valueTable.timers['DIV/Divider Register - 0xFF04'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF04, wasmboy)];

    // Update interrupts valueTable
    // TODO: Interrupot master switch
    // if(wasmboy.wasmInstance.exports.areInterruptsEnabled()) {
    //   valueTable.interrupts['Interrupt Master Switch'] = 0x01;
    // } else {
    //   valueTable.interrupts['Interrupt Master Switch'] = 0x00;
    // }
    valueTable.interrupts['IE/Interrupt Enabled - 0xFFFF'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFFFF, wasmboy)];
    valueTable.interrupts['IF/Interrupt Request - 0xFF0F'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFF0F, wasmboy)];

    // Update APU valueTable
    // Add the register valueTable for our 4 channels
    for (var channelNum = 1; channelNum <= 4; channelNum++) {
      for (var registerNum = 0; registerNum < 5; registerNum++) {
        var registerAddress = 0xFF10 + 5 * (channelNum - 1) + registerNum;
        valueTable.apu['Channel ' + channelNum + ' - NR' + channelNum + registerNum + ' - 0x' + registerAddress.toString(16).toUpperCase()] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(registerAddress, wasmboy)];
      }
    }
    valueTable.interrupts['IE/Interrupt Enabled - 0xFFFF'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFFFF, wasmboy)];
    valueTable.interrupts['IE/Interrupt Enabled - 0xFFFF'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFFFF, wasmboy)];
    valueTable.interrupts['IE/Interrupt Enabled - 0xFFFF'] = wasmboy.wasmByteMemory[getWasmBoyOffsetFromGameBoyOffset(0xFFFF, wasmboy)];

    // Clone our valueTable, that it is immutable and will cause change detection
    var newState = wasmboyDebugger__extends({}, this.state);
    newState.valueTable = valueTable;
    this.setState(newState);
  };

  WasmBoyDebugger.prototype.render = function render(props) {
    var _this6 = this;

    return Object(preact_min["h"])(
      'div',
      { 'class': 'wasmboy__debugger animated fadeIn' },
      wasmboyDebugger__ref,
      wasmboyDebugger__ref2,
      Object(preact_min["h"])(
        'div',
        { 'class': 'debuggerAction' },
        Object(preact_min["h"])(
          'button',
          { 'class': 'button', onclick: function onclick() {
              _this6.stepOpcode(props.wasmboy, props.wasmboyGraphics).then(function () {});
            } },
          'Step Opcode'
        )
      ),
      Object(preact_min["h"])(
        'div',
        { 'class': 'debuggerAction' },
        'Run Specified Number of Opcodes:',
        Object(preact_min["h"])('input', { type: 'number',
          'class': 'input',
          value: this.state.opcodesToRun,
          onChange: function onChange(evt) {
            _this6.state.opcodesToRun = evt.target.value;
          } }),
        Object(preact_min["h"])(
          'button',
          { 'class': 'button', onclick: function onclick() {
              _this6.runNumberOfOpcodes(props.wasmboy, props.wasmboyGraphics).then(function () {});
            } },
          'Run number of opcodes'
        )
      ),
      Object(preact_min["h"])(
        'div',
        { 'class': 'debuggerAction' },
        'Breakpoint Line Number: 0x',
        Object(preact_min["h"])('input', {
          type: 'string',
          'class': 'input',
          value: this.state.breakPoint,
          onChange: function onChange(evt) {
            _this6.state.breakPoint = evt.target.value;
          } }),
        Object(preact_min["h"])(
          'button',
          { 'class': 'button', onclick: function onclick() {
              _this6.breakPoint(props.wasmboy, props.wasmboyGraphics);
            } },
          'Run To Breakpoint'
        )
      ),
      wasmboyDebugger__ref3,
      Object(preact_min["h"])(
        'div',
        { 'class': 'debuggerAction' },
        Object(preact_min["h"])(
          'button',
          { 'class': 'button', onclick: function onclick() {
              _this6.logWasmBoyMemory(props.wasmboy);
            } },
          'Log Memory to console'
        )
      ),
      Object(preact_min["h"])(
        'div',
        { 'class': 'debuggerAction' },
        Object(preact_min["h"])(
          'button',
          { 'class': 'button', onclick: function onclick() {
              props.wasmboyAudio.debugSaveCurrentAudioBufferToWav();
            } },
          'Save Current Audio buffer to wav'
        )
      ),
      Object(preact_min["h"])(
        'div',
        { 'class': 'debuggerAction' },
        Object(preact_min["h"])(
          'button',
          { 'class': 'button', onclick: function onclick() {
              _this6.state.showValueTable = true;_this6.updateValueTable(props.wasmboy);
            } },
          'Update Value Table'
        )
      ),
      wasmboyDebugger__ref4,
      Object(preact_min["h"])(
        'div',
        null,
        Object(preact_min["h"])(
          'label',
          { 'class': 'checkbox', 'for': 'showValueTable' },
          'Show Value Table',
          Object(preact_min["h"])('input', {
            id: 'showValueTable',
            type: 'checkbox',
            checked: this.state.showValueTable,
            onChange: function onChange() {
              _this6.flipShowStatus('showValueTable');_this6.updateValueTable(props.wasmboy);
            } })
        )
      ),
      Object(preact_min["h"])(
        'div',
        null,
        Object(preact_min["h"])(
          'label',
          { 'class': 'checkbox', 'for': 'autoUpdateValueTable' },
          'Auto Update Value Table',
          Object(preact_min["h"])('input', {
            id: 'autoUpdateValueTable',
            type: 'checkbox',
            checked: this.state.autoUpdateValueTable,
            onChange: function onChange() {
              _this6.state.showValueTable = true;_this6.flipShowStatus('autoUpdateValueTable', props.wasmboy);
            } })
        )
      ),
      Object(preact_min["h"])(
        'div',
        null,
        Object(preact_min["h"])(
          'label',
          { 'class': 'checkbox', 'for': 'showBackgroundMap' },
          'Show Background Map',
          Object(preact_min["h"])('input', {
            id: 'showBackgroundMap',
            type: 'checkbox',
            checked: this.state.showBackgroundMap,
            onChange: function onChange() {
              _this6.flipShowStatus('showBackgroundMap');
            } })
        )
      ),
      Object(preact_min["h"])(
        'div',
        null,
        Object(preact_min["h"])(
          'label',
          { 'class': 'checkbox', 'for': 'showTileData' },
          'Show Tile Data',
          Object(preact_min["h"])('input', {
            id: 'showTileData',
            type: 'checkbox',
            checked: this.state.showTileData,
            onChange: function onChange() {
              _this6.flipShowStatus('showTileData');
            } })
        )
      ),
      Object(preact_min["h"])(
        'div',
        { className: this.getStateClass('showValueTable') + " animated fadeIn" },
        wasmboyDebugger__ref5,
        wasmboyDebugger__ref6,
        wasmboyDebugger__ref7,
        Object(preact_min["h"])(numberBaseTable_NumberBaseTable, { object: this.state.valueTable.cpu }),
        _ref8,
        _ref9,
        Object(preact_min["h"])(numberBaseTable_NumberBaseTable, { object: this.state.valueTable.ppu }),
        _ref10,
        _ref11,
        Object(preact_min["h"])(numberBaseTable_NumberBaseTable, { object: this.state.valueTable.apu }),
        _ref12,
        _ref13,
        Object(preact_min["h"])(numberBaseTable_NumberBaseTable, { object: this.state.valueTable.timers }),
        _ref14,
        _ref15,
        Object(preact_min["h"])(numberBaseTable_NumberBaseTable, { object: this.state.valueTable.interrupts })
      ),
      Object(preact_min["h"])(
        'div',
        { className: this.getStateClass('showBackgroundMap') + " animated fadeIn" },
        Object(preact_min["h"])(wasmboyBackgroundMap_WasmBoyBackgroundMap, {
          wasmboy: props.wasmboy,
          shouldUpdate: this.state.showBackgroundMap,
          getWasmBoyOffsetFromGameBoyOffset: getWasmBoyOffsetFromGameBoyOffset })
      ),
      Object(preact_min["h"])(
        'div',
        { className: this.getStateClass('showTileData') + " animated fadeIn" },
        Object(preact_min["h"])(wasmboyTileData_WasmBoyTileData, {
          wasmboy: props.wasmboy,
          shouldUpdate: this.state.showTileData,
          getWasmBoyOffsetFromGameBoyOffset: getWasmBoyOffsetFromGameBoyOffset })
      )
    );
  };

  return WasmBoyDebugger;
}(preact_min["Component"]);
// EXTERNAL MODULE: ./debugger/wasmboyOptions/wasmboyOptions.css
var wasmboyOptions = __webpack_require__("WEVK");
var wasmboyOptions_default = /*#__PURE__*/__webpack_require__.n(wasmboyOptions);

// CONCATENATED MODULE: ./debugger/wasmboyOptions/wasmboyOptions.js
var wasmboyOptions__extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };



function wasmboyOptions__classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function wasmboyOptions__possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function wasmboyOptions__inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }




var wasmboyOptions__ref = Object(preact_min["h"])(
  'h1',
  null,
  'Options:'
);

var wasmboyOptions__ref2 = Object(preact_min["h"])(
  'div',
  { 'class': 'wasmboy__options__info' },
  Object(preact_min["h"])(
    'i',
    null,
    'Applying options will reset any currently running game without saving. It is reccomended you apply your options before loading your game. Information on the ',
    Object(preact_min["h"])(
      'a',
      { href: 'https://github.com/torch2424/wasmBoy/blob/master/test/performance/results.md', target: '_blank' },
      'effectiveness of performance improving options can be found here'
    )
  )
);

var wasmboyOptions_WasmBoyOptions = function (_Component) {
  wasmboyOptions__inherits(WasmBoyOptions, _Component);

  function WasmBoyOptions(props) {
    wasmboyOptions__classCallCheck(this, WasmBoyOptions);

    var _this = wasmboyOptions__possibleConstructorReturn(this, _Component.call(this, props));

    _this.state = {};
    return _this;
  }

  WasmBoyOptions.prototype.componentDidMount = function componentDidMount() {
    var _this2 = this;

    // Add all of our default options from the props to our component state
    var newState = wasmboyOptions__extends({}, this.state);
    Object.keys(this.props.availableOptions).forEach(function (optionKey) {
      newState[optionKey] = _this2.props.wasmBoy[optionKey];
    });
    this.setState(newState);
  };

  WasmBoyOptions.prototype.setStateKey = function setStateKey(stateKey, value) {
    var newState = wasmboyOptions__extends({}, this.state);
    newState[stateKey] = value;
    this.setState(newState);
  };

  // Simply resets wasmboy with the current options


  WasmBoyOptions.prototype.applyOptions = function applyOptions() {
    this.props.wasmBoy.reset(this.state);
    this.props.showNotification('Applied Options! 🛠️');
  };

  WasmBoyOptions.prototype.render = function render() {
    var _this3 = this;

    // Create an array of all of our configurable options
    var options = [];
    Object.keys(this.state).forEach(function (stateOptionKey) {

      // Boolean Checkboxes
      if (typeof _this3.state[stateOptionKey] === typeof true) {
        options.push(Object(preact_min["h"])(
          'div',
          null,
          Object(preact_min["h"])(
            'label',
            { 'class': 'checkbox', 'for': stateOptionKey },
            stateOptionKey,
            Object(preact_min["h"])('input', {
              id: stateOptionKey,
              type: 'checkbox',
              checked: _this3.state[stateOptionKey],
              onChange: function onChange() {
                _this3.setStateKey(stateOptionKey, !_this3.state[stateOptionKey]);
              } })
          )
        ));
      }

      // Number Input Fields
      if (typeof _this3.state[stateOptionKey] === "number") {
        options.push(Object(preact_min["h"])(
          'div',
          null,
          Object(preact_min["h"])(
            'label',
            { 'class': 'checkbox' },
            stateOptionKey,
            Object(preact_min["h"])('input', { type: 'number',
              'class': 'input',
              name: stateOptionKey,
              value: _this3.state[stateOptionKey],
              onChange: function onChange(event) {
                _this3.setStateKey(stateOptionKey, parseFloat(event.target.value));
              } })
          )
        ));
      }
    });

    return Object(preact_min["h"])(
      'div',
      { 'class': 'wasmboy__options animated fadeIn' },
      wasmboyOptions__ref,
      wasmboyOptions__ref2,
      Object(preact_min["h"])(
        'div',
        { 'class': 'wasmboy__options__inputs' },
        options
      ),
      Object(preact_min["h"])(
        'button',
        { 'class': 'wasmboy__options__apply button', onClick: function onClick() {
            _this3.applyOptions();
          } },
        'Apply Options'
      )
    );
  };

  return WasmBoyOptions;
}(preact_min["Component"]);
// EXTERNAL MODULE: ./debugger/wasmboyGamepad/wasmboyGamepad.css
var wasmboyGamepad = __webpack_require__("pGic");
var wasmboyGamepad_default = /*#__PURE__*/__webpack_require__.n(wasmboyGamepad);

// CONCATENATED MODULE: ./debugger/wasmboyGamepad/wasmboyGamepad.js


function wasmboyGamepad__classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function wasmboyGamepad__possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function wasmboyGamepad__inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }




// Simple mobile contreols for the wasmboy debugger

var wasmboyGamepad__ref = Object(preact_min["h"])(
    'svg',
    { id: 'gamepadDpad', height: '24', viewBox: '0 0 24 24', width: '24', xmlns: 'http://www.w3.org/2000/svg' },
    Object(preact_min["h"])('path', { d: 'M0 0h24v24H0z', fill: 'none' }),
    Object(preact_min["h"])('path', { d: 'M15 7.5V2H9v5.5l3 3 3-3zM7.5 9H2v6h5.5l3-3-3-3zM9 16.5V22h6v-5.5l-3-3-3 3zM16.5 9l-3 3 3 3H22V9h-5.5z' })
);

var wasmboyGamepad__ref2 = Object(preact_min["h"])(
    'svg',
    { id: 'gamepadStart', height: '24', viewBox: '6 6 12 12', width: '24', xmlns: 'http://www.w3.org/2000/svg' },
    Object(preact_min["h"])('path', { d: 'M19 13H5v-2h14v2z' }),
    Object(preact_min["h"])('path', { d: 'M0 0h24v24H0z', fill: 'none' }),
    Object(preact_min["h"])(
        'text',
        { x: '21', y: '55', transform: 'scale(0.325)' },
        'Start'
    )
);

var wasmboyGamepad__ref3 = Object(preact_min["h"])(
    'svg',
    { id: 'gamepadSelect', height: '24', viewBox: '6 6 12 12', width: '24', xmlns: 'http://www.w3.org/2000/svg' },
    Object(preact_min["h"])('path', { d: 'M19 13H5v-2h14v2z' }),
    Object(preact_min["h"])('path', { d: 'M0 0h24v24H0z', fill: 'none' }),
    Object(preact_min["h"])(
        'text',
        { x: '16', y: '55', transform: 'scale(0.325)' },
        'Select'
    )
);

var wasmboyGamepad__ref4 = Object(preact_min["h"])(
    'svg',
    { id: 'gamepadA', height: '24', viewBox: '0 0 24 24', width: '24', xmlns: 'http://www.w3.org/2000/svg' },
    Object(preact_min["h"])('path', { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z' }),
    Object(preact_min["h"])('path', { d: 'M0 0h24v24H0z', fill: 'none' }),
    Object(preact_min["h"])(
        'text',
        { x: '7.5', y: '16.25' },
        'A'
    )
);

var wasmboyGamepad__ref5 = Object(preact_min["h"])(
    'svg',
    { id: 'gamepadB', height: '24', viewBox: '0 0 24 24', width: '24', xmlns: 'http://www.w3.org/2000/svg' },
    Object(preact_min["h"])('path', { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z' }),
    Object(preact_min["h"])('path', { d: 'M0 0h24v24H0z', fill: 'none' }),
    Object(preact_min["h"])(
        'text',
        { x: '7.5', y: '17.25' },
        'B'
    )
);

var wasmboyGamepad_WasmBoyGamepad = function (_Component) {
    wasmboyGamepad__inherits(WasmBoyGamepad, _Component);

    function WasmBoyGamepad() {
        wasmboyGamepad__classCallCheck(this, WasmBoyGamepad);

        return wasmboyGamepad__possibleConstructorReturn(this, _Component.call(this));
    }

    WasmBoyGamepad.prototype.render = function render() {
        return Object(preact_min["h"])(
            'div',
            { 'class': 'wasmboy__gamepad' },
            wasmboyGamepad__ref,
            wasmboyGamepad__ref2,
            wasmboyGamepad__ref3,
            wasmboyGamepad__ref4,
            wasmboyGamepad__ref5
        );
    };

    return WasmBoyGamepad;
}(preact_min["Component"]);
// CONCATENATED MODULE: ./debugger/index.js





// CONCATENATED MODULE: ./index.js
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return index_App; });
var index__extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };



function index__classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function index__possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function index__inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }







var wasmBoyDefaultOptions = {
	isGbcEnabled: true,
	isAudioEnabled: true,
	frameSkip: 1,
	audioBatchProcessing: true,
	timersBatchProcessing: false,
	audioAccumulateSamples: true,
	graphicsBatchProcessing: false,
	graphicsDisableScanlineRendering: false,
	tileRendering: true,
	tileCaching: true,
	gameboyFrameRate: 60,
	saveStateCallback: function saveStateCallback(saveStateObject) {
		// Function called everytime a savestate occurs
		// Used by the WasmBoySystemControls to show screenshots on save states
		saveStateObject.screenshotCanvasDataURL = WasmBoyGraphics.canvasElement.toDataURL();
		return saveStateObject;
	}
};

// Our canvas element
var index_canvasElement = undefined;

// Our notification timeout
var notificationTimeout = undefined;

var index__ref = Object(preact_min["h"])('div', null);

var index__ref2 = Object(preact_min["h"])('div', null);

var index__ref3 = Object(preact_min["h"])('div', null);

var index__ref4 = Object(preact_min["h"])('div', null);

var index__ref5 = Object(preact_min["h"])(
	'section',
	null,
	Object(preact_min["h"])(wasmboyDebugger_WasmBoyDebugger, { wasmboy: WasmBoy, wasmboyGraphics: WasmBoyGraphics, wasmboyAudio: WasmBoyAudio })
);

var index__ref6 = Object(preact_min["h"])(
	'h1',
	{ 'class': 'wasmboy__title' },
	'WasmBoy (Debugger / Demo)'
);

var index__ref7 = Object(preact_min["h"])(
	'main',
	{ className: 'wasmboy__canvas-container' },
	Object(preact_min["h"])('canvas', { className: 'wasmboy__canvas-container__canvas' })
);

var index__ref8 = Object(preact_min["h"])(wasmboyGamepad_WasmBoyGamepad, null);

var index_App = function (_Component) {
	index__inherits(App, _Component);

	function App() {
		index__classCallCheck(this, App);

		var _this = index__possibleConstructorReturn(this, _Component.call(this));

		_this.state = {
			showDebugger: false,
			showOptions: false,
			notification: index__ref
		};
		return _this;
	}

	// Using componentDidMount to wait for the canvas element to be inserted in DOM


	App.prototype.componentDidMount = function componentDidMount() {

		// Get our canvas element
		index_canvasElement = document.querySelector(".wasmboy__canvas-container__canvas");

		// Load our game
		WasmBoy.initialize(index_canvasElement, wasmBoyDefaultOptions);

		// Add our touch inputs
		// Add our touch inputs
		var dpadElement = document.getElementById('gamepadDpad');
		var startElement = document.getElementById('gamepadStart');
		var selectElement = document.getElementById('gamepadSelect');
		var aElement = document.getElementById('gamepadA');
		var bElement = document.getElementById('gamepadB');

		WasmBoyController.addTouchInput('UP', dpadElement, 'DPAD', 'UP');
		WasmBoyController.addTouchInput('RIGHT', dpadElement, 'DPAD', 'RIGHT');
		WasmBoyController.addTouchInput('DOWN', dpadElement, 'DPAD', 'DOWN');
		WasmBoyController.addTouchInput('LEFT', dpadElement, 'DPAD', 'LEFT');
		WasmBoyController.addTouchInput('A', aElement, 'BUTTON');
		WasmBoyController.addTouchInput('B', bElement, 'BUTTON');
		WasmBoyController.addTouchInput('START', startElement, 'BUTTON');
		WasmBoyController.addTouchInput('SELECT', selectElement, 'BUTTON');
	};

	// Function to show notifications to the user


	App.prototype.showNotification = function showNotification(notificationText) {
		var _this2 = this;

		if (notificationTimeout) {
			clearTimeout(notificationTimeout);
			notificationTimeout = undefined;
		}

		var closeNotification = function closeNotification() {
			var newState = index__extends({}, _this2.state);
			newState.notification = index__ref2;
			_this2.setState(newState);
		};

		var newState = index__extends({}, this.state);
		newState.notification = Object(preact_min["h"])(
			'div',
			{ 'class': 'notification animated fadeIn' },
			Object(preact_min["h"])('button', { 'class': 'delete', onClick: function onClick() {
					closeNotification();
				} }),
			notificationText
		);
		this.setState(newState);

		notificationTimeout = setTimeout(function () {
			closeNotification();
		}, 3000);
	};

	App.prototype.render = function render() {
		var _this3 = this;

		// Optionally render the options
		var optionsComponent = index__ref3;
		if (this.state.showOptions) {
			optionsComponent = Object(preact_min["h"])(
				'section',
				null,
				Object(preact_min["h"])(wasmboyOptions_WasmBoyOptions, { wasmBoy: WasmBoy, availableOptions: wasmBoyDefaultOptions, showNotification: function showNotification(text) {
						_this3.showNotification(text);
					} })
			);
		}

		// optionally render the debugger
		var debuggerComponent = index__ref4;
		if (this.state.showDebugger) {
			debuggerComponent = index__ref5;
		}

		return Object(preact_min["h"])(
			'div',
			{ 'class': 'wasmboy' },
			index__ref6,
			Object(preact_min["h"])(
				'div',
				{ style: 'text-align: center' },
				Object(preact_min["h"])(
					'label',
					{ 'class': 'checkbox' },
					'Show Options',
					Object(preact_min["h"])('input', {
						id: 'showOptions',
						type: 'checkbox',
						checked: this.state.showOptions,
						onChange: function onChange() {
							var newState = index__extends({}, _this3.state);
							newState.showOptions = !newState.showOptions;
							_this3.setState(newState);
						} })
				)
			),
			optionsComponent,
			Object(preact_min["h"])(
				'div',
				{ style: 'text-align: center' },
				Object(preact_min["h"])(
					'label',
					{ 'class': 'checkbox' },
					'Show Debugger',
					Object(preact_min["h"])('input', {
						type: 'checkbox',
						checked: this.state.showDebugger,
						onChange: function onChange() {
							var newState = index__extends({}, _this3.state);
							newState.showDebugger = !newState.showDebugger;
							_this3.setState(newState);
						} })
				)
			),
			debuggerComponent,
			Object(preact_min["h"])(wasmboyFilePicker_WasmBoyFilePicker, { wasmboy: WasmBoy,
				showNotification: function showNotification(text) {
					_this3.showNotification(text);
				} }),
			Object(preact_min["h"])(
				'div',
				null,
				Object(preact_min["h"])(wasmboySystemControls_WasmBoySystemControls, { wasmboy: WasmBoy, wasmboyMemory: WasmBoyMemory, showNotification: function showNotification(text) {
						_this3.showNotification(text);
					} })
			),
			index__ref7,
			index__ref8,
			this.state.notification
		);
	};

	return App;
}(preact_min["Component"]);



/***/ }),

/***/ "JsWE":
/***/ (function(module, exports, __webpack_require__) {

(function (global, factory) {
   true ? module.exports = factory(__webpack_require__("EBst")) : typeof define === 'function' && define.amd ? define(['preact'], factory) : global.preactPortal = factory(global.preact);
})(this, function (preact) {
  'use strict';

  var asyncGenerator = function () {
    function AwaitValue(value) {
      this.value = value;
    }

    function AsyncGenerator(gen) {
      var front, back;

      function send(key, arg) {
        return new Promise(function (resolve, reject) {
          var request = {
            key: key,
            arg: arg,
            resolve: resolve,
            reject: reject,
            next: null
          };

          if (back) {
            back = back.next = request;
          } else {
            front = back = request;
            resume(key, arg);
          }
        });
      }

      function resume(key, arg) {
        try {
          var result = gen[key](arg);
          var value = result.value;

          if (value instanceof AwaitValue) {
            Promise.resolve(value.value).then(function (arg) {
              resume("next", arg);
            }, function (arg) {
              resume("throw", arg);
            });
          } else {
            settle(result.done ? "return" : "normal", result.value);
          }
        } catch (err) {
          settle("throw", err);
        }
      }

      function settle(type, value) {
        switch (type) {
          case "return":
            front.resolve({
              value: value,
              done: true
            });
            break;

          case "throw":
            front.reject(value);
            break;

          default:
            front.resolve({
              value: value,
              done: false
            });
            break;
        }

        front = front.next;

        if (front) {
          resume(front.key, front.arg);
        } else {
          back = null;
        }
      }

      this._invoke = send;

      if (typeof gen.return !== "function") {
        this.return = undefined;
      }
    }

    if (typeof Symbol === "function" && Symbol.asyncIterator) {
      AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
        return this;
      };
    }

    AsyncGenerator.prototype.next = function (arg) {
      return this._invoke("next", arg);
    };

    AsyncGenerator.prototype.throw = function (arg) {
      return this._invoke("throw", arg);
    };

    AsyncGenerator.prototype.return = function (arg) {
      return this._invoke("return", arg);
    };

    return {
      wrap: function wrap(fn) {
        return function () {
          return new AsyncGenerator(fn.apply(this, arguments));
        };
      },
      await: function _await(value) {
        return new AwaitValue(value);
      }
    };
  }();

  var classCallCheck = function classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };

  var inherits = function inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  };

  var possibleConstructorReturn = function possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  };

  var Portal = function (_Component) {
    inherits(Portal, _Component);

    function Portal() {
      classCallCheck(this, Portal);
      return possibleConstructorReturn(this, _Component.apply(this, arguments));
    }

    Portal.prototype.componentDidUpdate = function componentDidUpdate(props) {
      for (var i in props) {
        if (props[i] !== this.props[i]) {
          return setTimeout(this.renderLayer);
        }
      }
    };

    Portal.prototype.componentDidMount = function componentDidMount() {
      this.isMounted = true;
      this.renderLayer = this.renderLayer.bind(this);
      this.renderLayer();
    };

    Portal.prototype.componentWillUnmount = function componentWillUnmount() {
      this.renderLayer(false);
      this.isMounted = false;
      if (this.remote) this.remote.parentNode.removeChild(this.remote);
    };

    Portal.prototype.findNode = function findNode(node) {
      return typeof node === 'string' ? document.querySelector(node) : node;
    };

    Portal.prototype.renderLayer = function renderLayer() {
      var show = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;

      if (!this.isMounted) return;

      if (this.props.into !== this.intoPointer) {
        this.intoPointer = this.props.into;
        if (this.into && this.remote) {
          this.remote = preact.render(preact.h(PortalProxy, null), this.into, this.remote);
        }
        this.into = this.findNode(this.props.into);
      }

      this.remote = preact.render(preact.h(PortalProxy, { context: this.context }, show && this.props.children || null), this.into, this.remote);
    };

    Portal.prototype.render = function render() {
      return null;
    };

    return Portal;
  }(preact.Component);

  var PortalProxy = function (_Component2) {
    inherits(PortalProxy, _Component2);

    function PortalProxy() {
      classCallCheck(this, PortalProxy);
      return possibleConstructorReturn(this, _Component2.apply(this, arguments));
    }

    PortalProxy.prototype.getChildContext = function getChildContext() {
      return this.props.context;
    };

    PortalProxy.prototype.render = function render(_ref) {
      var children = _ref.children;

      return children && children[0] || null;
    };

    return PortalProxy;
  }(preact.Component);

  return Portal;
});
//# sourceMappingURL=preact-portal.js.map

/***/ }),

/***/ "K0S7":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var utils = __webpack_require__("gt5T");

var MAXBITS = 15;
var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
//var ENOUGH = (ENOUGH_LENS+ENOUGH_DISTS);

var CODES = 0;
var LENS = 1;
var DISTS = 2;

var lbase = [/* Length codes 257..285 base */
3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0];

var lext = [/* Length codes 257..285 extra */
16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78];

var dbase = [/* Distance codes 0..29 base */
1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0];

var dext = [/* Distance codes 0..29 extra */
16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64];

module.exports = function inflate_table(type, lens, lens_index, codes, table, table_index, work, opts) {
  var bits = opts.bits;
  //here = opts.here; /* table entry for duplication */

  var len = 0; /* a code's length in bits */
  var sym = 0; /* index of code symbols */
  var min = 0,
      max = 0; /* minimum and maximum code lengths */
  var root = 0; /* number of index bits for root table */
  var curr = 0; /* number of index bits for current table */
  var drop = 0; /* code bits to drop for sub-table */
  var left = 0; /* number of prefix codes available */
  var used = 0; /* code entries in table used */
  var huff = 0; /* Huffman code */
  var incr; /* for incrementing code, index */
  var fill; /* index for replicating entries */
  var low; /* low bits for current root entry */
  var mask; /* mask for low root bits */
  var next; /* next available space in table */
  var base = null; /* base value table to use */
  var base_index = 0;
  //  var shoextra;    /* extra bits table to use */
  var end; /* use base and extra for symbol > end */
  var count = new utils.Buf16(MAXBITS + 1); //[MAXBITS+1];    /* number of codes of each length */
  var offs = new utils.Buf16(MAXBITS + 1); //[MAXBITS+1];     /* offsets in table for each length */
  var extra = null;
  var extra_index = 0;

  var here_bits, here_op, here_val;

  /*
   Process a set of code lengths to create a canonical Huffman code.  The
   code lengths are lens[0..codes-1].  Each length corresponds to the
   symbols 0..codes-1.  The Huffman code is generated by first sorting the
   symbols by length from short to long, and retaining the symbol order
   for codes with equal lengths.  Then the code starts with all zero bits
   for the first code of the shortest length, and the codes are integer
   increments for the same length, and zeros are appended as the length
   increases.  For the deflate format, these bits are stored backwards
   from their more natural integer increment ordering, and so when the
   decoding tables are built in the large loop below, the integer codes
   are incremented backwards.
    This routine assumes, but does not check, that all of the entries in
   lens[] are in the range 0..MAXBITS.  The caller must assure this.
   1..MAXBITS is interpreted as that code length.  zero means that that
   symbol does not occur in this code.
    The codes are sorted by computing a count of codes for each length,
   creating from that a table of starting indices for each length in the
   sorted table, and then entering the symbols in order in the sorted
   table.  The sorted table is work[], with that space being provided by
   the caller.
    The length counts are used for other purposes as well, i.e. finding
   the minimum and maximum length codes, determining if there are any
   codes at all, checking for a valid set of lengths, and looking ahead
   at length counts to determine sub-table sizes when building the
   decoding tables.
   */

  /* accumulate lengths for codes (assumes lens[] all in 0..MAXBITS) */
  for (len = 0; len <= MAXBITS; len++) {
    count[len] = 0;
  }
  for (sym = 0; sym < codes; sym++) {
    count[lens[lens_index + sym]]++;
  }

  /* bound code lengths, force root to be within code lengths */
  root = bits;
  for (max = MAXBITS; max >= 1; max--) {
    if (count[max] !== 0) {
      break;
    }
  }
  if (root > max) {
    root = max;
  }
  if (max === 0) {
    /* no symbols to code at all */
    //table.op[opts.table_index] = 64;  //here.op = (var char)64;    /* invalid code marker */
    //table.bits[opts.table_index] = 1;   //here.bits = (var char)1;
    //table.val[opts.table_index++] = 0;   //here.val = (var short)0;
    table[table_index++] = 1 << 24 | 64 << 16 | 0;

    //table.op[opts.table_index] = 64;
    //table.bits[opts.table_index] = 1;
    //table.val[opts.table_index++] = 0;
    table[table_index++] = 1 << 24 | 64 << 16 | 0;

    opts.bits = 1;
    return 0; /* no symbols, but wait for decoding to report error */
  }
  for (min = 1; min < max; min++) {
    if (count[min] !== 0) {
      break;
    }
  }
  if (root < min) {
    root = min;
  }

  /* check for an over-subscribed or incomplete set of lengths */
  left = 1;
  for (len = 1; len <= MAXBITS; len++) {
    left <<= 1;
    left -= count[len];
    if (left < 0) {
      return -1;
    } /* over-subscribed */
  }
  if (left > 0 && (type === CODES || max !== 1)) {
    return -1; /* incomplete set */
  }

  /* generate offsets into symbol table for each length for sorting */
  offs[1] = 0;
  for (len = 1; len < MAXBITS; len++) {
    offs[len + 1] = offs[len] + count[len];
  }

  /* sort symbols by length, by symbol order within each length */
  for (sym = 0; sym < codes; sym++) {
    if (lens[lens_index + sym] !== 0) {
      work[offs[lens[lens_index + sym]]++] = sym;
    }
  }

  /*
   Create and fill in decoding tables.  In this loop, the table being
   filled is at next and has curr index bits.  The code being used is huff
   with length len.  That code is converted to an index by dropping drop
   bits off of the bottom.  For codes where len is less than drop + curr,
   those top drop + curr - len bits are incremented through all values to
   fill the table with replicated entries.
    root is the number of index bits for the root table.  When len exceeds
   root, sub-tables are created pointed to by the root entry with an index
   of the low root bits of huff.  This is saved in low to check for when a
   new sub-table should be started.  drop is zero when the root table is
   being filled, and drop is root when sub-tables are being filled.
    When a new sub-table is needed, it is necessary to look ahead in the
   code lengths to determine what size sub-table is needed.  The length
   counts are used for this, and so count[] is decremented as codes are
   entered in the tables.
    used keeps track of how many table entries have been allocated from the
   provided *table space.  It is checked for LENS and DIST tables against
   the constants ENOUGH_LENS and ENOUGH_DISTS to guard against changes in
   the initial root table size constants.  See the comments in inftrees.h
   for more information.
    sym increments through all symbols, and the loop terminates when
   all codes of length max, i.e. all codes, have been processed.  This
   routine permits incomplete codes, so another loop after this one fills
   in the rest of the decoding tables with invalid code markers.
   */

  /* set up for code type */
  // poor man optimization - use if-else instead of switch,
  // to avoid deopts in old v8
  if (type === CODES) {
    base = extra = work; /* dummy value--not used */
    end = 19;
  } else if (type === LENS) {
    base = lbase;
    base_index -= 257;
    extra = lext;
    extra_index -= 257;
    end = 256;
  } else {
    /* DISTS */
    base = dbase;
    extra = dext;
    end = -1;
  }

  /* initialize opts for loop */
  huff = 0; /* starting code */
  sym = 0; /* starting code symbol */
  len = min; /* starting code length */
  next = table_index; /* current table to fill in */
  curr = root; /* current table index bits */
  drop = 0; /* current bits to drop from code for index */
  low = -1; /* trigger new sub-table when len > root */
  used = 1 << root; /* use root table entries */
  mask = used - 1; /* mask for comparing low */

  /* check available table space */
  if (type === LENS && used > ENOUGH_LENS || type === DISTS && used > ENOUGH_DISTS) {
    return 1;
  }

  /* process all codes and make table entries */
  for (;;) {
    /* create table entry */
    here_bits = len - drop;
    if (work[sym] < end) {
      here_op = 0;
      here_val = work[sym];
    } else if (work[sym] > end) {
      here_op = extra[extra_index + work[sym]];
      here_val = base[base_index + work[sym]];
    } else {
      here_op = 32 + 64; /* end of block */
      here_val = 0;
    }

    /* replicate for those indices with low len bits equal to huff */
    incr = 1 << len - drop;
    fill = 1 << curr;
    min = fill; /* save offset to next table */
    do {
      fill -= incr;
      table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
    } while (fill !== 0);

    /* backwards increment the len-bit code huff */
    incr = 1 << len - 1;
    while (huff & incr) {
      incr >>= 1;
    }
    if (incr !== 0) {
      huff &= incr - 1;
      huff += incr;
    } else {
      huff = 0;
    }

    /* go to next symbol, update count, len */
    sym++;
    if (--count[len] === 0) {
      if (len === max) {
        break;
      }
      len = lens[lens_index + work[sym]];
    }

    /* create new sub-table if needed */
    if (len > root && (huff & mask) !== low) {
      /* if first time, transition to sub-tables */
      if (drop === 0) {
        drop = root;
      }

      /* increment past last table */
      next += min; /* here min is 1 << curr */

      /* determine length of next table */
      curr = len - drop;
      left = 1 << curr;
      while (curr + drop < max) {
        left -= count[curr + drop];
        if (left <= 0) {
          break;
        }
        curr++;
        left <<= 1;
      }

      /* check for enough space */
      used += 1 << curr;
      if (type === LENS && used > ENOUGH_LENS || type === DISTS && used > ENOUGH_DISTS) {
        return 1;
      }

      /* point entry in root table to sub-table */
      low = huff & mask;
      /*table.op[low] = curr;
      table.bits[low] = root;
      table.val[low] = next - opts.table_index;*/
      table[low] = root << 24 | curr << 16 | next - table_index | 0;
    }
  }

  /* fill in remaining table entry if code is incomplete (guaranteed to have
   at most one remaining entry, since if the code is incomplete, the
   maximum code length that was allowed to get this far is one bit) */
  if (huff !== 0) {
    //table.op[next + huff] = 64;            /* invalid code marker */
    //table.bits[next + huff] = len - drop;
    //table.val[next + huff] = 0;
    table[next + huff] = len - drop << 24 | 64 << 16 | 0;
  }

  /* set return parameters */
  //opts.table_index += used;
  opts.bits = root;
  return 0;
};

/***/ }),

/***/ "KnAl":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__("71nt");
var GenericWorker = __webpack_require__("bxoG");

// the size of the generated chunks
// TODO expose this as a public variable
var DEFAULT_BLOCK_SIZE = 16 * 1024;

/**
 * A worker that reads a content and emits chunks.
 * @constructor
 * @param {Promise} dataP the promise of the data to split
 */
function DataWorker(dataP) {
    GenericWorker.call(this, "DataWorker");
    var self = this;
    this.dataIsReady = false;
    this.index = 0;
    this.max = 0;
    this.data = null;
    this.type = "";

    this._tickScheduled = false;

    dataP.then(function (data) {
        self.dataIsReady = true;
        self.data = data;
        self.max = data && data.length || 0;
        self.type = utils.getTypeOf(data);
        if (!self.isPaused) {
            self._tickAndRepeat();
        }
    }, function (e) {
        self.error(e);
    });
}

utils.inherits(DataWorker, GenericWorker);

/**
 * @see GenericWorker.cleanUp
 */
DataWorker.prototype.cleanUp = function () {
    GenericWorker.prototype.cleanUp.call(this);
    this.data = null;
};

/**
 * @see GenericWorker.resume
 */
DataWorker.prototype.resume = function () {
    if (!GenericWorker.prototype.resume.call(this)) {
        return false;
    }

    if (!this._tickScheduled && this.dataIsReady) {
        this._tickScheduled = true;
        utils.delay(this._tickAndRepeat, [], this);
    }
    return true;
};

/**
 * Trigger a tick a schedule an other call to this function.
 */
DataWorker.prototype._tickAndRepeat = function () {
    this._tickScheduled = false;
    if (this.isPaused || this.isFinished) {
        return;
    }
    this._tick();
    if (!this.isFinished) {
        utils.delay(this._tickAndRepeat, [], this);
        this._tickScheduled = true;
    }
};

/**
 * Read and push a chunk.
 */
DataWorker.prototype._tick = function () {

    if (this.isPaused || this.isFinished) {
        return false;
    }

    var size = DEFAULT_BLOCK_SIZE;
    var data = null,
        nextIndex = Math.min(this.max, this.index + size);
    if (this.index >= this.max) {
        // EOF
        return this.end();
    } else {
        switch (this.type) {
            case "string":
                data = this.data.substring(this.index, nextIndex);
                break;
            case "uint8array":
                data = this.data.subarray(this.index, nextIndex);
                break;
            case "array":
            case "nodebuffer":
                data = this.data.slice(this.index, nextIndex);
                break;
        }
        this.index = nextIndex;
        return this.push({
            data: data,
            meta: {
                percent: this.max ? this.index / this.max * 100 : 0
            }
        });
    }
};

module.exports = DataWorker;

/***/ }),

/***/ "KpjM":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


// Note: adler32 takes 12% for level 0 and 2% for level 6.
// It isn't worth it to make additional optimizations as in original.
// Small size is preferable.

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function adler32(adler, buf, len, pos) {
  var s1 = adler & 0xffff | 0,
      s2 = adler >>> 16 & 0xffff | 0,
      n = 0;

  while (len !== 0) {
    // Set limit ~ twice less than 5552, to keep
    // s2 in 31-bits, because we force signed ints.
    // in other case %= will fail.
    n = len > 2000 ? 2000 : len;
    len -= n;

    do {
      s1 = s1 + buf[pos++] | 0;
      s2 = s2 + s1 | 0;
    } while (--n);

    s1 %= 65521;
    s2 %= 65521;
  }

  return s1 | s2 << 16 | 0;
}

module.exports = adler32;

/***/ }),

/***/ "LC74":
/***/ (function(module, exports) {

if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor;
    var TempCtor = function TempCtor() {};
    TempCtor.prototype = superCtor.prototype;
    ctor.prototype = new TempCtor();
    ctor.prototype.constructor = ctor;
  };
}

/***/ }),

/***/ "LFbK":
/***/ (function(module, exports) {

module.exports = function (it) {
  return typeof it === 'object' ? it !== null : typeof it === 'function';
};

/***/ }),

/***/ "LGU4":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var zlib_inflate = __webpack_require__("fkix");
var utils = __webpack_require__("gt5T");
var strings = __webpack_require__("LjBA");
var c = __webpack_require__("0jOE");
var msg = __webpack_require__("2A+V");
var ZStream = __webpack_require__("h95s");
var GZheader = __webpack_require__("6ktE");

var toString = Object.prototype.toString;

/**
 * class Inflate
 *
 * Generic JS-style wrapper for zlib calls. If you don't need
 * streaming behaviour - use more simple functions: [[inflate]]
 * and [[inflateRaw]].
 **/

/* internal
 * inflate.chunks -> Array
 *
 * Chunks of output data, if [[Inflate#onData]] not overridden.
 **/

/**
 * Inflate.result -> Uint8Array|Array|String
 *
 * Uncompressed result, generated by default [[Inflate#onData]]
 * and [[Inflate#onEnd]] handlers. Filled after you push last chunk
 * (call [[Inflate#push]] with `Z_FINISH` / `true` param) or if you
 * push a chunk with explicit flush (call [[Inflate#push]] with
 * `Z_SYNC_FLUSH` param).
 **/

/**
 * Inflate.err -> Number
 *
 * Error code after inflate finished. 0 (Z_OK) on success.
 * Should be checked if broken data possible.
 **/

/**
 * Inflate.msg -> String
 *
 * Error message, if [[Inflate.err]] != 0
 **/

/**
 * new Inflate(options)
 * - options (Object): zlib inflate options.
 *
 * Creates new inflator instance with specified params. Throws exception
 * on bad params. Supported options:
 *
 * - `windowBits`
 * - `dictionary`
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Additional options, for internal needs:
 *
 * - `chunkSize` - size of generated data chunks (16K by default)
 * - `raw` (Boolean) - do raw inflate
 * - `to` (String) - if equal to 'string', then result will be converted
 *   from utf8 to utf16 (javascript) string. When string output requested,
 *   chunk length can differ from `chunkSize`, depending on content.
 *
 * By default, when no options set, autodetect deflate/gzip data format via
 * wrapper header.
 *
 * ##### Example:
 *
 * ```javascript
 * var pako = require('pako')
 *   , chunk1 = Uint8Array([1,2,3,4,5,6,7,8,9])
 *   , chunk2 = Uint8Array([10,11,12,13,14,15,16,17,18,19]);
 *
 * var inflate = new pako.Inflate({ level: 3});
 *
 * inflate.push(chunk1, false);
 * inflate.push(chunk2, true);  // true -> last chunk
 *
 * if (inflate.err) { throw new Error(inflate.err); }
 *
 * console.log(inflate.result);
 * ```
 **/
function Inflate(options) {
  if (!(this instanceof Inflate)) return new Inflate(options);

  this.options = utils.assign({
    chunkSize: 16384,
    windowBits: 0,
    to: ''
  }, options || {});

  var opt = this.options;

  // Force window size for `raw` data, if not set directly,
  // because we have no header for autodetect.
  if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
    opt.windowBits = -opt.windowBits;
    if (opt.windowBits === 0) {
      opt.windowBits = -15;
    }
  }

  // If `windowBits` not defined (and mode not raw) - set autodetect flag for gzip/deflate
  if (opt.windowBits >= 0 && opt.windowBits < 16 && !(options && options.windowBits)) {
    opt.windowBits += 32;
  }

  // Gzip header has no info about windows size, we can do autodetect only
  // for deflate. So, if window size not set, force it to max when gzip possible
  if (opt.windowBits > 15 && opt.windowBits < 48) {
    // bit 3 (16) -> gzipped data
    // bit 4 (32) -> autodetect gzip/deflate
    if ((opt.windowBits & 15) === 0) {
      opt.windowBits |= 15;
    }
  }

  this.err = 0; // error code, if happens (0 = Z_OK)
  this.msg = ''; // error message
  this.ended = false; // used to avoid multiple onEnd() calls
  this.chunks = []; // chunks of compressed data

  this.strm = new ZStream();
  this.strm.avail_out = 0;

  var status = zlib_inflate.inflateInit2(this.strm, opt.windowBits);

  if (status !== c.Z_OK) {
    throw new Error(msg[status]);
  }

  this.header = new GZheader();

  zlib_inflate.inflateGetHeader(this.strm, this.header);
}

/**
 * Inflate#push(data[, mode]) -> Boolean
 * - data (Uint8Array|Array|ArrayBuffer|String): input data
 * - mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE modes.
 *   See constants. Skipped or `false` means Z_NO_FLUSH, `true` means Z_FINISH.
 *
 * Sends input data to inflate pipe, generating [[Inflate#onData]] calls with
 * new output chunks. Returns `true` on success. The last data block must have
 * mode Z_FINISH (or `true`). That will flush internal pending buffers and call
 * [[Inflate#onEnd]]. For interim explicit flushes (without ending the stream) you
 * can use mode Z_SYNC_FLUSH, keeping the decompression context.
 *
 * On fail call [[Inflate#onEnd]] with error code and return false.
 *
 * We strongly recommend to use `Uint8Array` on input for best speed (output
 * format is detected automatically). Also, don't skip last param and always
 * use the same type in your code (boolean or number). That will improve JS speed.
 *
 * For regular `Array`-s make sure all elements are [0..255].
 *
 * ##### Example
 *
 * ```javascript
 * push(chunk, false); // push one of data chunks
 * ...
 * push(chunk, true);  // push last chunk
 * ```
 **/
Inflate.prototype.push = function (data, mode) {
  var strm = this.strm;
  var chunkSize = this.options.chunkSize;
  var dictionary = this.options.dictionary;
  var status, _mode;
  var next_out_utf8, tail, utf8str;
  var dict;

  // Flag to properly process Z_BUF_ERROR on testing inflate call
  // when we check that all output data was flushed.
  var allowBufError = false;

  if (this.ended) {
    return false;
  }
  _mode = mode === ~~mode ? mode : mode === true ? c.Z_FINISH : c.Z_NO_FLUSH;

  // Convert data if needed
  if (typeof data === 'string') {
    // Only binary strings can be decompressed on practice
    strm.input = strings.binstring2buf(data);
  } else if (toString.call(data) === '[object ArrayBuffer]') {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }

  strm.next_in = 0;
  strm.avail_in = strm.input.length;

  do {
    if (strm.avail_out === 0) {
      strm.output = new utils.Buf8(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }

    status = zlib_inflate.inflate(strm, c.Z_NO_FLUSH); /* no bad return value */

    if (status === c.Z_NEED_DICT && dictionary) {
      // Convert data if needed
      if (typeof dictionary === 'string') {
        dict = strings.string2buf(dictionary);
      } else if (toString.call(dictionary) === '[object ArrayBuffer]') {
        dict = new Uint8Array(dictionary);
      } else {
        dict = dictionary;
      }

      status = zlib_inflate.inflateSetDictionary(this.strm, dict);
    }

    if (status === c.Z_BUF_ERROR && allowBufError === true) {
      status = c.Z_OK;
      allowBufError = false;
    }

    if (status !== c.Z_STREAM_END && status !== c.Z_OK) {
      this.onEnd(status);
      this.ended = true;
      return false;
    }

    if (strm.next_out) {
      if (strm.avail_out === 0 || status === c.Z_STREAM_END || strm.avail_in === 0 && (_mode === c.Z_FINISH || _mode === c.Z_SYNC_FLUSH)) {

        if (this.options.to === 'string') {

          next_out_utf8 = strings.utf8border(strm.output, strm.next_out);

          tail = strm.next_out - next_out_utf8;
          utf8str = strings.buf2string(strm.output, next_out_utf8);

          // move tail
          strm.next_out = tail;
          strm.avail_out = chunkSize - tail;
          if (tail) {
            utils.arraySet(strm.output, strm.output, next_out_utf8, tail, 0);
          }

          this.onData(utf8str);
        } else {
          this.onData(utils.shrinkBuf(strm.output, strm.next_out));
        }
      }
    }

    // When no more input data, we should check that internal inflate buffers
    // are flushed. The only way to do it when avail_out = 0 - run one more
    // inflate pass. But if output data not exists, inflate return Z_BUF_ERROR.
    // Here we set flag to process this error properly.
    //
    // NOTE. Deflate does not return error in this case and does not needs such
    // logic.
    if (strm.avail_in === 0 && strm.avail_out === 0) {
      allowBufError = true;
    }
  } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== c.Z_STREAM_END);

  if (status === c.Z_STREAM_END) {
    _mode = c.Z_FINISH;
  }

  // Finalize on the last chunk.
  if (_mode === c.Z_FINISH) {
    status = zlib_inflate.inflateEnd(this.strm);
    this.onEnd(status);
    this.ended = true;
    return status === c.Z_OK;
  }

  // callback interim results if Z_SYNC_FLUSH.
  if (_mode === c.Z_SYNC_FLUSH) {
    this.onEnd(c.Z_OK);
    strm.avail_out = 0;
    return true;
  }

  return true;
};

/**
 * Inflate#onData(chunk) -> Void
 * - chunk (Uint8Array|Array|String): output data. Type of array depends
 *   on js engine support. When string output requested, each chunk
 *   will be string.
 *
 * By default, stores data blocks in `chunks[]` property and glue
 * those in `onEnd`. Override this handler, if you need another behaviour.
 **/
Inflate.prototype.onData = function (chunk) {
  this.chunks.push(chunk);
};

/**
 * Inflate#onEnd(status) -> Void
 * - status (Number): inflate status. 0 (Z_OK) on success,
 *   other if not.
 *
 * Called either after you tell inflate that the input stream is
 * complete (Z_FINISH) or should be flushed (Z_SYNC_FLUSH)
 * or if an error happened. By default - join collected chunks,
 * free memory and fill `results` / `err` properties.
 **/
Inflate.prototype.onEnd = function (status) {
  // On success - join
  if (status === c.Z_OK) {
    if (this.options.to === 'string') {
      // Glue & convert here, until we teach pako to send
      // utf8 aligned strings to onData
      this.result = this.chunks.join('');
    } else {
      this.result = utils.flattenChunks(this.chunks);
    }
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};

/**
 * inflate(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * Decompress `data` with inflate/ungzip and `options`. Autodetect
 * format via wrapper header by default. That's why we don't provide
 * separate `ungzip` method.
 *
 * Supported options are:
 *
 * - windowBits
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information.
 *
 * Sugar (options):
 *
 * - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
 *   negative windowBits implicitly.
 * - `to` (String) - if equal to 'string', then result will be converted
 *   from utf8 to utf16 (javascript) string. When string output requested,
 *   chunk length can differ from `chunkSize`, depending on content.
 *
 *
 * ##### Example:
 *
 * ```javascript
 * var pako = require('pako')
 *   , input = pako.deflate([1,2,3,4,5,6,7,8,9])
 *   , output;
 *
 * try {
 *   output = pako.inflate(input);
 * } catch (err)
 *   console.log(err);
 * }
 * ```
 **/
function inflate(input, options) {
  var inflator = new Inflate(options);

  inflator.push(input, true);

  // That will never happens, if you don't cheat with options :)
  if (inflator.err) {
    throw inflator.msg || msg[inflator.err];
  }

  return inflator.result;
}

/**
 * inflateRaw(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * The same as [[inflate]], but creates raw data, without wrapper
 * (header and adler32 crc).
 **/
function inflateRaw(input, options) {
  options = options || {};
  options.raw = true;
  return inflate(input, options);
}

/**
 * ungzip(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * Just shortcut to [[inflate]], because it autodetects format
 * by header.content. Done for convenience.
 **/

exports.Inflate = Inflate;
exports.inflate = inflate;
exports.inflateRaw = inflateRaw;
exports.ungzip = inflate;

/***/ }),

/***/ "LjBA":
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// String encode/decode helpers


var utils = __webpack_require__("gt5T");

// Quick check if we can use fast array to bin string conversion
//
// - apply(Array) can fail on Android 2.2
// - apply(Uint8Array) can fail on iOS 5.1 Safari
//
var STR_APPLY_OK = true;
var STR_APPLY_UIA_OK = true;

try {
  String.fromCharCode.apply(null, [0]);
} catch (__) {
  STR_APPLY_OK = false;
}
try {
  String.fromCharCode.apply(null, new Uint8Array(1));
} catch (__) {
  STR_APPLY_UIA_OK = false;
}

// Table with utf8 lengths (calculated by first byte of sequence)
// Note, that 5 & 6-byte values and some 4-byte values can not be represented in JS,
// because max possible codepoint is 0x10ffff
var _utf8len = new utils.Buf8(256);
for (var q = 0; q < 256; q++) {
  _utf8len[q] = q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1;
}
_utf8len[254] = _utf8len[254] = 1; // Invalid sequence start


// convert string to array (typed, when possible)
exports.string2buf = function (str) {
  var buf,
      c,
      c2,
      m_pos,
      i,
      str_len = str.length,
      buf_len = 0;

  // count binary size
  for (m_pos = 0; m_pos < str_len; m_pos++) {
    c = str.charCodeAt(m_pos);
    if ((c & 0xfc00) === 0xd800 && m_pos + 1 < str_len) {
      c2 = str.charCodeAt(m_pos + 1);
      if ((c2 & 0xfc00) === 0xdc00) {
        c = 0x10000 + (c - 0xd800 << 10) + (c2 - 0xdc00);
        m_pos++;
      }
    }
    buf_len += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }

  // allocate buffer
  buf = new utils.Buf8(buf_len);

  // convert
  for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
    c = str.charCodeAt(m_pos);
    if ((c & 0xfc00) === 0xd800 && m_pos + 1 < str_len) {
      c2 = str.charCodeAt(m_pos + 1);
      if ((c2 & 0xfc00) === 0xdc00) {
        c = 0x10000 + (c - 0xd800 << 10) + (c2 - 0xdc00);
        m_pos++;
      }
    }
    if (c < 0x80) {
      /* one byte */
      buf[i++] = c;
    } else if (c < 0x800) {
      /* two bytes */
      buf[i++] = 0xC0 | c >>> 6;
      buf[i++] = 0x80 | c & 0x3f;
    } else if (c < 0x10000) {
      /* three bytes */
      buf[i++] = 0xE0 | c >>> 12;
      buf[i++] = 0x80 | c >>> 6 & 0x3f;
      buf[i++] = 0x80 | c & 0x3f;
    } else {
      /* four bytes */
      buf[i++] = 0xf0 | c >>> 18;
      buf[i++] = 0x80 | c >>> 12 & 0x3f;
      buf[i++] = 0x80 | c >>> 6 & 0x3f;
      buf[i++] = 0x80 | c & 0x3f;
    }
  }

  return buf;
};

// Helper (used in 2 places)
function buf2binstring(buf, len) {
  // use fallback for big arrays to avoid stack overflow
  if (len < 65537) {
    if (buf.subarray && STR_APPLY_UIA_OK || !buf.subarray && STR_APPLY_OK) {
      return String.fromCharCode.apply(null, utils.shrinkBuf(buf, len));
    }
  }

  var result = '';
  for (var i = 0; i < len; i++) {
    result += String.fromCharCode(buf[i]);
  }
  return result;
}

// Convert byte array to binary string
exports.buf2binstring = function (buf) {
  return buf2binstring(buf, buf.length);
};

// Convert binary string (typed, when possible)
exports.binstring2buf = function (str) {
  var buf = new utils.Buf8(str.length);
  for (var i = 0, len = buf.length; i < len; i++) {
    buf[i] = str.charCodeAt(i);
  }
  return buf;
};

// convert array to string
exports.buf2string = function (buf, max) {
  var i, out, c, c_len;
  var len = max || buf.length;

  // Reserve max possible length (2 words per char)
  // NB: by unknown reasons, Array is significantly faster for
  //     String.fromCharCode.apply than Uint16Array.
  var utf16buf = new Array(len * 2);

  for (out = 0, i = 0; i < len;) {
    c = buf[i++];
    // quick process ascii
    if (c < 0x80) {
      utf16buf[out++] = c;continue;
    }

    c_len = _utf8len[c];
    // skip 5 & 6 byte codes
    if (c_len > 4) {
      utf16buf[out++] = 0xfffd;i += c_len - 1;continue;
    }

    // apply mask on first byte
    c &= c_len === 2 ? 0x1f : c_len === 3 ? 0x0f : 0x07;
    // join the rest
    while (c_len > 1 && i < len) {
      c = c << 6 | buf[i++] & 0x3f;
      c_len--;
    }

    // terminated by end of string?
    if (c_len > 1) {
      utf16buf[out++] = 0xfffd;continue;
    }

    if (c < 0x10000) {
      utf16buf[out++] = c;
    } else {
      c -= 0x10000;
      utf16buf[out++] = 0xd800 | c >> 10 & 0x3ff;
      utf16buf[out++] = 0xdc00 | c & 0x3ff;
    }
  }

  return buf2binstring(utf16buf, out);
};

// Calculate max possible position in utf8 buffer,
// that will not break sequence. If that's not possible
// - (very small limits) return max size as is.
//
// buf[] - utf8 bytes array
// max   - length limit (mandatory);
exports.utf8border = function (buf, max) {
  var pos;

  max = max || buf.length;
  if (max > buf.length) {
    max = buf.length;
  }

  // go back from last position, until start of sequence found
  pos = max - 1;
  while (pos >= 0 && (buf[pos] & 0xC0) === 0x80) {
    pos--;
  }

  // Very small and broken sequence,
  // return max, because we should return something anyway.
  if (pos < 0) {
    return max;
  }

  // If we came to start of buffer - that means buffer is too small,
  // return max too.
  if (pos === 0) {
    return max;
  }

  return pos + _utf8len[buf[pos]] > max ? pos : max;
};

/***/ }),

/***/ "MXSK":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__("71nt");

function DataReader(data) {
    this.data = data; // type : see implementation
    this.length = data.length;
    this.index = 0;
    this.zero = 0;
}
DataReader.prototype = {
    /**
     * Check that the offset will not go too far.
     * @param {string} offset the additional offset to check.
     * @throws {Error} an Error if the offset is out of bounds.
     */
    checkOffset: function checkOffset(offset) {
        this.checkIndex(this.index + offset);
    },
    /**
     * Check that the specified index will not be too far.
     * @param {string} newIndex the index to check.
     * @throws {Error} an Error if the index is out of bounds.
     */
    checkIndex: function checkIndex(newIndex) {
        if (this.length < this.zero + newIndex || newIndex < 0) {
            throw new Error("End of data reached (data length = " + this.length + ", asked index = " + newIndex + "). Corrupted zip ?");
        }
    },
    /**
     * Change the index.
     * @param {number} newIndex The new index.
     * @throws {Error} if the new index is out of the data.
     */
    setIndex: function setIndex(newIndex) {
        this.checkIndex(newIndex);
        this.index = newIndex;
    },
    /**
     * Skip the next n bytes.
     * @param {number} n the number of bytes to skip.
     * @throws {Error} if the new index is out of the data.
     */
    skip: function skip(n) {
        this.setIndex(this.index + n);
    },
    /**
     * Get the byte at the specified index.
     * @param {number} i the index to use.
     * @return {number} a byte.
     */
    byteAt: function byteAt(i) {
        // see implementations
    },
    /**
     * Get the next number with a given byte size.
     * @param {number} size the number of bytes to read.
     * @return {number} the corresponding number.
     */
    readInt: function readInt(size) {
        var result = 0,
            i;
        this.checkOffset(size);
        for (i = this.index + size - 1; i >= this.index; i--) {
            result = (result << 8) + this.byteAt(i);
        }
        this.index += size;
        return result;
    },
    /**
     * Get the next string with a given byte size.
     * @param {number} size the number of bytes to read.
     * @return {string} the corresponding string.
     */
    readString: function readString(size) {
        return utils.transformTo("string", this.readData(size));
    },
    /**
     * Get raw data without conversion, <size> bytes.
     * @param {number} size the number of bytes to read.
     * @return {Object} the raw data, implementation specific.
     */
    readData: function readData(size) {
        // see implementations
    },
    /**
     * Find the last occurence of a zip signature (4 bytes).
     * @param {string} sig the signature to find.
     * @return {number} the index of the last occurence, -1 if not found.
     */
    lastIndexOfSignature: function lastIndexOfSignature(sig) {
        // see implementations
    },
    /**
     * Read the signature (4 bytes) at the current position and compare it with sig.
     * @param {string} sig the expected signature
     * @return {boolean} true if the signature matches, false otherwise.
     */
    readAndCheckSignature: function readAndCheckSignature(sig) {
        // see implementations
    },
    /**
     * Get the next date.
     * @return {Date} the date.
     */
    readDate: function readDate() {
        var dostime = this.readInt(4);
        return new Date(Date.UTC((dostime >> 25 & 0x7f) + 1980, // year
        (dostime >> 21 & 0x0f) - 1, // month
        dostime >> 16 & 0x1f, // day
        dostime >> 11 & 0x1f, // hour
        dostime >> 5 & 0x3f, // minute
        (dostime & 0x1f) << 1)); // second
    }
};
module.exports = DataReader;

/***/ }),

/***/ "OmGh":
/***/ (function(module, exports) {

var toString = {}.toString;

module.exports = function (it) {
  return toString.call(it).slice(8, -1);
};

/***/ }),

/***/ "PPgq":
/***/ (function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ }),

/***/ "PirY":
/***/ (function(module, exports) {


module.exports = function load(src, opts, cb) {
  var head = document.head || document.getElementsByTagName('head')[0];
  var script = document.createElement('script');

  if (typeof opts === 'function') {
    cb = opts;
    opts = {};
  }

  opts = opts || {};
  cb = cb || function () {};

  script.type = opts.type || 'text/javascript';
  script.charset = opts.charset || 'utf8';
  script.async = 'async' in opts ? !!opts.async : true;
  script.src = src;

  if (opts.attrs) {
    setAttributes(script, opts.attrs);
  }

  if (opts.text) {
    script.text = '' + opts.text;
  }

  var onend = 'onload' in script ? stdOnEnd : ieOnEnd;
  onend(script, cb);

  // some good legacy browsers (firefox) fail the 'in' detection above
  // so as a fallback we always set onload
  // old IE will ignore this and new IE will set onload
  if (!script.onload) {
    stdOnEnd(script, cb);
  }

  head.appendChild(script);
};

function setAttributes(script, attrs) {
  for (var attr in attrs) {
    script.setAttribute(attr, attrs[attr]);
  }
}

function stdOnEnd(script, cb) {
  script.onload = function () {
    this.onerror = this.onload = null;
    cb(null, script);
  };
  script.onerror = function () {
    // this.onload = null here is necessary
    // because even IE9 works not like others
    this.onerror = this.onload = null;
    cb(new Error('Failed to load ' + this.src), script);
  };
}

function ieOnEnd(script, cb) {
  script.onreadystatechange = function () {
    if (this.readyState != 'complete' && this.readyState != 'loaded') return;
    this.onreadystatechange = null;
    cb(null, script); // there is no way to catch loading errors in IE8
  };
}

/***/ }),

/***/ "Q2VO":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__("71nt");
var GenericWorker = __webpack_require__("bxoG");

/**
 * A worker which calculate the total length of the data flowing through.
 * @constructor
 * @param {String} propName the name used to expose the length
 */
function DataLengthProbe(propName) {
    GenericWorker.call(this, "DataLengthProbe for " + propName);
    this.propName = propName;
    this.withStreamInfo(propName, 0);
}
utils.inherits(DataLengthProbe, GenericWorker);

/**
 * @see GenericWorker.processChunk
 */
DataLengthProbe.prototype.processChunk = function (chunk) {
    if (chunk) {
        var length = this.streamInfo[this.propName] || 0;
        this.streamInfo[this.propName] = length + chunk.data.length;
    }
    GenericWorker.prototype.processChunk.call(this, chunk);
};
module.exports = DataLengthProbe;

/***/ }),

/***/ "UGHC":
/***/ (function(module, exports) {

// Generated by CoffeeScript 1.12.2
(function () {
  var getNanoSeconds, hrtime, loadTime, moduleLoadTime, nodeLoadTime, upTime;

  if (typeof performance !== "undefined" && performance !== null && performance.now) {
    module.exports = function () {
      return performance.now();
    };
  } else if (typeof process !== "undefined" && process !== null && process.hrtime) {
    module.exports = function () {
      return (getNanoSeconds() - nodeLoadTime) / 1e6;
    };
    hrtime = process.hrtime;
    getNanoSeconds = function getNanoSeconds() {
      var hr;
      hr = hrtime();
      return hr[0] * 1e9 + hr[1];
    };
    moduleLoadTime = getNanoSeconds();
    upTime = process.uptime() * 1e9;
    nodeLoadTime = moduleLoadTime - upTime;
  } else if (Date.now) {
    module.exports = function () {
      return Date.now() - loadTime;
    };
    loadTime = Date.now();
  } else {
    module.exports = function () {
      return new Date().getTime() - loadTime;
    };
    loadTime = new Date().getTime();
  }
}).call(this);

//# sourceMappingURL=performance-now.js.map

/***/ }),

/***/ "UfYs":
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.



module.exports = Transform;

var Duplex = __webpack_require__("g3Lj");

/*<replacement>*/
var util = __webpack_require__("jOgh");
util.inherits = __webpack_require__("ihNc");
/*</replacement>*/

util.inherits(Transform, Duplex);

function TransformState(stream) {
  this.afterTransform = function (er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
  this.writeencoding = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb) return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (data !== null && data !== undefined) stream.push(data);

  cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}

function Transform(options) {
  if (!(this instanceof Transform)) return new Transform(options);

  Duplex.call(this, options);

  this._transformState = new TransformState(this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  if (options) {
    if (typeof options.transform === 'function') this._transform = options.transform;

    if (typeof options.flush === 'function') this._flush = options.flush;
  }

  this.once('prefinish', function () {
    if (typeof this._flush === 'function') this._flush(function (er) {
      done(stream, er);
    });else done(stream);
  });
}

Transform.prototype.push = function (chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function (chunk, encoding, cb) {
  throw new Error('not implemented');
};

Transform.prototype._write = function (chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function (n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};

function done(stream, er) {
  if (er) return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var ts = stream._transformState;

  if (ws.length) throw new Error('calling transform done when ws.length != 0');

  if (ts.transforming) throw new Error('calling transform done when still transforming');

  return stream.push(null);
}

/***/ }),

/***/ "Un+M":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

// See state defs from inflate.js

var BAD = 30; /* got a data error -- remain here until reset */
var TYPE = 12; /* i: waiting for type bits, including last-flag bit */

/*
   Decode literal, length, and distance codes and write out the resulting
   literal and match bytes until either not enough input or output is
   available, an end-of-block is encountered, or a data error is encountered.
   When large enough input and output buffers are supplied to inflate(), for
   example, a 16K input buffer and a 64K output buffer, more than 95% of the
   inflate execution time is spent in this routine.

   Entry assumptions:

        state.mode === LEN
        strm.avail_in >= 6
        strm.avail_out >= 258
        start >= strm.avail_out
        state.bits < 8

   On return, state.mode is one of:

        LEN -- ran out of enough output space or enough available input
        TYPE -- reached end of block code, inflate() to interpret next block
        BAD -- error in block data

   Notes:

    - The maximum input bits used by a length/distance pair is 15 bits for the
      length code, 5 bits for the length extra, 15 bits for the distance code,
      and 13 bits for the distance extra.  This totals 48 bits, or six bytes.
      Therefore if strm.avail_in >= 6, then there is enough input to avoid
      checking for available input while decoding.

    - The maximum bytes that a single length/distance pair can output is 258
      bytes, which is the maximum length that can be coded.  inflate_fast()
      requires strm.avail_out >= 258 for each loop to avoid checking for
      output space.
 */
module.exports = function inflate_fast(strm, start) {
  var state;
  var _in; /* local strm.input */
  var last; /* have enough input while in < last */
  var _out; /* local strm.output */
  var beg; /* inflate()'s initial strm.output */
  var end; /* while out < end, enough space available */
  //#ifdef INFLATE_STRICT
  var dmax; /* maximum distance from zlib header */
  //#endif
  var wsize; /* window size or zero if not using window */
  var whave; /* valid bytes in the window */
  var wnext; /* window write index */
  // Use `s_window` instead `window`, avoid conflict with instrumentation tools
  var s_window; /* allocated sliding window, if wsize != 0 */
  var hold; /* local strm.hold */
  var bits; /* local strm.bits */
  var lcode; /* local strm.lencode */
  var dcode; /* local strm.distcode */
  var lmask; /* mask for first level of length codes */
  var dmask; /* mask for first level of distance codes */
  var here; /* retrieved table entry */
  var op; /* code bits, operation, extra bits, or */
  /*  window position, window bytes to copy */
  var len; /* match length, unused bytes */
  var dist; /* match distance */
  var from; /* where to copy match from */
  var from_source;

  var input, output; // JS specific, because we have no pointers

  /* copy state to local variables */
  state = strm.state;
  //here = state.here;
  _in = strm.next_in;
  input = strm.input;
  last = _in + (strm.avail_in - 5);
  _out = strm.next_out;
  output = strm.output;
  beg = _out - (start - strm.avail_out);
  end = _out + (strm.avail_out - 257);
  //#ifdef INFLATE_STRICT
  dmax = state.dmax;
  //#endif
  wsize = state.wsize;
  whave = state.whave;
  wnext = state.wnext;
  s_window = state.window;
  hold = state.hold;
  bits = state.bits;
  lcode = state.lencode;
  dcode = state.distcode;
  lmask = (1 << state.lenbits) - 1;
  dmask = (1 << state.distbits) - 1;

  /* decode literals and length/distances until end-of-block or not enough
     input data or output space */

  top: do {
    if (bits < 15) {
      hold += input[_in++] << bits;
      bits += 8;
      hold += input[_in++] << bits;
      bits += 8;
    }

    here = lcode[hold & lmask];

    dolen: for (;;) {
      // Goto emulation
      op = here >>> 24 /*here.bits*/;
      hold >>>= op;
      bits -= op;
      op = here >>> 16 & 0xff /*here.op*/;
      if (op === 0) {
        /* literal */
        //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
        //        "inflate:         literal '%c'\n" :
        //        "inflate:         literal 0x%02x\n", here.val));
        output[_out++] = here & 0xffff /*here.val*/;
      } else if (op & 16) {
        /* length base */
        len = here & 0xffff /*here.val*/;
        op &= 15; /* number of extra bits */
        if (op) {
          if (bits < op) {
            hold += input[_in++] << bits;
            bits += 8;
          }
          len += hold & (1 << op) - 1;
          hold >>>= op;
          bits -= op;
        }
        //Tracevv((stderr, "inflate:         length %u\n", len));
        if (bits < 15) {
          hold += input[_in++] << bits;
          bits += 8;
          hold += input[_in++] << bits;
          bits += 8;
        }
        here = dcode[hold & dmask];

        dodist: for (;;) {
          // goto emulation
          op = here >>> 24 /*here.bits*/;
          hold >>>= op;
          bits -= op;
          op = here >>> 16 & 0xff /*here.op*/;

          if (op & 16) {
            /* distance base */
            dist = here & 0xffff /*here.val*/;
            op &= 15; /* number of extra bits */
            if (bits < op) {
              hold += input[_in++] << bits;
              bits += 8;
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
              }
            }
            dist += hold & (1 << op) - 1;
            //#ifdef INFLATE_STRICT
            if (dist > dmax) {
              strm.msg = 'invalid distance too far back';
              state.mode = BAD;
              break top;
            }
            //#endif
            hold >>>= op;
            bits -= op;
            //Tracevv((stderr, "inflate:         distance %u\n", dist));
            op = _out - beg; /* max distance in output */
            if (dist > op) {
              /* see if copy from window */
              op = dist - op; /* distance back in window */
              if (op > whave) {
                if (state.sane) {
                  strm.msg = 'invalid distance too far back';
                  state.mode = BAD;
                  break top;
                }

                // (!) This block is disabled in zlib defaults,
                // don't enable it for binary compatibility
                //#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
                //                if (len <= op - whave) {
                //                  do {
                //                    output[_out++] = 0;
                //                  } while (--len);
                //                  continue top;
                //                }
                //                len -= op - whave;
                //                do {
                //                  output[_out++] = 0;
                //                } while (--op > whave);
                //                if (op === 0) {
                //                  from = _out - dist;
                //                  do {
                //                    output[_out++] = output[from++];
                //                  } while (--len);
                //                  continue top;
                //                }
                //#endif
              }
              from = 0; // window index
              from_source = s_window;
              if (wnext === 0) {
                /* very common case */
                from += wsize - op;
                if (op < len) {
                  /* some from window */
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = _out - dist; /* rest from output */
                  from_source = output;
                }
              } else if (wnext < op) {
                /* wrap around window */
                from += wsize + wnext - op;
                op -= wnext;
                if (op < len) {
                  /* some from end of window */
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = 0;
                  if (wnext < len) {
                    /* some from start of window */
                    op = wnext;
                    len -= op;
                    do {
                      output[_out++] = s_window[from++];
                    } while (--op);
                    from = _out - dist; /* rest from output */
                    from_source = output;
                  }
                }
              } else {
                /* contiguous in window */
                from += wnext - op;
                if (op < len) {
                  /* some from window */
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = _out - dist; /* rest from output */
                  from_source = output;
                }
              }
              while (len > 2) {
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                len -= 3;
              }
              if (len) {
                output[_out++] = from_source[from++];
                if (len > 1) {
                  output[_out++] = from_source[from++];
                }
              }
            } else {
              from = _out - dist; /* copy direct from output */
              do {
                /* minimum length is three */
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                len -= 3;
              } while (len > 2);
              if (len) {
                output[_out++] = output[from++];
                if (len > 1) {
                  output[_out++] = output[from++];
                }
              }
            }
          } else if ((op & 64) === 0) {
            /* 2nd level distance code */
            here = dcode[(here & 0xffff) + ( /*here.val*/hold & (1 << op) - 1)];
            continue dodist;
          } else {
            strm.msg = 'invalid distance code';
            state.mode = BAD;
            break top;
          }

          break; // need to emulate goto via "continue"
        }
      } else if ((op & 64) === 0) {
        /* 2nd level length code */
        here = lcode[(here & 0xffff) + ( /*here.val*/hold & (1 << op) - 1)];
        continue dolen;
      } else if (op & 32) {
        /* end-of-block */
        //Tracevv((stderr, "inflate:         end of block\n"));
        state.mode = TYPE;
        break top;
      } else {
        strm.msg = 'invalid literal/length code';
        state.mode = BAD;
        break top;
      }

      break; // need to emulate goto via "continue"
    }
  } while (_in < last && _out < end);

  /* return unused bytes (on entry, bits < 8, so in won't go too far back) */
  len = bits >> 3;
  _in -= len;
  bits -= len << 3;
  hold &= (1 << bits) - 1;

  /* update state and return */
  strm.next_in = _in;
  strm.next_out = _out;
  strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
  strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
  state.hold = hold;
  state.bits = bits;
  return;
};

/***/ }),

/***/ "VOug":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var utils = __webpack_require__("gt5T");
var trees = __webpack_require__("ZjIE");
var adler32 = __webpack_require__("KpjM");
var crc32 = __webpack_require__("2WCG");
var msg = __webpack_require__("2A+V");

/* Public constants ==========================================================*/
/* ===========================================================================*/

/* Allowed flush values; see deflate() and inflate() below for details */
var Z_NO_FLUSH = 0;
var Z_PARTIAL_FLUSH = 1;
//var Z_SYNC_FLUSH    = 2;
var Z_FULL_FLUSH = 3;
var Z_FINISH = 4;
var Z_BLOCK = 5;
//var Z_TREES         = 6;


/* Return codes for the compression/decompression functions. Negative values
 * are errors, positive values are used for special but normal events.
 */
var Z_OK = 0;
var Z_STREAM_END = 1;
//var Z_NEED_DICT     = 2;
//var Z_ERRNO         = -1;
var Z_STREAM_ERROR = -2;
var Z_DATA_ERROR = -3;
//var Z_MEM_ERROR     = -4;
var Z_BUF_ERROR = -5;
//var Z_VERSION_ERROR = -6;


/* compression levels */
//var Z_NO_COMPRESSION      = 0;
//var Z_BEST_SPEED          = 1;
//var Z_BEST_COMPRESSION    = 9;
var Z_DEFAULT_COMPRESSION = -1;

var Z_FILTERED = 1;
var Z_HUFFMAN_ONLY = 2;
var Z_RLE = 3;
var Z_FIXED = 4;
var Z_DEFAULT_STRATEGY = 0;

/* Possible values of the data_type field (though see inflate()) */
//var Z_BINARY              = 0;
//var Z_TEXT                = 1;
//var Z_ASCII               = 1; // = Z_TEXT
var Z_UNKNOWN = 2;

/* The deflate compression method */
var Z_DEFLATED = 8;

/*============================================================================*/

var MAX_MEM_LEVEL = 9;
/* Maximum value for memLevel in deflateInit2 */
var MAX_WBITS = 15;
/* 32K LZ77 window */
var DEF_MEM_LEVEL = 8;

var LENGTH_CODES = 29;
/* number of length codes, not counting the special END_BLOCK code */
var LITERALS = 256;
/* number of literal bytes 0..255 */
var L_CODES = LITERALS + 1 + LENGTH_CODES;
/* number of Literal or Length codes, including the END_BLOCK code */
var D_CODES = 30;
/* number of distance codes */
var BL_CODES = 19;
/* number of codes used to transfer the bit lengths */
var HEAP_SIZE = 2 * L_CODES + 1;
/* maximum heap size */
var MAX_BITS = 15;
/* All codes must not exceed MAX_BITS bits */

var MIN_MATCH = 3;
var MAX_MATCH = 258;
var MIN_LOOKAHEAD = MAX_MATCH + MIN_MATCH + 1;

var PRESET_DICT = 0x20;

var INIT_STATE = 42;
var EXTRA_STATE = 69;
var NAME_STATE = 73;
var COMMENT_STATE = 91;
var HCRC_STATE = 103;
var BUSY_STATE = 113;
var FINISH_STATE = 666;

var BS_NEED_MORE = 1; /* block not completed, need more input or more output */
var BS_BLOCK_DONE = 2; /* block flush performed */
var BS_FINISH_STARTED = 3; /* finish started, need only more output at next deflate */
var BS_FINISH_DONE = 4; /* finish done, accept no more input or output */

var OS_CODE = 0x03; // Unix :) . Don't detect, use this default.

function err(strm, errorCode) {
  strm.msg = msg[errorCode];
  return errorCode;
}

function rank(f) {
  return (f << 1) - (f > 4 ? 9 : 0);
}

function zero(buf) {
  var len = buf.length;while (--len >= 0) {
    buf[len] = 0;
  }
}

/* =========================================================================
 * Flush as much pending output as possible. All deflate() output goes
 * through this function so some applications may wish to modify it
 * to avoid allocating a large strm->output buffer and copying into it.
 * (See also read_buf()).
 */
function flush_pending(strm) {
  var s = strm.state;

  //_tr_flush_bits(s);
  var len = s.pending;
  if (len > strm.avail_out) {
    len = strm.avail_out;
  }
  if (len === 0) {
    return;
  }

  utils.arraySet(strm.output, s.pending_buf, s.pending_out, len, strm.next_out);
  strm.next_out += len;
  s.pending_out += len;
  strm.total_out += len;
  strm.avail_out -= len;
  s.pending -= len;
  if (s.pending === 0) {
    s.pending_out = 0;
  }
}

function flush_block_only(s, last) {
  trees._tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
  s.block_start = s.strstart;
  flush_pending(s.strm);
}

function put_byte(s, b) {
  s.pending_buf[s.pending++] = b;
}

/* =========================================================================
 * Put a short in the pending buffer. The 16-bit value is put in MSB order.
 * IN assertion: the stream state is correct and there is enough room in
 * pending_buf.
 */
function putShortMSB(s, b) {
  //  put_byte(s, (Byte)(b >> 8));
  //  put_byte(s, (Byte)(b & 0xff));
  s.pending_buf[s.pending++] = b >>> 8 & 0xff;
  s.pending_buf[s.pending++] = b & 0xff;
}

/* ===========================================================================
 * Read a new buffer from the current input stream, update the adler32
 * and total number of bytes read.  All deflate() input goes through
 * this function so some applications may wish to modify it to avoid
 * allocating a large strm->input buffer and copying from it.
 * (See also flush_pending()).
 */
function read_buf(strm, buf, start, size) {
  var len = strm.avail_in;

  if (len > size) {
    len = size;
  }
  if (len === 0) {
    return 0;
  }

  strm.avail_in -= len;

  // zmemcpy(buf, strm->next_in, len);
  utils.arraySet(buf, strm.input, strm.next_in, len, start);
  if (strm.state.wrap === 1) {
    strm.adler = adler32(strm.adler, buf, len, start);
  } else if (strm.state.wrap === 2) {
    strm.adler = crc32(strm.adler, buf, len, start);
  }

  strm.next_in += len;
  strm.total_in += len;

  return len;
}

/* ===========================================================================
 * Set match_start to the longest match starting at the given string and
 * return its length. Matches shorter or equal to prev_length are discarded,
 * in which case the result is equal to prev_length and match_start is
 * garbage.
 * IN assertions: cur_match is the head of the hash chain for the current
 *   string (strstart) and its distance is <= MAX_DIST, and prev_length >= 1
 * OUT assertion: the match length is not greater than s->lookahead.
 */
function longest_match(s, cur_match) {
  var chain_length = s.max_chain_length; /* max hash chain length */
  var scan = s.strstart; /* current string */
  var match; /* matched string */
  var len; /* length of current match */
  var best_len = s.prev_length; /* best match length so far */
  var nice_match = s.nice_match; /* stop if match long enough */
  var limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0 /*NIL*/;

  var _win = s.window; // shortcut

  var wmask = s.w_mask;
  var prev = s.prev;

  /* Stop when cur_match becomes <= limit. To simplify the code,
   * we prevent matches with the string of window index 0.
   */

  var strend = s.strstart + MAX_MATCH;
  var scan_end1 = _win[scan + best_len - 1];
  var scan_end = _win[scan + best_len];

  /* The code is optimized for HASH_BITS >= 8 and MAX_MATCH-2 multiple of 16.
   * It is easy to get rid of this optimization if necessary.
   */
  // Assert(s->hash_bits >= 8 && MAX_MATCH == 258, "Code too clever");

  /* Do not waste too much time if we already have a good match: */
  if (s.prev_length >= s.good_match) {
    chain_length >>= 2;
  }
  /* Do not look for matches beyond the end of the input. This is necessary
   * to make deflate deterministic.
   */
  if (nice_match > s.lookahead) {
    nice_match = s.lookahead;
  }

  // Assert((ulg)s->strstart <= s->window_size-MIN_LOOKAHEAD, "need lookahead");

  do {
    // Assert(cur_match < s->strstart, "no future");
    match = cur_match;

    /* Skip to next match if the match length cannot increase
     * or if the match length is less than 2.  Note that the checks below
     * for insufficient lookahead only occur occasionally for performance
     * reasons.  Therefore uninitialized memory will be accessed, and
     * conditional jumps will be made that depend on those values.
     * However the length of the match is limited to the lookahead, so
     * the output of deflate is not affected by the uninitialized values.
     */

    if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1]) {
      continue;
    }

    /* The check at best_len-1 can be removed because it will be made
     * again later. (This heuristic is not always a win.)
     * It is not necessary to compare scan[2] and match[2] since they
     * are always equal when the other bytes match, given that
     * the hash keys are equal and that HASH_BITS >= 8.
     */
    scan += 2;
    match++;
    // Assert(*scan == *match, "match[2]?");

    /* We check for insufficient lookahead only every 8th comparison;
     * the 256th check will be made at strstart+258.
     */
    do {
      /*jshint noempty:false*/
    } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);

    // Assert(scan <= s->window+(unsigned)(s->window_size-1), "wild scan");

    len = MAX_MATCH - (strend - scan);
    scan = strend - MAX_MATCH;

    if (len > best_len) {
      s.match_start = cur_match;
      best_len = len;
      if (len >= nice_match) {
        break;
      }
      scan_end1 = _win[scan + best_len - 1];
      scan_end = _win[scan + best_len];
    }
  } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);

  if (best_len <= s.lookahead) {
    return best_len;
  }
  return s.lookahead;
}

/* ===========================================================================
 * Fill the window when the lookahead becomes insufficient.
 * Updates strstart and lookahead.
 *
 * IN assertion: lookahead < MIN_LOOKAHEAD
 * OUT assertions: strstart <= window_size-MIN_LOOKAHEAD
 *    At least one byte has been read, or avail_in == 0; reads are
 *    performed for at least two bytes (required for the zip translate_eol
 *    option -- not supported here).
 */
function fill_window(s) {
  var _w_size = s.w_size;
  var p, n, m, more, str;

  //Assert(s->lookahead < MIN_LOOKAHEAD, "already enough lookahead");

  do {
    more = s.window_size - s.lookahead - s.strstart;

    // JS ints have 32 bit, block below not needed
    /* Deal with !@#$% 64K limit: */
    //if (sizeof(int) <= 2) {
    //    if (more == 0 && s->strstart == 0 && s->lookahead == 0) {
    //        more = wsize;
    //
    //  } else if (more == (unsigned)(-1)) {
    //        /* Very unlikely, but possible on 16 bit machine if
    //         * strstart == 0 && lookahead == 1 (input done a byte at time)
    //         */
    //        more--;
    //    }
    //}


    /* If the window is almost full and there is insufficient lookahead,
     * move the upper half to the lower one to make room in the upper half.
     */
    if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {

      utils.arraySet(s.window, s.window, _w_size, _w_size, 0);
      s.match_start -= _w_size;
      s.strstart -= _w_size;
      /* we now have strstart >= MAX_DIST */
      s.block_start -= _w_size;

      /* Slide the hash table (could be avoided with 32 bit values
       at the expense of memory usage). We slide even when level == 0
       to keep the hash table consistent if we switch back to level > 0
       later. (Using level 0 permanently is not an optimal usage of
       zlib, so we don't care about this pathological case.)
       */

      n = s.hash_size;
      p = n;
      do {
        m = s.head[--p];
        s.head[p] = m >= _w_size ? m - _w_size : 0;
      } while (--n);

      n = _w_size;
      p = n;
      do {
        m = s.prev[--p];
        s.prev[p] = m >= _w_size ? m - _w_size : 0;
        /* If n is not on any hash chain, prev[n] is garbage but
         * its value will never be used.
         */
      } while (--n);

      more += _w_size;
    }
    if (s.strm.avail_in === 0) {
      break;
    }

    /* If there was no sliding:
     *    strstart <= WSIZE+MAX_DIST-1 && lookahead <= MIN_LOOKAHEAD - 1 &&
     *    more == window_size - lookahead - strstart
     * => more >= window_size - (MIN_LOOKAHEAD-1 + WSIZE + MAX_DIST-1)
     * => more >= window_size - 2*WSIZE + 2
     * In the BIG_MEM or MMAP case (not yet supported),
     *   window_size == input_size + MIN_LOOKAHEAD  &&
     *   strstart + s->lookahead <= input_size => more >= MIN_LOOKAHEAD.
     * Otherwise, window_size == 2*WSIZE so more >= 2.
     * If there was sliding, more >= WSIZE. So in all cases, more >= 2.
     */
    //Assert(more >= 2, "more < 2");
    n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
    s.lookahead += n;

    /* Initialize the hash value now that we have some input: */
    if (s.lookahead + s.insert >= MIN_MATCH) {
      str = s.strstart - s.insert;
      s.ins_h = s.window[str];

      /* UPDATE_HASH(s, s->ins_h, s->window[str + 1]); */
      s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + 1]) & s.hash_mask;
      //#if MIN_MATCH != 3
      //        Call update_hash() MIN_MATCH-3 more times
      //#endif
      while (s.insert) {
        /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
        s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;

        s.prev[str & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = str;
        str++;
        s.insert--;
        if (s.lookahead + s.insert < MIN_MATCH) {
          break;
        }
      }
    }
    /* If the whole input has less than MIN_MATCH bytes, ins_h is garbage,
     * but this is not important since only literal bytes will be emitted.
     */
  } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);

  /* If the WIN_INIT bytes after the end of the current data have never been
   * written, then zero those bytes in order to avoid memory check reports of
   * the use of uninitialized (or uninitialised as Julian writes) bytes by
   * the longest match routines.  Update the high water mark for the next
   * time through here.  WIN_INIT is set to MAX_MATCH since the longest match
   * routines allow scanning to strstart + MAX_MATCH, ignoring lookahead.
   */
  //  if (s.high_water < s.window_size) {
  //    var curr = s.strstart + s.lookahead;
  //    var init = 0;
  //
  //    if (s.high_water < curr) {
  //      /* Previous high water mark below current data -- zero WIN_INIT
  //       * bytes or up to end of window, whichever is less.
  //       */
  //      init = s.window_size - curr;
  //      if (init > WIN_INIT)
  //        init = WIN_INIT;
  //      zmemzero(s->window + curr, (unsigned)init);
  //      s->high_water = curr + init;
  //    }
  //    else if (s->high_water < (ulg)curr + WIN_INIT) {
  //      /* High water mark at or above current data, but below current data
  //       * plus WIN_INIT -- zero out to current data plus WIN_INIT, or up
  //       * to end of window, whichever is less.
  //       */
  //      init = (ulg)curr + WIN_INIT - s->high_water;
  //      if (init > s->window_size - s->high_water)
  //        init = s->window_size - s->high_water;
  //      zmemzero(s->window + s->high_water, (unsigned)init);
  //      s->high_water += init;
  //    }
  //  }
  //
  //  Assert((ulg)s->strstart <= s->window_size - MIN_LOOKAHEAD,
  //    "not enough room for search");
}

/* ===========================================================================
 * Copy without compression as much as possible from the input stream, return
 * the current block state.
 * This function does not insert new strings in the dictionary since
 * uncompressible data is probably not useful. This function is used
 * only for the level=0 compression option.
 * NOTE: this function should be optimized to avoid extra copying from
 * window to pending_buf.
 */
function deflate_stored(s, flush) {
  /* Stored blocks are limited to 0xffff bytes, pending_buf is limited
   * to pending_buf_size, and each stored block has a 5 byte header:
   */
  var max_block_size = 0xffff;

  if (max_block_size > s.pending_buf_size - 5) {
    max_block_size = s.pending_buf_size - 5;
  }

  /* Copy as much as possible from input to output: */
  for (;;) {
    /* Fill the window as much as possible: */
    if (s.lookahead <= 1) {

      //Assert(s->strstart < s->w_size+MAX_DIST(s) ||
      //  s->block_start >= (long)s->w_size, "slide too late");
      //      if (!(s.strstart < s.w_size + (s.w_size - MIN_LOOKAHEAD) ||
      //        s.block_start >= s.w_size)) {
      //        throw  new Error("slide too late");
      //      }

      fill_window(s);
      if (s.lookahead === 0 && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }

      if (s.lookahead === 0) {
        break;
      }
      /* flush the current block */
    }
    //Assert(s->block_start >= 0L, "block gone");
    //    if (s.block_start < 0) throw new Error("block gone");

    s.strstart += s.lookahead;
    s.lookahead = 0;

    /* Emit a stored block if pending_buf will be full: */
    var max_start = s.block_start + max_block_size;

    if (s.strstart === 0 || s.strstart >= max_start) {
      /* strstart == 0 is possible when wraparound on 16-bit machine */
      s.lookahead = s.strstart - max_start;
      s.strstart = max_start;
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
    /* Flush if we may have to slide, otherwise block_start may become
     * negative and the data will be gone:
     */
    if (s.strstart - s.block_start >= s.w_size - MIN_LOOKAHEAD) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }

  s.insert = 0;

  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }

  if (s.strstart > s.block_start) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }

  return BS_NEED_MORE;
}

/* ===========================================================================
 * Compress as much as possible from the input stream, return the current
 * block state.
 * This function does not perform lazy evaluation of matches and inserts
 * new strings in the dictionary only for unmatched strings or for short
 * matches. It is used only for the fast compression options.
 */
function deflate_fast(s, flush) {
  var hash_head; /* head of the hash chain */
  var bflush; /* set if current block must be flushed */

  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the next match, plus MIN_MATCH bytes to insert the
     * string following the next match.
     */
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break; /* flush the current block */
      }
    }

    /* Insert the string window[strstart .. strstart+2] in the
     * dictionary, and set hash_head to the head of the hash chain:
     */
    hash_head = 0 /*NIL*/;
    if (s.lookahead >= MIN_MATCH) {
      /*** INSERT_STRING(s, s.strstart, hash_head); ***/
      s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
      /***/
    }

    /* Find the longest match, discarding those <= prev_length.
     * At this point we have always match_length < MIN_MATCH
     */
    if (hash_head !== 0 /*NIL*/ && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
      /* To simplify the code, we prevent matches with the string
       * of window index 0 (in particular we have to avoid a match
       * of the string with itself at the start of the input file).
       */
      s.match_length = longest_match(s, hash_head);
      /* longest_match() sets match_start */
    }
    if (s.match_length >= MIN_MATCH) {
      // check_match(s, s.strstart, s.match_start, s.match_length); // for debug only

      /*** _tr_tally_dist(s, s.strstart - s.match_start,
                     s.match_length - MIN_MATCH, bflush); ***/
      bflush = trees._tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);

      s.lookahead -= s.match_length;

      /* Insert new strings in the hash table only if the match length
       * is not too large. This saves time but degrades compression.
       */
      if (s.match_length <= s.max_lazy_match /*max_insert_length*/ && s.lookahead >= MIN_MATCH) {
        s.match_length--; /* string at strstart already in table */
        do {
          s.strstart++;
          /*** INSERT_STRING(s, s.strstart, hash_head); ***/
          s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
          /***/
          /* strstart never exceeds WSIZE-MAX_MATCH, so there are
           * always MIN_MATCH bytes ahead.
           */
        } while (--s.match_length !== 0);
        s.strstart++;
      } else {
        s.strstart += s.match_length;
        s.match_length = 0;
        s.ins_h = s.window[s.strstart];
        /* UPDATE_HASH(s, s.ins_h, s.window[s.strstart+1]); */
        s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + 1]) & s.hash_mask;

        //#if MIN_MATCH != 3
        //                Call UPDATE_HASH() MIN_MATCH-3 more times
        //#endif
        /* If lookahead < MIN_MATCH, ins_h is garbage, but it does not
         * matter since it will be recomputed at next deflate call.
         */
      }
    } else {
      /* No match, output a literal byte */
      //Tracevv((stderr,"%c", s.window[s.strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = trees._tr_tally(s, 0, s.window[s.strstart]);

      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
}

/* ===========================================================================
 * Same as above, but achieves better compression. We use a lazy
 * evaluation for matches: a match is finally adopted only if there is
 * no better match at the next window position.
 */
function deflate_slow(s, flush) {
  var hash_head; /* head of hash chain */
  var bflush; /* set if current block must be flushed */

  var max_insert;

  /* Process the input block. */
  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the next match, plus MIN_MATCH bytes to insert the
     * string following the next match.
     */
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      } /* flush the current block */
    }

    /* Insert the string window[strstart .. strstart+2] in the
     * dictionary, and set hash_head to the head of the hash chain:
     */
    hash_head = 0 /*NIL*/;
    if (s.lookahead >= MIN_MATCH) {
      /*** INSERT_STRING(s, s.strstart, hash_head); ***/
      s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
      /***/
    }

    /* Find the longest match, discarding those <= prev_length.
     */
    s.prev_length = s.match_length;
    s.prev_match = s.match_start;
    s.match_length = MIN_MATCH - 1;

    if (hash_head !== 0 /*NIL*/ && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD /*MAX_DIST(s)*/) {
        /* To simplify the code, we prevent matches with the string
         * of window index 0 (in particular we have to avoid a match
         * of the string with itself at the start of the input file).
         */
        s.match_length = longest_match(s, hash_head);
        /* longest_match() sets match_start */

        if (s.match_length <= 5 && (s.strategy === Z_FILTERED || s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096 /*TOO_FAR*/)) {

          /* If prev_match is also MIN_MATCH, match_start is garbage
           * but we will ignore the current match anyway.
           */
          s.match_length = MIN_MATCH - 1;
        }
      }
    /* If there was a match at the previous step and the current
     * match is not better, output the previous match:
     */
    if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
      max_insert = s.strstart + s.lookahead - MIN_MATCH;
      /* Do not insert strings in hash table beyond this. */

      //check_match(s, s.strstart-1, s.prev_match, s.prev_length);

      /***_tr_tally_dist(s, s.strstart - 1 - s.prev_match,
                     s.prev_length - MIN_MATCH, bflush);***/
      bflush = trees._tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
      /* Insert in hash table all strings up to the end of the match.
       * strstart-1 and strstart are already inserted. If there is not
       * enough lookahead, the last two strings are not inserted in
       * the hash table.
       */
      s.lookahead -= s.prev_length - 1;
      s.prev_length -= 2;
      do {
        if (++s.strstart <= max_insert) {
          /*** INSERT_STRING(s, s.strstart, hash_head); ***/
          s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
          /***/
        }
      } while (--s.prev_length !== 0);
      s.match_available = 0;
      s.match_length = MIN_MATCH - 1;
      s.strstart++;

      if (bflush) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
        /***/
      }
    } else if (s.match_available) {
      /* If there was no match at the previous position, output a
       * single literal. If there was a match but the current match
       * is longer, truncate the previous match to a single literal.
       */
      //Tracevv((stderr,"%c", s->window[s->strstart-1]));
      /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
      bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);

      if (bflush) {
        /*** FLUSH_BLOCK_ONLY(s, 0) ***/
        flush_block_only(s, false);
        /***/
      }
      s.strstart++;
      s.lookahead--;
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    } else {
      /* There is no previous match to compare with, wait for
       * the next step to decide.
       */
      s.match_available = 1;
      s.strstart++;
      s.lookahead--;
    }
  }
  //Assert (flush != Z_NO_FLUSH, "no flush?");
  if (s.match_available) {
    //Tracevv((stderr,"%c", s->window[s->strstart-1]));
    /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
    bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);

    s.match_available = 0;
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }

  return BS_BLOCK_DONE;
}

/* ===========================================================================
 * For Z_RLE, simply look for runs of bytes, generate matches only of distance
 * one.  Do not maintain a hash table.  (It will be regenerated if this run of
 * deflate switches away from Z_RLE.)
 */
function deflate_rle(s, flush) {
  var bflush; /* set if current block must be flushed */
  var prev; /* byte at distance one to match */
  var scan, strend; /* scan goes up to strend for length of run */

  var _win = s.window;

  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the longest run, plus one for the unrolled loop.
     */
    if (s.lookahead <= MAX_MATCH) {
      fill_window(s);
      if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      } /* flush the current block */
    }

    /* See how many times the previous byte repeats */
    s.match_length = 0;
    if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
      scan = s.strstart - 1;
      prev = _win[scan];
      if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
        strend = s.strstart + MAX_MATCH;
        do {
          /*jshint noempty:false*/
        } while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
        s.match_length = MAX_MATCH - (strend - scan);
        if (s.match_length > s.lookahead) {
          s.match_length = s.lookahead;
        }
      }
      //Assert(scan <= s->window+(uInt)(s->window_size-1), "wild scan");
    }

    /* Emit match if have run of MIN_MATCH or longer, else emit literal */
    if (s.match_length >= MIN_MATCH) {
      //check_match(s, s.strstart, s.strstart - 1, s.match_length);

      /*** _tr_tally_dist(s, 1, s.match_length - MIN_MATCH, bflush); ***/
      bflush = trees._tr_tally(s, 1, s.match_length - MIN_MATCH);

      s.lookahead -= s.match_length;
      s.strstart += s.match_length;
      s.match_length = 0;
    } else {
      /* No match, output a literal byte */
      //Tracevv((stderr,"%c", s->window[s->strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = trees._tr_tally(s, 0, s.window[s.strstart]);

      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
}

/* ===========================================================================
 * For Z_HUFFMAN_ONLY, do not look for matches.  Do not maintain a hash table.
 * (It will be regenerated if this run of deflate switches away from Huffman.)
 */
function deflate_huff(s, flush) {
  var bflush; /* set if current block must be flushed */

  for (;;) {
    /* Make sure that we have a literal to write. */
    if (s.lookahead === 0) {
      fill_window(s);
      if (s.lookahead === 0) {
        if (flush === Z_NO_FLUSH) {
          return BS_NEED_MORE;
        }
        break; /* flush the current block */
      }
    }

    /* Output a literal byte */
    s.match_length = 0;
    //Tracevv((stderr,"%c", s->window[s->strstart]));
    /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
    bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
    s.lookahead--;
    s.strstart++;
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
}

/* Values for max_lazy_match, good_match and max_chain_length, depending on
 * the desired pack level (0..9). The values given below have been tuned to
 * exclude worst case performance for pathological files. Better values may be
 * found for specific files.
 */
function Config(good_length, max_lazy, nice_length, max_chain, func) {
  this.good_length = good_length;
  this.max_lazy = max_lazy;
  this.nice_length = nice_length;
  this.max_chain = max_chain;
  this.func = func;
}

var configuration_table;

configuration_table = [
/*      good lazy nice chain */
new Config(0, 0, 0, 0, deflate_stored), /* 0 store only */
new Config(4, 4, 8, 4, deflate_fast), /* 1 max speed, no lazy matches */
new Config(4, 5, 16, 8, deflate_fast), /* 2 */
new Config(4, 6, 32, 32, deflate_fast), /* 3 */

new Config(4, 4, 16, 16, deflate_slow), /* 4 lazy matches */
new Config(8, 16, 32, 32, deflate_slow), /* 5 */
new Config(8, 16, 128, 128, deflate_slow), /* 6 */
new Config(8, 32, 128, 256, deflate_slow), /* 7 */
new Config(32, 128, 258, 1024, deflate_slow), /* 8 */
new Config(32, 258, 258, 4096, deflate_slow) /* 9 max compression */
];

/* ===========================================================================
 * Initialize the "longest match" routines for a new zlib stream
 */
function lm_init(s) {
  s.window_size = 2 * s.w_size;

  /*** CLEAR_HASH(s); ***/
  zero(s.head); // Fill with NIL (= 0);

  /* Set the default configuration parameters:
   */
  s.max_lazy_match = configuration_table[s.level].max_lazy;
  s.good_match = configuration_table[s.level].good_length;
  s.nice_match = configuration_table[s.level].nice_length;
  s.max_chain_length = configuration_table[s.level].max_chain;

  s.strstart = 0;
  s.block_start = 0;
  s.lookahead = 0;
  s.insert = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  s.ins_h = 0;
}

function DeflateState() {
  this.strm = null; /* pointer back to this zlib stream */
  this.status = 0; /* as the name implies */
  this.pending_buf = null; /* output still pending */
  this.pending_buf_size = 0; /* size of pending_buf */
  this.pending_out = 0; /* next pending byte to output to the stream */
  this.pending = 0; /* nb of bytes in the pending buffer */
  this.wrap = 0; /* bit 0 true for zlib, bit 1 true for gzip */
  this.gzhead = null; /* gzip header information to write */
  this.gzindex = 0; /* where in extra, name, or comment */
  this.method = Z_DEFLATED; /* can only be DEFLATED */
  this.last_flush = -1; /* value of flush param for previous deflate call */

  this.w_size = 0; /* LZ77 window size (32K by default) */
  this.w_bits = 0; /* log2(w_size)  (8..16) */
  this.w_mask = 0; /* w_size - 1 */

  this.window = null;
  /* Sliding window. Input bytes are read into the second half of the window,
   * and move to the first half later to keep a dictionary of at least wSize
   * bytes. With this organization, matches are limited to a distance of
   * wSize-MAX_MATCH bytes, but this ensures that IO is always
   * performed with a length multiple of the block size.
   */

  this.window_size = 0;
  /* Actual size of window: 2*wSize, except when the user input buffer
   * is directly used as sliding window.
   */

  this.prev = null;
  /* Link to older string with same hash index. To limit the size of this
   * array to 64K, this link is maintained only for the last 32K strings.
   * An index in this array is thus a window index modulo 32K.
   */

  this.head = null; /* Heads of the hash chains or NIL. */

  this.ins_h = 0; /* hash index of string to be inserted */
  this.hash_size = 0; /* number of elements in hash table */
  this.hash_bits = 0; /* log2(hash_size) */
  this.hash_mask = 0; /* hash_size-1 */

  this.hash_shift = 0;
  /* Number of bits by which ins_h must be shifted at each input
   * step. It must be such that after MIN_MATCH steps, the oldest
   * byte no longer takes part in the hash key, that is:
   *   hash_shift * MIN_MATCH >= hash_bits
   */

  this.block_start = 0;
  /* Window position at the beginning of the current output block. Gets
   * negative when the window is moved backwards.
   */

  this.match_length = 0; /* length of best match */
  this.prev_match = 0; /* previous match */
  this.match_available = 0; /* set if previous match exists */
  this.strstart = 0; /* start of string to insert */
  this.match_start = 0; /* start of matching string */
  this.lookahead = 0; /* number of valid bytes ahead in window */

  this.prev_length = 0;
  /* Length of the best match at previous step. Matches not greater than this
   * are discarded. This is used in the lazy match evaluation.
   */

  this.max_chain_length = 0;
  /* To speed up deflation, hash chains are never searched beyond this
   * length.  A higher limit improves compression ratio but degrades the
   * speed.
   */

  this.max_lazy_match = 0;
  /* Attempt to find a better match only when the current match is strictly
   * smaller than this value. This mechanism is used only for compression
   * levels >= 4.
   */
  // That's alias to max_lazy_match, don't use directly
  //this.max_insert_length = 0;
  /* Insert new strings in the hash table only if the match length is not
   * greater than this length. This saves time but degrades compression.
   * max_insert_length is used only for compression levels <= 3.
   */

  this.level = 0; /* compression level (1..9) */
  this.strategy = 0; /* favor or force Huffman coding*/

  this.good_match = 0;
  /* Use a faster search when the previous match is longer than this */

  this.nice_match = 0; /* Stop searching when current match exceeds this */

  /* used by trees.c: */

  /* Didn't use ct_data typedef below to suppress compiler warning */

  // struct ct_data_s dyn_ltree[HEAP_SIZE];   /* literal and length tree */
  // struct ct_data_s dyn_dtree[2*D_CODES+1]; /* distance tree */
  // struct ct_data_s bl_tree[2*BL_CODES+1];  /* Huffman tree for bit lengths */

  // Use flat array of DOUBLE size, with interleaved fata,
  // because JS does not support effective
  this.dyn_ltree = new utils.Buf16(HEAP_SIZE * 2);
  this.dyn_dtree = new utils.Buf16((2 * D_CODES + 1) * 2);
  this.bl_tree = new utils.Buf16((2 * BL_CODES + 1) * 2);
  zero(this.dyn_ltree);
  zero(this.dyn_dtree);
  zero(this.bl_tree);

  this.l_desc = null; /* desc. for literal tree */
  this.d_desc = null; /* desc. for distance tree */
  this.bl_desc = null; /* desc. for bit length tree */

  //ush bl_count[MAX_BITS+1];
  this.bl_count = new utils.Buf16(MAX_BITS + 1);
  /* number of codes at each bit length for an optimal tree */

  //int heap[2*L_CODES+1];      /* heap used to build the Huffman trees */
  this.heap = new utils.Buf16(2 * L_CODES + 1); /* heap used to build the Huffman trees */
  zero(this.heap);

  this.heap_len = 0; /* number of elements in the heap */
  this.heap_max = 0; /* element of largest frequency */
  /* The sons of heap[n] are heap[2*n] and heap[2*n+1]. heap[0] is not used.
   * The same heap array is used to build all trees.
   */

  this.depth = new utils.Buf16(2 * L_CODES + 1); //uch depth[2*L_CODES+1];
  zero(this.depth);
  /* Depth of each subtree used as tie breaker for trees of equal frequency
   */

  this.l_buf = 0; /* buffer index for literals or lengths */

  this.lit_bufsize = 0;
  /* Size of match buffer for literals/lengths.  There are 4 reasons for
   * limiting lit_bufsize to 64K:
   *   - frequencies can be kept in 16 bit counters
   *   - if compression is not successful for the first block, all input
   *     data is still in the window so we can still emit a stored block even
   *     when input comes from standard input.  (This can also be done for
   *     all blocks if lit_bufsize is not greater than 32K.)
   *   - if compression is not successful for a file smaller than 64K, we can
   *     even emit a stored file instead of a stored block (saving 5 bytes).
   *     This is applicable only for zip (not gzip or zlib).
   *   - creating new Huffman trees less frequently may not provide fast
   *     adaptation to changes in the input data statistics. (Take for
   *     example a binary file with poorly compressible code followed by
   *     a highly compressible string table.) Smaller buffer sizes give
   *     fast adaptation but have of course the overhead of transmitting
   *     trees more frequently.
   *   - I can't count above 4
   */

  this.last_lit = 0; /* running index in l_buf */

  this.d_buf = 0;
  /* Buffer index for distances. To simplify the code, d_buf and l_buf have
   * the same number of elements. To use different lengths, an extra flag
   * array would be necessary.
   */

  this.opt_len = 0; /* bit length of current block with optimal trees */
  this.static_len = 0; /* bit length of current block with static trees */
  this.matches = 0; /* number of string matches in current block */
  this.insert = 0; /* bytes at end of window left to insert */

  this.bi_buf = 0;
  /* Output buffer. bits are inserted starting at the bottom (least
   * significant bits).
   */
  this.bi_valid = 0;
  /* Number of valid bits in bi_buf.  All bits above the last valid bit
   * are always zero.
   */

  // Used for window memory init. We safely ignore it for JS. That makes
  // sense only for pointers and memory check tools.
  //this.high_water = 0;
  /* High water mark offset in window for initialized bytes -- bytes above
   * this are set to zero in order to avoid memory check warnings when
   * longest match routines access bytes past the input.  This is then
   * updated to the new high water mark.
   */
}

function deflateResetKeep(strm) {
  var s;

  if (!strm || !strm.state) {
    return err(strm, Z_STREAM_ERROR);
  }

  strm.total_in = strm.total_out = 0;
  strm.data_type = Z_UNKNOWN;

  s = strm.state;
  s.pending = 0;
  s.pending_out = 0;

  if (s.wrap < 0) {
    s.wrap = -s.wrap;
    /* was made negative by deflate(..., Z_FINISH); */
  }
  s.status = s.wrap ? INIT_STATE : BUSY_STATE;
  strm.adler = s.wrap === 2 ? 0 // crc32(0, Z_NULL, 0)
  : 1; // adler32(0, Z_NULL, 0)
  s.last_flush = Z_NO_FLUSH;
  trees._tr_init(s);
  return Z_OK;
}

function deflateReset(strm) {
  var ret = deflateResetKeep(strm);
  if (ret === Z_OK) {
    lm_init(strm.state);
  }
  return ret;
}

function deflateSetHeader(strm, head) {
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  if (strm.state.wrap !== 2) {
    return Z_STREAM_ERROR;
  }
  strm.state.gzhead = head;
  return Z_OK;
}

function deflateInit2(strm, level, method, windowBits, memLevel, strategy) {
  if (!strm) {
    // === Z_NULL
    return Z_STREAM_ERROR;
  }
  var wrap = 1;

  if (level === Z_DEFAULT_COMPRESSION) {
    level = 6;
  }

  if (windowBits < 0) {
    /* suppress zlib wrapper */
    wrap = 0;
    windowBits = -windowBits;
  } else if (windowBits > 15) {
    wrap = 2; /* write gzip wrapper instead */
    windowBits -= 16;
  }

  if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > Z_FIXED) {
    return err(strm, Z_STREAM_ERROR);
  }

  if (windowBits === 8) {
    windowBits = 9;
  }
  /* until 256-byte window bug fixed */

  var s = new DeflateState();

  strm.state = s;
  s.strm = strm;

  s.wrap = wrap;
  s.gzhead = null;
  s.w_bits = windowBits;
  s.w_size = 1 << s.w_bits;
  s.w_mask = s.w_size - 1;

  s.hash_bits = memLevel + 7;
  s.hash_size = 1 << s.hash_bits;
  s.hash_mask = s.hash_size - 1;
  s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);

  s.window = new utils.Buf8(s.w_size * 2);
  s.head = new utils.Buf16(s.hash_size);
  s.prev = new utils.Buf16(s.w_size);

  // Don't need mem init magic for JS.
  //s.high_water = 0;  /* nothing written to s->window yet */

  s.lit_bufsize = 1 << memLevel + 6; /* 16K elements by default */

  s.pending_buf_size = s.lit_bufsize * 4;

  //overlay = (ushf *) ZALLOC(strm, s->lit_bufsize, sizeof(ush)+2);
  //s->pending_buf = (uchf *) overlay;
  s.pending_buf = new utils.Buf8(s.pending_buf_size);

  // It is offset from `s.pending_buf` (size is `s.lit_bufsize * 2`)
  //s->d_buf = overlay + s->lit_bufsize/sizeof(ush);
  s.d_buf = 1 * s.lit_bufsize;

  //s->l_buf = s->pending_buf + (1+sizeof(ush))*s->lit_bufsize;
  s.l_buf = (1 + 2) * s.lit_bufsize;

  s.level = level;
  s.strategy = strategy;
  s.method = method;

  return deflateReset(strm);
}

function deflateInit(strm, level) {
  return deflateInit2(strm, level, Z_DEFLATED, MAX_WBITS, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY);
}

function deflate(strm, flush) {
  var old_flush, s;
  var beg, val; // for gzip header write only

  if (!strm || !strm.state || flush > Z_BLOCK || flush < 0) {
    return strm ? err(strm, Z_STREAM_ERROR) : Z_STREAM_ERROR;
  }

  s = strm.state;

  if (!strm.output || !strm.input && strm.avail_in !== 0 || s.status === FINISH_STATE && flush !== Z_FINISH) {
    return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR : Z_STREAM_ERROR);
  }

  s.strm = strm; /* just in case */
  old_flush = s.last_flush;
  s.last_flush = flush;

  /* Write the header */
  if (s.status === INIT_STATE) {

    if (s.wrap === 2) {
      // GZIP header
      strm.adler = 0; //crc32(0L, Z_NULL, 0);
      put_byte(s, 31);
      put_byte(s, 139);
      put_byte(s, 8);
      if (!s.gzhead) {
        // s->gzhead == Z_NULL
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
        put_byte(s, OS_CODE);
        s.status = BUSY_STATE;
      } else {
        put_byte(s, (s.gzhead.text ? 1 : 0) + (s.gzhead.hcrc ? 2 : 0) + (!s.gzhead.extra ? 0 : 4) + (!s.gzhead.name ? 0 : 8) + (!s.gzhead.comment ? 0 : 16));
        put_byte(s, s.gzhead.time & 0xff);
        put_byte(s, s.gzhead.time >> 8 & 0xff);
        put_byte(s, s.gzhead.time >> 16 & 0xff);
        put_byte(s, s.gzhead.time >> 24 & 0xff);
        put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
        put_byte(s, s.gzhead.os & 0xff);
        if (s.gzhead.extra && s.gzhead.extra.length) {
          put_byte(s, s.gzhead.extra.length & 0xff);
          put_byte(s, s.gzhead.extra.length >> 8 & 0xff);
        }
        if (s.gzhead.hcrc) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending, 0);
        }
        s.gzindex = 0;
        s.status = EXTRA_STATE;
      }
    } else // DEFLATE header
      {
        var header = Z_DEFLATED + (s.w_bits - 8 << 4) << 8;
        var level_flags = -1;

        if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
          level_flags = 0;
        } else if (s.level < 6) {
          level_flags = 1;
        } else if (s.level === 6) {
          level_flags = 2;
        } else {
          level_flags = 3;
        }
        header |= level_flags << 6;
        if (s.strstart !== 0) {
          header |= PRESET_DICT;
        }
        header += 31 - header % 31;

        s.status = BUSY_STATE;
        putShortMSB(s, header);

        /* Save the adler32 of the preset dictionary: */
        if (s.strstart !== 0) {
          putShortMSB(s, strm.adler >>> 16);
          putShortMSB(s, strm.adler & 0xffff);
        }
        strm.adler = 1; // adler32(0L, Z_NULL, 0);
      }
  }

  //#ifdef GZIP
  if (s.status === EXTRA_STATE) {
    if (s.gzhead.extra /* != Z_NULL*/) {
        beg = s.pending; /* start of bytes to update crc */

        while (s.gzindex < (s.gzhead.extra.length & 0xffff)) {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            beg = s.pending;
            if (s.pending === s.pending_buf_size) {
              break;
            }
          }
          put_byte(s, s.gzhead.extra[s.gzindex] & 0xff);
          s.gzindex++;
        }
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        if (s.gzindex === s.gzhead.extra.length) {
          s.gzindex = 0;
          s.status = NAME_STATE;
        }
      } else {
      s.status = NAME_STATE;
    }
  }
  if (s.status === NAME_STATE) {
    if (s.gzhead.name /* != Z_NULL*/) {
        beg = s.pending; /* start of bytes to update crc */
        //int val;

        do {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            beg = s.pending;
            if (s.pending === s.pending_buf_size) {
              val = 1;
              break;
            }
          }
          // JS specific: little magic to add zero terminator to end of string
          if (s.gzindex < s.gzhead.name.length) {
            val = s.gzhead.name.charCodeAt(s.gzindex++) & 0xff;
          } else {
            val = 0;
          }
          put_byte(s, val);
        } while (val !== 0);

        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        if (val === 0) {
          s.gzindex = 0;
          s.status = COMMENT_STATE;
        }
      } else {
      s.status = COMMENT_STATE;
    }
  }
  if (s.status === COMMENT_STATE) {
    if (s.gzhead.comment /* != Z_NULL*/) {
        beg = s.pending; /* start of bytes to update crc */
        //int val;

        do {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            beg = s.pending;
            if (s.pending === s.pending_buf_size) {
              val = 1;
              break;
            }
          }
          // JS specific: little magic to add zero terminator to end of string
          if (s.gzindex < s.gzhead.comment.length) {
            val = s.gzhead.comment.charCodeAt(s.gzindex++) & 0xff;
          } else {
            val = 0;
          }
          put_byte(s, val);
        } while (val !== 0);

        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        if (val === 0) {
          s.status = HCRC_STATE;
        }
      } else {
      s.status = HCRC_STATE;
    }
  }
  if (s.status === HCRC_STATE) {
    if (s.gzhead.hcrc) {
      if (s.pending + 2 > s.pending_buf_size) {
        flush_pending(strm);
      }
      if (s.pending + 2 <= s.pending_buf_size) {
        put_byte(s, strm.adler & 0xff);
        put_byte(s, strm.adler >> 8 & 0xff);
        strm.adler = 0; //crc32(0L, Z_NULL, 0);
        s.status = BUSY_STATE;
      }
    } else {
      s.status = BUSY_STATE;
    }
  }
  //#endif

  /* Flush as much pending output as possible */
  if (s.pending !== 0) {
    flush_pending(strm);
    if (strm.avail_out === 0) {
      /* Since avail_out is 0, deflate will be called again with
       * more output space, but possibly with both pending and
       * avail_in equal to zero. There won't be anything to do,
       * but this is not an error situation so make sure we
       * return OK instead of BUF_ERROR at next call of deflate:
       */
      s.last_flush = -1;
      return Z_OK;
    }

    /* Make sure there is something to do and avoid duplicate consecutive
     * flushes. For repeated and useless calls with Z_FINISH, we keep
     * returning Z_STREAM_END instead of Z_BUF_ERROR.
     */
  } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== Z_FINISH) {
    return err(strm, Z_BUF_ERROR);
  }

  /* User must not provide more input after the first FINISH: */
  if (s.status === FINISH_STATE && strm.avail_in !== 0) {
    return err(strm, Z_BUF_ERROR);
  }

  /* Start a new block or continue the current one.
   */
  if (strm.avail_in !== 0 || s.lookahead !== 0 || flush !== Z_NO_FLUSH && s.status !== FINISH_STATE) {
    var bstate = s.strategy === Z_HUFFMAN_ONLY ? deflate_huff(s, flush) : s.strategy === Z_RLE ? deflate_rle(s, flush) : configuration_table[s.level].func(s, flush);

    if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
      s.status = FINISH_STATE;
    }
    if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        /* avoid BUF_ERROR next call, see above */
      }
      return Z_OK;
      /* If flush != Z_NO_FLUSH && avail_out == 0, the next call
       * of deflate should use the same flush parameter to make sure
       * that the flush is complete. So we don't have to output an
       * empty block here, this will be done at next call. This also
       * ensures that for a very small output buffer, we emit at most
       * one empty block.
       */
    }
    if (bstate === BS_BLOCK_DONE) {
      if (flush === Z_PARTIAL_FLUSH) {
        trees._tr_align(s);
      } else if (flush !== Z_BLOCK) {
        /* FULL_FLUSH or SYNC_FLUSH */

        trees._tr_stored_block(s, 0, 0, false);
        /* For a full flush, this empty block will be recognized
         * as a special marker by inflate_sync().
         */
        if (flush === Z_FULL_FLUSH) {
          /*** CLEAR_HASH(s); ***/ /* forget history */
          zero(s.head); // Fill with NIL (= 0);

          if (s.lookahead === 0) {
            s.strstart = 0;
            s.block_start = 0;
            s.insert = 0;
          }
        }
      }
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1; /* avoid BUF_ERROR at next call, see above */
        return Z_OK;
      }
    }
  }
  //Assert(strm->avail_out > 0, "bug2");
  //if (strm.avail_out <= 0) { throw new Error("bug2");}

  if (flush !== Z_FINISH) {
    return Z_OK;
  }
  if (s.wrap <= 0) {
    return Z_STREAM_END;
  }

  /* Write the trailer */
  if (s.wrap === 2) {
    put_byte(s, strm.adler & 0xff);
    put_byte(s, strm.adler >> 8 & 0xff);
    put_byte(s, strm.adler >> 16 & 0xff);
    put_byte(s, strm.adler >> 24 & 0xff);
    put_byte(s, strm.total_in & 0xff);
    put_byte(s, strm.total_in >> 8 & 0xff);
    put_byte(s, strm.total_in >> 16 & 0xff);
    put_byte(s, strm.total_in >> 24 & 0xff);
  } else {
    putShortMSB(s, strm.adler >>> 16);
    putShortMSB(s, strm.adler & 0xffff);
  }

  flush_pending(strm);
  /* If avail_out is zero, the application will call deflate again
   * to flush the rest.
   */
  if (s.wrap > 0) {
    s.wrap = -s.wrap;
  }
  /* write the trailer only once! */
  return s.pending !== 0 ? Z_OK : Z_STREAM_END;
}

function deflateEnd(strm) {
  var status;

  if (!strm /*== Z_NULL*/ || !strm.state /*== Z_NULL*/) {
      return Z_STREAM_ERROR;
    }

  status = strm.state.status;
  if (status !== INIT_STATE && status !== EXTRA_STATE && status !== NAME_STATE && status !== COMMENT_STATE && status !== HCRC_STATE && status !== BUSY_STATE && status !== FINISH_STATE) {
    return err(strm, Z_STREAM_ERROR);
  }

  strm.state = null;

  return status === BUSY_STATE ? err(strm, Z_DATA_ERROR) : Z_OK;
}

/* =========================================================================
 * Initializes the compression dictionary from the given byte
 * sequence without producing any compressed output.
 */
function deflateSetDictionary(strm, dictionary) {
  var dictLength = dictionary.length;

  var s;
  var str, n;
  var wrap;
  var avail;
  var next;
  var input;
  var tmpDict;

  if (!strm /*== Z_NULL*/ || !strm.state /*== Z_NULL*/) {
      return Z_STREAM_ERROR;
    }

  s = strm.state;
  wrap = s.wrap;

  if (wrap === 2 || wrap === 1 && s.status !== INIT_STATE || s.lookahead) {
    return Z_STREAM_ERROR;
  }

  /* when using zlib wrappers, compute Adler-32 for provided dictionary */
  if (wrap === 1) {
    /* adler32(strm->adler, dictionary, dictLength); */
    strm.adler = adler32(strm.adler, dictionary, dictLength, 0);
  }

  s.wrap = 0; /* avoid computing Adler-32 in read_buf */

  /* if dictionary would fill window, just replace the history */
  if (dictLength >= s.w_size) {
    if (wrap === 0) {
      /* already empty otherwise */
      /*** CLEAR_HASH(s); ***/
      zero(s.head); // Fill with NIL (= 0);
      s.strstart = 0;
      s.block_start = 0;
      s.insert = 0;
    }
    /* use the tail */
    // dictionary = dictionary.slice(dictLength - s.w_size);
    tmpDict = new utils.Buf8(s.w_size);
    utils.arraySet(tmpDict, dictionary, dictLength - s.w_size, s.w_size, 0);
    dictionary = tmpDict;
    dictLength = s.w_size;
  }
  /* insert dictionary into window and hash */
  avail = strm.avail_in;
  next = strm.next_in;
  input = strm.input;
  strm.avail_in = dictLength;
  strm.next_in = 0;
  strm.input = dictionary;
  fill_window(s);
  while (s.lookahead >= MIN_MATCH) {
    str = s.strstart;
    n = s.lookahead - (MIN_MATCH - 1);
    do {
      /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
      s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;

      s.prev[str & s.w_mask] = s.head[s.ins_h];

      s.head[s.ins_h] = str;
      str++;
    } while (--n);
    s.strstart = str;
    s.lookahead = MIN_MATCH - 1;
    fill_window(s);
  }
  s.strstart += s.lookahead;
  s.block_start = s.strstart;
  s.insert = s.lookahead;
  s.lookahead = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  strm.next_in = next;
  strm.input = input;
  strm.avail_in = avail;
  s.wrap = wrap;
  return Z_OK;
}

exports.deflateInit = deflateInit;
exports.deflateInit2 = deflateInit2;
exports.deflateReset = deflateReset;
exports.deflateResetKeep = deflateResetKeep;
exports.deflateSetHeader = deflateSetHeader;
exports.deflate = deflate;
exports.deflateEnd = deflateEnd;
exports.deflateSetDictionary = deflateSetDictionary;
exports.deflateInfo = 'pako deflate (from Nodeca project)';

/* Not implemented
exports.deflateBound = deflateBound;
exports.deflateCopy = deflateCopy;
exports.deflateParams = deflateParams;
exports.deflatePending = deflatePending;
exports.deflatePrime = deflatePrime;
exports.deflateTune = deflateTune;
*/

/***/ }),

/***/ "WEVK":
/***/ (function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ }),

/***/ "WgY6":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/**
 * Representation a of zip file in js
 * @constructor
 */

function JSZip() {
    // if this constructor is used without `new`, it adds `new` before itself:
    if (!(this instanceof JSZip)) {
        return new JSZip();
    }

    if (arguments.length) {
        throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");
    }

    // object containing the files :
    // {
    //   "folder/" : {...},
    //   "folder/data.txt" : {...}
    // }
    this.files = {};

    this.comment = null;

    // Where we are in the hierarchy
    this.root = "";
    this.clone = function () {
        var newObj = new JSZip();
        for (var i in this) {
            if (typeof this[i] !== "function") {
                newObj[i] = this[i];
            }
        }
        return newObj;
    };
}
JSZip.prototype = __webpack_require__("FLm2");
JSZip.prototype.loadAsync = __webpack_require__("BT+d");
JSZip.support = __webpack_require__("oKij");
JSZip.defaults = __webpack_require__("e3b7");

// TODO find a better way to handle this version,
// a require('package.json').version doesn't work with webpack, see #327
JSZip.version = "3.1.5";

JSZip.loadAsync = function (content, options) {
    return new JSZip().loadAsync(content, options);
};

JSZip.external = __webpack_require__("vVrn");
module.exports = JSZip;

/***/ }),

/***/ "ZjIE":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var utils = __webpack_require__("gt5T");

/* Public constants ==========================================================*/
/* ===========================================================================*/

//var Z_FILTERED          = 1;
//var Z_HUFFMAN_ONLY      = 2;
//var Z_RLE               = 3;
var Z_FIXED = 4;
//var Z_DEFAULT_STRATEGY  = 0;

/* Possible values of the data_type field (though see inflate()) */
var Z_BINARY = 0;
var Z_TEXT = 1;
//var Z_ASCII             = 1; // = Z_TEXT
var Z_UNKNOWN = 2;

/*============================================================================*/

function zero(buf) {
  var len = buf.length;while (--len >= 0) {
    buf[len] = 0;
  }
}

// From zutil.h

var STORED_BLOCK = 0;
var STATIC_TREES = 1;
var DYN_TREES = 2;
/* The three kinds of block type */

var MIN_MATCH = 3;
var MAX_MATCH = 258;
/* The minimum and maximum match lengths */

// From deflate.h
/* ===========================================================================
 * Internal compression state.
 */

var LENGTH_CODES = 29;
/* number of length codes, not counting the special END_BLOCK code */

var LITERALS = 256;
/* number of literal bytes 0..255 */

var L_CODES = LITERALS + 1 + LENGTH_CODES;
/* number of Literal or Length codes, including the END_BLOCK code */

var D_CODES = 30;
/* number of distance codes */

var BL_CODES = 19;
/* number of codes used to transfer the bit lengths */

var HEAP_SIZE = 2 * L_CODES + 1;
/* maximum heap size */

var MAX_BITS = 15;
/* All codes must not exceed MAX_BITS bits */

var Buf_size = 16;
/* size of bit buffer in bi_buf */

/* ===========================================================================
 * Constants
 */

var MAX_BL_BITS = 7;
/* Bit length codes must not exceed MAX_BL_BITS bits */

var END_BLOCK = 256;
/* end of block literal code */

var REP_3_6 = 16;
/* repeat previous bit length 3-6 times (2 bits of repeat count) */

var REPZ_3_10 = 17;
/* repeat a zero length 3-10 times  (3 bits of repeat count) */

var REPZ_11_138 = 18;
/* repeat a zero length 11-138 times  (7 bits of repeat count) */

/* eslint-disable comma-spacing,array-bracket-spacing */
var extra_lbits = /* extra bits for each length code */
[0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];

var extra_dbits = /* extra bits for each distance code */
[0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

var extra_blbits = /* extra bits for each bit length code */
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7];

var bl_order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
/* eslint-enable comma-spacing,array-bracket-spacing */

/* The lengths of the bit length codes are sent in order of decreasing
 * probability, to avoid transmitting the lengths for unused bit length codes.
 */

/* ===========================================================================
 * Local data. These are initialized only once.
 */

// We pre-fill arrays with 0 to avoid uninitialized gaps

var DIST_CODE_LEN = 512; /* see definition of array dist_code below */

// !!!! Use flat array instead of structure, Freq = i*2, Len = i*2+1
var static_ltree = new Array((L_CODES + 2) * 2);
zero(static_ltree);
/* The static literal tree. Since the bit lengths are imposed, there is no
 * need for the L_CODES extra codes used during heap construction. However
 * The codes 286 and 287 are needed to build a canonical tree (see _tr_init
 * below).
 */

var static_dtree = new Array(D_CODES * 2);
zero(static_dtree);
/* The static distance tree. (Actually a trivial tree since all codes use
 * 5 bits.)
 */

var _dist_code = new Array(DIST_CODE_LEN);
zero(_dist_code);
/* Distance codes. The first 256 values correspond to the distances
 * 3 .. 258, the last 256 values correspond to the top 8 bits of
 * the 15 bit distances.
 */

var _length_code = new Array(MAX_MATCH - MIN_MATCH + 1);
zero(_length_code);
/* length code for each normalized match length (0 == MIN_MATCH) */

var base_length = new Array(LENGTH_CODES);
zero(base_length);
/* First normalized length for each code (0 = MIN_MATCH) */

var base_dist = new Array(D_CODES);
zero(base_dist);
/* First normalized distance for each code (0 = distance of 1) */

function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {

  this.static_tree = static_tree; /* static tree or NULL */
  this.extra_bits = extra_bits; /* extra bits for each code or NULL */
  this.extra_base = extra_base; /* base index for extra_bits */
  this.elems = elems; /* max number of elements in the tree */
  this.max_length = max_length; /* max bit length for the codes */

  // show if `static_tree` has data or dummy - needed for monomorphic objects
  this.has_stree = static_tree && static_tree.length;
}

var static_l_desc;
var static_d_desc;
var static_bl_desc;

function TreeDesc(dyn_tree, stat_desc) {
  this.dyn_tree = dyn_tree; /* the dynamic tree */
  this.max_code = 0; /* largest code with non zero frequency */
  this.stat_desc = stat_desc; /* the corresponding static tree */
}

function d_code(dist) {
  return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
}

/* ===========================================================================
 * Output a short LSB first on the stream.
 * IN assertion: there is enough room in pendingBuf.
 */
function put_short(s, w) {
  //    put_byte(s, (uch)((w) & 0xff));
  //    put_byte(s, (uch)((ush)(w) >> 8));
  s.pending_buf[s.pending++] = w & 0xff;
  s.pending_buf[s.pending++] = w >>> 8 & 0xff;
}

/* ===========================================================================
 * Send a value on a given number of bits.
 * IN assertion: length <= 16 and value fits in length bits.
 */
function send_bits(s, value, length) {
  if (s.bi_valid > Buf_size - length) {
    s.bi_buf |= value << s.bi_valid & 0xffff;
    put_short(s, s.bi_buf);
    s.bi_buf = value >> Buf_size - s.bi_valid;
    s.bi_valid += length - Buf_size;
  } else {
    s.bi_buf |= value << s.bi_valid & 0xffff;
    s.bi_valid += length;
  }
}

function send_code(s, c, tree) {
  send_bits(s, tree[c * 2] /*.Code*/, tree[c * 2 + 1] /*.Len*/);
}

/* ===========================================================================
 * Reverse the first len bits of a code, using straightforward code (a faster
 * method would use a table)
 * IN assertion: 1 <= len <= 15
 */
function bi_reverse(code, len) {
  var res = 0;
  do {
    res |= code & 1;
    code >>>= 1;
    res <<= 1;
  } while (--len > 0);
  return res >>> 1;
}

/* ===========================================================================
 * Flush the bit buffer, keeping at most 7 bits in it.
 */
function bi_flush(s) {
  if (s.bi_valid === 16) {
    put_short(s, s.bi_buf);
    s.bi_buf = 0;
    s.bi_valid = 0;
  } else if (s.bi_valid >= 8) {
    s.pending_buf[s.pending++] = s.bi_buf & 0xff;
    s.bi_buf >>= 8;
    s.bi_valid -= 8;
  }
}

/* ===========================================================================
 * Compute the optimal bit lengths for a tree and update the total bit length
 * for the current block.
 * IN assertion: the fields freq and dad are set, heap[heap_max] and
 *    above are the tree nodes sorted by increasing frequency.
 * OUT assertions: the field len is set to the optimal bit length, the
 *     array bl_count contains the frequencies for each bit length.
 *     The length opt_len is updated; static_len is also updated if stree is
 *     not null.
 */
function gen_bitlen(s, desc)
//    deflate_state *s;
//    tree_desc *desc;    /* the tree descriptor */
{
  var tree = desc.dyn_tree;
  var max_code = desc.max_code;
  var stree = desc.stat_desc.static_tree;
  var has_stree = desc.stat_desc.has_stree;
  var extra = desc.stat_desc.extra_bits;
  var base = desc.stat_desc.extra_base;
  var max_length = desc.stat_desc.max_length;
  var h; /* heap index */
  var n, m; /* iterate over the tree elements */
  var bits; /* bit length */
  var xbits; /* extra bits */
  var f; /* frequency */
  var overflow = 0; /* number of elements with bit length too large */

  for (bits = 0; bits <= MAX_BITS; bits++) {
    s.bl_count[bits] = 0;
  }

  /* In a first pass, compute the optimal bit lengths (which may
   * overflow in the case of the bit length tree).
   */
  tree[s.heap[s.heap_max] * 2 + 1] /*.Len*/ = 0; /* root of the heap */

  for (h = s.heap_max + 1; h < HEAP_SIZE; h++) {
    n = s.heap[h];
    bits = tree[tree[n * 2 + 1] /*.Dad*/ * 2 + 1] /*.Len*/ + 1;
    if (bits > max_length) {
      bits = max_length;
      overflow++;
    }
    tree[n * 2 + 1] /*.Len*/ = bits;
    /* We overwrite tree[n].Dad which is no longer needed */

    if (n > max_code) {
      continue;
    } /* not a leaf node */

    s.bl_count[bits]++;
    xbits = 0;
    if (n >= base) {
      xbits = extra[n - base];
    }
    f = tree[n * 2] /*.Freq*/;
    s.opt_len += f * (bits + xbits);
    if (has_stree) {
      s.static_len += f * (stree[n * 2 + 1] /*.Len*/ + xbits);
    }
  }
  if (overflow === 0) {
    return;
  }

  // Trace((stderr,"\nbit length overflow\n"));
  /* This happens for example on obj2 and pic of the Calgary corpus */

  /* Find the first bit length which could increase: */
  do {
    bits = max_length - 1;
    while (s.bl_count[bits] === 0) {
      bits--;
    }
    s.bl_count[bits]--; /* move one leaf down the tree */
    s.bl_count[bits + 1] += 2; /* move one overflow item as its brother */
    s.bl_count[max_length]--;
    /* The brother of the overflow item also moves one step up,
     * but this does not affect bl_count[max_length]
     */
    overflow -= 2;
  } while (overflow > 0);

  /* Now recompute all bit lengths, scanning in increasing frequency.
   * h is still equal to HEAP_SIZE. (It is simpler to reconstruct all
   * lengths instead of fixing only the wrong ones. This idea is taken
   * from 'ar' written by Haruhiko Okumura.)
   */
  for (bits = max_length; bits !== 0; bits--) {
    n = s.bl_count[bits];
    while (n !== 0) {
      m = s.heap[--h];
      if (m > max_code) {
        continue;
      }
      if (tree[m * 2 + 1] /*.Len*/ !== bits) {
        // Trace((stderr,"code %d bits %d->%d\n", m, tree[m].Len, bits));
        s.opt_len += (bits - tree[m * 2 + 1] /*.Len*/) * tree[m * 2] /*.Freq*/;
        tree[m * 2 + 1] /*.Len*/ = bits;
      }
      n--;
    }
  }
}

/* ===========================================================================
 * Generate the codes for a given tree and bit counts (which need not be
 * optimal).
 * IN assertion: the array bl_count contains the bit length statistics for
 * the given tree and the field len is set for all tree elements.
 * OUT assertion: the field code is set for all tree elements of non
 *     zero code length.
 */
function gen_codes(tree, max_code, bl_count)
//    ct_data *tree;             /* the tree to decorate */
//    int max_code;              /* largest code with non zero frequency */
//    ushf *bl_count;            /* number of codes at each bit length */
{
  var next_code = new Array(MAX_BITS + 1); /* next code value for each bit length */
  var code = 0; /* running code value */
  var bits; /* bit index */
  var n; /* code index */

  /* The distribution counts are first used to generate the code values
   * without bit reversal.
   */
  for (bits = 1; bits <= MAX_BITS; bits++) {
    next_code[bits] = code = code + bl_count[bits - 1] << 1;
  }
  /* Check that the bit counts in bl_count are consistent. The last code
   * must be all ones.
   */
  //Assert (code + bl_count[MAX_BITS]-1 == (1<<MAX_BITS)-1,
  //        "inconsistent bit counts");
  //Tracev((stderr,"\ngen_codes: max_code %d ", max_code));

  for (n = 0; n <= max_code; n++) {
    var len = tree[n * 2 + 1] /*.Len*/;
    if (len === 0) {
      continue;
    }
    /* Now reverse the bits */
    tree[n * 2] /*.Code*/ = bi_reverse(next_code[len]++, len);

    //Tracecv(tree != static_ltree, (stderr,"\nn %3d %c l %2d c %4x (%x) ",
    //     n, (isgraph(n) ? n : ' '), len, tree[n].Code, next_code[len]-1));
  }
}

/* ===========================================================================
 * Initialize the various 'constant' tables.
 */
function tr_static_init() {
  var n; /* iterates over tree elements */
  var bits; /* bit counter */
  var length; /* length value */
  var code; /* code value */
  var dist; /* distance index */
  var bl_count = new Array(MAX_BITS + 1);
  /* number of codes at each bit length for an optimal tree */

  // do check in _tr_init()
  //if (static_init_done) return;

  /* For some embedded targets, global variables are not initialized: */
  /*#ifdef NO_INIT_GLOBAL_POINTERS
    static_l_desc.static_tree = static_ltree;
    static_l_desc.extra_bits = extra_lbits;
    static_d_desc.static_tree = static_dtree;
    static_d_desc.extra_bits = extra_dbits;
    static_bl_desc.extra_bits = extra_blbits;
  #endif*/

  /* Initialize the mapping length (0..255) -> length code (0..28) */
  length = 0;
  for (code = 0; code < LENGTH_CODES - 1; code++) {
    base_length[code] = length;
    for (n = 0; n < 1 << extra_lbits[code]; n++) {
      _length_code[length++] = code;
    }
  }
  //Assert (length == 256, "tr_static_init: length != 256");
  /* Note that the length 255 (match length 258) can be represented
   * in two different ways: code 284 + 5 bits or code 285, so we
   * overwrite length_code[255] to use the best encoding:
   */
  _length_code[length - 1] = code;

  /* Initialize the mapping dist (0..32K) -> dist code (0..29) */
  dist = 0;
  for (code = 0; code < 16; code++) {
    base_dist[code] = dist;
    for (n = 0; n < 1 << extra_dbits[code]; n++) {
      _dist_code[dist++] = code;
    }
  }
  //Assert (dist == 256, "tr_static_init: dist != 256");
  dist >>= 7; /* from now on, all distances are divided by 128 */
  for (; code < D_CODES; code++) {
    base_dist[code] = dist << 7;
    for (n = 0; n < 1 << extra_dbits[code] - 7; n++) {
      _dist_code[256 + dist++] = code;
    }
  }
  //Assert (dist == 256, "tr_static_init: 256+dist != 512");

  /* Construct the codes of the static literal tree */
  for (bits = 0; bits <= MAX_BITS; bits++) {
    bl_count[bits] = 0;
  }

  n = 0;
  while (n <= 143) {
    static_ltree[n * 2 + 1] /*.Len*/ = 8;
    n++;
    bl_count[8]++;
  }
  while (n <= 255) {
    static_ltree[n * 2 + 1] /*.Len*/ = 9;
    n++;
    bl_count[9]++;
  }
  while (n <= 279) {
    static_ltree[n * 2 + 1] /*.Len*/ = 7;
    n++;
    bl_count[7]++;
  }
  while (n <= 287) {
    static_ltree[n * 2 + 1] /*.Len*/ = 8;
    n++;
    bl_count[8]++;
  }
  /* Codes 286 and 287 do not exist, but we must include them in the
   * tree construction to get a canonical Huffman tree (longest code
   * all ones)
   */
  gen_codes(static_ltree, L_CODES + 1, bl_count);

  /* The static distance tree is trivial: */
  for (n = 0; n < D_CODES; n++) {
    static_dtree[n * 2 + 1] /*.Len*/ = 5;
    static_dtree[n * 2] /*.Code*/ = bi_reverse(n, 5);
  }

  // Now data ready and we can init static trees
  static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS + 1, L_CODES, MAX_BITS);
  static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES, MAX_BITS);
  static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES, MAX_BL_BITS);

  //static_init_done = true;
}

/* ===========================================================================
 * Initialize a new block.
 */
function init_block(s) {
  var n; /* iterates over tree elements */

  /* Initialize the trees. */
  for (n = 0; n < L_CODES; n++) {
    s.dyn_ltree[n * 2] /*.Freq*/ = 0;
  }
  for (n = 0; n < D_CODES; n++) {
    s.dyn_dtree[n * 2] /*.Freq*/ = 0;
  }
  for (n = 0; n < BL_CODES; n++) {
    s.bl_tree[n * 2] /*.Freq*/ = 0;
  }

  s.dyn_ltree[END_BLOCK * 2] /*.Freq*/ = 1;
  s.opt_len = s.static_len = 0;
  s.last_lit = s.matches = 0;
}

/* ===========================================================================
 * Flush the bit buffer and align the output on a byte boundary
 */
function bi_windup(s) {
  if (s.bi_valid > 8) {
    put_short(s, s.bi_buf);
  } else if (s.bi_valid > 0) {
    //put_byte(s, (Byte)s->bi_buf);
    s.pending_buf[s.pending++] = s.bi_buf;
  }
  s.bi_buf = 0;
  s.bi_valid = 0;
}

/* ===========================================================================
 * Copy a stored block, storing first the length and its
 * one's complement if requested.
 */
function copy_block(s, buf, len, header)
//DeflateState *s;
//charf    *buf;    /* the input data */
//unsigned len;     /* its length */
//int      header;  /* true if block header must be written */
{
  bi_windup(s); /* align on byte boundary */

  if (header) {
    put_short(s, len);
    put_short(s, ~len);
  }
  //  while (len--) {
  //    put_byte(s, *buf++);
  //  }
  utils.arraySet(s.pending_buf, s.window, buf, len, s.pending);
  s.pending += len;
}

/* ===========================================================================
 * Compares to subtrees, using the tree depth as tie breaker when
 * the subtrees have equal frequency. This minimizes the worst case length.
 */
function smaller(tree, n, m, depth) {
  var _n2 = n * 2;
  var _m2 = m * 2;
  return tree[_n2] /*.Freq*/ < tree[_m2] /*.Freq*/ || tree[_n2] /*.Freq*/ === tree[_m2] /*.Freq*/ && depth[n] <= depth[m];
}

/* ===========================================================================
 * Restore the heap property by moving down the tree starting at node k,
 * exchanging a node with the smallest of its two sons if necessary, stopping
 * when the heap property is re-established (each father smaller than its
 * two sons).
 */
function pqdownheap(s, tree, k)
//    deflate_state *s;
//    ct_data *tree;  /* the tree to restore */
//    int k;               /* node to move down */
{
  var v = s.heap[k];
  var j = k << 1; /* left son of k */
  while (j <= s.heap_len) {
    /* Set j to the smallest of the two sons: */
    if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
      j++;
    }
    /* Exit if v is smaller than both sons */
    if (smaller(tree, v, s.heap[j], s.depth)) {
      break;
    }

    /* Exchange v with the smallest son */
    s.heap[k] = s.heap[j];
    k = j;

    /* And continue down the tree, setting j to the left son of k */
    j <<= 1;
  }
  s.heap[k] = v;
}

// inlined manually
// var SMALLEST = 1;

/* ===========================================================================
 * Send the block data compressed using the given Huffman trees
 */
function compress_block(s, ltree, dtree)
//    deflate_state *s;
//    const ct_data *ltree; /* literal tree */
//    const ct_data *dtree; /* distance tree */
{
  var dist; /* distance of matched string */
  var lc; /* match length or unmatched char (if dist == 0) */
  var lx = 0; /* running index in l_buf */
  var code; /* the code to send */
  var extra; /* number of extra bits to send */

  if (s.last_lit !== 0) {
    do {
      dist = s.pending_buf[s.d_buf + lx * 2] << 8 | s.pending_buf[s.d_buf + lx * 2 + 1];
      lc = s.pending_buf[s.l_buf + lx];
      lx++;

      if (dist === 0) {
        send_code(s, lc, ltree); /* send a literal byte */
        //Tracecv(isgraph(lc), (stderr," '%c' ", lc));
      } else {
        /* Here, lc is the match length - MIN_MATCH */
        code = _length_code[lc];
        send_code(s, code + LITERALS + 1, ltree); /* send the length code */
        extra = extra_lbits[code];
        if (extra !== 0) {
          lc -= base_length[code];
          send_bits(s, lc, extra); /* send the extra length bits */
        }
        dist--; /* dist is now the match distance - 1 */
        code = d_code(dist);
        //Assert (code < D_CODES, "bad d_code");

        send_code(s, code, dtree); /* send the distance code */
        extra = extra_dbits[code];
        if (extra !== 0) {
          dist -= base_dist[code];
          send_bits(s, dist, extra); /* send the extra distance bits */
        }
      } /* literal or match pair ? */

      /* Check that the overlay between pending_buf and d_buf+l_buf is ok: */
      //Assert((uInt)(s->pending) < s->lit_bufsize + 2*lx,
      //       "pendingBuf overflow");
    } while (lx < s.last_lit);
  }

  send_code(s, END_BLOCK, ltree);
}

/* ===========================================================================
 * Construct one Huffman tree and assigns the code bit strings and lengths.
 * Update the total bit length for the current block.
 * IN assertion: the field freq is set for all tree elements.
 * OUT assertions: the fields len and code are set to the optimal bit length
 *     and corresponding code. The length opt_len is updated; static_len is
 *     also updated if stree is not null. The field max_code is set.
 */
function build_tree(s, desc)
//    deflate_state *s;
//    tree_desc *desc; /* the tree descriptor */
{
  var tree = desc.dyn_tree;
  var stree = desc.stat_desc.static_tree;
  var has_stree = desc.stat_desc.has_stree;
  var elems = desc.stat_desc.elems;
  var n, m; /* iterate over heap elements */
  var max_code = -1; /* largest code with non zero frequency */
  var node; /* new node being created */

  /* Construct the initial heap, with least frequent element in
   * heap[SMALLEST]. The sons of heap[n] are heap[2*n] and heap[2*n+1].
   * heap[0] is not used.
   */
  s.heap_len = 0;
  s.heap_max = HEAP_SIZE;

  for (n = 0; n < elems; n++) {
    if (tree[n * 2] /*.Freq*/ !== 0) {
      s.heap[++s.heap_len] = max_code = n;
      s.depth[n] = 0;
    } else {
      tree[n * 2 + 1] /*.Len*/ = 0;
    }
  }

  /* The pkzip format requires that at least one distance code exists,
   * and that at least one bit should be sent even if there is only one
   * possible code. So to avoid special checks later on we force at least
   * two codes of non zero frequency.
   */
  while (s.heap_len < 2) {
    node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
    tree[node * 2] /*.Freq*/ = 1;
    s.depth[node] = 0;
    s.opt_len--;

    if (has_stree) {
      s.static_len -= stree[node * 2 + 1] /*.Len*/;
    }
    /* node is 0 or 1 so it does not have extra bits */
  }
  desc.max_code = max_code;

  /* The elements heap[heap_len/2+1 .. heap_len] are leaves of the tree,
   * establish sub-heaps of increasing lengths:
   */
  for (n = s.heap_len >> 1 /*int /2*/; n >= 1; n--) {
    pqdownheap(s, tree, n);
  }

  /* Construct the Huffman tree by repeatedly combining the least two
   * frequent nodes.
   */
  node = elems; /* next internal node of the tree */
  do {
    //pqremove(s, tree, n);  /* n = node of least frequency */
    /*** pqremove ***/
    n = s.heap[1 /*SMALLEST*/];
    s.heap[1 /*SMALLEST*/] = s.heap[s.heap_len--];
    pqdownheap(s, tree, 1 /*SMALLEST*/);
    /***/

    m = s.heap[1 /*SMALLEST*/]; /* m = node of next least frequency */

    s.heap[--s.heap_max] = n; /* keep the nodes sorted by frequency */
    s.heap[--s.heap_max] = m;

    /* Create a new node father of n and m */
    tree[node * 2] /*.Freq*/ = tree[n * 2] /*.Freq*/ + tree[m * 2] /*.Freq*/;
    s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
    tree[n * 2 + 1] /*.Dad*/ = tree[m * 2 + 1] /*.Dad*/ = node;

    /* and insert the new node in the heap */
    s.heap[1 /*SMALLEST*/] = node++;
    pqdownheap(s, tree, 1 /*SMALLEST*/);
  } while (s.heap_len >= 2);

  s.heap[--s.heap_max] = s.heap[1 /*SMALLEST*/];

  /* At this point, the fields freq and dad are set. We can now
   * generate the bit lengths.
   */
  gen_bitlen(s, desc);

  /* The field len is now set, we can generate the bit codes */
  gen_codes(tree, max_code, s.bl_count);
}

/* ===========================================================================
 * Scan a literal or distance tree to determine the frequencies of the codes
 * in the bit length tree.
 */
function scan_tree(s, tree, max_code)
//    deflate_state *s;
//    ct_data *tree;   /* the tree to be scanned */
//    int max_code;    /* and its largest code of non zero frequency */
{
  var n; /* iterates over all tree elements */
  var prevlen = -1; /* last emitted length */
  var curlen; /* length of current code */

  var nextlen = tree[0 * 2 + 1] /*.Len*/; /* length of next code */

  var count = 0; /* repeat count of the current code */
  var max_count = 7; /* max repeat count */
  var min_count = 4; /* min repeat count */

  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  tree[(max_code + 1) * 2 + 1] /*.Len*/ = 0xffff; /* guard */

  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1] /*.Len*/;

    if (++count < max_count && curlen === nextlen) {
      continue;
    } else if (count < min_count) {
      s.bl_tree[curlen * 2] /*.Freq*/ += count;
    } else if (curlen !== 0) {

      if (curlen !== prevlen) {
        s.bl_tree[curlen * 2] /*.Freq*/++;
      }
      s.bl_tree[REP_3_6 * 2] /*.Freq*/++;
    } else if (count <= 10) {
      s.bl_tree[REPZ_3_10 * 2] /*.Freq*/++;
    } else {
      s.bl_tree[REPZ_11_138 * 2] /*.Freq*/++;
    }

    count = 0;
    prevlen = curlen;

    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
}

/* ===========================================================================
 * Send a literal or distance tree in compressed form, using the codes in
 * bl_tree.
 */
function send_tree(s, tree, max_code)
//    deflate_state *s;
//    ct_data *tree; /* the tree to be scanned */
//    int max_code;       /* and its largest code of non zero frequency */
{
  var n; /* iterates over all tree elements */
  var prevlen = -1; /* last emitted length */
  var curlen; /* length of current code */

  var nextlen = tree[0 * 2 + 1] /*.Len*/; /* length of next code */

  var count = 0; /* repeat count of the current code */
  var max_count = 7; /* max repeat count */
  var min_count = 4; /* min repeat count */

  /* tree[max_code+1].Len = -1; */ /* guard already set */
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }

  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1] /*.Len*/;

    if (++count < max_count && curlen === nextlen) {
      continue;
    } else if (count < min_count) {
      do {
        send_code(s, curlen, s.bl_tree);
      } while (--count !== 0);
    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        send_code(s, curlen, s.bl_tree);
        count--;
      }
      //Assert(count >= 3 && count <= 6, " 3_6?");
      send_code(s, REP_3_6, s.bl_tree);
      send_bits(s, count - 3, 2);
    } else if (count <= 10) {
      send_code(s, REPZ_3_10, s.bl_tree);
      send_bits(s, count - 3, 3);
    } else {
      send_code(s, REPZ_11_138, s.bl_tree);
      send_bits(s, count - 11, 7);
    }

    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
}

/* ===========================================================================
 * Construct the Huffman tree for the bit lengths and return the index in
 * bl_order of the last bit length code to send.
 */
function build_bl_tree(s) {
  var max_blindex; /* index of last bit length code of non zero freq */

  /* Determine the bit length frequencies for literal and distance trees */
  scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
  scan_tree(s, s.dyn_dtree, s.d_desc.max_code);

  /* Build the bit length tree: */
  build_tree(s, s.bl_desc);
  /* opt_len now includes the length of the tree representations, except
   * the lengths of the bit lengths codes and the 5+5+4 bits for the counts.
   */

  /* Determine the number of bit length codes to send. The pkzip format
   * requires that at least 4 bit length codes be sent. (appnote.txt says
   * 3 but the actual value used is 4.)
   */
  for (max_blindex = BL_CODES - 1; max_blindex >= 3; max_blindex--) {
    if (s.bl_tree[bl_order[max_blindex] * 2 + 1] /*.Len*/ !== 0) {
      break;
    }
  }
  /* Update opt_len to include the bit length tree and counts */
  s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
  //Tracev((stderr, "\ndyn trees: dyn %ld, stat %ld",
  //        s->opt_len, s->static_len));

  return max_blindex;
}

/* ===========================================================================
 * Send the header for a block using dynamic Huffman trees: the counts, the
 * lengths of the bit length codes, the literal tree and the distance tree.
 * IN assertion: lcodes >= 257, dcodes >= 1, blcodes >= 4.
 */
function send_all_trees(s, lcodes, dcodes, blcodes)
//    deflate_state *s;
//    int lcodes, dcodes, blcodes; /* number of codes for each tree */
{
  var rank; /* index in bl_order */

  //Assert (lcodes >= 257 && dcodes >= 1 && blcodes >= 4, "not enough codes");
  //Assert (lcodes <= L_CODES && dcodes <= D_CODES && blcodes <= BL_CODES,
  //        "too many codes");
  //Tracev((stderr, "\nbl counts: "));
  send_bits(s, lcodes - 257, 5); /* not +255 as stated in appnote.txt */
  send_bits(s, dcodes - 1, 5);
  send_bits(s, blcodes - 4, 4); /* not -3 as stated in appnote.txt */
  for (rank = 0; rank < blcodes; rank++) {
    //Tracev((stderr, "\nbl code %2d ", bl_order[rank]));
    send_bits(s, s.bl_tree[bl_order[rank] * 2 + 1] /*.Len*/, 3);
  }
  //Tracev((stderr, "\nbl tree: sent %ld", s->bits_sent));

  send_tree(s, s.dyn_ltree, lcodes - 1); /* literal tree */
  //Tracev((stderr, "\nlit tree: sent %ld", s->bits_sent));

  send_tree(s, s.dyn_dtree, dcodes - 1); /* distance tree */
  //Tracev((stderr, "\ndist tree: sent %ld", s->bits_sent));
}

/* ===========================================================================
 * Check if the data type is TEXT or BINARY, using the following algorithm:
 * - TEXT if the two conditions below are satisfied:
 *    a) There are no non-portable control characters belonging to the
 *       "black list" (0..6, 14..25, 28..31).
 *    b) There is at least one printable character belonging to the
 *       "white list" (9 {TAB}, 10 {LF}, 13 {CR}, 32..255).
 * - BINARY otherwise.
 * - The following partially-portable control characters form a
 *   "gray list" that is ignored in this detection algorithm:
 *   (7 {BEL}, 8 {BS}, 11 {VT}, 12 {FF}, 26 {SUB}, 27 {ESC}).
 * IN assertion: the fields Freq of dyn_ltree are set.
 */
function detect_data_type(s) {
  /* black_mask is the bit mask of black-listed bytes
   * set bits 0..6, 14..25, and 28..31
   * 0xf3ffc07f = binary 11110011111111111100000001111111
   */
  var black_mask = 0xf3ffc07f;
  var n;

  /* Check for non-textual ("black-listed") bytes. */
  for (n = 0; n <= 31; n++, black_mask >>>= 1) {
    if (black_mask & 1 && s.dyn_ltree[n * 2] /*.Freq*/ !== 0) {
      return Z_BINARY;
    }
  }

  /* Check for textual ("white-listed") bytes. */
  if (s.dyn_ltree[9 * 2] /*.Freq*/ !== 0 || s.dyn_ltree[10 * 2] /*.Freq*/ !== 0 || s.dyn_ltree[13 * 2] /*.Freq*/ !== 0) {
    return Z_TEXT;
  }
  for (n = 32; n < LITERALS; n++) {
    if (s.dyn_ltree[n * 2] /*.Freq*/ !== 0) {
      return Z_TEXT;
    }
  }

  /* There are no "black-listed" or "white-listed" bytes:
   * this stream either is empty or has tolerated ("gray-listed") bytes only.
   */
  return Z_BINARY;
}

var static_init_done = false;

/* ===========================================================================
 * Initialize the tree data structures for a new zlib stream.
 */
function _tr_init(s) {

  if (!static_init_done) {
    tr_static_init();
    static_init_done = true;
  }

  s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
  s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
  s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);

  s.bi_buf = 0;
  s.bi_valid = 0;

  /* Initialize the first block of the first file: */
  init_block(s);
}

/* ===========================================================================
 * Send a stored block
 */
function _tr_stored_block(s, buf, stored_len, last)
//DeflateState *s;
//charf *buf;       /* input block */
//ulg stored_len;   /* length of input block */
//int last;         /* one if this is the last block for a file */
{
  send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3); /* send block type */
  copy_block(s, buf, stored_len, true); /* with header */
}

/* ===========================================================================
 * Send one empty static block to give enough lookahead for inflate.
 * This takes 10 bits, of which 7 may remain in the bit buffer.
 */
function _tr_align(s) {
  send_bits(s, STATIC_TREES << 1, 3);
  send_code(s, END_BLOCK, static_ltree);
  bi_flush(s);
}

/* ===========================================================================
 * Determine the best encoding for the current block: dynamic trees, static
 * trees or store, and output the encoded block to the zip file.
 */
function _tr_flush_block(s, buf, stored_len, last)
//DeflateState *s;
//charf *buf;       /* input block, or NULL if too old */
//ulg stored_len;   /* length of input block */
//int last;         /* one if this is the last block for a file */
{
  var opt_lenb, static_lenb; /* opt_len and static_len in bytes */
  var max_blindex = 0; /* index of last bit length code of non zero freq */

  /* Build the Huffman trees unless a stored block is forced */
  if (s.level > 0) {

    /* Check if the file is binary or text */
    if (s.strm.data_type === Z_UNKNOWN) {
      s.strm.data_type = detect_data_type(s);
    }

    /* Construct the literal and distance trees */
    build_tree(s, s.l_desc);
    // Tracev((stderr, "\nlit data: dyn %ld, stat %ld", s->opt_len,
    //        s->static_len));

    build_tree(s, s.d_desc);
    // Tracev((stderr, "\ndist data: dyn %ld, stat %ld", s->opt_len,
    //        s->static_len));
    /* At this point, opt_len and static_len are the total bit lengths of
     * the compressed block data, excluding the tree representations.
     */

    /* Build the bit length tree for the above two trees, and get the index
     * in bl_order of the last bit length code to send.
     */
    max_blindex = build_bl_tree(s);

    /* Determine the best encoding. Compute the block lengths in bytes. */
    opt_lenb = s.opt_len + 3 + 7 >>> 3;
    static_lenb = s.static_len + 3 + 7 >>> 3;

    // Tracev((stderr, "\nopt %lu(%lu) stat %lu(%lu) stored %lu lit %u ",
    //        opt_lenb, s->opt_len, static_lenb, s->static_len, stored_len,
    //        s->last_lit));

    if (static_lenb <= opt_lenb) {
      opt_lenb = static_lenb;
    }
  } else {
    // Assert(buf != (char*)0, "lost buf");
    opt_lenb = static_lenb = stored_len + 5; /* force a stored block */
  }

  if (stored_len + 4 <= opt_lenb && buf !== -1) {
    /* 4: two words for the lengths */

    /* The test buf != NULL is only necessary if LIT_BUFSIZE > WSIZE.
     * Otherwise we can't have processed more than WSIZE input bytes since
     * the last block flush, because compression would have been
     * successful. If LIT_BUFSIZE <= WSIZE, it is never too late to
     * transform a block into a stored block.
     */
    _tr_stored_block(s, buf, stored_len, last);
  } else if (s.strategy === Z_FIXED || static_lenb === opt_lenb) {

    send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
    compress_block(s, static_ltree, static_dtree);
  } else {
    send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
    send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
    compress_block(s, s.dyn_ltree, s.dyn_dtree);
  }
  // Assert (s->compressed_len == s->bits_sent, "bad compressed size");
  /* The above check is made mod 2^32, for files larger than 512 MB
   * and uLong implemented on 32 bits.
   */
  init_block(s);

  if (last) {
    bi_windup(s);
  }
  // Tracev((stderr,"\ncomprlen %lu(%lu) ", s->compressed_len>>3,
  //       s->compressed_len-7*last));
}

/* ===========================================================================
 * Save the match info and tally the frequency counts. Return true if
 * the current block must be flushed.
 */
function _tr_tally(s, dist, lc)
//    deflate_state *s;
//    unsigned dist;  /* distance of matched string */
//    unsigned lc;    /* match length-MIN_MATCH or unmatched char (if dist==0) */
{
  //var out_length, in_length, dcode;

  s.pending_buf[s.d_buf + s.last_lit * 2] = dist >>> 8 & 0xff;
  s.pending_buf[s.d_buf + s.last_lit * 2 + 1] = dist & 0xff;

  s.pending_buf[s.l_buf + s.last_lit] = lc & 0xff;
  s.last_lit++;

  if (dist === 0) {
    /* lc is the unmatched char */
    s.dyn_ltree[lc * 2] /*.Freq*/++;
  } else {
    s.matches++;
    /* Here, lc is the match length - MIN_MATCH */
    dist--; /* dist = match distance - 1 */
    //Assert((ush)dist < (ush)MAX_DIST(s) &&
    //       (ush)lc <= (ush)(MAX_MATCH-MIN_MATCH) &&
    //       (ush)d_code(dist) < (ush)D_CODES,  "_tr_tally: bad match");

    s.dyn_ltree[(_length_code[lc] + LITERALS + 1) * 2] /*.Freq*/++;
    s.dyn_dtree[d_code(dist) * 2] /*.Freq*/++;
  }

  // (!) This block is disabled in zlib defaults,
  // don't enable it for binary compatibility

  //#ifdef TRUNCATE_BLOCK
  //  /* Try to guess if it is profitable to stop the current block here */
  //  if ((s.last_lit & 0x1fff) === 0 && s.level > 2) {
  //    /* Compute an upper bound for the compressed length */
  //    out_length = s.last_lit*8;
  //    in_length = s.strstart - s.block_start;
  //
  //    for (dcode = 0; dcode < D_CODES; dcode++) {
  //      out_length += s.dyn_dtree[dcode*2]/*.Freq*/ * (5 + extra_dbits[dcode]);
  //    }
  //    out_length >>>= 3;
  //    //Tracev((stderr,"\nlast_lit %u, in %ld, out ~%ld(%ld%%) ",
  //    //       s->last_lit, in_length, out_length,
  //    //       100L - out_length*100L/in_length));
  //    if (s.matches < (s.last_lit>>1)/*int /2*/ && out_length < (in_length>>1)/*int /2*/) {
  //      return true;
  //    }
  //  }
  //#endif

  return s.last_lit === s.lit_bufsize - 1;
  /* We avoid equality with lit_bufsize because of wraparound at 64K
   * on 16 bit machines and because stored blocks are restricted to
   * 64K-1 bytes.
   */
}

exports._tr_init = _tr_init;
exports._tr_stored_block = _tr_stored_block;
exports._tr_flush_block = _tr_flush_block;
exports._tr_tally = _tr_tally;
exports._tr_align = _tr_align;

/***/ }),

/***/ "a1Qx":
/***/ (function(module, exports) {

module.exports = function (exec) {
  try {
    return !!exec();
  } catch (e) {
    return true;
  }
};

/***/ }),

/***/ "a4gv":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


(function () {
  function toArray(arr) {
    return Array.prototype.slice.call(arr);
  }

  function promisifyRequest(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () {
        resolve(request.result);
      };

      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function promisifyRequestCall(obj, method, args) {
    var request;
    var p = new Promise(function (resolve, reject) {
      request = obj[method].apply(obj, args);
      promisifyRequest(request).then(resolve, reject);
    });

    p.request = request;
    return p;
  }

  function promisifyCursorRequestCall(obj, method, args) {
    var p = promisifyRequestCall(obj, method, args);
    return p.then(function (value) {
      if (!value) return;
      return new Cursor(value, p.request);
    });
  }

  function proxyProperties(ProxyClass, targetProp, properties) {
    properties.forEach(function (prop) {
      Object.defineProperty(ProxyClass.prototype, prop, {
        get: function get() {
          return this[targetProp][prop];
        },
        set: function set(val) {
          this[targetProp][prop] = val;
        }
      });
    });
  }

  function proxyRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function (prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function () {
        return promisifyRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function proxyMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function (prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function () {
        return this[targetProp][prop].apply(this[targetProp], arguments);
      };
    });
  }

  function proxyCursorRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function (prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function () {
        return promisifyCursorRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function Index(index) {
    this._index = index;
  }

  proxyProperties(Index, '_index', ['name', 'keyPath', 'multiEntry', 'unique']);

  proxyRequestMethods(Index, '_index', IDBIndex, ['get', 'getKey', 'getAll', 'getAllKeys', 'count']);

  proxyCursorRequestMethods(Index, '_index', IDBIndex, ['openCursor', 'openKeyCursor']);

  function Cursor(cursor, request) {
    this._cursor = cursor;
    this._request = request;
  }

  proxyProperties(Cursor, '_cursor', ['direction', 'key', 'primaryKey', 'value']);

  proxyRequestMethods(Cursor, '_cursor', IDBCursor, ['update', 'delete']);

  // proxy 'next' methods
  ['advance', 'continue', 'continuePrimaryKey'].forEach(function (methodName) {
    if (!(methodName in IDBCursor.prototype)) return;
    Cursor.prototype[methodName] = function () {
      var cursor = this;
      var args = arguments;
      return Promise.resolve().then(function () {
        cursor._cursor[methodName].apply(cursor._cursor, args);
        return promisifyRequest(cursor._request).then(function (value) {
          if (!value) return;
          return new Cursor(value, cursor._request);
        });
      });
    };
  });

  function ObjectStore(store) {
    this._store = store;
  }

  ObjectStore.prototype.createIndex = function () {
    return new Index(this._store.createIndex.apply(this._store, arguments));
  };

  ObjectStore.prototype.index = function () {
    return new Index(this._store.index.apply(this._store, arguments));
  };

  proxyProperties(ObjectStore, '_store', ['name', 'keyPath', 'indexNames', 'autoIncrement']);

  proxyRequestMethods(ObjectStore, '_store', IDBObjectStore, ['put', 'add', 'delete', 'clear', 'get', 'getAll', 'getKey', 'getAllKeys', 'count']);

  proxyCursorRequestMethods(ObjectStore, '_store', IDBObjectStore, ['openCursor', 'openKeyCursor']);

  proxyMethods(ObjectStore, '_store', IDBObjectStore, ['deleteIndex']);

  function Transaction(idbTransaction) {
    this._tx = idbTransaction;
    this.complete = new Promise(function (resolve, reject) {
      idbTransaction.oncomplete = function () {
        resolve();
      };
      idbTransaction.onerror = function () {
        reject(idbTransaction.error);
      };
      idbTransaction.onabort = function () {
        reject(idbTransaction.error);
      };
    });
  }

  Transaction.prototype.objectStore = function () {
    return new ObjectStore(this._tx.objectStore.apply(this._tx, arguments));
  };

  proxyProperties(Transaction, '_tx', ['objectStoreNames', 'mode']);

  proxyMethods(Transaction, '_tx', IDBTransaction, ['abort']);

  function UpgradeDB(db, oldVersion, transaction) {
    this._db = db;
    this.oldVersion = oldVersion;
    this.transaction = new Transaction(transaction);
  }

  UpgradeDB.prototype.createObjectStore = function () {
    return new ObjectStore(this._db.createObjectStore.apply(this._db, arguments));
  };

  proxyProperties(UpgradeDB, '_db', ['name', 'version', 'objectStoreNames']);

  proxyMethods(UpgradeDB, '_db', IDBDatabase, ['deleteObjectStore', 'close']);

  function DB(db) {
    this._db = db;
  }

  DB.prototype.transaction = function () {
    return new Transaction(this._db.transaction.apply(this._db, arguments));
  };

  proxyProperties(DB, '_db', ['name', 'version', 'objectStoreNames']);

  proxyMethods(DB, '_db', IDBDatabase, ['close']);

  // Add cursor iterators
  // TODO: remove this once browsers do the right thing with promises
  ['openCursor', 'openKeyCursor'].forEach(function (funcName) {
    [ObjectStore, Index].forEach(function (Constructor) {
      Constructor.prototype[funcName.replace('open', 'iterate')] = function () {
        var args = toArray(arguments);
        var callback = args[args.length - 1];
        var nativeObject = this._store || this._index;
        var request = nativeObject[funcName].apply(nativeObject, args.slice(0, -1));
        request.onsuccess = function () {
          callback(request.result);
        };
      };
    });
  });

  // polyfill getAll
  [Index, ObjectStore].forEach(function (Constructor) {
    if (Constructor.prototype.getAll) return;
    Constructor.prototype.getAll = function (query, count) {
      var instance = this;
      var items = [];

      return new Promise(function (resolve) {
        instance.iterateCursor(query, function (cursor) {
          if (!cursor) {
            resolve(items);
            return;
          }
          items.push(cursor.value);

          if (count !== undefined && items.length == count) {
            resolve(items);
            return;
          }
          cursor.continue();
        });
      });
    };
  });

  var exp = {
    open: function open(name, version, upgradeCallback) {
      var p = promisifyRequestCall(indexedDB, 'open', [name, version]);
      var request = p.request;

      request.onupgradeneeded = function (event) {
        if (upgradeCallback) {
          upgradeCallback(new UpgradeDB(request.result, event.oldVersion, request.transaction));
        }
      };

      return p.then(function (db) {
        return new DB(db);
      });
    },
    delete: function _delete(name) {
      return promisifyRequestCall(indexedDB, 'deleteDatabase', [name]);
    }
  };

  if (true) {
    module.exports = exp;
    module.exports.default = module.exports;
  } else {
    self.idb = exp;
  }
})();

/***/ }),

/***/ "aIUk":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var StreamHelper = __webpack_require__("GE67");
var DataWorker = __webpack_require__("KnAl");
var utf8 = __webpack_require__("Ed4+");
var CompressedObject = __webpack_require__("jbop");
var GenericWorker = __webpack_require__("bxoG");

/**
 * A simple object representing a file in the zip file.
 * @constructor
 * @param {string} name the name of the file
 * @param {String|ArrayBuffer|Uint8Array|Buffer} data the data
 * @param {Object} options the options of the file
 */
var ZipObject = function ZipObject(name, data, options) {
    this.name = name;
    this.dir = options.dir;
    this.date = options.date;
    this.comment = options.comment;
    this.unixPermissions = options.unixPermissions;
    this.dosPermissions = options.dosPermissions;

    this._data = data;
    this._dataBinary = options.binary;
    // keep only the compression
    this.options = {
        compression: options.compression,
        compressionOptions: options.compressionOptions
    };
};

ZipObject.prototype = {
    /**
     * Create an internal stream for the content of this object.
     * @param {String} type the type of each chunk.
     * @return StreamHelper the stream.
     */
    internalStream: function internalStream(type) {
        var result = null,
            outputType = "string";
        try {
            if (!type) {
                throw new Error("No output type specified.");
            }
            outputType = type.toLowerCase();
            var askUnicodeString = outputType === "string" || outputType === "text";
            if (outputType === "binarystring" || outputType === "text") {
                outputType = "string";
            }
            result = this._decompressWorker();

            var isUnicodeString = !this._dataBinary;

            if (isUnicodeString && !askUnicodeString) {
                result = result.pipe(new utf8.Utf8EncodeWorker());
            }
            if (!isUnicodeString && askUnicodeString) {
                result = result.pipe(new utf8.Utf8DecodeWorker());
            }
        } catch (e) {
            result = new GenericWorker("error");
            result.error(e);
        }

        return new StreamHelper(result, outputType, "");
    },

    /**
     * Prepare the content in the asked type.
     * @param {String} type the type of the result.
     * @param {Function} onUpdate a function to call on each internal update.
     * @return Promise the promise of the result.
     */
    async: function async(type, onUpdate) {
        return this.internalStream(type).accumulate(onUpdate);
    },

    /**
     * Prepare the content as a nodejs stream.
     * @param {String} type the type of each chunk.
     * @param {Function} onUpdate a function to call on each internal update.
     * @return Stream the stream.
     */
    nodeStream: function nodeStream(type, onUpdate) {
        return this.internalStream(type || "nodebuffer").toNodejsStream(onUpdate);
    },

    /**
     * Return a worker for the compressed content.
     * @private
     * @param {Object} compression the compression object to use.
     * @param {Object} compressionOptions the options to use when compressing.
     * @return Worker the worker.
     */
    _compressWorker: function _compressWorker(compression, compressionOptions) {
        if (this._data instanceof CompressedObject && this._data.compression.magic === compression.magic) {
            return this._data.getCompressedWorker();
        } else {
            var result = this._decompressWorker();
            if (!this._dataBinary) {
                result = result.pipe(new utf8.Utf8EncodeWorker());
            }
            return CompressedObject.createWorkerFrom(result, compression, compressionOptions);
        }
    },
    /**
     * Return a worker for the decompressed content.
     * @private
     * @return Worker the worker.
     */
    _decompressWorker: function _decompressWorker() {
        if (this._data instanceof CompressedObject) {
            return this._data.getContentWorker();
        } else if (this._data instanceof GenericWorker) {
            return this._data;
        } else {
            return new DataWorker(this._data);
        }
    }
};

var removedMethods = ["asText", "asBinary", "asNodeBuffer", "asUint8Array", "asArrayBuffer"];
var removedFn = function removedFn() {
    throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
};

for (var i = 0; i < removedMethods.length; i++) {
    ZipObject.prototype[removedMethods[i]] = removedFn;
}
module.exports = ZipObject;

/***/ }),

/***/ "aw5X":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = Readable;

/*<replacement>*/
var processNextTick = __webpack_require__("Ji/z");
/*</replacement>*/

/*<replacement>*/
var isArray = __webpack_require__("sOR5");
/*</replacement>*/

/*<replacement>*/
var Buffer = __webpack_require__("fy20").Buffer;
/*</replacement>*/

Readable.ReadableState = ReadableState;

var EE = __webpack_require__("FpCL");

/*<replacement>*/
var EElistenerCount = function EElistenerCount(emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

/*<replacement>*/
var Stream;
(function () {
  try {
    Stream = __webpack_require__("97RM");
  } catch (_) {} finally {
    if (!Stream) Stream = __webpack_require__("FpCL").EventEmitter;
  }
})();
/*</replacement>*/

var Buffer = __webpack_require__("fy20").Buffer;

/*<replacement>*/
var util = __webpack_require__("jOgh");
util.inherits = __webpack_require__("ihNc");
/*</replacement>*/

/*<replacement>*/
var debugUtil = __webpack_require__("Bcfi");
var debug = undefined;
if (debugUtil && debugUtil.debuglog) {
  debug = debugUtil.debuglog('stream');
} else {
  debug = function debug() {};
}
/*</replacement>*/

var StringDecoder;

util.inherits(Readable, Stream);

var Duplex;
function ReadableState(options, stream) {
  Duplex = Duplex || __webpack_require__("g3Lj");

  options = options || {};

  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.readableObjectMode;

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;
  this.resumeScheduled = false;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder) StringDecoder = __webpack_require__("5c6Q").StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

var Duplex;
function Readable(options) {
  Duplex = Duplex || __webpack_require__("g3Lj");

  if (!(this instanceof Readable)) return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  if (options && typeof options.read === 'function') this._read = options.read;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function (chunk, encoding) {
  var state = this._readableState;

  if (!state.objectMode && typeof chunk === 'string') {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = new Buffer(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function (chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

Readable.prototype.isPaused = function () {
  return this._readableState.flowing === false;
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var e = new Error('stream.unshift() after end event');
      stream.emit('error', e);
    } else {
      var skipAdd;
      if (state.decoder && !addToFront && !encoding) {
        chunk = state.decoder.write(chunk);
        skipAdd = !state.objectMode && chunk.length === 0;
      }

      if (!addToFront) state.reading = false;

      // Don't add to the buffer if we've decoded to an empty string chunk and
      // we're not in object mode
      if (!skipAdd) {
        // if we want the data now, just emit it.
        if (state.flowing && state.length === 0 && !state.sync) {
          stream.emit('data', chunk);
          stream.read(0);
        } else {
          // update the buffer info.
          state.length += state.objectMode ? 1 : chunk.length;
          if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);

          if (state.needReadable) emitReadable(stream);
        }
      }

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}

// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function (enc) {
  if (!StringDecoder) StringDecoder = __webpack_require__("5c6Q").StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 8MB
var MAX_HWM = 0x800000;
function computeNewHighWaterMark(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2
    n--;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    n++;
  }
  return n;
}

function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended) return 0;

  if (state.objectMode) return n === 0 ? 0 : 1;

  if (n === null || isNaN(n)) {
    // only flow one buffer at a time
    if (state.flowing && state.buffer.length) return state.buffer[0].length;else return state.length;
  }

  if (n <= 0) return 0;

  // If we're asking for more than the target buffer level,
  // then raise the water mark.  Bump up to the next highest
  // power of 2, to prevent increasing it excessively in tiny
  // amounts.
  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else {
      return state.length;
    }
  }

  return n;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function (n) {
  debug('read', n);
  var state = this._readableState;
  var nOrig = n;

  if (typeof n !== 'number' || n > 0) state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0) endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  }

  if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0) state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
  }

  // If _read pushed data synchronously, then `reading` will be false,
  // and we need to re-evaluate how much data we can return to the user.
  if (doRead && !state.reading) n = howMuchToRead(nOrig, state);

  var ret;
  if (n > 0) ret = fromList(n, state);else ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended) state.needReadable = true;

  // If we tried to read() past the EOF, then emit end on the next tick.
  if (nOrig !== n && state.ended && state.length === 0) endReadable(this);

  if (ret !== null) this.emit('data', ret);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!Buffer.isBuffer(chunk) && typeof chunk !== 'string' && chunk !== null && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}

function onEofChunk(stream, state) {
  if (state.ended) return;
  if (state.decoder) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync) processNextTick(emitReadable_, stream);else emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}

// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    processNextTick(maybeReadMore_, stream, state);
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;else len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function (n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function (dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted) processNextTick(endFn);else src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    debug('onunpipe');
    if (readable === src) {
      cleanup();
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  var cleanedUp = false;
  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);
    src.removeListener('data', ondata);

    cleanedUp = true;

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
  }

  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    var ret = dest.write(chunk);
    if (false === ret) {
      // If the user unpiped during `dest.write()`, it is possible
      // to get stuck in a permanently paused state if that write
      // also returned false.
      if (state.pipesCount === 1 && state.pipes[0] === dest && src.listenerCount('data') === 1 && !cleanedUp) {
        debug('false write response, pause', src._readableState.awaitDrain);
        src._readableState.awaitDrain++;
      }
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EElistenerCount(dest, 'error') === 0) dest.emit('error', er);
  }
  // This is a brutally ugly hack to make sure that our error handler
  // is attached before any userland ones.  NEVER DO THIS.
  if (!dest._events || !dest._events.error) dest.on('error', onerror);else if (isArray(dest._events.error)) dest._events.error.unshift(onerror);else dest._events.error = [onerror, dest._events.error];

  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function () {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain) state.awaitDrain--;
    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}

Readable.prototype.unpipe = function (dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0) return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes) return this;

    if (!dest) dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest) dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var _i = 0; _i < len; _i++) {
      dests[_i].emit('unpipe', this);
    }return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1) return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1) state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function (ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  // If listening to data, and it has not explicitly been paused,
  // then call resume to start the flow of data on the next tick.
  if (ev === 'data' && false !== this._readableState.flowing) {
    this.resume();
  }

  if (ev === 'readable' && !this._readableState.endEmitted) {
    var state = this._readableState;
    if (!state.readableListening) {
      state.readableListening = true;
      state.emittedReadable = false;
      state.needReadable = true;
      if (!state.reading) {
        processNextTick(nReadingNextTick, this);
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  self.read(0);
}

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function () {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    processNextTick(resume_, stream, state);
  }
}

function resume_(stream, state) {
  if (!state.reading) {
    debug('resume read 0');
    stream.read(0);
  }

  state.resumeScheduled = false;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading) stream.read(0);
}

Readable.prototype.pause = function () {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  if (state.flowing) {
    do {
      var chunk = stream.read();
    } while (null !== chunk && state.flowing);
  }
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function (stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function () {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length) self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function (chunk) {
    debug('wrapped data');
    if (state.decoder) chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (this[i] === undefined && typeof stream[i] === 'function') {
      this[i] = function (method) {
        return function () {
          return stream[method].apply(stream, arguments);
        };
      }(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function (ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function (n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};

// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, state) {
  var list = state.buffer;
  var length = state.length;
  var stringMode = !!state.decoder;
  var objectMode = !!state.objectMode;
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0) return null;

  if (length === 0) ret = null;else if (objectMode) ret = list.shift();else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode) ret = list.join('');else if (list.length === 1) ret = list[0];else ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode) ret = '';else ret = new Buffer(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var buf = list[0];
        var cpy = Math.min(n - c, buf.length);

        if (stringMode) ret += buf.slice(0, cpy);else buf.copy(ret, c, 0, cpy);

        if (cpy < buf.length) list[0] = buf.slice(cpy);else list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0) throw new Error('endReadable called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    processNextTick(endReadableNT, state, stream);
  }
}

function endReadableNT(state, stream) {
  // Check that we didn't get one last unshift.
  if (!state.endEmitted && state.length === 0) {
    state.endEmitted = true;
    stream.readable = false;
    stream.emit('end');
  }
}

function forEach(xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf(xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}

/***/ }),

/***/ "bNE/":
/***/ (function(module, exports, __webpack_require__) {

module.exports = !__webpack_require__("ismg") && !__webpack_require__("a1Qx")(function () {
  return Object.defineProperty(__webpack_require__("8vkY")('div'), 'a', { get: function get() {
      return 7;
    } }).a != 7;
});

/***/ }),

/***/ "bxoG":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/**
 * A worker that does nothing but passing chunks to the next one. This is like
 * a nodejs stream but with some differences. On the good side :
 * - it works on IE 6-9 without any issue / polyfill
 * - it weights less than the full dependencies bundled with browserify
 * - it forwards errors (no need to declare an error handler EVERYWHERE)
 *
 * A chunk is an object with 2 attributes : `meta` and `data`. The former is an
 * object containing anything (`percent` for example), see each worker for more
 * details. The latter is the real data (String, Uint8Array, etc).
 *
 * @constructor
 * @param {String} name the name of the stream (mainly used for debugging purposes)
 */

function GenericWorker(name) {
    // the name of the worker
    this.name = name || "default";
    // an object containing metadata about the workers chain
    this.streamInfo = {};
    // an error which happened when the worker was paused
    this.generatedError = null;
    // an object containing metadata to be merged by this worker into the general metadata
    this.extraStreamInfo = {};
    // true if the stream is paused (and should not do anything), false otherwise
    this.isPaused = true;
    // true if the stream is finished (and should not do anything), false otherwise
    this.isFinished = false;
    // true if the stream is locked to prevent further structure updates (pipe), false otherwise
    this.isLocked = false;
    // the event listeners
    this._listeners = {
        'data': [],
        'end': [],
        'error': []
    };
    // the previous worker, if any
    this.previous = null;
}

GenericWorker.prototype = {
    /**
     * Push a chunk to the next workers.
     * @param {Object} chunk the chunk to push
     */
    push: function push(chunk) {
        this.emit("data", chunk);
    },
    /**
     * End the stream.
     * @return {Boolean} true if this call ended the worker, false otherwise.
     */
    end: function end() {
        if (this.isFinished) {
            return false;
        }

        this.flush();
        try {
            this.emit("end");
            this.cleanUp();
            this.isFinished = true;
        } catch (e) {
            this.emit("error", e);
        }
        return true;
    },
    /**
     * End the stream with an error.
     * @param {Error} e the error which caused the premature end.
     * @return {Boolean} true if this call ended the worker with an error, false otherwise.
     */
    error: function error(e) {
        if (this.isFinished) {
            return false;
        }

        if (this.isPaused) {
            this.generatedError = e;
        } else {
            this.isFinished = true;

            this.emit("error", e);

            // in the workers chain exploded in the middle of the chain,
            // the error event will go downward but we also need to notify
            // workers upward that there has been an error.
            if (this.previous) {
                this.previous.error(e);
            }

            this.cleanUp();
        }
        return true;
    },
    /**
     * Add a callback on an event.
     * @param {String} name the name of the event (data, end, error)
     * @param {Function} listener the function to call when the event is triggered
     * @return {GenericWorker} the current object for chainability
     */
    on: function on(name, listener) {
        this._listeners[name].push(listener);
        return this;
    },
    /**
     * Clean any references when a worker is ending.
     */
    cleanUp: function cleanUp() {
        this.streamInfo = this.generatedError = this.extraStreamInfo = null;
        this._listeners = [];
    },
    /**
     * Trigger an event. This will call registered callback with the provided arg.
     * @param {String} name the name of the event (data, end, error)
     * @param {Object} arg the argument to call the callback with.
     */
    emit: function emit(name, arg) {
        if (this._listeners[name]) {
            for (var i = 0; i < this._listeners[name].length; i++) {
                this._listeners[name][i].call(this, arg);
            }
        }
    },
    /**
     * Chain a worker with an other.
     * @param {Worker} next the worker receiving events from the current one.
     * @return {worker} the next worker for chainability
     */
    pipe: function pipe(next) {
        return next.registerPrevious(this);
    },
    /**
     * Same as `pipe` in the other direction.
     * Using an API with `pipe(next)` is very easy.
     * Implementing the API with the point of view of the next one registering
     * a source is easier, see the ZipFileWorker.
     * @param {Worker} previous the previous worker, sending events to this one
     * @return {Worker} the current worker for chainability
     */
    registerPrevious: function registerPrevious(previous) {
        if (this.isLocked) {
            throw new Error("The stream '" + this + "' has already been used.");
        }

        // sharing the streamInfo...
        this.streamInfo = previous.streamInfo;
        // ... and adding our own bits
        this.mergeStreamInfo();
        this.previous = previous;
        var self = this;
        previous.on('data', function (chunk) {
            self.processChunk(chunk);
        });
        previous.on('end', function () {
            self.end();
        });
        previous.on('error', function (e) {
            self.error(e);
        });
        return this;
    },
    /**
     * Pause the stream so it doesn't send events anymore.
     * @return {Boolean} true if this call paused the worker, false otherwise.
     */
    pause: function pause() {
        if (this.isPaused || this.isFinished) {
            return false;
        }
        this.isPaused = true;

        if (this.previous) {
            this.previous.pause();
        }
        return true;
    },
    /**
     * Resume a paused stream.
     * @return {Boolean} true if this call resumed the worker, false otherwise.
     */
    resume: function resume() {
        if (!this.isPaused || this.isFinished) {
            return false;
        }
        this.isPaused = false;

        // if true, the worker tried to resume but failed
        var withError = false;
        if (this.generatedError) {
            this.error(this.generatedError);
            withError = true;
        }
        if (this.previous) {
            this.previous.resume();
        }

        return !withError;
    },
    /**
     * Flush any remaining bytes as the stream is ending.
     */
    flush: function flush() {},
    /**
     * Process a chunk. This is usually the method overridden.
     * @param {Object} chunk the chunk to process.
     */
    processChunk: function processChunk(chunk) {
        this.push(chunk);
    },
    /**
     * Add a key/value to be added in the workers chain streamInfo once activated.
     * @param {String} key the key to use
     * @param {Object} value the associated value
     * @return {Worker} the current worker for chainability
     */
    withStreamInfo: function withStreamInfo(key, value) {
        this.extraStreamInfo[key] = value;
        this.mergeStreamInfo();
        return this;
    },
    /**
     * Merge this worker's streamInfo into the chain's streamInfo.
     */
    mergeStreamInfo: function mergeStreamInfo() {
        for (var key in this.extraStreamInfo) {
            if (!this.extraStreamInfo.hasOwnProperty(key)) {
                continue;
            }
            this.streamInfo[key] = this.extraStreamInfo[key];
        }
    },

    /**
     * Lock the stream to prevent further updates on the workers chain.
     * After calling this method, all calls to pipe will fail.
     */
    lock: function lock() {
        if (this.isLocked) {
            throw new Error("The stream '" + this + "' has already been used.");
        }
        this.isLocked = true;
        if (this.previous) {
            this.previous.lock();
        }
    },

    /**
     *
     * Pretty print the workers chain.
     */
    toString: function toString() {
        var me = "Worker " + this.name;
        if (this.previous) {
            return this.previous + " -> " + me;
        } else {
            return me;
        }
    }
};

module.exports = GenericWorker;

/***/ }),

/***/ "dL6i":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var ArrayReader = __webpack_require__("hjG0");
var utils = __webpack_require__("71nt");

function Uint8ArrayReader(data) {
    ArrayReader.call(this, data);
}
utils.inherits(Uint8ArrayReader, ArrayReader);
/**
 * @see DataReader.readData
 */
Uint8ArrayReader.prototype.readData = function (size) {
    this.checkOffset(size);
    if (size === 0) {
        // in IE10, when using subarray(idx, idx), we get the array [0x00] instead of [].
        return new Uint8Array(0);
    }
    var result = this.data.subarray(this.zero + this.index, this.zero + this.index + size);
    this.index += size;
    return result;
};
module.exports = Uint8ArrayReader;

/***/ }),

/***/ "dUfp":
/***/ (function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ }),

/***/ "e3b7":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.base64 = false;
exports.binary = false;
exports.dir = false;
exports.createFolders = true;
exports.date = null;
exports.compression = null;
exports.compressionOptions = null;
exports.comment = null;
exports.unixPermissions = null;
exports.dosPermissions = null;

/***/ }),

/***/ "eX64":
/***/ (function(module, exports) {

var core = module.exports = { version: '2.3.0' };
if (typeof __e == 'number') __e = core; // eslint-disable-line no-undef

/***/ }),

/***/ "f1Cs":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var readerFor = __webpack_require__("Gquf");
var utils = __webpack_require__("71nt");
var sig = __webpack_require__("j3u2");
var ZipEntry = __webpack_require__("65V/");
var utf8 = __webpack_require__("Ed4+");
var support = __webpack_require__("oKij");
//  class ZipEntries {{{
/**
 * All the entries in the zip file.
 * @constructor
 * @param {Object} loadOptions Options for loading the stream.
 */
function ZipEntries(loadOptions) {
    this.files = [];
    this.loadOptions = loadOptions;
}
ZipEntries.prototype = {
    /**
     * Check that the reader is on the specified signature.
     * @param {string} expectedSignature the expected signature.
     * @throws {Error} if it is an other signature.
     */
    checkSignature: function checkSignature(expectedSignature) {
        if (!this.reader.readAndCheckSignature(expectedSignature)) {
            this.reader.index -= 4;
            var signature = this.reader.readString(4);
            throw new Error("Corrupted zip or bug: unexpected signature " + "(" + utils.pretty(signature) + ", expected " + utils.pretty(expectedSignature) + ")");
        }
    },
    /**
     * Check if the given signature is at the given index.
     * @param {number} askedIndex the index to check.
     * @param {string} expectedSignature the signature to expect.
     * @return {boolean} true if the signature is here, false otherwise.
     */
    isSignature: function isSignature(askedIndex, expectedSignature) {
        var currentIndex = this.reader.index;
        this.reader.setIndex(askedIndex);
        var signature = this.reader.readString(4);
        var result = signature === expectedSignature;
        this.reader.setIndex(currentIndex);
        return result;
    },
    /**
     * Read the end of the central directory.
     */
    readBlockEndOfCentral: function readBlockEndOfCentral() {
        this.diskNumber = this.reader.readInt(2);
        this.diskWithCentralDirStart = this.reader.readInt(2);
        this.centralDirRecordsOnThisDisk = this.reader.readInt(2);
        this.centralDirRecords = this.reader.readInt(2);
        this.centralDirSize = this.reader.readInt(4);
        this.centralDirOffset = this.reader.readInt(4);

        this.zipCommentLength = this.reader.readInt(2);
        // warning : the encoding depends of the system locale
        // On a linux machine with LANG=en_US.utf8, this field is utf8 encoded.
        // On a windows machine, this field is encoded with the localized windows code page.
        var zipComment = this.reader.readData(this.zipCommentLength);
        var decodeParamType = support.uint8array ? "uint8array" : "array";
        // To get consistent behavior with the generation part, we will assume that
        // this is utf8 encoded unless specified otherwise.
        var decodeContent = utils.transformTo(decodeParamType, zipComment);
        this.zipComment = this.loadOptions.decodeFileName(decodeContent);
    },
    /**
     * Read the end of the Zip 64 central directory.
     * Not merged with the method readEndOfCentral :
     * The end of central can coexist with its Zip64 brother,
     * I don't want to read the wrong number of bytes !
     */
    readBlockZip64EndOfCentral: function readBlockZip64EndOfCentral() {
        this.zip64EndOfCentralSize = this.reader.readInt(8);
        this.reader.skip(4);
        // this.versionMadeBy = this.reader.readString(2);
        // this.versionNeeded = this.reader.readInt(2);
        this.diskNumber = this.reader.readInt(4);
        this.diskWithCentralDirStart = this.reader.readInt(4);
        this.centralDirRecordsOnThisDisk = this.reader.readInt(8);
        this.centralDirRecords = this.reader.readInt(8);
        this.centralDirSize = this.reader.readInt(8);
        this.centralDirOffset = this.reader.readInt(8);

        this.zip64ExtensibleData = {};
        var extraDataSize = this.zip64EndOfCentralSize - 44,
            index = 0,
            extraFieldId,
            extraFieldLength,
            extraFieldValue;
        while (index < extraDataSize) {
            extraFieldId = this.reader.readInt(2);
            extraFieldLength = this.reader.readInt(4);
            extraFieldValue = this.reader.readData(extraFieldLength);
            this.zip64ExtensibleData[extraFieldId] = {
                id: extraFieldId,
                length: extraFieldLength,
                value: extraFieldValue
            };
        }
    },
    /**
     * Read the end of the Zip 64 central directory locator.
     */
    readBlockZip64EndOfCentralLocator: function readBlockZip64EndOfCentralLocator() {
        this.diskWithZip64CentralDirStart = this.reader.readInt(4);
        this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8);
        this.disksCount = this.reader.readInt(4);
        if (this.disksCount > 1) {
            throw new Error("Multi-volumes zip are not supported");
        }
    },
    /**
     * Read the local files, based on the offset read in the central part.
     */
    readLocalFiles: function readLocalFiles() {
        var i, file;
        for (i = 0; i < this.files.length; i++) {
            file = this.files[i];
            this.reader.setIndex(file.localHeaderOffset);
            this.checkSignature(sig.LOCAL_FILE_HEADER);
            file.readLocalPart(this.reader);
            file.handleUTF8();
            file.processAttributes();
        }
    },
    /**
     * Read the central directory.
     */
    readCentralDir: function readCentralDir() {
        var file;

        this.reader.setIndex(this.centralDirOffset);
        while (this.reader.readAndCheckSignature(sig.CENTRAL_FILE_HEADER)) {
            file = new ZipEntry({
                zip64: this.zip64
            }, this.loadOptions);
            file.readCentralPart(this.reader);
            this.files.push(file);
        }

        if (this.centralDirRecords !== this.files.length) {
            if (this.centralDirRecords !== 0 && this.files.length === 0) {
                // We expected some records but couldn't find ANY.
                // This is really suspicious, as if something went wrong.
                throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length);
            } else {
                // We found some records but not all.
                // Something is wrong but we got something for the user: no error here.
                // console.warn("expected", this.centralDirRecords, "records in central dir, got", this.files.length);
            }
        }
    },
    /**
     * Read the end of central directory.
     */
    readEndOfCentral: function readEndOfCentral() {
        var offset = this.reader.lastIndexOfSignature(sig.CENTRAL_DIRECTORY_END);
        if (offset < 0) {
            // Check if the content is a truncated zip or complete garbage.
            // A "LOCAL_FILE_HEADER" is not required at the beginning (auto
            // extractible zip for example) but it can give a good hint.
            // If an ajax request was used without responseType, we will also
            // get unreadable data.
            var isGarbage = !this.isSignature(0, sig.LOCAL_FILE_HEADER);

            if (isGarbage) {
                throw new Error("Can't find end of central directory : is this a zip file ? " + "If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html");
            } else {
                throw new Error("Corrupted zip: can't find end of central directory");
            }
        }
        this.reader.setIndex(offset);
        var endOfCentralDirOffset = offset;
        this.checkSignature(sig.CENTRAL_DIRECTORY_END);
        this.readBlockEndOfCentral();

        /* extract from the zip spec :
            4)  If one of the fields in the end of central directory
                record is too small to hold required data, the field
                should be set to -1 (0xFFFF or 0xFFFFFFFF) and the
                ZIP64 format record should be created.
            5)  The end of central directory record and the
                Zip64 end of central directory locator record must
                reside on the same disk when splitting or spanning
                an archive.
         */
        if (this.diskNumber === utils.MAX_VALUE_16BITS || this.diskWithCentralDirStart === utils.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === utils.MAX_VALUE_16BITS || this.centralDirRecords === utils.MAX_VALUE_16BITS || this.centralDirSize === utils.MAX_VALUE_32BITS || this.centralDirOffset === utils.MAX_VALUE_32BITS) {
            this.zip64 = true;

            /*
            Warning : the zip64 extension is supported, but ONLY if the 64bits integer read from
            the zip file can fit into a 32bits integer. This cannot be solved : JavaScript represents
            all numbers as 64-bit double precision IEEE 754 floating point numbers.
            So, we have 53bits for integers and bitwise operations treat everything as 32bits.
            see https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Operators/Bitwise_Operators
            and http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-262.pdf section 8.5
            */

            // should look for a zip64 EOCD locator
            offset = this.reader.lastIndexOfSignature(sig.ZIP64_CENTRAL_DIRECTORY_LOCATOR);
            if (offset < 0) {
                throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
            }
            this.reader.setIndex(offset);
            this.checkSignature(sig.ZIP64_CENTRAL_DIRECTORY_LOCATOR);
            this.readBlockZip64EndOfCentralLocator();

            // now the zip64 EOCD record
            if (!this.isSignature(this.relativeOffsetEndOfZip64CentralDir, sig.ZIP64_CENTRAL_DIRECTORY_END)) {
                // console.warn("ZIP64 end of central directory not where expected.");
                this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(sig.ZIP64_CENTRAL_DIRECTORY_END);
                if (this.relativeOffsetEndOfZip64CentralDir < 0) {
                    throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
                }
            }
            this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir);
            this.checkSignature(sig.ZIP64_CENTRAL_DIRECTORY_END);
            this.readBlockZip64EndOfCentral();
        }

        var expectedEndOfCentralDirOffset = this.centralDirOffset + this.centralDirSize;
        if (this.zip64) {
            expectedEndOfCentralDirOffset += 20; // end of central dir 64 locator
            expectedEndOfCentralDirOffset += 12 /* should not include the leading 12 bytes */ + this.zip64EndOfCentralSize;
        }

        var extraBytes = endOfCentralDirOffset - expectedEndOfCentralDirOffset;

        if (extraBytes > 0) {
            // console.warn(extraBytes, "extra bytes at beginning or within zipfile");
            if (this.isSignature(endOfCentralDirOffset, sig.CENTRAL_FILE_HEADER)) {
                // The offsets seem wrong, but we have something at the specified offset.
                // So… we keep it.
            } else {
                // the offset is wrong, update the "zero" of the reader
                // this happens if data has been prepended (crx files for example)
                this.reader.zero = extraBytes;
            }
        } else if (extraBytes < 0) {
            throw new Error("Corrupted zip: missing " + Math.abs(extraBytes) + " bytes.");
        }
    },
    prepareReader: function prepareReader(data) {
        this.reader = readerFor(data);
    },
    /**
     * Read a zip file and create ZipEntries.
     * @param {String|ArrayBuffer|Uint8Array|Buffer} data the binary string representing a zip file.
     */
    load: function load(data) {
        this.prepareReader(data);
        this.readEndOfCentral();
        this.readCentralDir();
        this.readLocalFiles();
    }
};
// }}} end of ZipEntries
module.exports = ZipEntries;

/***/ }),

/***/ "fkix":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var utils = __webpack_require__("gt5T");
var adler32 = __webpack_require__("KpjM");
var crc32 = __webpack_require__("2WCG");
var inflate_fast = __webpack_require__("Un+M");
var inflate_table = __webpack_require__("K0S7");

var CODES = 0;
var LENS = 1;
var DISTS = 2;

/* Public constants ==========================================================*/
/* ===========================================================================*/

/* Allowed flush values; see deflate() and inflate() below for details */
//var Z_NO_FLUSH      = 0;
//var Z_PARTIAL_FLUSH = 1;
//var Z_SYNC_FLUSH    = 2;
//var Z_FULL_FLUSH    = 3;
var Z_FINISH = 4;
var Z_BLOCK = 5;
var Z_TREES = 6;

/* Return codes for the compression/decompression functions. Negative values
 * are errors, positive values are used for special but normal events.
 */
var Z_OK = 0;
var Z_STREAM_END = 1;
var Z_NEED_DICT = 2;
//var Z_ERRNO         = -1;
var Z_STREAM_ERROR = -2;
var Z_DATA_ERROR = -3;
var Z_MEM_ERROR = -4;
var Z_BUF_ERROR = -5;
//var Z_VERSION_ERROR = -6;

/* The deflate compression method */
var Z_DEFLATED = 8;

/* STATES ====================================================================*/
/* ===========================================================================*/

var HEAD = 1; /* i: waiting for magic header */
var FLAGS = 2; /* i: waiting for method and flags (gzip) */
var TIME = 3; /* i: waiting for modification time (gzip) */
var OS = 4; /* i: waiting for extra flags and operating system (gzip) */
var EXLEN = 5; /* i: waiting for extra length (gzip) */
var EXTRA = 6; /* i: waiting for extra bytes (gzip) */
var NAME = 7; /* i: waiting for end of file name (gzip) */
var COMMENT = 8; /* i: waiting for end of comment (gzip) */
var HCRC = 9; /* i: waiting for header crc (gzip) */
var DICTID = 10; /* i: waiting for dictionary check value */
var DICT = 11; /* waiting for inflateSetDictionary() call */
var TYPE = 12; /* i: waiting for type bits, including last-flag bit */
var TYPEDO = 13; /* i: same, but skip check to exit inflate on new block */
var STORED = 14; /* i: waiting for stored size (length and complement) */
var COPY_ = 15; /* i/o: same as COPY below, but only first time in */
var COPY = 16; /* i/o: waiting for input or output to copy stored block */
var TABLE = 17; /* i: waiting for dynamic block table lengths */
var LENLENS = 18; /* i: waiting for code length code lengths */
var CODELENS = 19; /* i: waiting for length/lit and distance code lengths */
var LEN_ = 20; /* i: same as LEN below, but only first time in */
var LEN = 21; /* i: waiting for length/lit/eob code */
var LENEXT = 22; /* i: waiting for length extra bits */
var DIST = 23; /* i: waiting for distance code */
var DISTEXT = 24; /* i: waiting for distance extra bits */
var MATCH = 25; /* o: waiting for output space to copy string */
var LIT = 26; /* o: waiting for output space to write literal */
var CHECK = 27; /* i: waiting for 32-bit check value */
var LENGTH = 28; /* i: waiting for 32-bit length (gzip) */
var DONE = 29; /* finished check, done -- remain here until reset */
var BAD = 30; /* got a data error -- remain here until reset */
var MEM = 31; /* got an inflate() memory error -- remain here until reset */
var SYNC = 32; /* looking for synchronization bytes to restart inflate() */

/* ===========================================================================*/

var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
//var ENOUGH =  (ENOUGH_LENS+ENOUGH_DISTS);

var MAX_WBITS = 15;
/* 32K LZ77 window */
var DEF_WBITS = MAX_WBITS;

function zswap32(q) {
  return (q >>> 24 & 0xff) + (q >>> 8 & 0xff00) + ((q & 0xff00) << 8) + ((q & 0xff) << 24);
}

function InflateState() {
  this.mode = 0; /* current inflate mode */
  this.last = false; /* true if processing last block */
  this.wrap = 0; /* bit 0 true for zlib, bit 1 true for gzip */
  this.havedict = false; /* true if dictionary provided */
  this.flags = 0; /* gzip header method and flags (0 if zlib) */
  this.dmax = 0; /* zlib header max distance (INFLATE_STRICT) */
  this.check = 0; /* protected copy of check value */
  this.total = 0; /* protected copy of output count */
  // TODO: may be {}
  this.head = null; /* where to save gzip header information */

  /* sliding window */
  this.wbits = 0; /* log base 2 of requested window size */
  this.wsize = 0; /* window size or zero if not using window */
  this.whave = 0; /* valid bytes in the window */
  this.wnext = 0; /* window write index */
  this.window = null; /* allocated sliding window, if needed */

  /* bit accumulator */
  this.hold = 0; /* input bit accumulator */
  this.bits = 0; /* number of bits in "in" */

  /* for string and stored block copying */
  this.length = 0; /* literal or length of data to copy */
  this.offset = 0; /* distance back to copy string from */

  /* for table and code decoding */
  this.extra = 0; /* extra bits needed */

  /* fixed and dynamic code tables */
  this.lencode = null; /* starting table for length/literal codes */
  this.distcode = null; /* starting table for distance codes */
  this.lenbits = 0; /* index bits for lencode */
  this.distbits = 0; /* index bits for distcode */

  /* dynamic table building */
  this.ncode = 0; /* number of code length code lengths */
  this.nlen = 0; /* number of length code lengths */
  this.ndist = 0; /* number of distance code lengths */
  this.have = 0; /* number of code lengths in lens[] */
  this.next = null; /* next available space in codes[] */

  this.lens = new utils.Buf16(320); /* temporary storage for code lengths */
  this.work = new utils.Buf16(288); /* work area for code table building */

  /*
   because we don't have pointers in js, we use lencode and distcode directly
   as buffers so we don't need codes
  */
  //this.codes = new utils.Buf32(ENOUGH);       /* space for code tables */
  this.lendyn = null; /* dynamic table for length/literal codes (JS specific) */
  this.distdyn = null; /* dynamic table for distance codes (JS specific) */
  this.sane = 0; /* if false, allow invalid distance too far */
  this.back = 0; /* bits back of last unprocessed length/lit */
  this.was = 0; /* initial length of match */
}

function inflateResetKeep(strm) {
  var state;

  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  state = strm.state;
  strm.total_in = strm.total_out = state.total = 0;
  strm.msg = ''; /*Z_NULL*/
  if (state.wrap) {
    /* to support ill-conceived Java test suite */
    strm.adler = state.wrap & 1;
  }
  state.mode = HEAD;
  state.last = 0;
  state.havedict = 0;
  state.dmax = 32768;
  state.head = null /*Z_NULL*/;
  state.hold = 0;
  state.bits = 0;
  //state.lencode = state.distcode = state.next = state.codes;
  state.lencode = state.lendyn = new utils.Buf32(ENOUGH_LENS);
  state.distcode = state.distdyn = new utils.Buf32(ENOUGH_DISTS);

  state.sane = 1;
  state.back = -1;
  //Tracev((stderr, "inflate: reset\n"));
  return Z_OK;
}

function inflateReset(strm) {
  var state;

  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  state = strm.state;
  state.wsize = 0;
  state.whave = 0;
  state.wnext = 0;
  return inflateResetKeep(strm);
}

function inflateReset2(strm, windowBits) {
  var wrap;
  var state;

  /* get the state */
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  state = strm.state;

  /* extract wrap request from windowBits parameter */
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else {
    wrap = (windowBits >> 4) + 1;
    if (windowBits < 48) {
      windowBits &= 15;
    }
  }

  /* set number of window bits, free window if different */
  if (windowBits && (windowBits < 8 || windowBits > 15)) {
    return Z_STREAM_ERROR;
  }
  if (state.window !== null && state.wbits !== windowBits) {
    state.window = null;
  }

  /* update state and reset the rest of it */
  state.wrap = wrap;
  state.wbits = windowBits;
  return inflateReset(strm);
}

function inflateInit2(strm, windowBits) {
  var ret;
  var state;

  if (!strm) {
    return Z_STREAM_ERROR;
  }
  //strm.msg = Z_NULL;                 /* in case we return an error */

  state = new InflateState();

  //if (state === Z_NULL) return Z_MEM_ERROR;
  //Tracev((stderr, "inflate: allocated\n"));
  strm.state = state;
  state.window = null /*Z_NULL*/;
  ret = inflateReset2(strm, windowBits);
  if (ret !== Z_OK) {
    strm.state = null /*Z_NULL*/;
  }
  return ret;
}

function inflateInit(strm) {
  return inflateInit2(strm, DEF_WBITS);
}

/*
 Return state with length and distance decoding tables and index sizes set to
 fixed code decoding.  Normally this returns fixed tables from inffixed.h.
 If BUILDFIXED is defined, then instead this routine builds the tables the
 first time it's called, and returns those tables the first time and
 thereafter.  This reduces the size of the code by about 2K bytes, in
 exchange for a little execution time.  However, BUILDFIXED should not be
 used for threaded applications, since the rewriting of the tables and virgin
 may not be thread-safe.
 */
var virgin = true;

var lenfix, distfix; // We have no pointers in JS, so keep tables separate

function fixedtables(state) {
  /* build fixed huffman tables if first call (may not be thread safe) */
  if (virgin) {
    var sym;

    lenfix = new utils.Buf32(512);
    distfix = new utils.Buf32(32);

    /* literal/length table */
    sym = 0;
    while (sym < 144) {
      state.lens[sym++] = 8;
    }
    while (sym < 256) {
      state.lens[sym++] = 9;
    }
    while (sym < 280) {
      state.lens[sym++] = 7;
    }
    while (sym < 288) {
      state.lens[sym++] = 8;
    }

    inflate_table(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });

    /* distance table */
    sym = 0;
    while (sym < 32) {
      state.lens[sym++] = 5;
    }

    inflate_table(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });

    /* do this just once */
    virgin = false;
  }

  state.lencode = lenfix;
  state.lenbits = 9;
  state.distcode = distfix;
  state.distbits = 5;
}

/*
 Update the window with the last wsize (normally 32K) bytes written before
 returning.  If window does not exist yet, create it.  This is only called
 when a window is already in use, or when output has been written during this
 inflate call, but the end of the deflate stream has not been reached yet.
 It is also called to create a window for dictionary data when a dictionary
 is loaded.

 Providing output buffers larger than 32K to inflate() should provide a speed
 advantage, since only the last 32K of output is copied to the sliding window
 upon return from inflate(), and since all distances after the first 32K of
 output will fall in the output data, making match copies simpler and faster.
 The advantage may be dependent on the size of the processor's data caches.
 */
function updatewindow(strm, src, end, copy) {
  var dist;
  var state = strm.state;

  /* if it hasn't been done already, allocate space for the window */
  if (state.window === null) {
    state.wsize = 1 << state.wbits;
    state.wnext = 0;
    state.whave = 0;

    state.window = new utils.Buf8(state.wsize);
  }

  /* copy state->wsize or less output bytes into the circular window */
  if (copy >= state.wsize) {
    utils.arraySet(state.window, src, end - state.wsize, state.wsize, 0);
    state.wnext = 0;
    state.whave = state.wsize;
  } else {
    dist = state.wsize - state.wnext;
    if (dist > copy) {
      dist = copy;
    }
    //zmemcpy(state->window + state->wnext, end - copy, dist);
    utils.arraySet(state.window, src, end - copy, dist, state.wnext);
    copy -= dist;
    if (copy) {
      //zmemcpy(state->window, end - copy, copy);
      utils.arraySet(state.window, src, end - copy, copy, 0);
      state.wnext = copy;
      state.whave = state.wsize;
    } else {
      state.wnext += dist;
      if (state.wnext === state.wsize) {
        state.wnext = 0;
      }
      if (state.whave < state.wsize) {
        state.whave += dist;
      }
    }
  }
  return 0;
}

function inflate(strm, flush) {
  var state;
  var input, output; // input/output buffers
  var next; /* next input INDEX */
  var put; /* next output INDEX */
  var have, left; /* available input and output */
  var hold; /* bit buffer */
  var bits; /* bits in bit buffer */
  var _in, _out; /* save starting available input and output */
  var copy; /* number of stored or match bytes to copy */
  var from; /* where to copy match bytes from */
  var from_source;
  var here = 0; /* current decoding table entry */
  var here_bits, here_op, here_val; // paked "here" denormalized (JS specific)
  //var last;                   /* parent table entry */
  var last_bits, last_op, last_val; // paked "last" denormalized (JS specific)
  var len; /* length to copy for repeats, bits to drop */
  var ret; /* return code */
  var hbuf = new utils.Buf8(4); /* buffer for gzip header crc calculation */
  var opts;

  var n; // temporary var for NEED_BITS

  var order = /* permutation of code lengths */
  [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  if (!strm || !strm.state || !strm.output || !strm.input && strm.avail_in !== 0) {
    return Z_STREAM_ERROR;
  }

  state = strm.state;
  if (state.mode === TYPE) {
    state.mode = TYPEDO;
  } /* skip check */

  //--- LOAD() ---
  put = strm.next_out;
  output = strm.output;
  left = strm.avail_out;
  next = strm.next_in;
  input = strm.input;
  have = strm.avail_in;
  hold = state.hold;
  bits = state.bits;
  //---

  _in = have;
  _out = left;
  ret = Z_OK;

  inf_leave: // goto emulation
  for (;;) {
    switch (state.mode) {
      case HEAD:
        if (state.wrap === 0) {
          state.mode = TYPEDO;
          break;
        }
        //=== NEEDBITS(16);
        while (bits < 16) {
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if (state.wrap & 2 && hold === 0x8b1f) {
          /* gzip header */
          state.check = 0 /*crc32(0L, Z_NULL, 0)*/;
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff;
          hbuf[1] = hold >>> 8 & 0xff;
          state.check = crc32(state.check, hbuf, 2, 0);
          //===//

          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          state.mode = FLAGS;
          break;
        }
        state.flags = 0; /* expect zlib header */
        if (state.head) {
          state.head.done = false;
        }
        if (!(state.wrap & 1) || /* check if zlib header allowed */
        (((hold & 0xff) << /*BITS(8)*/8) + (hold >> 8)) % 31) {
          strm.msg = 'incorrect header check';
          state.mode = BAD;
          break;
        }
        if ((hold & 0x0f) !== /*BITS(4)*/Z_DEFLATED) {
          strm.msg = 'unknown compression method';
          state.mode = BAD;
          break;
        }
        //--- DROPBITS(4) ---//
        hold >>>= 4;
        bits -= 4;
        //---//
        len = (hold & 0x0f) + /*BITS(4)*/8;
        if (state.wbits === 0) {
          state.wbits = len;
        } else if (len > state.wbits) {
          strm.msg = 'invalid window size';
          state.mode = BAD;
          break;
        }
        state.dmax = 1 << len;
        //Tracev((stderr, "inflate:   zlib header ok\n"));
        strm.adler = state.check = 1 /*adler32(0L, Z_NULL, 0)*/;
        state.mode = hold & 0x200 ? DICTID : TYPE;
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        break;
      case FLAGS:
        //=== NEEDBITS(16); */
        while (bits < 16) {
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.flags = hold;
        if ((state.flags & 0xff) !== Z_DEFLATED) {
          strm.msg = 'unknown compression method';
          state.mode = BAD;
          break;
        }
        if (state.flags & 0xe000) {
          strm.msg = 'unknown header flags set';
          state.mode = BAD;
          break;
        }
        if (state.head) {
          state.head.text = hold >> 8 & 1;
        }
        if (state.flags & 0x0200) {
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff;
          hbuf[1] = hold >>> 8 & 0xff;
          state.check = crc32(state.check, hbuf, 2, 0);
          //===//
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = TIME;
      /* falls through */
      case TIME:
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if (state.head) {
          state.head.time = hold;
        }
        if (state.flags & 0x0200) {
          //=== CRC4(state.check, hold)
          hbuf[0] = hold & 0xff;
          hbuf[1] = hold >>> 8 & 0xff;
          hbuf[2] = hold >>> 16 & 0xff;
          hbuf[3] = hold >>> 24 & 0xff;
          state.check = crc32(state.check, hbuf, 4, 0);
          //===
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = OS;
      /* falls through */
      case OS:
        //=== NEEDBITS(16); */
        while (bits < 16) {
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if (state.head) {
          state.head.xflags = hold & 0xff;
          state.head.os = hold >> 8;
        }
        if (state.flags & 0x0200) {
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff;
          hbuf[1] = hold >>> 8 & 0xff;
          state.check = crc32(state.check, hbuf, 2, 0);
          //===//
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = EXLEN;
      /* falls through */
      case EXLEN:
        if (state.flags & 0x0400) {
          //=== NEEDBITS(16); */
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.length = hold;
          if (state.head) {
            state.head.extra_len = hold;
          }
          if (state.flags & 0x0200) {
            //=== CRC2(state.check, hold);
            hbuf[0] = hold & 0xff;
            hbuf[1] = hold >>> 8 & 0xff;
            state.check = crc32(state.check, hbuf, 2, 0);
            //===//
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
        } else if (state.head) {
          state.head.extra = null /*Z_NULL*/;
        }
        state.mode = EXTRA;
      /* falls through */
      case EXTRA:
        if (state.flags & 0x0400) {
          copy = state.length;
          if (copy > have) {
            copy = have;
          }
          if (copy) {
            if (state.head) {
              len = state.head.extra_len - state.length;
              if (!state.head.extra) {
                // Use untyped array for more convenient processing later
                state.head.extra = new Array(state.head.extra_len);
              }
              utils.arraySet(state.head.extra, input, next,
              // extra field is limited to 65536 bytes
              // - no need for additional size check
              copy,
              /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
              len);
              //zmemcpy(state.head.extra + len, next,
              //        len + copy > state.head.extra_max ?
              //        state.head.extra_max - len : copy);
            }
            if (state.flags & 0x0200) {
              state.check = crc32(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            state.length -= copy;
          }
          if (state.length) {
            break inf_leave;
          }
        }
        state.length = 0;
        state.mode = NAME;
      /* falls through */
      case NAME:
        if (state.flags & 0x0800) {
          if (have === 0) {
            break inf_leave;
          }
          copy = 0;
          do {
            // TODO: 2 or 1 bytes?
            len = input[next + copy++];
            /* use constant limit because in js we should not preallocate memory */
            if (state.head && len && state.length < 65536 /*state.head.name_max*/) {
              state.head.name += String.fromCharCode(len);
            }
          } while (len && copy < have);

          if (state.flags & 0x0200) {
            state.check = crc32(state.check, input, copy, next);
          }
          have -= copy;
          next += copy;
          if (len) {
            break inf_leave;
          }
        } else if (state.head) {
          state.head.name = null;
        }
        state.length = 0;
        state.mode = COMMENT;
      /* falls through */
      case COMMENT:
        if (state.flags & 0x1000) {
          if (have === 0) {
            break inf_leave;
          }
          copy = 0;
          do {
            len = input[next + copy++];
            /* use constant limit because in js we should not preallocate memory */
            if (state.head && len && state.length < 65536 /*state.head.comm_max*/) {
              state.head.comment += String.fromCharCode(len);
            }
          } while (len && copy < have);
          if (state.flags & 0x0200) {
            state.check = crc32(state.check, input, copy, next);
          }
          have -= copy;
          next += copy;
          if (len) {
            break inf_leave;
          }
        } else if (state.head) {
          state.head.comment = null;
        }
        state.mode = HCRC;
      /* falls through */
      case HCRC:
        if (state.flags & 0x0200) {
          //=== NEEDBITS(16); */
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          if (hold !== (state.check & 0xffff)) {
            strm.msg = 'header crc mismatch';
            state.mode = BAD;
            break;
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
        }
        if (state.head) {
          state.head.hcrc = state.flags >> 9 & 1;
          state.head.done = true;
        }
        strm.adler = state.check = 0;
        state.mode = TYPE;
        break;
      case DICTID:
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        strm.adler = state.check = zswap32(hold);
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = DICT;
      /* falls through */
      case DICT:
        if (state.havedict === 0) {
          //--- RESTORE() ---
          strm.next_out = put;
          strm.avail_out = left;
          strm.next_in = next;
          strm.avail_in = have;
          state.hold = hold;
          state.bits = bits;
          //---
          return Z_NEED_DICT;
        }
        strm.adler = state.check = 1 /*adler32(0L, Z_NULL, 0)*/;
        state.mode = TYPE;
      /* falls through */
      case TYPE:
        if (flush === Z_BLOCK || flush === Z_TREES) {
          break inf_leave;
        }
      /* falls through */
      case TYPEDO:
        if (state.last) {
          //--- BYTEBITS() ---//
          hold >>>= bits & 7;
          bits -= bits & 7;
          //---//
          state.mode = CHECK;
          break;
        }
        //=== NEEDBITS(3); */
        while (bits < 3) {
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.last = hold & 0x01 /*BITS(1)*/;
        //--- DROPBITS(1) ---//
        hold >>>= 1;
        bits -= 1;
        //---//

        switch (hold & 0x03) {/*BITS(2)*/case 0:
            /* stored block */
            //Tracev((stderr, "inflate:     stored block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = STORED;
            break;
          case 1:
            /* fixed block */
            fixedtables(state);
            //Tracev((stderr, "inflate:     fixed codes block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = LEN_; /* decode codes */
            if (flush === Z_TREES) {
              //--- DROPBITS(2) ---//
              hold >>>= 2;
              bits -= 2;
              //---//
              break inf_leave;
            }
            break;
          case 2:
            /* dynamic block */
            //Tracev((stderr, "inflate:     dynamic codes block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = TABLE;
            break;
          case 3:
            strm.msg = 'invalid block type';
            state.mode = BAD;
        }
        //--- DROPBITS(2) ---//
        hold >>>= 2;
        bits -= 2;
        //---//
        break;
      case STORED:
        //--- BYTEBITS() ---// /* go to byte boundary */
        hold >>>= bits & 7;
        bits -= bits & 7;
        //---//
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if ((hold & 0xffff) !== (hold >>> 16 ^ 0xffff)) {
          strm.msg = 'invalid stored block lengths';
          state.mode = BAD;
          break;
        }
        state.length = hold & 0xffff;
        //Tracev((stderr, "inflate:       stored length %u\n",
        //        state.length));
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = COPY_;
        if (flush === Z_TREES) {
          break inf_leave;
        }
      /* falls through */
      case COPY_:
        state.mode = COPY;
      /* falls through */
      case COPY:
        copy = state.length;
        if (copy) {
          if (copy > have) {
            copy = have;
          }
          if (copy > left) {
            copy = left;
          }
          if (copy === 0) {
            break inf_leave;
          }
          //--- zmemcpy(put, next, copy); ---
          utils.arraySet(output, input, next, copy, put);
          //---//
          have -= copy;
          next += copy;
          left -= copy;
          put += copy;
          state.length -= copy;
          break;
        }
        //Tracev((stderr, "inflate:       stored end\n"));
        state.mode = TYPE;
        break;
      case TABLE:
        //=== NEEDBITS(14); */
        while (bits < 14) {
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.nlen = (hold & 0x1f) + /*BITS(5)*/257;
        //--- DROPBITS(5) ---//
        hold >>>= 5;
        bits -= 5;
        //---//
        state.ndist = (hold & 0x1f) + /*BITS(5)*/1;
        //--- DROPBITS(5) ---//
        hold >>>= 5;
        bits -= 5;
        //---//
        state.ncode = (hold & 0x0f) + /*BITS(4)*/4;
        //--- DROPBITS(4) ---//
        hold >>>= 4;
        bits -= 4;
        //---//
        //#ifndef PKZIP_BUG_WORKAROUND
        if (state.nlen > 286 || state.ndist > 30) {
          strm.msg = 'too many length or distance symbols';
          state.mode = BAD;
          break;
        }
        //#endif
        //Tracev((stderr, "inflate:       table sizes ok\n"));
        state.have = 0;
        state.mode = LENLENS;
      /* falls through */
      case LENLENS:
        while (state.have < state.ncode) {
          //=== NEEDBITS(3);
          while (bits < 3) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.lens[order[state.have++]] = hold & 0x07; //BITS(3);
          //--- DROPBITS(3) ---//
          hold >>>= 3;
          bits -= 3;
          //---//
        }
        while (state.have < 19) {
          state.lens[order[state.have++]] = 0;
        }
        // We have separate tables & no pointers. 2 commented lines below not needed.
        //state.next = state.codes;
        //state.lencode = state.next;
        // Switch to use dynamic table
        state.lencode = state.lendyn;
        state.lenbits = 7;

        opts = { bits: state.lenbits };
        ret = inflate_table(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
        state.lenbits = opts.bits;

        if (ret) {
          strm.msg = 'invalid code lengths set';
          state.mode = BAD;
          break;
        }
        //Tracev((stderr, "inflate:       code lengths ok\n"));
        state.have = 0;
        state.mode = CODELENS;
      /* falls through */
      case CODELENS:
        while (state.have < state.nlen + state.ndist) {
          for (;;) {
            here = state.lencode[hold & (1 << state.lenbits) - 1]; /*BITS(state.lenbits)*/
            here_bits = here >>> 24;
            here_op = here >>> 16 & 0xff;
            here_val = here & 0xffff;

            if (here_bits <= bits) {
              break;
            }
            //--- PULLBYTE() ---//
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          if (here_val < 16) {
            //--- DROPBITS(here.bits) ---//
            hold >>>= here_bits;
            bits -= here_bits;
            //---//
            state.lens[state.have++] = here_val;
          } else {
            if (here_val === 16) {
              //=== NEEDBITS(here.bits + 2);
              n = here_bits + 2;
              while (bits < n) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              //===//
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              //---//
              if (state.have === 0) {
                strm.msg = 'invalid bit length repeat';
                state.mode = BAD;
                break;
              }
              len = state.lens[state.have - 1];
              copy = 3 + (hold & 0x03); //BITS(2);
              //--- DROPBITS(2) ---//
              hold >>>= 2;
              bits -= 2;
              //---//
            } else if (here_val === 17) {
              //=== NEEDBITS(here.bits + 3);
              n = here_bits + 3;
              while (bits < n) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              //===//
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              //---//
              len = 0;
              copy = 3 + (hold & 0x07); //BITS(3);
              //--- DROPBITS(3) ---//
              hold >>>= 3;
              bits -= 3;
              //---//
            } else {
              //=== NEEDBITS(here.bits + 7);
              n = here_bits + 7;
              while (bits < n) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              //===//
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              //---//
              len = 0;
              copy = 11 + (hold & 0x7f); //BITS(7);
              //--- DROPBITS(7) ---//
              hold >>>= 7;
              bits -= 7;
              //---//
            }
            if (state.have + copy > state.nlen + state.ndist) {
              strm.msg = 'invalid bit length repeat';
              state.mode = BAD;
              break;
            }
            while (copy--) {
              state.lens[state.have++] = len;
            }
          }
        }

        /* handle error breaks in while */
        if (state.mode === BAD) {
          break;
        }

        /* check for end-of-block code (better have one) */
        if (state.lens[256] === 0) {
          strm.msg = 'invalid code -- missing end-of-block';
          state.mode = BAD;
          break;
        }

        /* build code tables -- note: do not change the lenbits or distbits
           values here (9 and 6) without reading the comments in inftrees.h
           concerning the ENOUGH constants, which depend on those values */
        state.lenbits = 9;

        opts = { bits: state.lenbits };
        ret = inflate_table(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
        // We have separate tables & no pointers. 2 commented lines below not needed.
        // state.next_index = opts.table_index;
        state.lenbits = opts.bits;
        // state.lencode = state.next;

        if (ret) {
          strm.msg = 'invalid literal/lengths set';
          state.mode = BAD;
          break;
        }

        state.distbits = 6;
        //state.distcode.copy(state.codes);
        // Switch to use dynamic table
        state.distcode = state.distdyn;
        opts = { bits: state.distbits };
        ret = inflate_table(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
        // We have separate tables & no pointers. 2 commented lines below not needed.
        // state.next_index = opts.table_index;
        state.distbits = opts.bits;
        // state.distcode = state.next;

        if (ret) {
          strm.msg = 'invalid distances set';
          state.mode = BAD;
          break;
        }
        //Tracev((stderr, 'inflate:       codes ok\n'));
        state.mode = LEN_;
        if (flush === Z_TREES) {
          break inf_leave;
        }
      /* falls through */
      case LEN_:
        state.mode = LEN;
      /* falls through */
      case LEN:
        if (have >= 6 && left >= 258) {
          //--- RESTORE() ---
          strm.next_out = put;
          strm.avail_out = left;
          strm.next_in = next;
          strm.avail_in = have;
          state.hold = hold;
          state.bits = bits;
          //---
          inflate_fast(strm, _out);
          //--- LOAD() ---
          put = strm.next_out;
          output = strm.output;
          left = strm.avail_out;
          next = strm.next_in;
          input = strm.input;
          have = strm.avail_in;
          hold = state.hold;
          bits = state.bits;
          //---

          if (state.mode === TYPE) {
            state.back = -1;
          }
          break;
        }
        state.back = 0;
        for (;;) {
          here = state.lencode[hold & (1 << state.lenbits) - 1]; /*BITS(state.lenbits)*/
          here_bits = here >>> 24;
          here_op = here >>> 16 & 0xff;
          here_val = here & 0xffff;

          if (here_bits <= bits) {
            break;
          }
          //--- PULLBYTE() ---//
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
          //---//
        }
        if (here_op && (here_op & 0xf0) === 0) {
          last_bits = here_bits;
          last_op = here_op;
          last_val = here_val;
          for (;;) {
            here = state.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> /*BITS(last.bits + last.op)*/last_bits)];
            here_bits = here >>> 24;
            here_op = here >>> 16 & 0xff;
            here_val = here & 0xffff;

            if (last_bits + here_bits <= bits) {
              break;
            }
            //--- PULLBYTE() ---//
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          //--- DROPBITS(last.bits) ---//
          hold >>>= last_bits;
          bits -= last_bits;
          //---//
          state.back += last_bits;
        }
        //--- DROPBITS(here.bits) ---//
        hold >>>= here_bits;
        bits -= here_bits;
        //---//
        state.back += here_bits;
        state.length = here_val;
        if (here_op === 0) {
          //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
          //        "inflate:         literal '%c'\n" :
          //        "inflate:         literal 0x%02x\n", here.val));
          state.mode = LIT;
          break;
        }
        if (here_op & 32) {
          //Tracevv((stderr, "inflate:         end of block\n"));
          state.back = -1;
          state.mode = TYPE;
          break;
        }
        if (here_op & 64) {
          strm.msg = 'invalid literal/length code';
          state.mode = BAD;
          break;
        }
        state.extra = here_op & 15;
        state.mode = LENEXT;
      /* falls through */
      case LENEXT:
        if (state.extra) {
          //=== NEEDBITS(state.extra);
          n = state.extra;
          while (bits < n) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.length += hold & (1 << state.extra) - 1 /*BITS(state.extra)*/;
          //--- DROPBITS(state.extra) ---//
          hold >>>= state.extra;
          bits -= state.extra;
          //---//
          state.back += state.extra;
        }
        //Tracevv((stderr, "inflate:         length %u\n", state.length));
        state.was = state.length;
        state.mode = DIST;
      /* falls through */
      case DIST:
        for (;;) {
          here = state.distcode[hold & (1 << state.distbits) - 1]; /*BITS(state.distbits)*/
          here_bits = here >>> 24;
          here_op = here >>> 16 & 0xff;
          here_val = here & 0xffff;

          if (here_bits <= bits) {
            break;
          }
          //--- PULLBYTE() ---//
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
          //---//
        }
        if ((here_op & 0xf0) === 0) {
          last_bits = here_bits;
          last_op = here_op;
          last_val = here_val;
          for (;;) {
            here = state.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> /*BITS(last.bits + last.op)*/last_bits)];
            here_bits = here >>> 24;
            here_op = here >>> 16 & 0xff;
            here_val = here & 0xffff;

            if (last_bits + here_bits <= bits) {
              break;
            }
            //--- PULLBYTE() ---//
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          //--- DROPBITS(last.bits) ---//
          hold >>>= last_bits;
          bits -= last_bits;
          //---//
          state.back += last_bits;
        }
        //--- DROPBITS(here.bits) ---//
        hold >>>= here_bits;
        bits -= here_bits;
        //---//
        state.back += here_bits;
        if (here_op & 64) {
          strm.msg = 'invalid distance code';
          state.mode = BAD;
          break;
        }
        state.offset = here_val;
        state.extra = here_op & 15;
        state.mode = DISTEXT;
      /* falls through */
      case DISTEXT:
        if (state.extra) {
          //=== NEEDBITS(state.extra);
          n = state.extra;
          while (bits < n) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.offset += hold & (1 << state.extra) - 1 /*BITS(state.extra)*/;
          //--- DROPBITS(state.extra) ---//
          hold >>>= state.extra;
          bits -= state.extra;
          //---//
          state.back += state.extra;
        }
        //#ifdef INFLATE_STRICT
        if (state.offset > state.dmax) {
          strm.msg = 'invalid distance too far back';
          state.mode = BAD;
          break;
        }
        //#endif
        //Tracevv((stderr, "inflate:         distance %u\n", state.offset));
        state.mode = MATCH;
      /* falls through */
      case MATCH:
        if (left === 0) {
          break inf_leave;
        }
        copy = _out - left;
        if (state.offset > copy) {
          /* copy from window */
          copy = state.offset - copy;
          if (copy > state.whave) {
            if (state.sane) {
              strm.msg = 'invalid distance too far back';
              state.mode = BAD;
              break;
            }
            // (!) This block is disabled in zlib defaults,
            // don't enable it for binary compatibility
            //#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
            //          Trace((stderr, "inflate.c too far\n"));
            //          copy -= state.whave;
            //          if (copy > state.length) { copy = state.length; }
            //          if (copy > left) { copy = left; }
            //          left -= copy;
            //          state.length -= copy;
            //          do {
            //            output[put++] = 0;
            //          } while (--copy);
            //          if (state.length === 0) { state.mode = LEN; }
            //          break;
            //#endif
          }
          if (copy > state.wnext) {
            copy -= state.wnext;
            from = state.wsize - copy;
          } else {
            from = state.wnext - copy;
          }
          if (copy > state.length) {
            copy = state.length;
          }
          from_source = state.window;
        } else {
          /* copy from output */
          from_source = output;
          from = put - state.offset;
          copy = state.length;
        }
        if (copy > left) {
          copy = left;
        }
        left -= copy;
        state.length -= copy;
        do {
          output[put++] = from_source[from++];
        } while (--copy);
        if (state.length === 0) {
          state.mode = LEN;
        }
        break;
      case LIT:
        if (left === 0) {
          break inf_leave;
        }
        output[put++] = state.length;
        left--;
        state.mode = LEN;
        break;
      case CHECK:
        if (state.wrap) {
          //=== NEEDBITS(32);
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            // Use '|' instead of '+' to make sure that result is signed
            hold |= input[next++] << bits;
            bits += 8;
          }
          //===//
          _out -= left;
          strm.total_out += _out;
          state.total += _out;
          if (_out) {
            strm.adler = state.check =
            /*UPDATE(state.check, put - _out, _out);*/
            state.flags ? crc32(state.check, output, _out, put - _out) : adler32(state.check, output, _out, put - _out);
          }
          _out = left;
          // NB: crc32 stored as signed 32-bit int, zswap32 returns signed too
          if ((state.flags ? hold : zswap32(hold)) !== state.check) {
            strm.msg = 'incorrect data check';
            state.mode = BAD;
            break;
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          //Tracev((stderr, "inflate:   check matches trailer\n"));
        }
        state.mode = LENGTH;
      /* falls through */
      case LENGTH:
        if (state.wrap && state.flags) {
          //=== NEEDBITS(32);
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          if (hold !== (state.total & 0xffffffff)) {
            strm.msg = 'incorrect length check';
            state.mode = BAD;
            break;
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          //Tracev((stderr, "inflate:   length matches trailer\n"));
        }
        state.mode = DONE;
      /* falls through */
      case DONE:
        ret = Z_STREAM_END;
        break inf_leave;
      case BAD:
        ret = Z_DATA_ERROR;
        break inf_leave;
      case MEM:
        return Z_MEM_ERROR;
      case SYNC:
      /* falls through */
      default:
        return Z_STREAM_ERROR;
    }
  }

  // inf_leave <- here is real place for "goto inf_leave", emulated via "break inf_leave"

  /*
     Return from inflate(), updating the total counts and the check value.
     If there was no progress during the inflate() call, return a buffer
     error.  Call updatewindow() to create and/or update the window state.
     Note: a memory error from inflate() is non-recoverable.
   */

  //--- RESTORE() ---
  strm.next_out = put;
  strm.avail_out = left;
  strm.next_in = next;
  strm.avail_in = have;
  state.hold = hold;
  state.bits = bits;
  //---

  if (state.wsize || _out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush !== Z_FINISH)) {
    if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) {
      state.mode = MEM;
      return Z_MEM_ERROR;
    }
  }
  _in -= strm.avail_in;
  _out -= strm.avail_out;
  strm.total_in += _in;
  strm.total_out += _out;
  state.total += _out;
  if (state.wrap && _out) {
    strm.adler = state.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
    state.flags ? crc32(state.check, output, _out, strm.next_out - _out) : adler32(state.check, output, _out, strm.next_out - _out);
  }
  strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
  if ((_in === 0 && _out === 0 || flush === Z_FINISH) && ret === Z_OK) {
    ret = Z_BUF_ERROR;
  }
  return ret;
}

function inflateEnd(strm) {

  if (!strm || !strm.state /*|| strm->zfree == (free_func)0*/) {
      return Z_STREAM_ERROR;
    }

  var state = strm.state;
  if (state.window) {
    state.window = null;
  }
  strm.state = null;
  return Z_OK;
}

function inflateGetHeader(strm, head) {
  var state;

  /* check state */
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  state = strm.state;
  if ((state.wrap & 2) === 0) {
    return Z_STREAM_ERROR;
  }

  /* save header structure */
  state.head = head;
  head.done = false;
  return Z_OK;
}

function inflateSetDictionary(strm, dictionary) {
  var dictLength = dictionary.length;

  var state;
  var dictid;
  var ret;

  /* check state */
  if (!strm /* == Z_NULL */ || !strm.state /* == Z_NULL */) {
      return Z_STREAM_ERROR;
    }
  state = strm.state;

  if (state.wrap !== 0 && state.mode !== DICT) {
    return Z_STREAM_ERROR;
  }

  /* check for correct dictionary identifier */
  if (state.mode === DICT) {
    dictid = 1; /* adler32(0, null, 0)*/
    /* dictid = adler32(dictid, dictionary, dictLength); */
    dictid = adler32(dictid, dictionary, dictLength, 0);
    if (dictid !== state.check) {
      return Z_DATA_ERROR;
    }
  }
  /* copy dictionary to window using updatewindow(), which will amend the
   existing dictionary if appropriate */
  ret = updatewindow(strm, dictionary, dictLength, dictLength);
  if (ret) {
    state.mode = MEM;
    return Z_MEM_ERROR;
  }
  state.havedict = 1;
  // Tracev((stderr, "inflate:   dictionary set\n"));
  return Z_OK;
}

exports.inflateReset = inflateReset;
exports.inflateReset2 = inflateReset2;
exports.inflateResetKeep = inflateResetKeep;
exports.inflateInit = inflateInit;
exports.inflateInit2 = inflateInit2;
exports.inflate = inflate;
exports.inflateEnd = inflateEnd;
exports.inflateGetHeader = inflateGetHeader;
exports.inflateSetDictionary = inflateSetDictionary;
exports.inflateInfo = 'pako inflate (from Nodeca project)';

/* Not implemented
exports.inflateCopy = inflateCopy;
exports.inflateGetDictionary = inflateGetDictionary;
exports.inflateMark = inflateMark;
exports.inflatePrime = inflatePrime;
exports.inflateSync = inflateSync;
exports.inflateSyncPoint = inflateSyncPoint;
exports.inflateUndermine = inflateUndermine;
*/

/***/ }),

/***/ "fy20":
/***/ (function(module, exports) {

module.exports = require("buffer");

/***/ }),

/***/ "g3Lj":
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.



/*<replacement>*/

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    keys.push(key);
  }return keys;
};
/*</replacement>*/

module.exports = Duplex;

/*<replacement>*/
var processNextTick = __webpack_require__("Ji/z");
/*</replacement>*/

/*<replacement>*/
var util = __webpack_require__("jOgh");
util.inherits = __webpack_require__("ihNc");
/*</replacement>*/

var Readable = __webpack_require__("aw5X");
var Writable = __webpack_require__("xTyK");

util.inherits(Duplex, Readable);

var keys = objectKeys(Writable.prototype);
for (var v = 0; v < keys.length; v++) {
  var method = keys[v];
  if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
}

function Duplex(options) {
  if (!(this instanceof Duplex)) return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false) this.readable = false;

  if (options && options.writable === false) this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended) return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  processNextTick(onEndNT, this);
}

function onEndNT(self) {
  self.end();
}

function forEach(xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

/***/ }),

/***/ "gt5T":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var TYPED_OK = typeof Uint8Array !== 'undefined' && typeof Uint16Array !== 'undefined' && typeof Int32Array !== 'undefined';

function _has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

exports.assign = function (obj /*from1, from2, from3, ...*/) {
  var sources = Array.prototype.slice.call(arguments, 1);
  while (sources.length) {
    var source = sources.shift();
    if (!source) {
      continue;
    }

    if (typeof source !== 'object') {
      throw new TypeError(source + 'must be non-object');
    }

    for (var p in source) {
      if (_has(source, p)) {
        obj[p] = source[p];
      }
    }
  }

  return obj;
};

// reduce buffer size, avoiding mem copy
exports.shrinkBuf = function (buf, size) {
  if (buf.length === size) {
    return buf;
  }
  if (buf.subarray) {
    return buf.subarray(0, size);
  }
  buf.length = size;
  return buf;
};

var fnTyped = {
  arraySet: function arraySet(dest, src, src_offs, len, dest_offs) {
    if (src.subarray && dest.subarray) {
      dest.set(src.subarray(src_offs, src_offs + len), dest_offs);
      return;
    }
    // Fallback to ordinary array
    for (var i = 0; i < len; i++) {
      dest[dest_offs + i] = src[src_offs + i];
    }
  },
  // Join array of chunks to single array.
  flattenChunks: function flattenChunks(chunks) {
    var i, l, len, pos, chunk, result;

    // calculate data length
    len = 0;
    for (i = 0, l = chunks.length; i < l; i++) {
      len += chunks[i].length;
    }

    // join chunks
    result = new Uint8Array(len);
    pos = 0;
    for (i = 0, l = chunks.length; i < l; i++) {
      chunk = chunks[i];
      result.set(chunk, pos);
      pos += chunk.length;
    }

    return result;
  }
};

var fnUntyped = {
  arraySet: function arraySet(dest, src, src_offs, len, dest_offs) {
    for (var i = 0; i < len; i++) {
      dest[dest_offs + i] = src[src_offs + i];
    }
  },
  // Join array of chunks to single array.
  flattenChunks: function flattenChunks(chunks) {
    return [].concat.apply([], chunks);
  }
};

// Enable/Disable typed arrays use, for testing
//
exports.setTyped = function (on) {
  if (on) {
    exports.Buf8 = Uint8Array;
    exports.Buf16 = Uint16Array;
    exports.Buf32 = Int32Array;
    exports.assign(exports, fnTyped);
  } else {
    exports.Buf8 = Array;
    exports.Buf16 = Array;
    exports.Buf32 = Array;
    exports.assign(exports, fnUntyped);
  }
};

exports.setTyped(TYPED_OK);

/***/ }),

/***/ "h95s":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function ZStream() {
  /* next input byte */
  this.input = null; // JS specific, because we have no pointers
  this.next_in = 0;
  /* number of bytes available at input */
  this.avail_in = 0;
  /* total number of input bytes read so far */
  this.total_in = 0;
  /* next output byte should be put there */
  this.output = null; // JS specific, because we have no pointers
  this.next_out = 0;
  /* remaining free space at output */
  this.avail_out = 0;
  /* total number of bytes output so far */
  this.total_out = 0;
  /* last error message, NULL if no error */
  this.msg = '' /*Z_NULL*/;
  /* not visible by applications */
  this.state = null;
  /* best guess about the data type: binary or text */
  this.data_type = 2 /*Z_UNKNOWN*/;
  /* adler32 value of the uncompressed data */
  this.adler = 0;
}

module.exports = ZStream;

/***/ }),

/***/ "hCo4":
/***/ (function(module, exports, __webpack_require__) {

var $export = __webpack_require__("2cs7"),
    $task = __webpack_require__("IVFP");
$export($export.G + $export.B, {
  setImmediate: $task.set,
  clearImmediate: $task.clear
});

/***/ }),

/***/ "hKHw":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__("71nt");

/**
 * The following functions come from pako, from pako/lib/zlib/crc32.js
 * released under the MIT license, see pako https://github.com/nodeca/pako/
 */

// Use ordinary array, since untyped makes no boost here
function makeTable() {
    var c,
        table = [];

    for (var n = 0; n < 256; n++) {
        c = n;
        for (var k = 0; k < 8; k++) {
            c = c & 1 ? 0xEDB88320 ^ c >>> 1 : c >>> 1;
        }
        table[n] = c;
    }

    return table;
}

// Create table on load. Just 255 signed longs. Not a problem.
var crcTable = makeTable();

function crc32(crc, buf, len, pos) {
    var t = crcTable,
        end = pos + len;

    crc = crc ^ -1;

    for (var i = pos; i < end; i++) {
        crc = crc >>> 8 ^ t[(crc ^ buf[i]) & 0xFF];
    }

    return crc ^ -1; // >>> 0;
}

// That's all for the pako functions.

/**
 * Compute the crc32 of a string.
 * This is almost the same as the function crc32, but for strings. Using the
 * same function for the two use cases leads to horrible performances.
 * @param {Number} crc the starting value of the crc.
 * @param {String} str the string to use.
 * @param {Number} len the length of the string.
 * @param {Number} pos the starting position for the crc32 computation.
 * @return {Number} the computed crc32.
 */
function crc32str(crc, str, len, pos) {
    var t = crcTable,
        end = pos + len;

    crc = crc ^ -1;

    for (var i = pos; i < end; i++) {
        crc = crc >>> 8 ^ t[(crc ^ str.charCodeAt(i)) & 0xFF];
    }

    return crc ^ -1; // >>> 0;
}

module.exports = function crc32wrapper(input, crc) {
    if (typeof input === "undefined" || !input.length) {
        return 0;
    }

    var isArray = utils.getTypeOf(input) !== "string";

    if (isArray) {
        return crc32(crc | 0, input, input.length, 0);
    } else {
        return crc32str(crc | 0, input, input.length, 0);
    }
};

/***/ }),

/***/ "hR8J":
/***/ (function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ }),

/***/ "hbB+":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__("71nt");
var support = __webpack_require__("oKij");
// private property
var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

// public method for encoding
exports.encode = function (input) {
    var output = [];
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0,
        len = input.length,
        remainingBytes = len;

    var isArray = utils.getTypeOf(input) !== "string";
    while (i < input.length) {
        remainingBytes = len - i;

        if (!isArray) {
            chr1 = input.charCodeAt(i++);
            chr2 = i < len ? input.charCodeAt(i++) : 0;
            chr3 = i < len ? input.charCodeAt(i++) : 0;
        } else {
            chr1 = input[i++];
            chr2 = i < len ? input[i++] : 0;
            chr3 = i < len ? input[i++] : 0;
        }

        enc1 = chr1 >> 2;
        enc2 = (chr1 & 3) << 4 | chr2 >> 4;
        enc3 = remainingBytes > 1 ? (chr2 & 15) << 2 | chr3 >> 6 : 64;
        enc4 = remainingBytes > 2 ? chr3 & 63 : 64;

        output.push(_keyStr.charAt(enc1) + _keyStr.charAt(enc2) + _keyStr.charAt(enc3) + _keyStr.charAt(enc4));
    }

    return output.join("");
};

// public method for decoding
exports.decode = function (input) {
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0,
        resultIndex = 0;

    var dataUrlPrefix = "data:";

    if (input.substr(0, dataUrlPrefix.length) === dataUrlPrefix) {
        // This is a common error: people give a data url
        // (data:image/png;base64,iVBOR...) with a {base64: true} and
        // wonders why things don't work.
        // We can detect that the string input looks like a data url but we
        // *can't* be sure it is one: removing everything up to the comma would
        // be too dangerous.
        throw new Error("Invalid base64 input, it looks like a data url.");
    }

    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

    var totalLength = input.length * 3 / 4;
    if (input.charAt(input.length - 1) === _keyStr.charAt(64)) {
        totalLength--;
    }
    if (input.charAt(input.length - 2) === _keyStr.charAt(64)) {
        totalLength--;
    }
    if (totalLength % 1 !== 0) {
        // totalLength is not an integer, the length does not match a valid
        // base64 content. That can happen if:
        // - the input is not a base64 content
        // - the input is *almost* a base64 content, with a extra chars at the
        //   beginning or at the end
        // - the input uses a base64 variant (base64url for example)
        throw new Error("Invalid base64 input, bad content length.");
    }
    var output;
    if (support.uint8array) {
        output = new Uint8Array(totalLength | 0);
    } else {
        output = new Array(totalLength | 0);
    }

    while (i < input.length) {

        enc1 = _keyStr.indexOf(input.charAt(i++));
        enc2 = _keyStr.indexOf(input.charAt(i++));
        enc3 = _keyStr.indexOf(input.charAt(i++));
        enc4 = _keyStr.indexOf(input.charAt(i++));

        chr1 = enc1 << 2 | enc2 >> 4;
        chr2 = (enc2 & 15) << 4 | enc3 >> 2;
        chr3 = (enc3 & 3) << 6 | enc4;

        output[resultIndex++] = chr1;

        if (enc3 !== 64) {
            output[resultIndex++] = chr2;
        }
        if (enc4 !== 64) {
            output[resultIndex++] = chr3;
        }
    }

    return output;
};

/***/ }),

/***/ "hjG0":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var DataReader = __webpack_require__("MXSK");
var utils = __webpack_require__("71nt");

function ArrayReader(data) {
    DataReader.call(this, data);
    for (var i = 0; i < this.data.length; i++) {
        data[i] = data[i] & 0xFF;
    }
}
utils.inherits(ArrayReader, DataReader);
/**
 * @see DataReader.byteAt
 */
ArrayReader.prototype.byteAt = function (i) {
    return this.data[this.zero + i];
};
/**
 * @see DataReader.lastIndexOfSignature
 */
ArrayReader.prototype.lastIndexOfSignature = function (sig) {
    var sig0 = sig.charCodeAt(0),
        sig1 = sig.charCodeAt(1),
        sig2 = sig.charCodeAt(2),
        sig3 = sig.charCodeAt(3);
    for (var i = this.length - 4; i >= 0; --i) {
        if (this.data[i] === sig0 && this.data[i + 1] === sig1 && this.data[i + 2] === sig2 && this.data[i + 3] === sig3) {
            return i - this.zero;
        }
    }

    return -1;
};
/**
 * @see DataReader.readAndCheckSignature
 */
ArrayReader.prototype.readAndCheckSignature = function (sig) {
    var sig0 = sig.charCodeAt(0),
        sig1 = sig.charCodeAt(1),
        sig2 = sig.charCodeAt(2),
        sig3 = sig.charCodeAt(3),
        data = this.readData(4);
    return sig0 === data[0] && sig1 === data[1] && sig2 === data[2] && sig3 === data[3];
};
/**
 * @see DataReader.readData
 */
ArrayReader.prototype.readData = function (size) {
    this.checkOffset(size);
    if (size === 0) {
        return [];
    }
    var result = this.data.slice(this.zero + this.index, this.zero + this.index + size);
    this.index += size;
    return result;
};
module.exports = ArrayReader;

/***/ }),

/***/ "hutl":
/***/ (function(module, exports, __webpack_require__) {

// optional / simple context binding
var aFunction = __webpack_require__("2SaJ");
module.exports = function (fn, that, length) {
  aFunction(fn);
  if (that === undefined) return fn;
  switch (length) {
    case 1:
      return function (a) {
        return fn.call(that, a);
      };
    case 2:
      return function (a, b) {
        return fn.call(that, a, b);
      };
    case 3:
      return function (a, b, c) {
        return fn.call(that, a, b, c);
      };
  }
  return function () /* ...args */{
    return fn.apply(that, arguments);
  };
};

/***/ }),

/***/ "ihNc":
/***/ (function(module, exports, __webpack_require__) {

try {
  var util = __webpack_require__("Bcfi");
  if (typeof util.inherits !== 'function') throw '';
  module.exports = util.inherits;
} catch (e) {
  module.exports = __webpack_require__("LC74");
}

/***/ }),

/***/ "ismg":
/***/ (function(module, exports, __webpack_require__) {

// Thank's IE8 for his funny defineProperty
module.exports = !__webpack_require__("a1Qx")(function () {
  return Object.defineProperty({}, 'a', { get: function get() {
      return 7;
    } }).a != 7;
});

/***/ }),

/***/ "j3u2":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.LOCAL_FILE_HEADER = "PK\x03\x04";
exports.CENTRAL_FILE_HEADER = "PK\x01\x02";
exports.CENTRAL_DIRECTORY_END = "PK\x05\x06";
exports.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x06\x07";
exports.ZIP64_CENTRAL_DIRECTORY_END = "PK\x06\x06";
exports.DATA_DESCRIPTOR = "PK\x07\x08";

/***/ }),

/***/ "jOgh":
/***/ (function(module, exports) {

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.

function isArray(arg) {
  if (Array.isArray) {
    return Array.isArray(arg);
  }
  return objectToString(arg) === '[object Array]';
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return objectToString(e) === '[object Error]' || e instanceof Error;
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null || typeof arg === 'boolean' || typeof arg === 'number' || typeof arg === 'string' || typeof arg === 'symbol' || // ES6 symbol
  typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = Buffer.isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

/***/ }),

/***/ "jbop":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var external = __webpack_require__("vVrn");
var DataWorker = __webpack_require__("KnAl");
var DataLengthProbe = __webpack_require__("Q2VO");
var Crc32Probe = __webpack_require__("u5ky");
var DataLengthProbe = __webpack_require__("Q2VO");

/**
 * Represent a compressed object, with everything needed to decompress it.
 * @constructor
 * @param {number} compressedSize the size of the data compressed.
 * @param {number} uncompressedSize the size of the data after decompression.
 * @param {number} crc32 the crc32 of the decompressed file.
 * @param {object} compression the type of compression, see lib/compressions.js.
 * @param {String|ArrayBuffer|Uint8Array|Buffer} data the compressed data.
 */
function CompressedObject(compressedSize, uncompressedSize, crc32, compression, data) {
    this.compressedSize = compressedSize;
    this.uncompressedSize = uncompressedSize;
    this.crc32 = crc32;
    this.compression = compression;
    this.compressedContent = data;
}

CompressedObject.prototype = {
    /**
     * Create a worker to get the uncompressed content.
     * @return {GenericWorker} the worker.
     */
    getContentWorker: function getContentWorker() {
        var worker = new DataWorker(external.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new DataLengthProbe("data_length"));

        var that = this;
        worker.on("end", function () {
            if (this.streamInfo['data_length'] !== that.uncompressedSize) {
                throw new Error("Bug : uncompressed data size mismatch");
            }
        });
        return worker;
    },
    /**
     * Create a worker to get the compressed content.
     * @return {GenericWorker} the worker.
     */
    getCompressedWorker: function getCompressedWorker() {
        return new DataWorker(external.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression);
    }
};

/**
 * Chain the given worker with other workers to compress the content with the
 * given compresion.
 * @param {GenericWorker} uncompressedWorker the worker to pipe.
 * @param {Object} compression the compression object.
 * @param {Object} compressionOptions the options to use when compressing.
 * @return {GenericWorker} the new worker compressing the content.
 */
CompressedObject.createWorkerFrom = function (uncompressedWorker, compression, compressionOptions) {
    return uncompressedWorker.pipe(new Crc32Probe()).pipe(new DataLengthProbe("uncompressedSize")).pipe(compression.compressWorker(compressionOptions)).pipe(new DataLengthProbe("compressedSize")).withStreamInfo("compression", compression);
};

module.exports = CompressedObject;

/***/ }),

/***/ "l3VN":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var GenericWorker = __webpack_require__("bxoG");
var utils = __webpack_require__("71nt");

/**
 * A worker which convert chunks to a specified type.
 * @constructor
 * @param {String} destType the destination type.
 */
function ConvertWorker(destType) {
    GenericWorker.call(this, "ConvertWorker to " + destType);
    this.destType = destType;
}
utils.inherits(ConvertWorker, GenericWorker);

/**
 * @see GenericWorker.processChunk
 */
ConvertWorker.prototype.processChunk = function (chunk) {
    this.push({
        data: utils.transformTo(this.destType, chunk.data),
        meta: chunk.meta
    });
};
module.exports = ConvertWorker;

/***/ }),

/***/ "lP8e":
/***/ (function(module, exports) {

// fast apply, http://jsperf.lnkit.com/fast-apply/5
module.exports = function (fn, args, that) {
                  var un = that === undefined;
                  switch (args.length) {
                                    case 0:
                                                      return un ? fn() : fn.call(that);
                                    case 1:
                                                      return un ? fn(args[0]) : fn.call(that, args[0]);
                                    case 2:
                                                      return un ? fn(args[0], args[1]) : fn.call(that, args[0], args[1]);
                                    case 3:
                                                      return un ? fn(args[0], args[1], args[2]) : fn.call(that, args[0], args[1], args[2]);
                                    case 4:
                                                      return un ? fn(args[0], args[1], args[2], args[3]) : fn.call(that, args[0], args[1], args[2], args[3]);
                  }return fn.apply(that, args);
};

/***/ }),

/***/ "njQ8":
/***/ (function(module, exports, __webpack_require__) {


/**
 * For Node.js, simply re-export the core `util.deprecate` function.
 */

module.exports = __webpack_require__("Bcfi").deprecate;

/***/ }),

/***/ "oKij":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.base64 = true;
exports.array = true;
exports.string = true;
exports.arraybuffer = typeof ArrayBuffer !== "undefined" && typeof Uint8Array !== "undefined";
exports.nodebuffer = typeof Buffer !== "undefined";
// contains true if JSZip can read/generate Uint8Array, false otherwise.
exports.uint8array = typeof Uint8Array !== "undefined";

if (typeof ArrayBuffer === "undefined") {
    exports.blob = false;
} else {
    var buffer = new ArrayBuffer(0);
    try {
        exports.blob = new Blob([buffer], {
            type: "application/zip"
        }).size === 0;
    } catch (e) {
        try {
            var Builder = self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder;
            var builder = new Builder();
            builder.append(buffer);
            exports.blob = builder.getBlob('application/zip').size === 0;
        } catch (e) {
            exports.blob = false;
        }
    }
}

try {
    exports.nodestream = !!__webpack_require__("CpFU").Readable;
} catch (e) {
    exports.nodestream = false;
}

/***/ }),

/***/ "ommR":
/***/ (function(module, exports, __webpack_require__) {

var now = __webpack_require__("UGHC"),
    root = typeof window === 'undefined' ? global : window,
    vendors = ['moz', 'webkit'],
    suffix = 'AnimationFrame',
    raf = root['request' + suffix],
    caf = root['cancel' + suffix] || root['cancelRequest' + suffix];

for (var i = 0; !raf && i < vendors.length; i++) {
  raf = root[vendors[i] + 'Request' + suffix];
  caf = root[vendors[i] + 'Cancel' + suffix] || root[vendors[i] + 'CancelRequest' + suffix];
}

// Some versions of FF have rAF but not cAF
if (!raf || !caf) {
  var last = 0,
      id = 0,
      queue = [],
      frameDuration = 1000 / 60;

  raf = function raf(callback) {
    if (queue.length === 0) {
      var _now = now(),
          next = Math.max(0, frameDuration - (_now - last));
      last = next + _now;
      setTimeout(function () {
        var cp = queue.slice(0);
        // Clear queue here to prevent
        // callbacks from appending listeners
        // to the current frame's queue
        queue.length = 0;
        for (var i = 0; i < cp.length; i++) {
          if (!cp[i].cancelled) {
            try {
              cp[i].callback(last);
            } catch (e) {
              setTimeout(function () {
                throw e;
              }, 0);
            }
          }
        }
      }, Math.round(next));
    }
    queue.push({
      handle: ++id,
      callback: callback,
      cancelled: false
    });
    return id;
  };

  caf = function caf(handle) {
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].handle === handle) {
        queue[i].cancelled = true;
      }
    }
  };
}

module.exports = function (fn) {
  // Wrap in a new function to prevent
  // `cancel` potentially being assigned
  // to the native rAF function
  return raf.call(root, fn);
};
module.exports.cancel = function () {
  caf.apply(root, arguments);
};
module.exports.polyfill = function (object) {
  if (!object) {
    object = root;
  }
  object.requestAnimationFrame = raf;
  object.cancelAnimationFrame = caf;
};

/***/ }),

/***/ "pGic":
/***/ (function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ }),

/***/ "rBub":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var Uint8ArrayReader = __webpack_require__("dL6i");
var utils = __webpack_require__("71nt");

function NodeBufferReader(data) {
    Uint8ArrayReader.call(this, data);
}
utils.inherits(NodeBufferReader, Uint8ArrayReader);

/**
 * @see DataReader.readData
 */
NodeBufferReader.prototype.readData = function (size) {
    this.checkOffset(size);
    var result = this.data.slice(this.zero + this.index, this.zero + this.index + size);
    this.index += size;
    return result;
};
module.exports = NodeBufferReader;

/***/ }),

/***/ "sOR5":
/***/ (function(module, exports) {

var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

/***/ }),

/***/ "tJQH":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var compressions = __webpack_require__("GfW5");
var ZipFileWorker = __webpack_require__("CcWG");

/**
 * Find the compression to use.
 * @param {String} fileCompression the compression defined at the file level, if any.
 * @param {String} zipCompression the compression defined at the load() level.
 * @return {Object} the compression object to use.
 */
var getCompression = function getCompression(fileCompression, zipCompression) {

    var compressionName = fileCompression || zipCompression;
    var compression = compressions[compressionName];
    if (!compression) {
        throw new Error(compressionName + " is not a valid compression method !");
    }
    return compression;
};

/**
 * Create a worker to generate a zip file.
 * @param {JSZip} zip the JSZip instance at the right root level.
 * @param {Object} options to generate the zip file.
 * @param {String} comment the comment to use.
 */
exports.generateWorker = function (zip, options, comment) {

    var zipFileWorker = new ZipFileWorker(options.streamFiles, comment, options.platform, options.encodeFileName);
    var entriesCount = 0;
    try {

        zip.forEach(function (relativePath, file) {
            entriesCount++;
            var compression = getCompression(file.options.compression, options.compression);
            var compressionOptions = file.options.compressionOptions || options.compressionOptions || {};
            var dir = file.dir,
                date = file.date;

            file._compressWorker(compression, compressionOptions).withStreamInfo("file", {
                name: relativePath,
                dir: dir,
                date: date,
                comment: file.comment || "",
                unixPermissions: file.unixPermissions,
                dosPermissions: file.dosPermissions
            }).pipe(zipFileWorker);
        });
        zipFileWorker.entriesCount = entriesCount;
    } catch (e) {
        zipFileWorker.error(e);
    }

    return zipFileWorker;
};

/***/ }),

/***/ "tmYD":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var zlib_deflate = __webpack_require__("VOug");
var utils = __webpack_require__("gt5T");
var strings = __webpack_require__("LjBA");
var msg = __webpack_require__("2A+V");
var ZStream = __webpack_require__("h95s");

var toString = Object.prototype.toString;

/* Public constants ==========================================================*/
/* ===========================================================================*/

var Z_NO_FLUSH = 0;
var Z_FINISH = 4;

var Z_OK = 0;
var Z_STREAM_END = 1;
var Z_SYNC_FLUSH = 2;

var Z_DEFAULT_COMPRESSION = -1;

var Z_DEFAULT_STRATEGY = 0;

var Z_DEFLATED = 8;

/* ===========================================================================*/

/**
 * class Deflate
 *
 * Generic JS-style wrapper for zlib calls. If you don't need
 * streaming behaviour - use more simple functions: [[deflate]],
 * [[deflateRaw]] and [[gzip]].
 **/

/* internal
 * Deflate.chunks -> Array
 *
 * Chunks of output data, if [[Deflate#onData]] not overridden.
 **/

/**
 * Deflate.result -> Uint8Array|Array
 *
 * Compressed result, generated by default [[Deflate#onData]]
 * and [[Deflate#onEnd]] handlers. Filled after you push last chunk
 * (call [[Deflate#push]] with `Z_FINISH` / `true` param)  or if you
 * push a chunk with explicit flush (call [[Deflate#push]] with
 * `Z_SYNC_FLUSH` param).
 **/

/**
 * Deflate.err -> Number
 *
 * Error code after deflate finished. 0 (Z_OK) on success.
 * You will not need it in real life, because deflate errors
 * are possible only on wrong options or bad `onData` / `onEnd`
 * custom handlers.
 **/

/**
 * Deflate.msg -> String
 *
 * Error message, if [[Deflate.err]] != 0
 **/

/**
 * new Deflate(options)
 * - options (Object): zlib deflate options.
 *
 * Creates new deflator instance with specified params. Throws exception
 * on bad params. Supported options:
 *
 * - `level`
 * - `windowBits`
 * - `memLevel`
 * - `strategy`
 * - `dictionary`
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Additional options, for internal needs:
 *
 * - `chunkSize` - size of generated data chunks (16K by default)
 * - `raw` (Boolean) - do raw deflate
 * - `gzip` (Boolean) - create gzip wrapper
 * - `to` (String) - if equal to 'string', then result will be "binary string"
 *    (each char code [0..255])
 * - `header` (Object) - custom header for gzip
 *   - `text` (Boolean) - true if compressed data believed to be text
 *   - `time` (Number) - modification time, unix timestamp
 *   - `os` (Number) - operation system code
 *   - `extra` (Array) - array of bytes with extra data (max 65536)
 *   - `name` (String) - file name (binary string)
 *   - `comment` (String) - comment (binary string)
 *   - `hcrc` (Boolean) - true if header crc should be added
 *
 * ##### Example:
 *
 * ```javascript
 * var pako = require('pako')
 *   , chunk1 = Uint8Array([1,2,3,4,5,6,7,8,9])
 *   , chunk2 = Uint8Array([10,11,12,13,14,15,16,17,18,19]);
 *
 * var deflate = new pako.Deflate({ level: 3});
 *
 * deflate.push(chunk1, false);
 * deflate.push(chunk2, true);  // true -> last chunk
 *
 * if (deflate.err) { throw new Error(deflate.err); }
 *
 * console.log(deflate.result);
 * ```
 **/
function Deflate(options) {
  if (!(this instanceof Deflate)) return new Deflate(options);

  this.options = utils.assign({
    level: Z_DEFAULT_COMPRESSION,
    method: Z_DEFLATED,
    chunkSize: 16384,
    windowBits: 15,
    memLevel: 8,
    strategy: Z_DEFAULT_STRATEGY,
    to: ''
  }, options || {});

  var opt = this.options;

  if (opt.raw && opt.windowBits > 0) {
    opt.windowBits = -opt.windowBits;
  } else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) {
    opt.windowBits += 16;
  }

  this.err = 0; // error code, if happens (0 = Z_OK)
  this.msg = ''; // error message
  this.ended = false; // used to avoid multiple onEnd() calls
  this.chunks = []; // chunks of compressed data

  this.strm = new ZStream();
  this.strm.avail_out = 0;

  var status = zlib_deflate.deflateInit2(this.strm, opt.level, opt.method, opt.windowBits, opt.memLevel, opt.strategy);

  if (status !== Z_OK) {
    throw new Error(msg[status]);
  }

  if (opt.header) {
    zlib_deflate.deflateSetHeader(this.strm, opt.header);
  }

  if (opt.dictionary) {
    var dict;
    // Convert data if needed
    if (typeof opt.dictionary === 'string') {
      // If we need to compress text, change encoding to utf8.
      dict = strings.string2buf(opt.dictionary);
    } else if (toString.call(opt.dictionary) === '[object ArrayBuffer]') {
      dict = new Uint8Array(opt.dictionary);
    } else {
      dict = opt.dictionary;
    }

    status = zlib_deflate.deflateSetDictionary(this.strm, dict);

    if (status !== Z_OK) {
      throw new Error(msg[status]);
    }

    this._dict_set = true;
  }
}

/**
 * Deflate#push(data[, mode]) -> Boolean
 * - data (Uint8Array|Array|ArrayBuffer|String): input data. Strings will be
 *   converted to utf8 byte sequence.
 * - mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE modes.
 *   See constants. Skipped or `false` means Z_NO_FLUSH, `true` means Z_FINISH.
 *
 * Sends input data to deflate pipe, generating [[Deflate#onData]] calls with
 * new compressed chunks. Returns `true` on success. The last data block must have
 * mode Z_FINISH (or `true`). That will flush internal pending buffers and call
 * [[Deflate#onEnd]]. For interim explicit flushes (without ending the stream) you
 * can use mode Z_SYNC_FLUSH, keeping the compression context.
 *
 * On fail call [[Deflate#onEnd]] with error code and return false.
 *
 * We strongly recommend to use `Uint8Array` on input for best speed (output
 * array format is detected automatically). Also, don't skip last param and always
 * use the same type in your code (boolean or number). That will improve JS speed.
 *
 * For regular `Array`-s make sure all elements are [0..255].
 *
 * ##### Example
 *
 * ```javascript
 * push(chunk, false); // push one of data chunks
 * ...
 * push(chunk, true);  // push last chunk
 * ```
 **/
Deflate.prototype.push = function (data, mode) {
  var strm = this.strm;
  var chunkSize = this.options.chunkSize;
  var status, _mode;

  if (this.ended) {
    return false;
  }

  _mode = mode === ~~mode ? mode : mode === true ? Z_FINISH : Z_NO_FLUSH;

  // Convert data if needed
  if (typeof data === 'string') {
    // If we need to compress text, change encoding to utf8.
    strm.input = strings.string2buf(data);
  } else if (toString.call(data) === '[object ArrayBuffer]') {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }

  strm.next_in = 0;
  strm.avail_in = strm.input.length;

  do {
    if (strm.avail_out === 0) {
      strm.output = new utils.Buf8(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }
    status = zlib_deflate.deflate(strm, _mode); /* no bad return value */

    if (status !== Z_STREAM_END && status !== Z_OK) {
      this.onEnd(status);
      this.ended = true;
      return false;
    }
    if (strm.avail_out === 0 || strm.avail_in === 0 && (_mode === Z_FINISH || _mode === Z_SYNC_FLUSH)) {
      if (this.options.to === 'string') {
        this.onData(strings.buf2binstring(utils.shrinkBuf(strm.output, strm.next_out)));
      } else {
        this.onData(utils.shrinkBuf(strm.output, strm.next_out));
      }
    }
  } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== Z_STREAM_END);

  // Finalize on the last chunk.
  if (_mode === Z_FINISH) {
    status = zlib_deflate.deflateEnd(this.strm);
    this.onEnd(status);
    this.ended = true;
    return status === Z_OK;
  }

  // callback interim results if Z_SYNC_FLUSH.
  if (_mode === Z_SYNC_FLUSH) {
    this.onEnd(Z_OK);
    strm.avail_out = 0;
    return true;
  }

  return true;
};

/**
 * Deflate#onData(chunk) -> Void
 * - chunk (Uint8Array|Array|String): output data. Type of array depends
 *   on js engine support. When string output requested, each chunk
 *   will be string.
 *
 * By default, stores data blocks in `chunks[]` property and glue
 * those in `onEnd`. Override this handler, if you need another behaviour.
 **/
Deflate.prototype.onData = function (chunk) {
  this.chunks.push(chunk);
};

/**
 * Deflate#onEnd(status) -> Void
 * - status (Number): deflate status. 0 (Z_OK) on success,
 *   other if not.
 *
 * Called once after you tell deflate that the input stream is
 * complete (Z_FINISH) or should be flushed (Z_SYNC_FLUSH)
 * or if an error happened. By default - join collected chunks,
 * free memory and fill `results` / `err` properties.
 **/
Deflate.prototype.onEnd = function (status) {
  // On success - join
  if (status === Z_OK) {
    if (this.options.to === 'string') {
      this.result = this.chunks.join('');
    } else {
      this.result = utils.flattenChunks(this.chunks);
    }
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};

/**
 * deflate(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to compress.
 * - options (Object): zlib deflate options.
 *
 * Compress `data` with deflate algorithm and `options`.
 *
 * Supported options are:
 *
 * - level
 * - windowBits
 * - memLevel
 * - strategy
 * - dictionary
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Sugar (options):
 *
 * - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
 *   negative windowBits implicitly.
 * - `to` (String) - if equal to 'string', then result will be "binary string"
 *    (each char code [0..255])
 *
 * ##### Example:
 *
 * ```javascript
 * var pako = require('pako')
 *   , data = Uint8Array([1,2,3,4,5,6,7,8,9]);
 *
 * console.log(pako.deflate(data));
 * ```
 **/
function deflate(input, options) {
  var deflator = new Deflate(options);

  deflator.push(input, true);

  // That will never happens, if you don't cheat with options :)
  if (deflator.err) {
    throw deflator.msg || msg[deflator.err];
  }

  return deflator.result;
}

/**
 * deflateRaw(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to compress.
 * - options (Object): zlib deflate options.
 *
 * The same as [[deflate]], but creates raw data, without wrapper
 * (header and adler32 crc).
 **/
function deflateRaw(input, options) {
  options = options || {};
  options.raw = true;
  return deflate(input, options);
}

/**
 * gzip(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to compress.
 * - options (Object): zlib deflate options.
 *
 * The same as [[deflate]], but create gzip wrapper instead of
 * deflate one.
 **/
function gzip(input, options) {
  options = options || {};
  options.gzip = true;
  return deflate(input, options);
}

exports.Deflate = Deflate;
exports.deflate = deflate;
exports.deflateRaw = deflateRaw;
exports.gzip = gzip;

/***/ }),

/***/ "toTQ":
/***/ (function(module, exports) {

var buffer = new ArrayBuffer(38818);var uint8 = new Uint8Array(buffer);uint8.set([0,97,115,109,1,0,0,0,1,114,15,96,0,1,127,96,7,127,127,127,127,127,127,127,0,96,1,127,1,127,96,2,127,127,0,96,2,127,127,1,127,96,1,127,0,96,0,0,96,8,127,127,127,127,127,127,127,127,0,96,3,127,127,127,1,127,96,4,127,127,127,127,0,96,13,127,127,127,127,127,127,127,127,127,127,127,127,127,1,127,96,4,127,127,127,127,1,127,96,3,127,127,127,0,96,7,127,127,127,127,127,127,127,1,127,96,6,127,127,127,127,127,127,0,2,11,1,3,101,110,118,3,108,111,103,0,1,3,144,2,142,2,1,2,3,2,2,2,2,4,3,5,6,5,5,7,0,6,0,0,0,0,0,0,0,0,0,0,0,4,4,4,4,4,8,4,8,5,8,4,9,10,6,0,1,6,6,6,6,6,6,6,0,5,6,3,3,0,0,0,2,2,3,0,0,6,6,6,6,0,5,6,6,6,6,6,2,2,2,2,2,2,6,4,2,0,6,2,0,6,2,0,0,2,0,0,0,4,11,12,5,5,5,6,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,6,5,6,5,6,5,6,5,5,5,4,5,5,0,0,4,2,0,2,2,12,5,12,3,3,0,5,6,5,6,5,5,5,5,5,5,4,3,4,5,3,5,5,5,2,3,12,2,2,0,2,5,2,2,0,0,0,2,2,2,2,2,2,3,5,5,2,5,5,2,5,5,2,5,5,2,2,2,2,2,2,2,2,2,2,4,8,2,2,5,2,2,2,2,0,3,5,0,0,0,4,9,4,13,13,1,14,14,12,12,3,5,6,6,6,0,0,6,6,6,6,5,6,0,0,4,3,6,6,6,6,6,6,6,6,6,6,6,6,2,6,6,6,6,6,6,6,6,6,6,6,6,6,5,3,1,0,1,6,238,8,216,1,127,0,65,128,128,172,4,11,127,0,65,128,8,11,127,0,65,128,8,11,127,0,65,128,16,11,127,0,65,255,255,3,11,127,0,65,128,144,4,11,127,0,65,128,144,4,11,127,0,65,128,4,11,127,0,65,128,216,5,11,127,0,65,128,152,14,11,127,0,65,128,152,26,11,127,0,65,128,248,35,11,127,0,65,128,248,43,11,127,0,65,128,248,51,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,207,254,3,11,127,1,65,0,11,127,1,65,240,254,3,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,1,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,128,2,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,1,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,15,11,127,1,65,0,11,127,1,65,0,11,127,1,65,15,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,15,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,15,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,128,247,2,11,127,1,65,1,11,127,1,65,1,11,127,1,65,1,11,127,1,65,1,11,127,1,65,1,11,127,1,65,1,11,127,1,65,1,11,127,1,65,1,11,127,1,65,0,11,127,1,65,0,11,127,1,65,255,0,11,127,1,65,255,0,11,127,1,65,128,128,8,11,127,1,65,1,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,1,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,213,254,3,11,127,1,65,0,11,127,1,65,209,254,3,11,127,1,65,210,254,3,11,127,1,65,211,254,3,11,127,1,65,212,254,3,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,232,254,3,11,127,1,65,235,254,3,11,127,1,65,233,254,3,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,127,1,65,127,11,127,1,65,127,11,127,1,65,0,11,127,1,65,0,11,127,1,65,0,11,7,152,6,39,6,99,111,110,102,105,103,0,1,14,115,101,116,74,111,121,112,97,100,83,116,97,116,101,0,14,18,103,101,116,65,117,100,105,111,81,117,101,117,101,73,110,100,101,120,0,15,15,114,101,115,101,116,65,117,100,105,111,81,117,101,117,101,0,16,14,119,97,115,109,77,101,109,111,114,121,83,105,122,101,3,0,28,119,97,115,109,66,111,121,73,110,116,101,114,110,97,108,83,116,97,116,101,76,111,99,97,116,105,111,110,3,1,24,119,97,115,109,66,111,121,73,110,116,101,114,110,97,108,83,116,97,116,101,83,105,122,101,3,2,29,103,97,109,101,66,111,121,73,110,116,101,114,110,97,108,77,101,109,111,114,121,76,111,99,97,116,105,111,110,3,3,25,103,97,109,101,66,111,121,73,110,116,101,114,110,97,108,77,101,109,111,114,121,83,105,122,101,3,4,19,118,105,100,101,111,79,117,116,112,117,116,76,111,99,97,116,105,111,110,3,5,34,102,114,97,109,101,73,110,80,114,111,103,114,101,115,115,86,105,100,101,111,79,117,116,112,117,116,76,111,99,97,116,105,111,110,3,8,27,103,97,109,101,98,111,121,67,111,108,111,114,80,97,108,101,116,116,101,76,111,99,97,116,105,111,110,3,6,23,103,97,109,101,98,111,121,67,111,108,111,114,80,97,108,101,116,116,101,83,105,122,101,3,7,21,98,97,99,107,103,114,111,117,110,100,77,97,112,76,111,99,97,116,105,111,110,3,9,11,116,105,108,101,68,97,116,97,77,97,112,3,10,19,115,111,117,110,100,79,117,116,112,117,116,76,111,99,97,116,105,111,110,3,11,17,103,97,109,101,66,121,116,101,115,76,111,99,97,116,105,111,110,3,13,20,103,97,109,101,82,97,109,66,97,110,107,115,76,111,99,97,116,105,111,110,3,12,33,103,101,116,87,97,115,109,66,111,121,79,102,102,115,101,116,70,114,111,109,71,97,109,101,66,111,121,79,102,102,115,101,116,0,6,12,103,101,116,82,101,103,105,115,116,101,114,65,0,17,12,103,101,116,82,101,103,105,115,116,101,114,66,0,18,12,103,101,116,82,101,103,105,115,116,101,114,67,0,19,12,103,101,116,82,101,103,105,115,116,101,114,68,0,20,12,103,101,116,82,101,103,105,115,116,101,114,69,0,21,12,103,101,116,82,101,103,105,115,116,101,114,72,0,22,12,103,101,116,82,101,103,105,115,116,101,114,76,0,23,12,103,101,116,82,101,103,105,115,116,101,114,70,0,24,17,103,101,116,80,114,111,103,114,97,109,67,111,117,110,116,101,114,0,25,15,103,101,116,83,116,97,99,107,80,111,105,110,116,101,114,0,26,25,103,101,116,79,112,99,111,100,101,65,116,80,114,111,103,114,97,109,67,111,117,110,116,101,114,0,27,29,100,114,97,119,66,97,99,107,103,114,111,117,110,100,77,97,112,84,111,87,97,115,109,77,101,109,111,114,121,0,36,24,100,114,97,119,84,105,108,101,68,97,116,97,84,111,87,97,115,109,77,101,109,111,114,121,0,41,14,104,97,115,67,111,114,101,83,116,97,114,116,101,100,0,42,10,105,110,105,116,105,97,108,105,122,101,0,55,13,101,109,117,108,97,116,105,111,110,83,116,101,112,0,241,1,6,117,112,100,97,116,101,0,242,1,9,115,97,118,101,83,116,97,116,101,0,128,2,9,108,111,97,100,83,116,97,116,101,0,141,2,6,109,101,109,111,114,121,2,0,8,2,142,2,10,180,196,1,142,2,121,0,32,0,65,0,74,4,64,65,1,36,14,5,65,0,36,14,11,32,1,65,0,74,4,64,65,1,36,15,5,65,0,36,15,11,32,2,65,0,74,4,64,65,1,36,16,5,65,0,36,16,11,32,3,65,0,74,4,64,65,1,36,17,5,65,0,36,17,11,32,4,65,0,74,4,64,65,1,36,18,5,65,0,36,18,11,32,5,65,0,74,4,64,65,1,36,19,5,65,0,36,19,11,32,6,65,0,74,4,64,65,1,36,20,5,65,0,36,20,11,11,73,0,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,14,8,1,2,3,4,5,6,7,8,0,11,12,8,11,35,22,15,11,35,23,15,11,35,24,15,11,35,25,15,11,35,26,15,11,35,27,15,11,35,28,15,11,35,29,15,11,65,0,11,93,0,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,14,8,1,2,3,4,5,6,7,8,0,11,12,8,11,32,1,36,22,12,7,11,32,1,36,23,12,6,11,32,1,36,24,12,5,11,32,1,36,25,12,4,11,32,1,36,26,12,3,11,32,1,36,27,12,2,11,32,1,36,28,12,1,11,32,1,36,29,11,11,47,1,2,127,35,34,33,1,35,35,69,34,2,4,127,32,1,69,5,32,2,11,65,1,113,4,64,65,1,33,1,11,32,1,65,128,128,1,108,32,0,65,128,128,1,107,106,11,17,0,35,38,65,128,192,0,108,32,0,65,128,192,2,107,106,11,165,1,1,1,127,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,12,117,14,14,1,1,1,1,2,2,2,2,3,3,4,4,5,6,0,11,12,6,11,32,0,65,128,248,51,106,15,11,32,0,16,4,65,128,248,51,106,15,11,35,36,4,64,35,37,16,7,65,1,113,33,1,11,32,0,65,128,144,126,106,32,1,65,128,192,0,108,106,15,11,32,0,16,5,65,128,248,43,106,15,11,32,0,65,128,144,126,106,15,11,35,36,4,64,35,39,16,7,65,7,113,33,1,11,32,1,65,1,72,4,64,65,1,33,1,11,32,0,32,1,65,128,32,108,106,65,128,240,125,106,15,11,32,0,65,128,80,106,11,9,0,32,0,16,6,45,0,0,11,10,0,32,1,65,1,32,0,116,114,11,11,0,32,0,16,6,32,1,58,0,0,11,26,1,1,127,32,0,65,143,254,3,16,7,16,8,34,1,36,40,65,143,254,3,32,1,16,9,11,10,0,65,1,36,33,65,4,16,10,11,99,1,1,127,65,0,36,21,32,0,16,2,69,4,64,65,1,33,1,11,32,0,65,1,16,3,32,1,4,64,65,0,33,1,32,0,65,3,76,4,64,65,1,33,1,11,65,0,33,0,35,31,4,127,32,1,5,35,31,11,65,1,113,4,64,65,1,33,0,11,35,32,4,127,32,1,69,5,35,32,11,65,1,113,4,64,65,1,33,0,11,32,0,4,64,16,11,11,11,11,8,0,32,0,65,0,16,3,11,138,1,0,32,0,65,0,74,4,64,65,0,16,12,5,65,0,16,13,11,32,1,65,0,74,4,64,65,1,16,12,5,65,1,16,13,11,32,2,65,0,74,4,64,65,2,16,12,5,65,2,16,13,11,32,3,65,0,74,4,64,65,3,16,12,5,65,3,16,13,11,32,4,65,0,74,4,64,65,4,16,12,5,65,4,16,13,11,32,5,65,0,74,4,64,65,5,16,12,5,65,5,16,13,11,32,6,65,0,74,4,64,65,6,16,12,5,65,6,16,13,11,32,7,65,0,74,4,64,65,7,16,12,5,65,7,16,13,11,11,4,0,35,41,11,6,0,65,0,36,41,11,4,0,35,42,11,4,0,35,43,11,4,0,35,44,11,4,0,35,45,11,4,0,35,46,11,4,0,35,47,11,4,0,35,48,11,4,0,35,49,11,4,0,35,50,11,4,0,35,51,11,10,0,35,50,16,7,65,255,1,113,11,23,0,32,0,65,128,144,126,106,32,1,65,1,113,65,128,192,0,108,106,45,0,0,11,13,0,32,1,65,1,32,0,116,113,65,0,71,11,56,1,1,127,32,0,65,128,144,2,70,4,64,32,1,65,128,1,106,33,2,65,7,32,1,16,29,4,64,32,1,65,128,1,107,33,2,11,32,0,32,2,65,16,108,106,15,11,32,0,32,1,65,16,108,106,11,34,1,1,127,32,0,65,63,113,33,2,32,1,4,64,32,2,65,192,0,106,33,2,11,32,2,65,128,144,4,106,45,0,0,11,18,0,32,0,65,255,1,113,65,8,116,32,1,65,255,1,113,114,11,32,1,1,127,32,0,65,8,108,32,1,65,2,108,106,34,3,65,1,106,32,2,16,31,32,3,32,2,16,31,16,32,11,22,0,32,1,65,31,32,0,65,5,108,116,113,32,0,65,5,108,117,65,8,108,11,74,0,32,2,69,4,64,32,1,16,7,32,0,65,2,108,117,65,3,113,33,0,11,65,242,1,33,1,2,64,2,64,2,64,2,64,2,64,32,0,14,4,4,1,2,3,0,11,12,3,11,65,160,1,33,1,12,2,11,65,216,0,33,1,12,1,11,65,8,33,1,11,32,1,11,152,3,1,11,127,65,128,144,2,33,8,35,52,4,64,65,128,128,2,33,8,11,65,128,176,2,33,9,35,53,4,64,65,128,184,2,33,9,11,3,64,32,3,65,128,2,72,4,64,65,0,33,4,3,64,32,4,65,128,2,72,4,64,32,8,32,9,32,3,65,3,117,65,32,108,106,32,4,65,3,117,106,34,1,65,0,16,28,16,30,33,10,32,3,65,8,111,33,2,65,7,32,4,65,8,111,107,33,6,65,0,33,5,35,36,4,127,32,0,65,0,74,5,35,36,11,65,1,113,4,64,32,1,65,1,16,28,33,5,11,65,6,32,5,16,29,4,64,65,7,32,2,107,33,2,11,65,0,33,7,65,3,32,5,16,29,4,64,65,1,33,7,11,32,10,32,2,65,2,108,106,32,7,16,28,33,11,65,0,33,1,32,6,32,10,32,2,65,2,108,106,65,1,106,32,7,16,28,16,29,4,64,65,2,33,1,11,32,6,32,11,16,29,4,64,32,1,65,1,106,33,1,11,32,3,65,128,2,108,32,4,106,65,3,108,33,6,35,36,4,127,32,0,65,0,74,5,35,36,11,65,1,113,4,64,65,0,32,5,65,7,113,32,1,65,0,16,33,34,1,16,34,33,5,65,1,32,1,16,34,33,7,65,2,32,1,16,34,33,2,32,6,65,128,152,14,106,34,1,32,5,58,0,0,32,1,65,1,106,32,7,58,0,0,32,1,65,2,106,32,2,58,0,0,5,32,1,65,199,254,3,65,0,16,35,33,1,65,0,33,2,3,64,32,2,65,3,72,4,64,32,6,65,128,152,14,106,32,2,106,32,1,58,0,0,32,2,65,1,106,33,2,12,1,11,11,11,32,4,65,1,106,33,4,12,1,11,11,32,3,65,1,106,33,3,12,1,11,11,11,13,0,32,1,32,2,108,32,0,106,65,3,108,11,11,0,32,1,65,160,1,108,32,0,106,11,40,1,1,127,32,2,65,3,113,33,4,32,3,4,64,65,2,32,4,16,8,33,4,11,32,0,32,1,16,38,65,128,160,4,106,32,4,58,0,0,11,180,2,1,6,127,32,1,32,0,16,30,34,0,32,5,65,2,108,106,32,2,16,28,33,17,32,0,32,5,65,2,108,106,65,1,106,32,2,16,28,33,18,32,3,33,0,3,64,32,0,32,4,76,4,64,32,6,32,0,32,3,107,106,34,15,32,8,72,4,64,32,0,33,1,32,12,65,0,72,34,13,4,127,32,13,5,65,5,32,12,16,29,69,11,65,1,113,4,64,65,7,32,1,107,33,1,11,65,0,33,13,32,1,32,18,16,29,4,64,65,2,33,13,11,32,1,32,17,16,29,4,64,32,13,65,1,106,33,13,11,32,12,65,0,78,4,127,65,0,32,12,65,7,113,32,13,65,0,16,33,34,2,16,34,33,16,65,1,32,2,16,34,33,1,65,2,32,2,16,34,5,32,11,65,0,76,4,64,65,199,254,3,33,11,11,32,13,32,11,32,10,16,35,34,2,33,16,32,2,34,1,11,33,5,32,9,32,15,32,7,32,8,16,37,34,2,106,32,16,58,0,0,32,9,32,2,106,65,1,106,32,1,58,0,0,32,9,32,2,106,65,2,106,32,5,58,0,0,65,0,33,1,32,12,65,0,78,4,64,65,7,32,12,16,29,33,1,11,32,15,32,7,32,13,32,1,16,39,32,14,65,1,106,33,14,11,32,0,65,1,106,33,0,12,1,11,11,32,14,11,199,1,1,6,127,3,64,32,2,65,23,72,4,64,65,0,33,0,3,64,32,0,65,31,72,4,64,65,0,33,4,32,0,65,15,74,4,64,65,1,33,4,11,32,2,33,1,32,2,65,15,74,4,64,32,1,65,15,107,33,1,11,32,1,65,4,116,33,1,32,0,65,15,74,4,127,32,1,32,0,65,15,107,106,5,32,1,32,0,106,11,33,1,65,128,128,2,33,5,32,2,65,15,74,4,64,65,128,144,2,33,5,11,65,0,33,3,3,64,32,3,65,8,72,4,64,32,1,32,5,32,4,65,0,65,7,32,3,32,0,65,8,108,32,2,65,8,108,32,3,106,65,248,1,65,128,152,26,65,1,65,0,65,127,16,40,26,32,3,65,1,106,33,3,12,1,11,11,32,0,65,1,106,33,0,12,1,11,11,32,2,65,1,106,33,2,12,1,11,11,11,12,0,35,54,4,64,65,1,15,11,65,0,11,18,0,32,0,32,1,32,2,32,3,32,4,32,5,32,6,16,0,11,164,1,1,2,127,65,199,2,16,7,33,0,65,0,36,55,65,0,36,56,65,0,36,57,65,0,36,58,65,0,36,35,32,0,4,64,32,0,65,1,78,34,1,4,127,32,0,65,3,76,5,32,1,11,65,1,113,4,64,65,1,36,56,5,32,0,65,5,78,34,1,4,127,32,0,65,6,76,5,32,1,11,65,1,113,4,64,65,1,36,57,5,32,0,65,15,78,34,1,4,127,32,0,65,19,76,5,32,1,11,65,1,113,4,64,65,1,36,58,5,32,0,65,25,78,34,1,4,127,32,0,65,30,76,5,32,1,11,65,1,113,4,64,65,1,36,35,11,11,11,11,5,65,1,36,55,11,65,1,36,34,65,0,36,38,11,108,0,35,36,4,64,65,145,1,36,59,65,192,254,3,65,145,1,16,9,65,193,254,3,65,129,1,16,9,65,196,254,3,65,144,1,16,9,65,199,254,3,65,252,1,16,9,5,65,145,1,36,59,65,192,254,3,65,145,1,16,9,65,193,254,3,65,133,1,16,9,65,198,254,3,65,255,1,16,9,65,199,254,3,65,252,1,16,9,65,200,254,3,65,255,1,16,9,65,201,254,3,65,255,1,16,9,11,11,47,0,65,144,254,3,65,128,1,16,9,65,145,254,3,65,191,1,16,9,65,146,254,3,65,243,1,16,9,65,147,254,3,65,193,1,16,9,65,148,254,3,65,191,1,16,9,11,44,0,65,149,254,3,65,255,1,16,9,65,150,254,3,65,63,16,9,65,151,254,3,65,0,16,9,65,152,254,3,65,0,16,9,65,153,254,3,65,184,1,16,9,11,50,0,65,154,254,3,65,255,0,16,9,65,155,254,3,65,255,1,16,9,65,156,254,3,65,159,1,16,9,65,157,254,3,65,0,16,9,65,158,254,3,65,184,1,16,9,65,1,36,60,11,45,0,65,159,254,3,65,255,1,16,9,65,160,254,3,65,255,1,16,9,65,161,254,3,65,0,16,9,65,162,254,3,65,0,16,9,65,163,254,3,65,191,1,16,9,11,45,0,16,46,16,47,16,48,16,49,65,164,254,3,65,247,0,16,9,65,165,254,3,65,243,1,16,9,65,166,254,3,65,241,1,16,9,65,1,36,61,65,1,36,62,11,98,1,1,127,65,128,2,33,0,35,68,4,64,65,128,4,33,0,11,2,64,2,64,2,64,2,64,2,64,35,65,14,3,1,2,3,0,11,12,3,11,65,128,8,33,0,35,68,4,64,65,128,16,33,0,11,32,0,15,11,65,16,33,0,35,68,4,64,65,32,33,0,11,32,0,15,11,65,192,0,33,0,35,68,4,64,65,254,0,33,0,11,32,0,15,11,32,0,11,32,0,65,2,32,0,16,29,36,64,35,64,69,4,64,15,11,32,0,65,3,113,36,65,65,0,36,66,16,51,36,67,11,62,0,35,36,4,64,65,132,254,3,65,47,16,9,65,47,36,63,65,135,254,3,65,248,1,16,9,65,248,1,16,52,5,65,132,254,3,65,171,1,16,9,65,171,1,36,63,65,135,254,3,65,248,1,16,9,65,248,1,16,52,11,11,128,4,1,2,127,65,195,2,16,7,34,3,65,192,1,70,34,2,4,127,32,2,5,32,0,65,0,74,34,2,4,127,32,3,65,128,1,70,5,32,2,11,65,1,113,11,65,1,113,4,64,65,1,36,36,11,65,4,65,1,32,1,65,241,177,127,65,241,177,127,65,241,177,127,65,241,177,127,16,43,32,1,65,0,76,4,64,35,36,4,64,65,17,36,42,65,128,1,36,49,65,0,36,43,65,0,36,44,65,255,1,36,45,65,214,0,36,46,65,0,36,47,65,13,36,48,65,128,2,36,50,65,254,255,3,36,51,65,240,254,3,65,248,1,16,9,65,207,254,3,65,254,1,16,9,65,205,254,3,65,254,0,16,9,65,128,254,3,65,207,1,16,9,65,130,254,3,65,252,0,16,9,65,143,254,3,65,225,1,16,9,65,232,254,3,65,192,1,16,9,65,233,254,3,65,255,1,16,9,65,234,254,3,65,193,1,16,9,65,235,254,3,65,13,16,9,65,207,254,3,65,0,16,9,65,240,254,3,65,1,16,9,65,209,254,3,65,255,1,16,9,65,210,254,3,65,255,1,16,9,65,211,254,3,65,255,1,16,9,65,212,254,3,65,255,1,16,9,65,213,254,3,65,255,1,16,9,65,236,254,3,65,254,1,16,9,65,245,254,3,65,143,1,16,9,5,65,1,36,42,65,176,1,36,49,65,0,36,43,65,19,36,44,65,0,36,45,65,216,1,36,46,65,1,36,47,65,205,0,36,48,65,128,2,36,50,65,254,255,3,36,51,65,240,254,3,65,255,1,16,9,65,207,254,3,65,255,1,16,9,65,205,254,3,65,255,1,16,9,65,128,254,3,65,207,1,16,9,65,130,254,3,65,254,0,16,9,65,143,254,3,65,225,1,16,9,65,232,254,3,65,255,1,16,9,65,233,254,3,65,255,1,16,9,65,234,254,3,65,255,1,16,9,65,235,254,3,65,255,1,16,9,65,207,254,3,65,0,16,9,65,240,254,3,65,1,16,9,65,209,254,3,65,255,1,16,9,65,210,254,3,65,255,1,16,9,65,211,254,3,65,255,1,16,9,65,212,254,3,65,255,1,16,9,65,213,254,3,65,255,1,16,9,11,16,44,16,45,16,50,16,53,11,11,12,0,32,0,32,1,16,54,65,0,36,54,11,16,0,35,68,4,64,65,160,201,8,15,11,65,208,164,4,11,18,0,35,50,65,1,106,65,255,255,3,113,16,7,65,255,1,113,11,13,0,16,57,16,27,16,32,65,255,255,3,113,11,12,0,32,0,65,128,254,3,113,65,8,117,11,8,0,32,0,65,255,1,113,11,248,2,1,2,127,35,55,4,64,15,11,32,0,65,255,63,76,4,64,35,57,4,127,65,4,32,1,65,255,1,113,16,29,69,5,35,57,11,65,1,113,69,4,64,32,1,65,15,113,34,2,4,64,32,2,65,10,70,4,64,65,1,36,71,11,5,65,0,36,71,11,11,5,32,0,65,255,255,0,76,4,64,35,35,69,34,2,4,127,32,2,5,32,0,65,255,223,0,76,11,65,1,113,4,64,35,57,4,64,32,1,65,15,113,36,34,11,32,1,33,2,35,56,4,64,32,2,65,31,113,33,2,35,34,65,224,1,113,36,34,5,35,58,4,64,32,2,65,255,0,113,33,2,35,34,65,128,1,113,36,34,5,35,35,4,64,35,34,65,0,113,36,34,11,11,11,35,34,32,2,114,36,34,5,65,0,33,2,35,34,16,60,33,3,32,1,65,0,74,4,64,65,1,33,2,11,32,2,32,3,16,32,36,34,11,5,35,57,69,34,3,4,127,32,0,65,255,191,1,76,5,32,3,11,65,1,113,4,64,35,56,4,127,35,72,5,35,56,11,65,1,113,4,64,35,34,65,31,113,36,34,35,34,32,1,65,224,1,113,114,36,34,15,11,35,58,4,64,32,1,65,8,78,34,3,4,127,32,1,65,12,76,5,32,3,11,26,11,32,1,33,3,35,35,4,127,32,3,65,15,113,5,32,3,65,3,113,11,34,3,36,38,5,35,57,69,34,3,4,127,32,0,65,255,255,1,76,5,32,3,11,65,1,113,4,64,35,56,4,64,65,0,32,1,65,255,1,113,16,29,4,64,65,1,36,72,5,65,0,36,72,11,11,11,11,11,11,11,14,0,35,68,4,64,65,174,1,15,11,65,215,0,11,16,0,35,68,4,64,65,128,128,1,15,11,65,128,192,0,11,42,1,1,127,35,77,65,0,74,34,0,4,127,35,78,5,32,0,11,65,1,113,4,64,35,77,65,1,107,36,77,11,35,77,69,4,64,65,0,36,79,11,11,42,1,1,127,35,80,65,0,74,34,0,4,127,35,81,5,32,0,11,65,1,113,4,64,35,80,65,1,107,36,80,11,35,80,69,4,64,65,0,36,82,11,11,42,1,1,127,35,83,65,0,74,34,0,4,127,35,84,5,32,0,11,65,1,113,4,64,35,83,65,1,107,36,83,11,35,83,69,4,64,65,0,36,85,11,11,42,1,1,127,35,86,65,0,74,34,0,4,127,35,87,5,32,0,11,65,1,113,4,64,35,86,65,1,107,36,86,11,35,86,69,4,64,65,0,36,88,11,11,29,1,1,127,35,92,35,93,117,33,0,35,94,4,127,35,92,32,0,107,5,35,92,32,0,106,11,34,0,11,64,1,2,127,65,148,254,3,16,7,65,248,1,113,32,0,65,8,117,34,1,114,33,2,65,147,254,3,32,0,65,255,1,113,34,0,16,9,65,148,254,3,32,2,16,9,32,0,36,95,32,1,36,96,35,96,65,8,116,35,95,114,36,97,11,56,1,2,127,16,68,34,0,65,255,15,76,34,1,4,127,35,93,65,0,74,5,32,1,11,65,1,113,4,64,32,0,36,92,32,0,16,69,16,68,33,0,11,32,0,65,255,15,74,4,64,65,0,36,79,11,11,42,0,35,89,65,1,107,36,89,35,89,65,0,76,4,64,35,90,36,89,35,91,4,127,35,90,65,0,74,5,35,91,11,65,1,113,4,64,16,70,11,11,11,84,1,1,127,35,98,65,1,107,36,98,35,98,65,0,76,4,64,35,99,36,98,35,98,4,64,35,100,4,127,35,101,65,15,72,5,35,100,11,65,1,113,4,64,35,101,65,1,106,36,101,5,35,100,69,34,0,4,127,35,101,65,0,74,5,32,0,11,65,1,113,4,64,35,101,65,1,107,36,101,11,11,11,11,11,84,1,1,127,35,102,65,1,107,36,102,35,102,65,0,76,4,64,35,103,36,102,35,102,4,64,35,104,4,127,35,105,65,15,72,5,35,104,11,65,1,113,4,64,35,105,65,1,106,36,105,5,35,104,69,34,0,4,127,35,105,65,0,74,5,32,0,11,65,1,113,4,64,35,105,65,1,107,36,105,11,11,11,11,11,84,1,1,127,35,106,65,1,107,36,106,35,106,65,0,76,4,64,35,107,36,106,35,106,4,64,35,108,4,127,35,109,65,15,72,5,35,108,11,65,1,113,4,64,35,109,65,1,106,36,109,5,35,108,69,34,0,4,127,35,109,65,0,74,5,32,0,11,65,1,113,4,64,35,109,65,1,107,36,109,11,11,11,11,11,134,1,0,35,75,32,0,106,36,75,35,75,16,63,78,4,64,35,75,16,63,107,36,75,2,64,2,64,2,64,2,64,2,64,2,64,2,64,35,76,14,8,1,0,2,0,3,0,4,5,0,11,12,5,11,16,64,16,65,16,66,16,67,12,4,11,16,64,16,65,16,66,16,67,16,71,12,3,11,16,64,16,65,16,66,16,67,12,2,11,16,64,16,65,16,66,16,67,16,71,12,1,11,16,72,16,73,16,74,11,35,76,65,1,106,36,76,35,76,65,8,78,4,64,65,0,36,76,11,65,1,15,11,65,0,11,25,0,35,110,32,0,106,36,110,35,111,35,110,107,65,0,74,4,64,65,0,15,11,65,1,11,108,0,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,1,107,14,4,1,2,3,4,0,11,12,4,11,35,112,35,113,71,4,64,35,113,36,112,65,1,15,11,65,0,15,11,35,114,35,115,71,4,64,35,115,36,114,65,1,15,11,65,0,15,11,35,116,35,117,71,4,64,35,117,36,116,65,1,15,11,65,0,15,11,35,118,35,119,71,4,64,35,119,36,118,65,1,15,11,65,0,15,11,65,0,11,25,0,35,120,32,0,106,36,120,35,121,35,120,107,65,0,74,4,64,65,0,15,11,65,1,11,41,1,1,127,35,122,32,0,106,36,122,35,123,35,122,107,65,0,74,34,1,4,127,35,60,69,5,32,1,11,65,1,113,4,64,65,0,15,11,65,1,11,25,0,35,124,32,0,106,36,124,35,125,35,124,107,65,0,74,4,64,65,0,15,11,65,1,11,25,0,65,128,16,35,97,107,65,4,108,36,111,35,68,4,64,35,111,65,2,108,36,111,11,11,60,0,2,64,2,64,2,64,2,64,2,64,32,0,65,1,107,14,3,1,2,3,0,11,12,3,11,32,1,65,129,1,16,29,15,11,32,1,65,135,1,16,29,15,11,32,1,65,254,0,16,29,15,11,32,1,65,1,16,29,11,115,1,1,127,35,111,32,0,107,36,111,35,111,65,0,76,4,64,35,111,34,0,65,0,32,0,107,32,0,65,0,74,27,33,0,16,81,35,111,32,0,107,36,111,35,127,65,1,106,36,127,35,127,65,8,78,4,64,65,0,36,127,11,11,35,79,4,127,35,113,5,35,79,11,65,1,113,4,64,35,101,33,0,5,65,15,15,11,65,1,33,1,35,128,1,35,127,16,82,69,4,64,65,127,33,1,11,32,1,32,0,108,65,15,106,11,16,1,1,127,35,110,33,0,65,0,36,110,32,0,16,83,11,26,0,65,128,16,35,130,1,107,65,4,108,36,121,35,68,4,64,35,121,65,2,108,36,121,11,11,120,1,1,127,35,121,32,0,107,36,121,35,121,65,0,76,4,64,35,121,34,0,65,0,32,0,107,32,0,65,0,74,27,33,0,16,85,35,121,32,0,107,36,121,35,131,1,65,1,106,36,131,1,35,131,1,65,8,78,4,64,65,0,36,131,1,11,11,35,82,4,127,35,115,5,35,82,11,65,1,113,4,64,35,105,33,0,5,65,15,15,11,65,1,33,1,35,132,1,35,131,1,16,82,69,4,64,65,127,33,1,11,32,1,32,0,108,65,15,106,11,16,1,1,127,35,120,33,0,65,0,36,120,32,0,16,86,11,26,0,65,128,16,35,134,1,107,65,2,108,36,123,35,68,4,64,35,123,65,2,108,36,123,11,11,251,1,1,2,127,35,123,32,0,107,36,123,35,123,65,0,76,4,64,35,123,34,1,65,0,32,1,107,32,1,65,0,74,27,33,1,16,88,35,123,32,1,107,36,123,35,135,1,65,1,106,36,135,1,35,135,1,65,32,78,4,64,65,0,36,135,1,11,11,65,0,33,1,35,136,1,33,2,35,85,4,127,35,117,5,35,85,11,65,1,113,4,64,35,60,4,64,65,156,254,3,16,7,65,5,117,65,15,113,34,2,36,136,1,65,0,36,60,11,5,65,15,15,11,35,135,1,65,2,109,65,176,254,3,106,16,7,33,0,35,135,1,65,2,111,4,127,32,0,65,15,113,5,32,0,65,4,117,65,15,113,11,33,0,2,64,2,64,2,64,2,64,2,64,2,64,32,2,14,3,1,2,3,0,11,12,3,11,32,0,65,4,117,33,0,12,3,11,65,1,33,1,12,2,11,32,0,65,1,117,33,0,65,2,33,1,12,1,11,32,0,65,2,117,33,0,65,4,33,1,11,32,1,65,0,74,4,127,32,0,32,1,109,5,65,0,11,34,0,65,15,106,11,16,1,1,127,35,122,33,0,65,0,36,122,32,0,16,89,11,27,1,1,127,35,138,1,35,139,1,116,33,0,35,68,4,64,32,0,65,2,108,33,0,11,32,0,11,161,1,1,1,127,35,125,32,0,107,36,125,35,125,65,0,76,4,64,35,125,34,0,65,0,32,0,107,32,0,65,0,74,27,33,0,16,91,36,125,35,125,32,0,107,36,125,35,140,1,65,1,113,35,140,1,65,1,117,65,1,113,115,33,1,35,140,1,65,1,117,36,140,1,35,140,1,32,1,65,14,116,114,36,140,1,35,141,1,4,64,35,140,1,65,191,127,113,36,140,1,35,140,1,32,1,65,6,116,114,36,140,1,11,11,35,88,4,127,35,119,5,35,88,11,65,1,113,4,64,35,109,33,1,5,65,15,15,11,65,0,35,140,1,16,29,4,127,65,127,5,65,1,11,34,0,32,1,108,65,15,106,11,16,1,1,127,35,124,33,0,65,0,36,124,32,0,16,92,11,18,0,35,68,4,64,65,128,128,128,4,15,11,65,128,128,128,2,11,4,0,16,94,11,52,1,1,127,32,0,65,60,70,4,64,65,255,0,15,11,32,0,65,60,107,65,160,141,6,34,2,108,32,1,108,65,8,109,65,160,141,6,109,65,60,106,65,160,141,6,108,65,140,241,2,109,11,203,1,1,2,127,65,0,36,61,35,145,1,4,127,65,0,32,0,106,5,65,15,11,33,4,35,146,1,4,127,32,4,32,1,106,5,32,4,65,15,106,11,33,4,35,147,1,4,127,32,4,32,2,106,5,32,4,65,15,106,11,33,4,35,148,1,4,127,32,4,32,3,106,5,32,4,65,15,106,11,33,4,35,149,1,4,127,65,0,32,0,106,5,65,15,11,33,5,35,150,1,4,127,32,5,32,1,106,5,32,5,65,15,106,11,33,5,35,151,1,4,127,32,5,32,2,106,5,32,5,65,15,106,11,33,5,35,152,1,4,127,32,5,32,3,106,5,32,5,65,15,106,11,33,5,65,0,36,62,65,0,36,142,1,32,4,35,153,1,65,1,106,16,96,33,0,32,5,35,154,1,65,1,106,16,96,33,1,32,0,36,155,1,32,1,36,156,1,32,0,32,1,16,32,11,37,1,1,127,32,2,65,2,108,65,128,248,35,106,34,3,32,0,65,1,106,58,0,0,32,3,65,1,106,32,1,65,1,106,58,0,0,11,167,2,1,4,127,32,0,16,76,34,1,4,127,32,1,5,65,1,16,77,11,65,1,113,33,1,32,0,16,78,34,2,4,127,32,2,5,65,2,16,77,11,65,1,113,33,2,32,0,16,79,34,3,4,127,32,3,5,65,3,16,77,11,65,1,113,33,3,32,0,16,80,34,4,4,127,32,4,5,65,4,16,77,11,65,1,113,33,4,32,1,4,64,16,84,36,126,11,32,2,4,64,16,87,36,129,1,11,32,3,4,64,16,90,36,133,1,11,32,4,4,64,16,93,36,137,1,11,32,1,4,127,32,1,5,32,2,11,65,1,113,34,1,4,127,32,1,5,32,3,11,65,1,113,34,1,4,127,32,1,5,32,4,11,65,1,113,4,64,65,1,36,142,1,11,35,143,1,32,0,35,144,1,108,106,36,143,1,35,143,1,16,95,78,4,64,35,143,1,16,95,107,36,143,1,35,142,1,4,127,35,142,1,5,35,61,11,65,1,113,34,1,4,127,32,1,5,35,62,11,65,1,113,4,64,35,126,35,129,1,35,133,1,35,137,1,16,97,26,11,35,155,1,65,1,106,35,156,1,65,1,106,35,41,16,98,35,41,65,1,106,36,41,35,41,35,157,1,65,2,109,65,1,107,78,4,64,35,41,65,1,107,36,41,11,11,11,135,1,1,4,127,32,0,16,83,33,1,32,0,16,86,33,2,32,0,16,89,33,3,32,0,16,92,33,4,32,1,36,126,32,2,36,129,1,32,3,36,133,1,32,4,36,137,1,35,143,1,32,0,35,144,1,108,106,36,143,1,35,143,1,16,95,78,4,64,35,143,1,16,95,107,36,143,1,32,1,32,2,32,3,32,4,16,97,34,0,16,59,65,1,106,32,0,16,60,65,1,106,35,41,16,98,35,41,65,1,106,36,41,35,41,35,157,1,65,2,109,65,1,107,78,4,64,35,41,65,1,107,36,41,11,11,11,36,1,1,127,32,0,16,75,33,1,35,18,4,127,32,1,69,5,35,18,11,65,1,113,4,64,32,0,16,99,5,32,0,16,100,11,11,35,0,35,74,16,62,72,4,64,15,11,3,64,35,74,16,62,78,4,64,16,62,16,101,35,74,16,62,107,36,74,12,1,11,11,11,28,0,32,0,65,240,0,113,65,4,117,36,90,65,3,32,0,16,29,36,94,32,0,65,7,113,36,93,11,10,0,65,7,32,0,16,29,36,117,11,30,0,32,0,65,6,117,65,3,113,36,128,1,32,0,65,63,113,36,159,1,65,192,0,35,159,1,107,36,77,11,30,0,32,0,65,6,117,65,3,113,36,132,1,32,0,65,63,113,36,160,1,65,192,0,35,160,1,107,36,80,11,16,0,32,0,36,161,1,65,128,2,35,161,1,107,36,83,11,19,0,32,0,65,63,113,36,162,1,65,192,0,35,162,1,107,36,86,11,39,0,32,0,65,4,117,65,15,113,36,163,1,65,3,32,0,16,29,36,100,32,0,65,7,113,36,99,32,0,65,248,1,113,65,0,74,36,113,11,39,0,32,0,65,4,117,65,15,113,36,164,1,65,3,32,0,16,29,36,104,32,0,65,7,113,36,103,32,0,65,248,1,113,65,0,74,36,115,11,13,0,32,0,65,5,117,65,15,113,36,165,1,11,39,0,32,0,65,4,117,65,15,113,36,166,1,65,3,32,0,16,29,36,108,32,0,65,7,113,36,107,32,0,65,248,1,113,65,0,74,36,119,11,16,0,32,0,36,95,35,96,65,8,116,35,95,114,36,97,11,20,0,32,0,36,167,1,35,168,1,65,8,116,35,167,1,114,36,130,1,11,20,0,32,0,36,169,1,35,170,1,65,8,116,35,169,1,114,36,134,1,11,124,0,32,0,65,4,117,36,139,1,65,3,32,0,16,29,36,141,1,32,0,65,7,113,36,171,1,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,35,171,1,14,8,1,2,3,4,5,6,7,8,0,11,12,8,11,65,8,36,138,1,15,11,65,16,36,138,1,15,11,65,32,36,138,1,15,11,65,48,36,138,1,15,11,65,192,0,36,138,1,15,11,65,208,0,36,138,1,15,11,65,224,0,36,138,1,15,11,65,240,0,36,138,1,11,11,27,0,65,6,32,0,16,29,36,78,32,0,65,7,113,36,96,35,96,65,8,116,35,95,114,36,97,11,91,1,1,127,65,1,36,79,35,77,69,4,64,65,192,0,36,77,11,16,81,35,99,36,98,35,163,1,36,101,35,97,36,92,35,90,36,89,35,90,65,0,74,34,0,4,127,35,93,65,0,74,5,32,0,11,65,1,113,4,64,65,1,36,91,5,65,0,36,91,11,35,93,65,0,74,4,64,16,70,11,35,113,69,4,64,65,0,36,79,11,11,31,0,65,6,32,0,16,29,36,81,32,0,65,7,113,36,168,1,35,168,1,65,8,116,35,167,1,114,36,130,1,11,38,0,65,1,36,82,35,80,69,4,64,65,192,0,36,80,11,16,85,35,103,36,102,35,164,1,36,105,35,115,69,4,64,65,0,36,82,11,11,31,0,65,6,32,0,16,29,36,84,32,0,65,7,113,36,170,1,35,170,1,65,8,116,35,169,1,114,36,134,1,11,34,0,65,1,36,85,35,83,69,4,64,65,128,2,36,83,11,16,88,65,0,36,135,1,35,117,69,4,64,65,0,36,85,11,11,10,0,65,6,32,0,16,29,36,87,11,47,0,65,1,36,88,35,86,69,4,64,65,192,0,36,86,11,16,91,36,125,35,107,36,106,35,166,1,36,109,65,255,255,1,36,140,1,35,119,69,4,64,65,0,36,88,11,11,21,0,32,0,65,4,117,65,7,113,36,153,1,32,0,65,7,113,36,154,1,11,74,0,65,7,32,0,16,29,36,148,1,65,6,32,0,16,29,36,147,1,65,5,32,0,16,29,36,146,1,65,4,32,0,16,29,36,145,1,65,3,32,0,16,29,36,152,1,65,2,32,0,16,29,36,151,1,65,1,32,0,16,29,36,150,1,65,0,32,0,16,29,36,149,1,11,11,0,65,7,32,0,16,29,36,158,1,11,129,3,1,1,127,32,0,65,166,254,3,71,34,2,4,127,35,158,1,69,5,32,2,11,65,1,113,4,64,65,0,15,11,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,144,254,3,107,14,23,1,3,7,11,15,0,4,8,12,16,2,5,9,13,17,0,6,10,14,18,19,20,21,0,11,12,21,11,32,1,16,103,65,1,15,11,32,1,16,104,65,1,15,11,32,1,16,105,65,1,15,11,32,1,16,106,65,1,15,11,32,1,16,107,65,1,15,11,32,1,16,108,65,1,15,11,32,1,16,109,65,1,15,11,32,1,16,110,65,1,15,11,65,1,36,60,32,1,16,111,65,1,15,11,32,1,16,112,65,1,15,11,32,1,16,113,65,1,15,11,32,1,16,114,65,1,15,11,32,1,16,115,65,1,15,11,32,1,16,116,65,1,15,11,65,7,32,1,16,29,4,64,32,1,16,117,16,118,11,65,1,15,11,65,7,32,1,16,29,4,64,32,1,16,119,16,120,11,65,1,15,11,65,7,32,1,16,29,4,64,32,1,16,121,16,122,11,65,1,15,11,65,7,32,1,16,29,4,64,32,1,16,123,16,124,11,65,1,15,11,32,1,16,125,65,1,36,61,65,1,15,11,32,1,16,126,65,1,36,62,65,1,15,11,32,1,16,127,65,7,32,1,16,29,69,4,64,65,144,254,3,33,0,3,64,32,0,65,166,254,3,72,4,64,32,0,65,0,16,9,32,0,65,1,106,33,0,12,1,11,11,11,65,1,15,11,65,1,11,72,0,65,7,32,0,16,29,36,172,1,65,6,32,0,16,29,36,173,1,65,5,32,0,16,29,36,174,1,65,4,32,0,16,29,36,52,65,3,32,0,16,29,36,53,65,2,32,0,16,29,36,175,1,65,1,32,0,16,29,36,176,1,65,0,32,0,16,29,36,177,1,11,54,1,1,127,32,0,65,8,116,33,0,3,64,32,1,65,159,1,76,4,64,32,1,65,128,252,3,106,32,0,32,1,106,16,7,16,9,32,1,65,1,106,33,1,12,1,11,11,65,132,5,36,179,1,11,19,0,35,186,1,16,7,35,187,1,16,7,16,32,65,240,255,3,113,11,23,0,35,188,1,16,7,35,189,1,16,7,16,32,65,240,63,113,65,128,128,2,106,11,13,0,32,1,65,1,32,0,116,65,127,115,113,11,115,1,1,127,32,0,65,166,254,3,70,4,64,65,166,254,3,16,7,65,128,1,113,33,1,35,79,4,127,65,0,32,1,16,8,5,65,0,32,1,16,133,1,11,26,35,82,4,127,65,1,32,1,16,8,5,65,1,32,1,16,133,1,11,26,35,85,4,127,65,2,32,1,16,8,5,65,2,32,1,16,133,1,11,26,35,88,4,127,65,3,32,1,16,8,5,65,3,32,1,16,133,1,11,26,32,1,65,240,0,114,15,11,65,127,11,193,1,1,1,127,35,30,33,0,35,31,4,64,35,22,4,127,65,2,32,0,16,133,1,5,65,2,32,0,16,8,11,33,0,35,23,4,127,65,0,32,0,16,133,1,5,65,0,32,0,16,8,11,33,0,35,24,4,127,65,3,32,0,16,133,1,5,65,3,32,0,16,8,11,33,0,35,25,4,127,65,1,32,0,16,133,1,5,65,1,32,0,16,8,11,33,0,5,35,32,4,64,35,26,4,127,65,0,32,0,16,133,1,5,65,0,32,0,16,8,11,33,0,35,27,4,127,65,1,32,0,16,133,1,5,65,1,32,0,16,8,11,33,0,35,28,4,127,65,2,32,0,16,133,1,5,65,2,32,0,16,8,11,33,0,35,29,4,127,65,3,32,0,16,133,1,5,65,3,32,0,16,8,11,33,0,11,11,32,0,65,240,1,114,11,147,2,1,1,127,32,0,65,128,128,2,34,1,72,4,64,65,127,15,11,32,0,65,128,128,2,78,34,1,4,127,32,0,65,128,192,2,72,5,32,1,11,65,1,113,4,64,65,127,15,11,32,0,65,128,192,3,78,34,1,4,127,32,0,65,128,252,3,72,5,32,1,11,65,1,113,4,64,32,0,65,128,192,0,107,16,7,15,11,32,0,65,128,252,3,78,34,1,4,127,32,0,65,159,253,3,76,5,32,1,11,65,1,113,4,64,35,73,65,2,72,4,64,65,255,1,15,11,65,127,15,11,32,0,65,196,254,3,70,4,64,32,0,35,59,16,9,35,59,15,11,32,0,65,144,254,3,78,34,1,4,127,32,0,65,166,254,3,76,5,32,1,11,65,1,113,4,64,16,102,32,0,16,134,1,15,11,32,0,65,176,254,3,78,34,1,4,127,32,0,65,191,254,3,76,5,32,1,11,65,1,113,4,64,16,102,65,127,15,11,32,0,65,132,254,3,70,4,64,32,0,35,63,16,9,35,63,15,11,32,0,65,133,254,3,70,4,64,32,0,35,193,1,16,9,35,193,1,15,11,32,0,65,128,254,3,70,4,64,16,135,1,15,11,65,127,11,28,1,1,127,32,0,16,136,1,34,1,65,127,70,4,64,32,0,16,7,15,11,32,1,65,255,1,113,11,101,1,3,127,3,64,32,4,32,2,72,4,64,32,0,32,4,106,16,137,1,33,5,32,1,32,4,106,33,3,3,64,32,3,65,255,191,2,74,4,64,32,3,65,128,192,0,107,33,3,12,1,11,11,32,3,32,5,16,155,1,32,4,65,1,106,33,4,12,1,11,11,65,32,33,3,35,68,4,64,65,192,0,33,3,11,35,179,1,32,3,32,2,65,16,109,108,106,36,179,1,11,142,1,1,3,127,35,36,69,4,64,15,11,35,185,1,4,127,65,7,32,0,16,29,69,5,35,185,1,11,65,1,113,4,64,65,0,36,185,1,35,184,1,16,7,33,1,35,184,1,65,7,32,1,16,8,16,9,15,11,16,131,1,33,1,16,132,1,33,2,65,7,32,0,16,133,1,65,1,106,65,16,108,33,3,65,7,32,0,16,29,4,64,65,1,36,185,1,32,3,36,190,1,32,1,36,191,1,32,2,36,192,1,35,184,1,65,7,32,0,16,133,1,16,9,5,32,1,32,2,32,3,16,138,1,35,184,1,65,255,1,16,9,11,11,36,1,1,127,32,0,65,63,113,33,3,32,2,4,64,32,3,65,192,0,106,33,3,11,32,3,65,128,144,4,106,32,1,58,0,0,11,24,0,65,7,32,0,16,29,4,64,32,1,65,7,32,0,65,1,106,16,8,16,9,11,11,76,1,2,127,32,0,35,196,1,70,34,2,4,127,32,2,5,32,0,35,195,1,70,11,65,1,113,4,64,65,6,32,0,65,1,107,16,7,16,133,1,33,2,32,0,35,195,1,70,4,64,65,1,33,3,11,32,2,32,1,32,3,16,140,1,32,2,32,0,65,1,107,16,141,1,11,11,5,0,65,128,2,11,51,0,35,198,1,32,0,106,36,198,1,35,198,1,16,143,1,78,4,64,35,198,1,16,143,1,107,36,198,1,35,63,65,1,106,36,63,35,63,65,255,1,74,4,64,65,0,36,63,11,11,11,11,0,65,1,36,200,1,65,2,16,10,11,70,0,32,0,16,144,1,35,64,69,4,64,15,11,35,66,32,0,106,36,66,3,64,35,66,35,67,78,4,64,35,66,35,67,107,36,66,35,193,1,65,255,1,78,4,64,35,199,1,36,193,1,16,145,1,5,35,193,1,65,1,106,36,193,1,11,12,1,11,11,11,70,1,1,127,16,143,1,33,0,35,64,4,127,35,67,32,0,72,5,35,64,11,65,1,113,4,64,35,67,33,0,11,35,197,1,32,0,72,4,64,15,11,3,64,35,197,1,32,0,78,4,64,32,0,16,146,1,35,197,1,32,0,107,36,197,1,12,1,11,11,11,24,0,65,0,36,63,65,132,254,3,65,0,16,9,65,0,36,66,35,199,1,36,193,1,11,7,0,32,0,36,193,1,11,7,0,32,0,36,199,1,11,26,0,32,0,65,255,1,115,36,30,65,4,35,30,16,29,36,31,65,5,35,30,16,29,36,32,11,41,0,65,0,32,0,16,29,36,201,1,65,1,32,0,16,29,36,202,1,65,2,32,0,16,29,36,200,1,65,4,32,0,16,29,36,33,32,0,36,40,11,43,0,65,0,32,0,16,29,36,203,1,65,1,32,0,16,29,36,204,1,65,2,32,0,16,29,36,205,1,65,4,32,0,16,29,36,206,1,32,0,36,207,1,11,219,5,1,2,127,32,0,65,128,128,2,34,2,72,4,64,32,0,32,1,16,61,65,0,15,11,32,0,65,128,128,2,78,34,2,4,127,32,0,65,128,192,2,72,5,32,2,11,65,1,113,4,64,65,1,15,11,65,128,252,3,33,3,32,0,65,128,192,3,78,34,2,4,127,32,0,65,128,252,3,72,5,32,2,11,65,1,113,4,64,32,0,65,128,192,0,107,32,1,16,9,65,1,15,11,32,0,65,128,252,3,78,34,2,4,127,32,0,65,159,253,3,76,5,32,2,11,65,1,113,4,64,35,73,65,2,72,4,64,65,0,15,11,65,1,15,11,32,0,65,160,253,3,78,34,2,4,127,32,0,65,255,253,3,76,5,32,2,11,65,1,113,4,64,65,0,15,11,32,0,65,144,254,3,78,34,2,4,127,32,0,65,166,254,3,76,5,32,2,11,65,1,113,4,64,16,102,32,0,32,1,16,128,1,15,11,32,0,65,176,254,3,78,34,2,4,127,32,0,65,191,254,3,76,5,32,2,11,65,1,113,4,64,16,102,11,32,0,65,192,254,3,78,34,2,4,127,32,0,65,203,254,3,76,5,32,2,11,65,1,113,4,64,32,0,65,192,254,3,70,4,64,32,1,16,129,1,65,1,15,11,32,0,65,196,254,3,70,4,64,65,0,36,59,32,0,65,0,16,9,65,0,15,11,32,0,65,197,254,3,70,4,64,32,1,36,178,1,65,1,15,11,32,0,65,198,254,3,70,4,64,32,1,16,130,1,65,1,15,11,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,194,254,3,107,14,10,2,1,0,0,0,0,0,0,4,3,0,11,12,4,11,32,1,36,180,1,65,1,15,11,32,1,36,181,1,65,1,15,11,32,1,36,182,1,65,1,15,11,32,1,36,183,1,65,1,15,11,65,1,15,11,32,0,35,184,1,70,4,64,32,1,16,139,1,65,0,15,11,32,0,35,39,70,34,2,4,127,32,2,5,32,0,35,37,70,11,65,1,113,4,64,35,185,1,4,64,35,191,1,65,128,128,1,78,34,2,4,127,35,191,1,65,255,255,1,76,5,32,2,11,65,1,113,34,2,4,127,32,2,5,35,191,1,65,128,160,3,78,34,2,4,127,35,191,1,65,255,191,3,76,5,32,2,11,65,1,113,11,65,1,113,4,64,65,0,15,11,11,11,32,0,35,194,1,78,34,2,4,127,32,0,35,195,1,76,5,32,2,11,65,1,113,4,64,32,0,32,1,16,142,1,65,1,15,11,32,0,65,132,254,3,78,34,2,4,127,32,0,65,135,254,3,76,5,32,2,11,65,1,113,4,64,16,147,1,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,132,254,3,107,14,4,1,2,3,4,0,11,12,4,11,32,1,16,148,1,65,0,15,11,32,1,16,149,1,65,1,15,11,32,1,16,150,1,65,1,15,11,32,1,16,52,65,1,15,11,65,1,15,11,32,0,65,128,254,3,70,4,64,32,1,16,151,1,11,32,0,65,143,254,3,70,4,64,32,1,16,152,1,65,1,15,11,32,0,65,255,255,3,70,4,64,32,1,16,153,1,65,1,15,11,65,1,11,18,0,32,0,32,1,16,154,1,4,64,32,0,32,1,16,9,11,11,48,1,1,127,65,1,32,0,116,65,255,1,113,33,2,32,1,65,0,74,4,64,35,49,32,2,114,65,255,1,113,36,49,5,35,49,32,2,65,255,1,115,113,36,49,11,35,49,11,10,0,65,5,32,0,16,156,1,26,11,79,1,1,127,32,1,65,0,78,4,64,32,0,65,15,113,32,1,65,15,113,106,65,16,113,4,64,65,1,16,157,1,5,65,0,16,157,1,11,5,32,1,34,2,65,0,32,2,107,32,2,65,0,74,27,65,15,113,32,0,65,15,113,75,4,64,65,1,16,157,1,5,65,0,16,157,1,11,11,11,10,0,65,7,32,0,16,156,1,26,11,10,0,65,6,32,0,16,156,1,26,11,10,0,65,4,32,0,16,156,1,26,11,21,0,32,0,65,1,116,65,255,1,113,32,0,65,7,118,114,65,255,1,113,11,51,1,1,127,32,1,16,59,33,2,32,0,32,1,16,60,34,1,16,154,1,4,64,32,0,32,1,16,9,11,32,0,65,1,106,34,0,32,2,16,154,1,4,64,32,0,32,2,16,9,11,11,123,0,32,2,4,64,32,0,32,1,115,32,0,32,1,106,115,34,2,65,16,113,4,64,65,1,16,157,1,5,65,0,16,157,1,11,32,2,65,128,2,113,4,64,65,1,16,161,1,5,65,0,16,161,1,11,5,32,0,32,1,65,255,255,3,113,106,65,255,255,3,113,34,2,32,0,73,4,64,65,1,16,161,1,5,65,0,16,161,1,11,32,0,32,1,65,255,255,3,113,115,32,2,115,65,128,32,113,4,64,65,1,16,157,1,5,65,0,16,157,1,11,11,11,21,0,32,0,65,1,118,32,0,65,7,116,65,255,1,113,114,65,255,1,113,11,246,4,1,1,127,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,14,16,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,0,11,12,16,11,65,4,15,11,16,58,16,59,65,255,1,113,36,43,16,58,16,60,65,255,1,113,36,44,35,50,65,2,106,65,255,255,3,113,36,50,65,12,15,11,35,43,35,44,16,32,35,42,16,155,1,65,8,15,11,35,43,35,44,16,32,65,255,255,3,113,65,1,106,65,255,255,3,113,34,0,16,59,65,255,1,113,36,43,32,0,16,60,65,255,1,113,36,44,65,8,15,11,35,43,65,1,16,158,1,35,43,65,1,106,65,255,1,113,36,43,35,43,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,4,15,11,35,43,65,127,16,158,1,35,43,65,1,107,65,255,1,113,36,43,35,43,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,1,16,160,1,65,4,15,11,16,27,36,43,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,11,35,42,65,128,1,113,65,128,1,70,4,64,65,1,16,161,1,5,65,0,16,161,1,11,35,42,16,162,1,36,42,65,0,16,159,1,65,0,16,160,1,65,0,16,157,1,65,4,15,11,16,58,35,51,16,163,1,35,50,65,2,106,65,255,255,3,113,36,50,65,20,15,11,35,47,35,48,16,32,65,255,255,3,113,34,0,35,43,35,44,16,32,65,255,255,3,113,34,1,65,0,16,164,1,32,0,32,1,106,65,255,255,3,113,34,0,16,59,65,255,1,113,36,47,32,0,16,60,65,255,1,113,36,48,65,0,16,160,1,65,8,15,11,35,43,35,44,16,32,16,137,1,65,255,1,113,36,42,65,8,15,11,35,43,35,44,16,32,65,255,255,3,113,65,1,107,65,255,255,3,113,34,0,16,59,65,255,1,113,36,43,32,0,16,60,65,255,1,113,36,44,65,8,15,11,35,44,65,1,16,158,1,35,44,65,1,106,65,255,1,113,36,44,35,44,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,4,15,11,35,44,65,127,16,158,1,35,44,65,1,107,65,255,1,113,36,44,35,44,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,1,16,160,1,65,4,15,11,16,27,36,44,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,11,35,42,65,1,113,65,0,75,4,64,65,1,16,161,1,5,65,0,16,161,1,11,35,42,16,165,1,36,42,65,0,16,159,1,65,0,16,160,1,65,0,16,157,1,65,4,15,11,65,127,11,10,0,35,49,65,4,118,65,1,113,11,19,0,32,0,65,1,116,65,255,1,113,16,167,1,114,65,255,1,113,11,32,0,35,50,32,0,65,24,116,65,24,117,106,65,255,255,3,113,36,50,35,50,65,1,106,65,255,255,3,113,36,50,11,22,0,32,0,65,1,118,16,167,1,65,7,116,65,255,1,113,114,65,255,1,113,11,222,5,1,1,127,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,16,107,14,16,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,0,11,12,16,11,35,36,4,64,65,0,65,205,254,3,16,137,1,34,0,16,29,4,64,65,205,254,3,65,7,65,0,32,0,16,133,1,34,0,16,29,4,127,65,0,36,68,65,7,32,0,16,133,1,5,65,1,36,68,65,7,32,0,16,8,11,34,0,16,155,1,65,204,0,15,11,11,35,50,65,1,106,65,255,255,3,113,36,50,65,4,15,11,16,58,16,59,65,255,1,113,36,45,16,58,16,60,65,255,1,113,36,46,35,50,65,2,106,65,255,255,3,113,36,50,65,12,15,11,35,45,35,46,16,32,35,42,16,155,1,65,8,15,11,35,45,35,46,16,32,65,255,255,3,113,65,1,106,65,255,255,3,113,34,0,16,59,65,255,1,113,36,45,32,0,16,60,65,255,1,113,36,46,65,8,15,11,35,45,65,1,16,158,1,35,45,65,1,106,65,255,1,113,36,45,35,45,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,4,15,11,35,45,65,127,16,158,1,35,45,65,1,107,65,255,1,113,36,45,35,45,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,1,16,160,1,65,4,15,11,16,27,36,45,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,11,65,0,33,0,35,42,65,128,1,113,65,128,1,70,4,64,65,1,33,0,11,35,42,16,168,1,36,42,32,0,4,64,65,1,16,161,1,5,65,0,16,161,1,11,65,0,16,159,1,65,0,16,160,1,65,0,16,157,1,65,4,15,11,16,27,16,169,1,65,12,15,11,35,47,35,48,16,32,65,255,255,3,113,34,0,35,45,35,46,16,32,65,255,255,3,113,34,1,65,0,16,164,1,32,0,32,1,106,65,255,255,3,113,34,0,16,59,65,255,1,113,36,47,32,0,16,60,65,255,1,113,36,48,65,0,16,160,1,65,8,15,11,35,45,35,46,16,32,65,255,255,3,113,16,137,1,65,255,1,113,36,42,65,8,15,11,35,45,35,46,16,32,65,255,255,3,113,65,1,107,65,255,255,3,113,34,0,16,59,65,255,1,113,36,45,32,0,16,60,65,255,1,113,36,46,65,8,15,11,35,46,65,1,16,158,1,35,46,65,1,106,65,255,1,113,36,46,35,46,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,4,15,11,35,46,65,127,16,158,1,35,46,65,1,107,65,255,1,113,36,46,35,46,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,1,16,160,1,65,4,15,11,16,27,36,46,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,11,65,0,33,0,35,42,65,1,113,65,1,70,4,64,65,1,33,0,11,35,42,16,170,1,36,42,32,0,4,64,65,1,16,161,1,5,65,0,16,161,1,11,65,0,16,159,1,65,0,16,160,1,65,0,16,157,1,65,4,15,11,65,127,11,10,0,35,49,65,7,118,65,1,113,11,10,0,35,49,65,5,118,65,1,113,11,10,0,35,49,65,6,118,65,1,113,11,179,6,1,1,127,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,32,107,14,16,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,0,11,12,16,11,16,172,1,4,64,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,5,16,27,16,169,1,65,12,15,11,0,11,16,58,34,0,16,59,65,255,1,113,36,47,32,0,16,60,65,255,1,113,36,48,35,50,65,2,106,65,255,255,3,113,36,50,65,12,15,11,35,47,35,48,16,32,65,255,255,3,113,34,0,35,42,16,155,1,32,0,65,1,106,65,255,255,3,113,34,0,16,59,65,255,1,113,36,47,32,0,16,60,65,255,1,113,36,48,65,8,15,11,35,47,35,48,16,32,65,255,255,3,113,65,1,106,65,255,255,3,113,34,0,16,59,65,255,1,113,36,47,32,0,16,60,65,255,1,113,36,48,65,8,15,11,35,47,65,1,16,158,1,35,47,65,1,106,65,255,1,113,36,47,35,47,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,4,15,11,35,47,65,127,16,158,1,35,47,65,1,107,65,255,1,113,36,47,35,47,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,1,16,160,1,65,4,15,11,16,27,36,47,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,11,16,173,1,65,0,75,4,64,65,6,33,1,11,16,167,1,65,0,75,4,64,32,1,65,224,0,114,65,255,1,113,33,1,11,16,174,1,65,0,75,4,127,35,42,32,1,107,65,255,1,113,5,35,42,65,15,113,65,9,75,4,64,32,1,65,6,114,65,255,1,113,33,1,11,35,42,65,153,1,75,4,64,32,1,65,224,0,114,65,255,1,113,33,1,11,35,42,32,1,106,65,255,1,113,11,34,0,4,64,65,0,16,159,1,5,65,1,16,159,1,11,32,1,65,224,0,113,4,64,65,1,16,161,1,5,65,0,16,161,1,11,65,0,16,157,1,32,0,36,42,65,4,15,11,16,172,1,65,0,75,4,64,16,27,16,169,1,65,12,15,5,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,11,0,11,35,47,35,48,16,32,65,255,255,3,113,34,1,32,1,65,0,16,164,1,32,1,65,2,108,65,255,255,3,113,34,1,16,59,65,255,1,113,36,47,32,1,16,60,65,255,1,113,36,48,65,0,16,160,1,65,8,15,11,35,47,35,48,16,32,65,255,255,3,113,34,1,16,137,1,65,255,1,113,36,42,32,1,65,1,106,65,255,255,3,113,34,1,16,59,65,255,1,113,36,47,32,1,16,60,65,255,1,113,36,48,65,8,15,11,35,47,35,48,16,32,65,255,255,3,113,65,1,107,65,255,255,3,113,34,1,16,59,65,255,1,113,36,47,32,1,16,60,65,255,1,113,36,48,65,8,15,11,35,48,65,1,16,158,1,35,48,65,1,106,65,255,1,113,36,48,35,48,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,4,15,11,35,48,65,127,16,158,1,35,48,65,1,107,65,255,1,113,36,48,35,48,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,1,16,160,1,65,4,15,11,16,27,36,48,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,11,35,42,65,127,115,65,255,1,113,36,42,65,1,16,160,1,65,1,16,157,1,65,4,15,11,65,127,11,173,5,1,2,127,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,48,107,14,16,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,0,11,12,16,11,16,167,1,4,64,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,5,16,27,16,169,1,65,12,15,11,0,11,16,58,36,51,35,50,65,2,106,65,255,255,3,113,36,50,65,12,15,11,35,47,35,48,16,32,65,255,255,3,113,34,0,35,42,16,155,1,32,0,65,1,107,65,255,255,3,113,34,0,16,59,65,255,1,113,36,47,32,0,16,60,65,255,1,113,36,48,65,8,15,11,35,51,65,1,106,65,255,255,3,113,36,51,65,8,15,11,35,47,35,48,16,32,65,255,255,3,113,34,0,16,137,1,65,255,1,113,34,1,65,1,34,2,16,158,1,32,1,65,1,106,65,255,1,113,34,1,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,32,0,32,1,16,155,1,65,12,15,11,35,47,35,48,16,32,65,255,255,3,113,34,2,16,137,1,65,255,1,113,34,1,65,127,16,158,1,32,1,65,1,107,65,255,1,113,34,1,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,1,16,160,1,32,2,32,1,16,155,1,65,12,15,11,35,47,35,48,16,32,65,255,255,3,113,16,27,16,155,1,35,50,65,1,106,65,255,255,3,113,36,50,65,12,15,11,65,0,16,160,1,65,0,16,157,1,65,1,16,161,1,65,4,15,11,16,167,1,65,1,70,4,64,16,27,16,169,1,65,12,15,5,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,11,0,11,35,47,35,48,16,32,65,255,255,3,113,34,1,35,51,65,0,16,164,1,32,1,35,51,106,65,255,255,3,113,34,2,16,59,65,255,1,113,36,47,32,2,16,60,65,255,1,113,36,48,65,0,16,160,1,65,8,15,11,35,47,35,48,16,32,65,255,255,3,113,34,2,16,137,1,65,255,1,113,36,42,32,2,65,1,107,65,255,255,3,113,34,2,16,59,65,255,1,113,36,47,32,2,16,60,65,255,1,113,36,48,65,8,15,11,35,51,65,1,107,65,255,255,3,113,36,51,65,8,15,11,35,42,65,1,16,158,1,35,42,65,1,106,65,255,1,113,36,42,35,42,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,4,15,11,35,42,65,127,16,158,1,35,42,65,1,107,65,255,1,113,36,42,35,42,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,1,16,160,1,65,4,15,11,16,27,36,42,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,11,65,0,16,160,1,65,0,16,157,1,16,167,1,65,0,75,4,64,65,0,16,161,1,5,65,1,16,161,1,11,65,4,15,11,65,127,11,211,1,0,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,192,0,107,14,16,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,0,11,12,16,11,65,4,15,11,35,44,36,43,65,4,15,11,35,45,36,43,65,4,15,11,35,46,36,43,65,4,15,11,35,47,36,43,65,4,15,11,35,48,36,43,65,4,15,11,35,47,35,48,16,32,16,137,1,65,255,1,113,36,43,65,8,15,11,35,42,36,43,65,4,15,11,35,43,36,44,65,4,15,11,65,4,15,11,35,45,36,44,65,4,15,11,35,46,36,44,65,4,15,11,35,47,36,44,65,4,15,11,35,48,36,44,65,4,15,11,35,47,35,48,16,32,16,137,1,65,255,1,113,36,44,65,8,15,11,35,42,36,44,65,4,15,11,65,127,11,211,1,0,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,208,0,107,14,16,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,0,11,12,16,11,35,43,36,45,65,4,15,11,35,44,36,45,65,4,15,11,65,4,15,11,35,46,36,45,65,4,15,11,35,47,36,45,65,4,15,11,35,48,36,45,65,4,15,11,35,47,35,48,16,32,16,137,1,65,255,1,113,36,45,65,8,15,11,35,42,36,45,65,4,15,11,35,43,36,46,65,4,15,11,35,44,36,46,65,4,15,11,35,45,36,46,65,4,15,11,65,4,15,11,35,47,36,46,65,4,15,11,35,48,36,46,65,4,15,11,35,47,35,48,16,32,16,137,1,65,255,1,113,36,46,65,4,15,11,35,42,36,46,65,4,15,11,65,127,11,211,1,0,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,224,0,107,14,16,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,0,11,12,16,11,35,43,36,47,65,8,15,11,35,44,36,47,65,4,15,11,35,45,36,47,65,4,15,11,35,46,36,47,65,4,15,11,65,4,15,11,35,48,36,47,65,4,15,11,35,47,35,48,16,32,16,137,1,65,255,1,113,36,47,65,8,15,11,35,42,36,47,65,4,15,11,35,43,36,48,65,4,15,11,35,44,36,48,65,4,15,11,35,45,36,48,65,4,15,11,35,46,36,48,65,4,15,11,35,47,36,48,65,4,15,11,65,4,15,11,35,47,35,48,16,32,16,137,1,65,255,1,113,36,48,65,8,15,11,35,42,36,48,65,4,15,11,65,127,11,132,2,0,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,240,0,107,14,16,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,0,11,12,16,11,35,47,35,48,16,32,35,43,16,155,1,65,8,15,11,35,47,35,48,16,32,35,44,16,155,1,65,8,15,11,35,47,35,48,16,32,35,45,16,155,1,65,8,15,11,35,47,35,48,16,32,35,46,16,155,1,65,8,15,11,35,47,35,48,16,32,35,47,16,155,1,65,8,15,11,35,47,35,48,16,32,35,48,16,155,1,65,8,15,11,35,185,1,69,4,64,65,1,36,70,11,65,4,15,11,35,47,35,48,16,32,35,42,16,155,1,65,8,15,11,35,43,36,42,65,4,15,11,35,44,36,42,65,4,15,11,35,45,36,42,65,4,15,11,35,46,36,42,65,4,15,11,35,47,36,42,65,4,15,11,35,48,36,42,65,4,15,11,35,47,35,48,16,32,16,137,1,65,255,1,113,36,42,65,8,15,11,65,4,15,11,65,127,11,75,1,1,127,32,1,65,0,78,4,64,32,0,32,0,32,1,65,255,1,113,106,65,255,1,113,75,4,64,65,1,16,161,1,5,65,0,16,161,1,11,5,32,1,34,2,65,0,32,2,107,32,2,65,0,74,27,32,0,74,4,64,65,1,16,161,1,5,65,0,16,161,1,11,11,11,48,0,35,42,32,0,16,158,1,35,42,32,0,16,181,1,35,42,32,0,106,65,255,1,113,36,42,35,42,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,11,99,1,1,127,35,42,32,0,106,16,167,1,106,65,255,1,113,33,1,35,42,32,0,115,32,1,115,65,16,113,4,64,65,1,16,157,1,5,65,0,16,157,1,11,35,42,32,0,106,16,167,1,106,65,128,2,113,65,0,75,4,64,65,1,16,161,1,5,65,0,16,161,1,11,32,1,36,42,35,42,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,11,235,1,0,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,128,1,107,14,16,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,0,11,12,16,11,35,43,16,182,1,65,4,15,11,35,44,16,182,1,65,4,15,11,35,45,16,182,1,65,4,15,11,35,46,16,182,1,65,4,15,11,35,47,16,182,1,65,4,15,11,35,48,16,182,1,65,4,15,11,35,47,35,48,16,32,16,137,1,65,255,1,113,16,182,1,65,8,15,11,35,42,16,182,1,65,4,15,11,35,43,16,183,1,65,4,15,11,35,44,16,183,1,65,4,15,11,35,45,16,183,1,65,4,15,11,35,46,16,183,1,65,4,15,11,35,47,16,183,1,65,4,15,11,35,48,16,183,1,65,4,15,11,35,47,35,48,16,32,16,137,1,65,255,1,113,16,183,1,65,8,15,11,35,42,16,183,1,65,4,15,11,65,127,11,55,1,1,127,35,42,32,0,65,127,108,34,1,16,158,1,35,42,32,1,16,181,1,35,42,32,0,107,65,255,1,113,36,42,35,42,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,1,16,160,1,11,99,1,1,127,35,42,32,0,107,16,167,1,107,65,255,1,113,33,1,35,42,32,0,115,32,1,115,65,16,113,4,64,65,1,16,157,1,5,65,0,16,157,1,11,35,42,32,0,107,16,167,1,107,65,128,2,113,65,0,75,4,64,65,1,16,161,1,5,65,0,16,161,1,11,32,1,36,42,35,42,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,1,16,160,1,11,235,1,0,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,144,1,107,14,16,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,0,11,12,16,11,35,43,16,185,1,65,4,15,11,35,44,16,185,1,65,4,15,11,35,45,16,185,1,65,4,15,11,35,46,16,185,1,65,4,15,11,35,47,16,185,1,65,4,15,11,35,48,16,185,1,65,4,15,11,35,47,35,48,16,32,16,137,1,65,255,1,113,16,185,1,65,8,15,11,35,42,16,185,1,65,4,15,11,35,43,16,186,1,65,4,15,11,35,44,16,186,1,65,4,15,11,35,45,16,186,1,65,4,15,11,35,46,16,186,1,65,4,15,11,35,47,16,186,1,65,4,15,11,35,48,16,186,1,65,4,15,11,35,47,35,48,16,32,16,137,1,65,255,1,113,16,186,1,65,8,15,11,35,42,16,186,1,65,4,15,11,65,127,11,44,0,35,42,32,0,113,65,255,1,113,36,42,35,42,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,1,16,157,1,65,0,16,161,1,11,44,0,35,42,32,0,115,65,255,1,113,36,42,35,42,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,0,16,157,1,65,0,16,161,1,11,235,1,0,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,160,1,107,14,16,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,0,11,12,16,11,35,43,16,188,1,65,4,15,11,35,44,16,188,1,65,4,15,11,35,45,16,188,1,65,4,15,11,35,46,16,188,1,65,4,15,11,35,47,16,188,1,65,4,15,11,35,48,16,188,1,65,4,15,11,35,47,35,48,16,32,16,137,1,65,255,1,113,16,188,1,65,8,15,11,35,42,16,188,1,65,4,15,11,35,43,16,189,1,65,4,15,11,35,44,16,189,1,65,4,15,11,35,45,16,189,1,65,4,15,11,35,46,16,189,1,65,4,15,11,35,47,16,189,1,65,4,15,11,35,48,16,189,1,65,4,15,11,35,47,35,48,16,32,16,137,1,65,255,1,113,16,189,1,65,8,15,11,35,42,16,189,1,65,4,15,11,65,127,11,44,0,35,42,32,0,114,65,255,1,113,36,42,35,42,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,0,16,157,1,65,0,16,161,1,11,47,1,1,127,35,42,32,0,65,127,108,34,1,16,158,1,35,42,32,1,16,181,1,35,42,32,1,106,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,1,16,160,1,11,235,1,0,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,176,1,107,14,16,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,0,11,12,16,11,35,43,16,191,1,65,4,15,11,35,44,16,191,1,65,4,15,11,35,45,16,191,1,65,4,15,11,35,46,16,191,1,65,4,15,11,35,47,16,191,1,65,4,15,11,35,48,16,191,1,65,4,15,11,35,47,35,48,16,32,16,137,1,65,255,1,113,16,191,1,65,8,15,11,35,42,16,191,1,65,4,15,11,35,43,16,192,1,65,4,15,11,35,44,16,192,1,65,4,15,11,35,45,16,192,1,65,4,15,11,35,46,16,192,1,65,4,15,11,35,47,16,192,1,65,4,15,11,35,48,16,192,1,65,4,15,11,35,47,35,48,16,32,16,137,1,65,255,1,113,16,192,1,65,8,15,11,35,42,16,192,1,65,4,15,11,65,127,11,63,1,2,127,2,64,2,64,32,0,16,136,1,34,1,65,127,71,13,1,32,0,16,7,33,1,11,11,2,64,2,64,32,0,65,1,106,34,2,16,136,1,34,0,65,127,71,13,1,32,2,16,7,33,0,11,11,32,0,32,1,16,32,11,59,0,32,0,65,128,1,113,65,128,1,70,4,64,65,1,16,161,1,5,65,0,16,161,1,11,32,0,16,162,1,34,0,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,0,16,157,1,32,0,11,57,0,32,0,65,1,113,65,0,75,4,64,65,1,16,161,1,5,65,0,16,161,1,11,32,0,16,165,1,34,0,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,0,16,157,1,32,0,11,72,1,1,127,32,0,65,128,1,113,65,128,1,70,4,64,65,1,33,1,11,32,0,16,168,1,33,0,32,1,4,64,65,1,16,161,1,5,65,0,16,161,1,11,32,0,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,0,16,157,1,32,0,11,70,1,1,127,32,0,65,1,113,65,1,70,4,64,65,1,33,1,11,32,0,16,170,1,33,0,32,1,4,64,65,1,16,161,1,5,65,0,16,161,1,11,32,0,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,0,16,157,1,32,0,11,76,1,1,127,32,0,65,128,1,113,65,128,1,70,4,64,65,1,33,1,11,32,0,65,1,116,65,255,1,113,33,0,32,1,4,64,65,1,16,161,1,5,65,0,16,161,1,11,32,0,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,0,16,157,1,32,0,11,104,1,2,127,32,0,65,128,1,113,65,128,1,70,4,64,65,1,33,1,11,32,0,65,1,113,65,1,70,4,64,65,1,33,2,11,32,0,65,1,118,33,0,32,1,4,64,32,0,65,128,1,114,65,255,1,113,33,0,11,32,0,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,0,16,157,1,32,2,4,64,65,1,16,161,1,5,65,0,16,161,1,11,32,0,11,53,0,32,0,65,15,113,65,4,116,32,0,65,240,1,113,65,4,118,114,34,0,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,0,16,157,1,65,0,16,161,1,32,0,11,68,1,1,127,32,0,65,1,113,65,1,70,4,64,65,1,33,1,11,32,0,65,1,118,34,0,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,0,16,157,1,32,1,4,64,65,1,16,161,1,5,65,0,16,161,1,11,32,0,11,40,0,32,1,65,1,32,0,116,65,255,1,113,113,4,64,65,0,16,159,1,5,65,1,16,159,1,11,65,0,16,160,1,65,1,16,157,1,32,1,11,48,0,32,1,65,0,74,4,127,32,2,65,1,32,0,116,65,255,1,113,114,65,255,1,113,5,32,2,65,1,32,0,116,65,255,1,113,65,127,115,65,255,1,113,113,11,34,2,11,194,8,1,5,127,65,127,33,4,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,8,111,34,5,14,8,1,2,3,4,5,6,7,8,0,11,12,8,11,35,43,33,1,12,7,11,35,44,33,1,12,6,11,35,45,33,1,12,5,11,35,46,33,1,12,4,11,35,47,33,1,12,3,11,35,48,33,1,12,2,11,35,47,35,48,16,32,16,137,1,65,255,1,113,33,1,12,1,11,35,42,33,1,11,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,240,1,113,65,4,117,14,16,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,0,11,12,16,11,32,0,65,7,76,4,64,32,1,16,195,1,33,2,65,1,33,3,5,32,0,65,15,76,4,64,32,1,16,196,1,33,2,65,1,33,3,11,11,12,15,11,32,0,65,23,76,4,64,32,1,16,197,1,33,2,65,1,33,3,5,32,0,65,31,76,4,64,32,1,16,198,1,33,2,65,1,33,3,11,11,12,14,11,32,0,65,39,76,4,64,32,1,16,199,1,33,2,65,1,33,3,5,32,0,65,47,76,4,64,32,1,16,200,1,33,2,65,1,33,3,11,11,12,13,11,32,0,65,55,76,4,64,32,1,16,201,1,33,2,65,1,33,3,5,32,0,65,63,76,4,64,32,1,16,202,1,33,2,65,1,33,3,11,11,12,12,11,32,0,65,199,0,76,4,64,65,0,32,1,16,203,1,33,2,65,1,33,3,5,32,0,65,207,0,76,4,64,65,1,32,1,16,203,1,33,2,65,1,33,3,11,11,12,11,11,32,0,65,215,0,76,4,64,65,2,32,1,16,203,1,33,2,65,1,33,3,5,32,0,65,223,0,76,4,64,65,3,32,1,16,203,1,33,2,65,1,33,3,11,11,12,10,11,32,0,65,231,0,76,4,64,65,4,32,1,16,203,1,33,2,65,1,33,3,5,32,0,65,239,0,76,4,64,65,5,32,1,16,203,1,33,2,65,1,33,3,11,11,12,9,11,32,0,65,247,0,76,4,64,65,6,32,1,16,203,1,33,2,65,1,33,3,5,32,0,65,255,0,76,4,64,65,7,32,1,16,203,1,33,2,65,1,33,3,11,11,12,8,11,32,0,65,135,1,76,4,64,65,0,65,0,32,1,16,204,1,33,2,65,1,33,3,5,32,0,65,143,1,76,4,64,65,1,65,0,32,1,16,204,1,33,2,65,1,33,3,11,11,12,7,11,32,0,65,151,1,76,4,64,65,2,65,0,32,1,16,204,1,33,2,65,1,33,3,5,32,0,65,159,1,76,4,64,65,3,65,0,32,1,16,204,1,33,2,65,1,33,3,11,11,12,6,11,32,0,65,167,1,76,4,64,65,4,65,0,32,1,16,204,1,33,2,65,1,33,3,5,32,0,65,175,1,76,4,64,65,5,65,0,32,1,16,204,1,33,2,65,1,33,3,11,11,12,5,11,32,0,65,183,1,76,4,64,65,6,65,0,32,1,16,204,1,33,2,65,1,33,3,5,32,0,65,191,1,76,4,64,65,7,65,0,32,1,16,204,1,33,2,65,1,33,3,11,11,12,4,11,32,0,65,199,1,76,4,64,65,0,65,1,32,1,16,204,1,33,2,65,1,33,3,5,32,0,65,207,1,76,4,64,65,1,65,1,32,1,16,204,1,33,2,65,1,33,3,11,11,12,3,11,32,0,65,215,1,76,4,64,65,2,65,1,32,1,16,204,1,33,2,65,1,33,3,5,32,0,65,223,1,76,4,64,65,3,65,1,32,1,16,204,1,33,2,65,1,33,3,11,11,12,2,11,32,0,65,231,1,76,4,64,65,4,65,1,32,1,16,204,1,33,2,65,1,33,3,5,32,0,65,239,1,76,4,64,65,5,65,1,32,1,16,204,1,33,2,65,1,33,3,11,11,12,1,11,32,0,65,247,1,76,4,64,65,6,65,1,32,1,16,204,1,33,2,65,1,33,3,5,32,0,65,255,1,76,4,64,65,7,65,1,32,1,16,204,1,33,2,65,1,33,3,11,11,11,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,5,14,8,1,2,3,4,5,6,7,8,0,11,12,8,11,32,2,36,43,12,7,11,32,2,36,44,12,6,11,32,2,36,45,12,5,11,32,2,36,46,12,4,11,32,2,36,47,12,3,11,32,2,36,48,12,2,11,35,47,35,48,16,32,32,2,16,155,1,12,1,11,32,2,36,42,11,35,50,65,1,106,65,255,255,3,113,36,50,32,3,4,64,65,8,33,4,32,5,65,6,70,4,64,65,16,33,4,11,11,32,4,11,213,4,1,1,127,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,192,1,107,14,16,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,0,11,12,16,11,16,172,1,4,64,65,8,15,5,35,51,16,194,1,65,255,255,3,113,36,50,35,51,65,2,106,65,255,255,3,113,36,51,65,20,15,11,0,11,35,51,16,194,1,33,1,35,51,65,2,106,65,255,255,3,113,36,51,32,1,16,59,65,255,1,113,36,43,32,1,16,60,65,255,1,113,36,44,65,12,15,11,16,172,1,4,64,35,50,65,2,106,65,255,255,3,113,36,50,65,12,15,5,16,58,36,50,65,16,15,11,0,11,16,58,36,50,65,16,15,11,16,172,1,4,64,35,50,65,2,106,65,255,255,3,113,36,50,65,12,15,5,35,51,65,2,107,65,255,255,3,113,36,51,35,51,35,50,65,2,106,65,255,255,3,113,16,163,1,16,58,36,50,65,24,15,11,0,11,35,51,65,2,107,65,255,255,3,113,36,51,35,51,35,43,35,44,16,32,16,163,1,65,16,15,11,16,27,16,182,1,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,11,35,51,65,2,107,65,255,255,3,113,36,51,35,51,35,50,16,163,1,65,0,36,50,65,16,15,11,16,172,1,65,1,70,4,64,35,51,16,194,1,65,255,255,3,113,36,50,35,51,65,2,106,65,255,255,3,113,36,51,65,20,15,5,65,8,15,11,0,11,35,51,16,194,1,65,255,255,3,113,36,50,35,51,65,2,106,65,255,255,3,113,36,51,65,16,15,11,16,172,1,65,1,70,4,64,16,58,36,50,65,16,15,5,35,50,65,2,106,65,255,255,3,113,36,50,65,12,15,11,0,11,16,27,16,205,1,34,1,65,0,74,4,64,32,1,65,4,106,33,1,11,32,1,15,11,16,172,1,65,1,70,4,64,35,51,65,2,107,65,255,255,3,113,36,51,35,51,35,50,65,2,106,65,255,255,3,113,16,163,1,16,58,36,50,65,24,15,5,35,50,65,2,106,65,255,255,3,113,36,50,65,12,15,11,0,11,35,51,65,2,107,65,255,255,3,113,36,51,35,51,35,50,65,2,106,65,255,255,3,113,16,163,1,16,58,36,50,65,24,15,11,16,27,16,183,1,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,11,35,51,65,2,107,65,255,255,3,113,36,51,35,51,35,50,16,163,1,65,8,36,50,65,16,15,11,65,127,11,7,0,32,0,36,208,1,11,145,4,1,1,127,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,208,1,107,14,16,1,2,3,0,4,5,6,7,8,9,10,0,11,0,12,13,0,11,12,13,11,16,167,1,4,64,65,8,15,5,35,51,16,194,1,65,255,255,3,113,36,50,35,51,65,2,106,65,255,255,3,113,36,51,65,20,15,11,0,11,35,51,16,194,1,33,1,35,51,65,2,106,65,255,255,3,113,36,51,32,1,16,59,65,255,1,113,36,45,32,1,16,60,65,255,1,113,36,46,65,12,15,11,16,167,1,4,64,35,50,65,2,106,65,255,255,3,113,36,50,65,12,15,5,16,58,36,50,65,16,15,11,0,11,16,167,1,4,64,35,50,65,2,106,65,255,255,3,113,36,50,65,12,15,5,35,51,65,2,107,65,255,255,3,113,36,51,35,51,35,50,65,2,106,65,255,255,3,113,16,163,1,16,58,36,50,65,24,15,11,0,11,35,51,65,2,107,65,255,255,3,113,36,51,35,51,35,45,35,46,16,32,16,163,1,65,16,15,11,16,27,16,185,1,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,11,35,51,65,2,107,65,255,255,3,113,36,51,35,51,35,50,16,163,1,65,16,36,50,65,16,15,11,16,167,1,65,1,70,4,64,35,51,16,194,1,65,255,255,3,113,36,50,35,51,65,2,106,65,255,255,3,113,36,51,65,20,15,5,65,8,15,11,0,11,35,51,16,194,1,65,255,255,3,113,36,50,65,1,16,207,1,35,51,65,2,106,65,255,255,3,113,36,51,65,16,15,11,16,167,1,65,1,70,4,64,16,58,36,50,65,16,15,5,35,50,65,2,106,65,255,255,3,113,36,50,65,12,15,11,0,11,16,167,1,65,1,70,4,64,35,51,65,2,107,65,255,255,3,113,36,51,35,51,35,50,65,2,106,65,255,255,3,113,16,163,1,16,58,36,50,65,24,15,5,35,50,65,2,106,65,255,255,3,113,36,50,65,12,15,11,0,11,16,27,16,186,1,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,11,35,51,65,2,107,65,255,255,3,113,36,51,35,51,35,50,16,163,1,65,24,36,50,65,16,15,11,65,127,11,240,2,1,1,127,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,224,1,107,14,16,1,2,3,0,0,4,5,6,7,8,9,0,0,0,10,11,0,11,12,11,11,16,27,65,128,254,3,106,35,42,16,155,1,35,50,65,1,106,65,255,255,3,113,36,50,65,12,15,11,35,51,16,194,1,33,1,35,51,65,2,106,65,255,255,3,113,36,51,32,1,16,59,65,255,1,113,36,47,32,1,16,60,65,255,1,113,36,48,65,12,15,11,35,44,65,128,254,3,106,35,42,16,155,1,65,8,15,11,35,51,65,2,107,65,255,255,3,113,36,51,35,51,35,47,35,48,16,32,16,163,1,65,16,15,11,16,27,16,188,1,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,11,35,51,65,2,107,65,255,255,3,113,36,51,35,51,35,50,16,163,1,65,32,36,50,65,16,15,11,16,27,65,24,116,65,24,117,33,1,35,51,32,1,65,1,16,164,1,35,51,32,1,106,65,255,255,3,113,36,51,65,0,16,159,1,65,0,16,160,1,35,50,65,1,106,65,255,255,3,113,36,50,65,16,15,11,35,47,35,48,16,32,65,255,255,3,113,36,50,65,4,15,11,16,58,35,42,16,155,1,35,50,65,2,106,65,255,255,3,113,36,50,65,16,15,11,16,27,16,189,1,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,11,35,51,65,2,107,65,255,255,3,113,36,51,35,51,35,50,16,163,1,65,40,36,50,65,16,15,11,65,127,11,167,3,0,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,240,1,107,14,16,1,2,3,4,0,5,6,7,8,9,10,11,0,0,12,13,0,11,12,13,11,16,27,65,128,254,3,106,16,137,1,65,255,1,113,36,42,35,50,65,1,106,65,255,255,3,113,36,50,65,12,15,11,35,51,16,194,1,65,255,255,3,113,33,0,35,51,65,2,106,65,255,255,3,113,36,51,32,0,16,59,65,255,1,113,36,42,32,0,16,60,65,255,1,113,36,49,65,12,15,11,35,44,65,128,254,3,106,16,137,1,65,255,1,113,36,42,65,8,15,11,65,0,16,207,1,65,4,15,11,35,51,65,2,107,65,255,255,3,113,36,51,35,51,35,42,35,49,16,32,16,163,1,65,16,15,11,16,27,16,191,1,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,11,35,51,65,2,107,65,255,255,3,113,36,51,35,51,35,50,16,163,1,65,48,36,50,65,16,15,11,16,27,65,24,116,65,24,117,33,0,65,0,16,159,1,65,0,16,160,1,35,51,32,0,65,1,16,164,1,35,51,32,0,106,65,255,255,3,113,34,0,16,59,65,255,1,113,36,47,32,0,16,60,65,255,1,113,36,48,35,50,65,1,106,65,255,255,3,113,36,50,65,12,15,11,35,47,35,48,16,32,65,255,255,3,113,36,51,65,8,15,11,16,58,16,137,1,65,255,1,113,36,42,35,50,65,2,106,65,255,255,3,113,36,50,65,16,15,11,65,1,16,207,1,65,4,15,11,16,27,16,192,1,35,50,65,1,106,65,255,255,3,113,36,50,65,8,15,11,35,51,65,2,107,65,255,255,3,113,36,51,35,51,35,50,16,163,1,65,56,36,50,65,16,15,11,65,127,11,189,1,0,35,50,65,1,106,65,255,255,3,113,36,50,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,2,64,32,0,65,240,1,113,65,4,117,14,15,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,0,11,12,15,11,32,0,16,166,1,15,11,32,0,16,171,1,15,11,32,0,16,175,1,15,11,32,0,16,176,1,15,11,32,0,16,177,1,15,11,32,0,16,178,1,15,11,32,0,16,179,1,15,11,32,0,16,180,1,15,11,32,0,16,184,1,15,11,32,0,16,187,1,15,11,32,0,16,190,1,15,11,32,0,16,193,1,15,11,32,0,16,206,1,15,11,32,0,16,208,1,15,11,32,0,16,209,1,15,11,32,0,16,210,1,11,11,0,35,40,35,207,1,113,65,0,74,11,27,1,1,127,32,1,16,59,33,2,32,0,32,1,16,60,16,9,32,0,65,1,106,32,2,16,9,11,126,1,1,127,65,0,16,207,1,32,0,65,143,254,3,16,7,16,133,1,34,1,36,40,65,143,254,3,32,1,16,9,35,51,65,2,107,65,255,255,3,113,36,51,35,51,35,50,16,213,1,2,64,2,64,2,64,2,64,2,64,2,64,32,0,14,5,1,2,3,0,4,0,11,12,4,11,65,0,36,201,1,65,192,0,36,50,12,3,11,65,0,36,202,1,65,200,0,36,50,12,2,11,65,0,36,200,1,65,208,0,36,50,12,1,11,65,0,36,33,65,224,0,36,50,11,11,187,1,1,1,127,35,208,1,4,127,35,207,1,65,0,74,5,35,208,1,11,65,1,113,34,0,4,127,35,40,65,0,74,5,32,0,11,65,1,113,4,64,65,0,33,0,35,203,1,4,127,35,201,1,5,35,203,1,11,65,1,113,4,64,65,0,16,214,1,65,1,33,0,5,35,204,1,4,127,35,202,1,5,35,204,1,11,65,1,113,4,64,65,1,16,214,1,65,1,33,0,5,35,205,1,4,127,35,200,1,5,35,205,1,11,65,1,113,4,64,65,2,16,214,1,65,1,33,0,5,35,206,1,4,127,35,33,5,35,206,1,11,65,1,113,4,64,65,4,16,214,1,65,1,33,0,11,11,11,11,32,0,4,64,65,20,33,0,35,70,4,64,65,0,36,70,65,24,33,0,11,32,0,15,11,11,65,0,11,14,0,35,68,4,64,65,144,7,15,11,65,200,3,11,5,0,16,216,1,11,14,0,32,1,65,160,1,108,32,0,106,65,3,108,11,22,0,32,0,32,1,16,218,1,65,128,216,5,106,32,2,106,32,3,58,0,0,11,16,0,32,0,32,1,16,38,65,128,160,4,106,45,0,0,11,180,2,1,3,127,32,1,65,0,74,34,5,4,127,32,0,65,8,74,5,32,5,11,65,1,113,34,5,4,127,32,6,35,211,1,70,5,32,5,11,65,1,113,34,5,4,127,32,0,35,212,1,70,5,32,5,11,65,1,113,4,64,65,0,33,5,65,0,33,6,65,5,32,4,65,1,107,16,7,16,29,4,64,65,1,33,5,11,65,5,32,4,16,7,16,29,4,64,65,1,33,6,11,65,0,33,3,3,64,32,3,65,8,72,4,64,32,5,32,6,71,4,64,65,7,32,3,107,33,3,11,32,0,32,3,106,65,160,1,76,4,64,32,0,65,8,32,3,107,107,33,8,32,0,32,3,106,32,1,16,218,1,65,128,216,5,106,33,9,65,0,33,4,3,64,32,4,65,3,72,4,64,32,0,32,3,106,32,1,32,4,32,9,32,4,106,45,0,0,16,219,1,32,4,65,1,106,33,4,12,1,11,11,32,0,32,3,106,32,1,65,2,32,8,32,1,16,220,1,34,4,16,133,1,65,2,32,4,16,29,16,39,32,7,65,1,106,33,7,11,32,3,65,1,106,33,3,12,1,11,11,5,32,6,36,211,1,11,32,0,35,212,1,78,4,64,32,0,65,8,106,36,212,1,32,0,32,2,65,8,111,34,6,72,4,64,35,212,1,32,6,106,36,212,1,11,11,32,7,11,133,1,1,3,127,32,3,65,8,111,33,3,32,0,69,4,64,32,2,32,2,65,8,109,65,8,108,107,33,7,11,65,7,33,8,32,0,65,8,106,65,160,1,74,4,64,65,160,1,32,0,107,33,8,11,65,127,33,2,35,36,4,64,65,3,32,4,65,1,16,28,34,2,65,255,1,113,16,29,4,64,65,1,33,9,11,65,6,32,2,16,29,4,64,65,7,32,3,107,33,3,11,11,32,6,32,5,32,9,32,7,32,8,32,3,32,0,32,1,65,160,1,65,128,216,5,65,0,65,0,32,2,16,40,11,230,1,1,1,127,32,5,32,6,16,30,33,6,32,4,65,1,16,28,33,4,32,3,65,8,111,33,3,65,6,32,4,16,29,4,64,65,7,32,3,107,33,3,11,65,0,33,5,65,3,32,4,16,29,4,64,65,1,33,5,11,32,6,32,3,65,2,108,106,32,5,16,28,33,7,32,6,32,3,65,2,108,106,65,1,106,32,5,16,28,33,5,32,2,65,8,111,33,3,65,5,32,4,16,29,69,4,64,65,7,32,3,107,33,3,11,65,0,33,2,32,3,32,5,16,29,4,64,65,2,33,2,11,32,3,32,7,16,29,4,64,32,2,65,1,106,33,2,11,65,0,32,4,65,7,113,32,2,65,0,16,33,34,3,16,34,33,5,65,1,32,3,16,34,33,6,65,2,32,3,16,34,33,3,32,0,32,1,65,0,32,5,16,219,1,32,0,32,1,65,1,32,6,16,219,1,32,0,32,1,65,2,32,3,16,219,1,32,0,32,1,32,2,65,7,32,4,16,29,16,39,11,142,1,0,32,4,32,5,16,30,34,4,32,3,65,8,111,34,3,65,2,108,106,65,0,16,28,33,5,32,4,32,3,65,2,108,106,65,1,106,65,0,16,28,33,4,65,0,33,3,65,7,32,2,65,8,111,107,34,2,32,4,16,29,4,64,65,2,33,3,11,32,2,32,5,16,29,4,64,32,3,65,1,106,65,255,1,113,33,3,11,32,0,32,1,65,0,32,3,65,199,254,3,65,0,16,35,34,2,16,219,1,32,0,32,1,65,1,32,2,16,219,1,32,0,32,1,65,2,32,2,16,219,1,32,0,32,1,32,3,65,0,16,39,11,221,1,1,6,127,32,3,65,3,117,33,11,3,64,32,4,65,160,1,72,4,64,32,4,32,5,106,34,6,65,128,2,78,4,64,32,6,65,128,2,107,33,6,11,32,2,32,11,65,32,108,106,32,6,65,3,117,106,34,8,65,0,16,28,33,7,65,0,33,9,35,20,4,64,32,4,32,0,32,6,32,3,32,8,32,1,32,7,16,221,1,34,10,65,0,74,4,64,32,4,32,10,65,1,107,106,33,4,65,1,33,9,11,11,35,19,4,127,32,9,69,5,35,19,11,65,1,113,4,64,32,4,32,0,32,6,32,3,32,8,32,1,32,7,16,222,1,34,10,65,0,74,4,64,32,4,32,10,65,1,107,106,33,4,11,5,32,9,69,4,64,35,36,4,64,32,4,32,0,32,6,32,3,32,8,32,1,32,7,16,223,1,5,32,4,32,0,32,6,32,3,32,1,32,7,16,224,1,11,11,11,32,4,65,1,106,33,4,12,1,11,11,11,43,1,1,127,32,0,35,181,1,106,34,3,65,128,2,78,4,64,32,3,65,128,2,107,33,3,11,32,0,32,1,32,2,32,3,65,0,35,180,1,16,225,1,11,47,1,2,127,35,182,1,33,3,32,0,35,183,1,34,4,72,4,64,15,11,32,0,32,1,32,2,32,0,32,4,107,32,3,65,7,107,34,3,32,3,65,127,108,16,225,1,11,128,5,1,14,127,65,39,33,8,3,64,32,8,65,0,78,4,64,32,8,65,4,108,34,4,65,128,252,3,106,16,7,33,3,32,4,65,129,252,3,106,16,7,33,9,32,4,65,130,252,3,106,16,7,33,2,32,3,65,16,107,33,3,32,9,65,8,107,33,9,65,8,33,5,32,1,4,64,65,16,33,5,32,2,65,2,111,65,1,70,4,64,32,2,65,1,107,33,2,11,11,32,0,32,3,78,34,7,4,127,32,0,32,3,32,5,106,72,5,32,7,11,65,1,113,4,64,65,7,32,4,65,131,252,3,106,16,7,34,7,16,29,33,10,65,6,32,7,16,29,33,4,65,5,32,7,16,29,33,13,32,0,32,3,107,33,3,32,4,4,64,32,3,32,5,107,65,127,108,65,1,107,33,3,11,65,128,128,2,32,2,16,30,32,3,65,2,108,106,33,3,65,0,33,2,35,36,4,127,65,3,32,7,16,29,5,35,36,11,65,1,113,4,64,65,1,33,2,11,32,3,32,2,16,28,33,14,32,3,65,1,106,32,2,16,28,33,15,65,7,33,3,3,64,32,3,65,0,78,4,64,32,3,33,2,32,13,4,64,32,2,65,7,107,65,127,108,33,2,11,65,0,33,4,32,2,32,15,16,29,4,64,65,2,33,4,11,32,2,32,14,16,29,4,64,32,4,65,1,106,33,4,11,32,4,4,64,32,9,65,7,32,3,107,106,34,5,65,0,78,34,6,4,127,32,5,65,160,1,76,5,32,6,11,65,1,113,4,64,65,0,33,6,65,0,33,11,65,0,33,12,35,36,4,127,35,177,1,69,5,35,36,11,65,1,113,4,64,65,1,33,6,11,32,6,69,4,64,32,5,32,0,16,220,1,33,2,32,10,4,127,32,2,65,3,113,65,0,74,5,32,10,11,65,1,113,4,64,65,1,33,11,5,35,36,4,127,65,2,32,2,16,29,5,35,36,11,65,1,113,4,64,65,1,33,12,11,11,11,32,6,4,127,32,6,5,32,11,69,34,2,4,127,32,12,69,5,32,2,11,65,1,113,11,65,1,113,4,64,35,36,4,64,65,0,32,7,65,7,113,32,4,65,1,16,33,34,2,16,34,33,4,65,1,32,2,16,34,33,6,65,2,32,2,16,34,33,2,32,5,32,0,65,0,32,4,16,219,1,32,5,32,0,65,1,32,6,16,219,1,32,5,32,0,65,2,32,2,16,219,1,5,65,200,254,3,33,2,65,4,32,7,16,29,4,64,65,201,254,3,33,2,11,32,5,32,0,65,0,32,4,32,2,65,0,16,35,34,2,16,219,1,32,5,32,0,65,1,32,2,16,219,1,32,5,32,0,65,2,32,2,16,219,1,11,11,11,11,32,3,65,1,107,33,3,12,1,11,11,11,32,8,65,1,107,33,8,12,1,11,11,11,111,1,2,127,65,128,144,2,33,2,35,52,4,64,65,128,128,2,33,2,11,35,36,4,127,35,36,5,35,177,1,11,65,1,113,4,64,65,128,176,2,33,1,35,53,4,64,65,128,184,2,33,1,11,32,0,32,2,32,1,16,226,1,11,35,174,1,4,64,65,128,176,2,33,1,35,173,1,4,64,65,128,184,2,33,1,11,32,0,32,2,32,1,16,227,1,11,35,176,1,4,64,32,0,35,175,1,16,228,1,11,11,34,1,1,127,3,64,32,0,65,144,1,77,4,64,32,0,16,229,1,32,0,65,1,106,65,255,1,113,33,0,12,1,11,11,11,66,1,2,127,3,64,32,0,65,144,1,72,4,64,65,0,33,1,3,64,32,1,65,160,1,72,4,64,32,1,32,0,16,38,65,128,160,4,106,65,0,58,0,0,32,1,65,1,106,33,1,12,1,11,11,32,0,65,1,106,33,0,12,1,11,11,11,12,0,65,127,36,211,1,65,127,36,212,1,11,14,0,35,68,4,64,65,240,5,15,11,65,248,2,11,14,0,35,68,4,64,65,242,3,15,11,65,249,1,11,11,0,65,1,36,202,1,65,1,16,10,11,108,1,1,127,35,185,1,69,4,64,15,11,35,190,1,65,16,34,0,72,4,64,35,190,1,33,0,11,35,191,1,35,192,1,32,0,16,138,1,35,191,1,32,0,106,36,191,1,35,192,1,32,0,106,36,192,1,35,190,1,32,0,107,36,190,1,35,190,1,65,0,76,4,64,65,0,36,185,1,35,184,1,65,255,1,16,9,5,35,184,1,65,7,35,190,1,65,16,109,65,1,107,16,133,1,16,9,11,11,11,0,65,1,36,201,1,65,0,16,10,11,216,2,1,5,127,35,172,1,69,4,64,65,0,36,210,1,65,0,36,59,65,196,254,3,65,0,16,9,65,0,65,1,65,193,254,3,16,7,16,133,1,16,133,1,33,3,65,0,36,73,65,193,254,3,32,3,16,9,15,11,35,73,33,2,35,59,34,3,65,144,1,78,4,64,65,1,33,1,5,35,210,1,16,233,1,78,4,64,65,2,33,1,5,35,210,1,16,234,1,78,4,64,65,3,33,1,11,11,11,32,2,32,1,71,4,64,65,193,254,3,16,7,33,0,32,1,36,73,65,0,33,2,2,64,2,64,2,64,2,64,2,64,2,64,32,1,14,4,1,2,3,4,0,11,12,4,11,65,3,65,1,65,0,32,0,16,133,1,16,133,1,34,0,16,29,33,2,12,3,11,65,4,65,0,65,1,32,0,16,133,1,16,8,34,0,16,29,33,2,12,2,11,65,5,65,1,65,0,32,0,16,133,1,16,8,34,0,16,29,33,2,12,1,11,65,1,65,0,32,0,16,8,16,8,33,0,11,32,2,4,64,16,235,1,11,32,1,69,4,64,16,236,1,11,32,1,65,1,70,4,64,16,237,1,11,35,178,1,33,2,32,1,69,34,4,4,127,32,4,5,32,1,65,1,70,11,65,1,113,34,4,4,127,32,3,32,2,70,5,32,4,11,65,1,113,4,64,65,6,65,2,32,0,16,8,34,0,16,29,4,64,16,235,1,11,5,65,2,32,0,16,133,1,33,0,11,65,193,254,3,32,0,16,9,11,11,115,1,1,127,35,172,1,4,64,35,210,1,32,0,106,36,210,1,35,210,1,16,216,1,78,4,64,35,210,1,16,216,1,107,36,210,1,35,59,34,1,65,144,1,70,4,64,35,17,4,64,16,230,1,5,32,1,16,229,1,11,16,231,1,16,232,1,5,32,1,65,144,1,72,4,64,35,17,69,4,64,32,1,16,229,1,11,11,11,32,1,65,153,1,74,4,127,65,0,5,32,1,65,1,106,11,34,1,36,59,11,11,16,238,1,11,44,0,35,209,1,16,217,1,72,4,64,15,11,3,64,35,209,1,16,217,1,78,4,64,16,217,1,16,239,1,35,209,1,16,217,1,107,36,209,1,12,1,11,11,11,238,1,1,2,127,65,1,36,54,65,4,33,0,35,70,69,34,1,4,127,35,21,69,5,32,1,11,65,1,113,4,64,35,50,16,7,65,255,1,113,16,211,1,33,0,5,35,70,4,127,35,208,1,69,5,35,70,11,65,1,113,34,1,4,127,16,212,1,5,32,1,11,65,1,113,4,64,65,0,36,70,65,0,36,21,35,50,16,7,65,255,1,113,16,211,1,33,0,35,50,65,1,107,65,255,255,3,113,36,50,11,11,35,49,65,240,1,113,36,49,32,0,65,0,76,4,64,32,0,15,11,35,179,1,65,0,74,4,64,32,0,35,179,1,106,33,0,65,0,36,179,1,11,32,0,16,215,1,106,33,0,35,69,32,0,106,36,69,35,21,69,4,64,35,15,4,64,35,209,1,32,0,106,36,209,1,16,240,1,5,32,0,16,239,1,11,35,14,4,64,35,74,32,0,106,36,74,5,32,0,16,101,11,11,35,16,4,64,35,197,1,32,0,106,36,197,1,16,147,1,5,32,0,16,146,1,11,32,0,11,76,1,2,127,3,64,32,0,69,34,1,4,127,35,69,16,56,72,5,32,1,11,65,1,113,4,64,16,241,1,65,0,72,4,64,65,1,33,0,11,12,1,11,11,35,69,16,56,78,4,64,35,69,16,56,107,36,69,65,1,15,11,35,50,65,1,107,65,255,255,3,113,36,50,65,127,11,14,0,32,0,65,128,8,106,32,1,65,50,108,106,11,22,0,32,1,4,64,32,0,65,1,58,0,0,5,32,0,65,0,58,0,0,11,11,158,1,0,65,0,65,0,16,243,1,35,42,58,0,0,65,1,65,0,16,243,1,35,43,58,0,0,65,2,65,0,16,243,1,35,44,58,0,0,65,3,65,0,16,243,1,35,45,58,0,0,65,4,65,0,16,243,1,35,46,58,0,0,65,5,65,0,16,243,1,35,47,58,0,0,65,6,65,0,16,243,1,35,48,58,0,0,65,7,65,0,16,243,1,35,49,58,0,0,65,8,65,0,16,243,1,35,51,59,1,0,65,10,65,0,16,243,1,35,50,59,1,0,65,12,65,0,16,243,1,35,69,54,2,0,65,17,65,0,16,243,1,35,70,16,244,1,65,18,65,0,16,243,1,35,21,16,244,1,11,35,0,65,0,65,1,16,243,1,35,210,1,54,2,0,65,4,65,1,16,243,1,35,73,58,0,0,65,196,254,3,35,59,16,9,11,28,0,65,0,65,2,16,243,1,35,208,1,16,244,1,65,1,65,2,16,243,1,35,213,1,16,244,1,11,3,0,1,11,110,0,65,0,65,4,16,243,1,35,34,59,1,0,65,2,65,4,16,243,1,35,38,59,1,0,65,4,65,4,16,243,1,35,71,16,244,1,65,5,65,4,16,243,1,35,72,16,244,1,65,6,65,4,16,243,1,35,55,16,244,1,65,7,65,4,16,243,1,35,56,16,244,1,65,8,65,4,16,243,1,35,57,16,244,1,65,9,65,4,16,243,1,35,58,16,244,1,65,10,65,4,16,243,1,35,35,16,244,1,11,56,0,65,0,65,5,16,243,1,35,66,54,2,0,65,4,65,5,16,243,1,35,67,54,2,0,65,8,65,5,16,243,1,35,198,1,54,2,0,65,132,254,3,35,63,16,9,65,133,254,3,35,193,1,16,9,11,39,0,65,0,65,6,16,243,1,35,75,54,2,0,65,4,65,6,16,243,1,35,143,1,58,0,0,65,5,65,6,16,243,1,35,76,58,0,0,11,123,0,65,0,65,7,16,243,1,35,79,16,244,1,65,1,65,7,16,243,1,35,111,54,2,0,65,5,65,7,16,243,1,35,98,54,2,0,65,9,65,7,16,243,1,35,77,54,2,0,65,14,65,7,16,243,1,35,101,54,2,0,65,19,65,7,16,243,1,35,214,1,58,0,0,65,20,65,7,16,243,1,35,127,58,0,0,65,25,65,7,16,243,1,35,91,16,244,1,65,26,65,7,16,243,1,35,89,54,2,0,65,31,65,7,16,243,1,35,92,59,1,0,11,88,0,65,0,65,8,16,243,1,35,82,16,244,1,65,1,65,8,16,243,1,35,121,54,2,0,65,5,65,8,16,243,1,35,102,54,2,0,65,9,65,8,16,243,1,35,80,54,2,0,65,14,65,8,16,243,1,35,105,54,2,0,65,19,65,8,16,243,1,35,215,1,58,0,0,65,20,65,8,16,243,1,35,131,1,58,0,0,11,51,0,65,0,65,9,16,243,1,35,85,16,244,1,65,1,65,9,16,243,1,35,123,54,2,0,65,5,65,9,16,243,1,35,83,54,2,0,65,9,65,9,16,243,1,35,135,1,59,1,0,11,75,0,65,0,65,10,16,243,1,35,88,16,244,1,65,1,65,10,16,243,1,35,125,54,2,0,65,5,65,10,16,243,1,35,106,54,2,0,65,9,65,10,16,243,1,35,86,54,2,0,65,14,65,10,16,243,1,35,109,54,2,0,65,19,65,10,16,243,1,35,140,1,59,1,0,11,35,0,16,245,1,16,246,1,16,247,1,16,248,1,16,249,1,16,250,1,16,251,1,16,252,1,16,253,1,16,254,1,16,255,1,11,18,0,32,0,45,0,0,65,0,74,4,64,65,1,15,11,65,0,11,158,1,0,65,0,65,0,16,243,1,45,0,0,36,42,65,1,65,0,16,243,1,45,0,0,36,43,65,2,65,0,16,243,1,45,0,0,36,44,65,3,65,0,16,243,1,45,0,0,36,45,65,4,65,0,16,243,1,45,0,0,36,46,65,5,65,0,16,243,1,45,0,0,36,47,65,6,65,0,16,243,1,45,0,0,36,48,65,7,65,0,16,243,1,45,0,0,36,49,65,8,65,0,16,243,1,47,1,0,36,51,65,10,65,0,16,243,1,47,1,0,36,50,65,12,65,0,16,243,1,40,2,0,36,69,65,17,65,0,16,243,1,16,129,2,36,70,65,18,65,0,16,243,1,16,129,2,36,21,11,44,0,65,0,65,1,16,243,1,40,2,0,36,210,1,65,4,65,1,16,243,1,45,0,0,36,73,65,196,254,3,16,7,36,59,65,192,254,3,16,7,16,129,1,11,46,0,65,0,65,2,16,243,1,16,129,2,36,208,1,65,1,65,2,16,243,1,16,129,2,36,213,1,65,255,255,3,16,7,16,153,1,65,143,254,3,16,7,16,152,1,11,11,0,65,128,254,3,16,7,16,151,1,11,110,0,65,0,65,4,16,243,1,47,1,0,36,34,65,2,65,4,16,243,1,47,1,0,36,38,65,4,65,4,16,243,1,16,129,2,36,71,65,5,65,4,16,243,1,16,129,2,36,72,65,6,65,4,16,243,1,16,129,2,36,55,65,7,65,4,16,243,1,16,129,2,36,56,65,8,65,4,16,243,1,16,129,2,36,57,65,9,65,4,16,243,1,16,129,2,36,58,65,10,65,4,16,243,1,16,129,2,36,35,11,73,0,65,0,65,5,16,243,1,40,2,0,36,66,65,4,65,5,16,243,1,40,2,0,36,67,65,8,65,5,16,243,1,40,2,0,36,198,1,65,132,254,3,16,7,36,63,65,133,254,3,16,7,16,149,1,65,134,254,3,16,7,16,150,1,65,135,254,3,16,7,16,52,11,41,0,65,0,65,6,16,243,1,40,2,0,36,75,65,4,65,6,16,243,1,45,0,0,36,143,1,65,5,65,6,16,243,1,45,0,0,36,76,16,16,11,123,0,65,0,65,7,16,243,1,16,129,2,36,79,65,1,65,7,16,243,1,40,2,0,36,111,65,5,65,7,16,243,1,40,2,0,36,98,65,9,65,7,16,243,1,40,2,0,36,77,65,14,65,7,16,243,1,40,2,0,36,101,65,19,65,7,16,243,1,45,0,0,36,214,1,65,20,65,7,16,243,1,45,0,0,36,127,65,25,65,7,16,243,1,16,129,2,36,91,65,26,65,7,16,243,1,40,2,0,36,89,65,31,65,7,16,243,1,47,1,0,36,92,11,88,0,65,0,65,8,16,243,1,16,129,2,36,82,65,1,65,8,16,243,1,40,2,0,36,121,65,5,65,8,16,243,1,40,2,0,36,102,65,9,65,8,16,243,1,40,2,0,36,80,65,14,65,8,16,243,1,40,2,0,36,105,65,19,65,8,16,243,1,45,0,0,36,215,1,65,20,65,8,16,243,1,45,0,0,36,131,1,11,51,0,65,0,65,9,16,243,1,16,129,2,36,85,65,1,65,9,16,243,1,40,2,0,36,123,65,5,65,9,16,243,1,40,2,0,36,83,65,9,65,9,16,243,1,47,1,0,36,135,1,11,75,0,65,0,65,10,16,243,1,16,129,2,36,88,65,1,65,10,16,243,1,40,2,0,36,125,65,5,65,10,16,243,1,40,2,0,36,106,65,9,65,10,16,243,1,40,2,0,36,86,65,14,65,10,16,243,1,40,2,0,36,109,65,19,65,10,16,243,1,47,1,0,36,140,1,11,39,0,16,130,2,16,131,2,16,132,2,16,133,2,16,134,2,16,135,2,16,136,2,16,137,2,16,138,2,16,139,2,16,140,2,65,0,36,54,11,20,0,63,0,65,139,1,72,4,64,65,139,1,63,0,107,64,0,26,11,11,11,73,1,0,65,4,11,67,32,0,0,0,105,0,110,0,105,0,116,0,105,0,97,0,108,0,105,0,122,0,105,0,110,0,103,0,32,0,40,0,105,0,110,0,99,0,108,0,117,0,100,0,101,0,66,0,111,0,111,0,116,0,82,0,111,0,109,0,61,0,36,0,48,0,41,0,184,87,4,110,97,109,101,1,176,87,143,2,0,26,119,97,115,109,47,104,101,108,112,101,114,115,47,105,110,100,101,120,47,101,110,118,46,108,111,103,1,18,119,97,115,109,47,99,111,110,102,105,103,47,99,111,110,102,105,103,2,51,119,97,115,109,47,106,111,121,112,97,100,47,105,110,100,101,120,47,95,103,101,116,74,111,121,112,97,100,66,117,116,116,111,110,83,116,97,116,101,70,114,111,109,66,117,116,116,111,110,73,100,3,51,119,97,115,109,47,106,111,121,112,97,100,47,105,110,100,101,120,47,95,115,101,116,74,111,121,112,97,100,66,117,116,116,111,110,83,116,97,116,101,70,114,111,109,66,117,116,116,111,110,73,100,4,37,119,97,115,109,47,109,101,109,111,114,121,47,98,97,110,107,105,110,103,47,103,101,116,82,111,109,66,97,110,107,65,100,100,114,101,115,115,5,37,119,97,115,109,47,109,101,109,111,114,121,47,98,97,110,107,105,110,103,47,103,101,116,82,97,109,66,97,110,107,65,100,100,114,101,115,115,6,55,119,97,115,109,47,109,101,109,111,114,121,47,109,101,109,111,114,121,77,97,112,47,103,101,116,87,97,115,109,66,111,121,79,102,102,115,101,116,70,114,111,109,71,97,109,101,66,111,121,79,102,102,115,101,116,7,41,119,97,115,109,47,109,101,109,111,114,121,47,108,111,97,100,47,101,105,103,104,116,66,105,116,76,111,97,100,70,114,111,109,71,66,77,101,109,111,114,121,8,31,119,97,115,109,47,104,101,108,112,101,114,115,47,105,110,100,101,120,47,115,101,116,66,105,116,79,110,66,121,116,101,9,43,119,97,115,109,47,109,101,109,111,114,121,47,115,116,111,114,101,47,101,105,103,104,116,66,105,116,83,116,111,114,101,73,110,116,111,71,66,77,101,109,111,114,121,10,39,119,97,115,109,47,105,110,116,101,114,114,117,112,116,115,47,105,110,100,101,120,47,95,114,101,113,117,101,115,116,73,110,116,101,114,114,117,112,116,11,44,119,97,115,109,47,105,110,116,101,114,114,117,112,116,115,47,105,110,100,101,120,47,114,101,113,117,101,115,116,74,111,121,112,97,100,73,110,116,101,114,114,117,112,116,12,36,119,97,115,109,47,106,111,121,112,97,100,47,105,110,100,101,120,47,95,112,114,101,115,115,74,111,121,112,97,100,66,117,116,116,111,110,13,38,119,97,115,109,47,106,111,121,112,97,100,47,105,110,100,101,120,47,95,114,101,108,101,97,115,101,74,111,121,112,97,100,66,117,116,116,111,110,14,32,119,97,115,109,47,106,111,121,112,97,100,47,105,110,100,101,120,47,115,101,116,74,111,121,112,97,100,83,116,97,116,101,15,35,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,103,101,116,65,117,100,105,111,81,117,101,117,101,73,110,100,101,120,16,32,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,114,101,115,101,116,65,117,100,105,111,81,117,101,117,101,17,33,119,97,115,109,47,100,101,98,117,103,47,100,101,98,117,103,45,99,112,117,47,103,101,116,82,101,103,105,115,116,101,114,65,18,33,119,97,115,109,47,100,101,98,117,103,47,100,101,98,117,103,45,99,112,117,47,103,101,116,82,101,103,105,115,116,101,114,66,19,33,119,97,115,109,47,100,101,98,117,103,47,100,101,98,117,103,45,99,112,117,47,103,101,116,82,101,103,105,115,116,101,114,67,20,33,119,97,115,109,47,100,101,98,117,103,47,100,101,98,117,103,45,99,112,117,47,103,101,116,82,101,103,105,115,116,101,114,68,21,33,119,97,115,109,47,100,101,98,117,103,47,100,101,98,117,103,45,99,112,117,47,103,101,116,82,101,103,105,115,116,101,114,69,22,33,119,97,115,109,47,100,101,98,117,103,47,100,101,98,117,103,45,99,112,117,47,103,101,116,82,101,103,105,115,116,101,114,72,23,33,119,97,115,109,47,100,101,98,117,103,47,100,101,98,117,103,45,99,112,117,47,103,101,116,82,101,103,105,115,116,101,114,76,24,33,119,97,115,109,47,100,101,98,117,103,47,100,101,98,117,103,45,99,112,117,47,103,101,116,82,101,103,105,115,116,101,114,70,25,38,119,97,115,109,47,100,101,98,117,103,47,100,101,98,117,103,45,99,112,117,47,103,101,116,80,114,111,103,114,97,109,67,111,117,110,116,101,114,26,36,119,97,115,109,47,100,101,98,117,103,47,100,101,98,117,103,45,99,112,117,47,103,101,116,83,116,97,99,107,80,111,105,110,116,101,114,27,46,119,97,115,109,47,100,101,98,117,103,47,100,101,98,117,103,45,99,112,117,47,103,101,116,79,112,99,111,100,101,65,116,80,114,111,103,114,97,109,67,111,117,110,116,101,114,28,35,119,97,115,109,47,109,101,109,111,114,121,47,109,101,109,111,114,121,47,108,111,97,100,70,114,111,109,86,114,97,109,66,97,110,107,29,33,119,97,115,109,47,104,101,108,112,101,114,115,47,105,110,100,101,120,47,99,104,101,99,107,66,105,116,79,110,66,121,116,101,30,44,119,97,115,109,47,103,114,97,112,104,105,99,115,47,114,101,110,100,101,114,85,116,105,108,115,47,103,101,116,84,105,108,101,68,97,116,97,65,100,100,114,101,115,115,31,48,119,97,115,109,47,109,101,109,111,114,121,47,109,101,109,111,114,121,47,108,111,97,100,80,97,108,101,116,116,101,66,121,116,101,70,114,111,109,87,97,115,109,77,101,109,111,114,121,32,35,119,97,115,109,47,104,101,108,112,101,114,115,47,105,110,100,101,120,47,99,111,110,99,97,116,101,110,97,116,101,66,121,116,101,115,33,44,119,97,115,109,47,103,114,97,112,104,105,99,115,47,112,97,108,101,116,116,101,47,103,101,116,82,103,98,67,111,108,111,114,70,114,111,109,80,97,108,101,116,116,101,34,46,119,97,115,109,47,103,114,97,112,104,105,99,115,47,112,97,108,101,116,116,101,47,103,101,116,67,111,108,111,114,67,111,109,112,111,110,101,110,116,70,114,111,109,82,103,98,35,51,119,97,115,109,47,103,114,97,112,104,105,99,115,47,112,97,108,101,116,116,101,47,103,101,116,77,111,110,111,99,104,114,111,109,101,67,111,108,111,114,70,114,111,109,80,97,108,101,116,116,101,36,55,119,97,115,109,47,100,101,98,117,103,47,100,101,98,117,103,45,103,114,97,112,104,105,99,115,47,100,114,97,119,66,97,99,107,103,114,111,117,110,100,77,97,112,84,111,87,97,115,109,77,101,109,111,114,121,37,37,119,97,115,109,47,103,114,97,112,104,105,99,115,47,116,105,108,101,115,47,103,101,116,84,105,108,101,80,105,120,101,108,83,116,97,114,116,38,36,119,97,115,109,47,103,114,97,112,104,105,99,115,47,112,114,105,111,114,105,116,121,47,103,101,116,80,105,120,101,108,83,116,97,114,116,39,42,119,97,115,109,47,103,114,97,112,104,105,99,115,47,112,114,105,111,114,105,116,121,47,97,100,100,80,114,105,111,114,105,116,121,102,111,114,80,105,120,101,108,40,44,119,97,115,109,47,103,114,97,112,104,105,99,115,47,116,105,108,101,115,47,100,114,97,119,80,105,120,101,108,115,70,114,111,109,76,105,110,101,79,102,84,105,108,101,41,50,119,97,115,109,47,100,101,98,117,103,47,100,101,98,117,103,45,103,114,97,112,104,105,99,115,47,100,114,97,119,84,105,108,101,68,97,116,97,84,111,87,97,115,109,77,101,109,111,114,121,42,25,119,97,115,109,47,105,110,100,101,120,47,104,97,115,67,111,114,101,83,116,97,114,116,101,100,43,22,119,97,115,109,47,104,101,108,112,101,114,115,47,105,110,100,101,120,47,108,111,103,44,38,119,97,115,109,47,109,101,109,111,114,121,47,109,101,109,111,114,121,47,105,110,105,116,105,97,108,105,122,101,67,97,114,116,114,105,100,103,101,45,41,119,97,115,109,47,103,114,97,112,104,105,99,115,47,103,114,97,112,104,105,99,115,47,105,110,105,116,105,97,108,105,122,101,71,114,97,112,104,105,99,115,46,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,67,104,97,110,110,101,108,49,46,105,110,105,116,105,97,108,105,122,101,47,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,50,47,67,104,97,110,110,101,108,50,46,105,110,105,116,105,97,108,105,122,101,48,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,51,47,67,104,97,110,110,101,108,51,46,105,110,105,116,105,97,108,105,122,101,49,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,52,47,67,104,97,110,110,101,108,52,46,105,110,105,116,105,97,108,105,122,101,50,32,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,105,110,105,116,105,97,108,105,122,101,83,111,117,110,100,51,50,119,97,115,109,47,116,105,109,101,114,115,47,105,110,100,101,120,47,103,101,116,70,114,101,113,117,101,110,99,121,70,114,111,109,73,110,112,117,116,67,108,111,99,107,83,101,108,101,99,116,52,43,119,97,115,109,47,116,105,109,101,114,115,47,105,110,100,101,120,47,84,105,109,101,114,115,46,117,112,100,97,116,101,84,105,109,101,114,67,111,110,116,114,111,108,53,34,119,97,115,109,47,116,105,109,101,114,115,47,105,110,100,101,120,47,105,110,105,116,105,97,108,105,122,101,84,105,109,101,114,115,54,26,119,97,115,109,47,99,112,117,47,99,112,117,47,105,110,105,116,105,97,108,105,122,101,67,112,117,55,21,119,97,115,109,47,105,110,100,101,120,47,105,110,105,116,105,97,108,105,122,101,56,37,119,97,115,109,47,99,112,117,47,99,112,117,47,67,112,117,46,77,65,88,95,67,89,67,76,69,83,95,80,69,82,95,70,82,65,77,69,57,31,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,103,101,116,68,97,116,97,66,121,116,101,84,119,111,58,40,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,103,101,116,67,111,110,99,97,116,101,110,97,116,101,100,68,97,116,97,66,121,116,101,59,32,119,97,115,109,47,104,101,108,112,101,114,115,47,105,110,100,101,120,47,115,112,108,105,116,72,105,103,104,66,121,116,101,60,31,119,97,115,109,47,104,101,108,112,101,114,115,47,105,110,100,101,120,47,115,112,108,105,116,76,111,119,66,121,116,101,61,33,119,97,115,109,47,109,101,109,111,114,121,47,98,97,110,107,105,110,103,47,104,97,110,100,108,101,66,97,110,107,105,110,103,62,41,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,83,111,117,110,100,46,98,97,116,99,104,80,114,111,99,101,115,115,67,121,99,108,101,115,63,45,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,83,111,117,110,100,46,109,97,120,70,114,97,109,101,83,101,113,117,101,110,99,101,67,121,99,108,101,115,64,41,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,67,104,97,110,110,101,108,49,46,117,112,100,97,116,101,76,101,110,103,116,104,65,41,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,50,47,67,104,97,110,110,101,108,50,46,117,112,100,97,116,101,76,101,110,103,116,104,66,41,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,51,47,67,104,97,110,110,101,108,51,46,117,112,100,97,116,101,76,101,110,103,116,104,67,41,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,52,47,67,104,97,110,110,101,108,52,46,117,112,100,97,116,101,76,101,110,103,116,104,68,44,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,103,101,116,78,101,119,70,114,101,113,117,101,110,99,121,70,114,111,109,83,119,101,101,112,69,41,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,67,104,97,110,110,101,108,49,46,115,101,116,70,114,101,113,117,101,110,99,121,70,50,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,99,97,108,99,117,108,97,116,101,83,119,101,101,112,65,110,100,67,104,101,99,107,79,118,101,114,102,108,111,119,71,40,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,67,104,97,110,110,101,108,49,46,117,112,100,97,116,101,83,119,101,101,112,72,43,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,67,104,97,110,110,101,108,49,46,117,112,100,97,116,101,69,110,118,101,108,111,112,101,73,43,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,50,47,67,104,97,110,110,101,108,50,46,117,112,100,97,116,101,69,110,118,101,108,111,112,101,74,43,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,52,47,67,104,97,110,110,101,108,52,46,117,112,100,97,116,101,69,110,118,101,108,111,112,101,75,37,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,117,112,100,97,116,101,70,114,97,109,101,83,101,113,117,101,110,99,101,114,76,46,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,67,104,97,110,110,101,108,49,46,119,105,108,108,67,104,97,110,110,101,108,85,112,100,97,116,101,77,36,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,100,105,100,67,104,97,110,110,101,108,68,97,99,67,104,97,110,103,101,78,46,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,50,47,67,104,97,110,110,101,108,50,46,119,105,108,108,67,104,97,110,110,101,108,85,112,100,97,116,101,79,46,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,51,47,67,104,97,110,110,101,108,51,46,119,105,108,108,67,104,97,110,110,101,108,85,112,100,97,116,101,80,46,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,52,47,67,104,97,110,110,101,108,52,46,119,105,108,108,67,104,97,110,110,101,108,85,112,100,97,116,101,81,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,67,104,97,110,110,101,108,49,46,114,101,115,101,116,84,105,109,101,114,82,61,119,97,115,109,47,115,111,117,110,100,47,100,117,116,121,47,105,115,68,117,116,121,67,121,99,108,101,67,108,111,99,107,80,111,115,105,116,105,118,101,79,114,78,101,103,97,116,105,118,101,70,111,114,87,97,118,101,102,111,114,109,83,38,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,67,104,97,110,110,101,108,49,46,103,101,116,83,97,109,112,108,101,84,54,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,67,104,97,110,110,101,108,49,46,103,101,116,83,97,109,112,108,101,70,114,111,109,67,121,99,108,101,67,111,117,110,116,101,114,85,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,50,47,67,104,97,110,110,101,108,50,46,114,101,115,101,116,84,105,109,101,114,86,38,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,50,47,67,104,97,110,110,101,108,50,46,103,101,116,83,97,109,112,108,101,87,54,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,50,47,67,104,97,110,110,101,108,50,46,103,101,116,83,97,109,112,108,101,70,114,111,109,67,121,99,108,101,67,111,117,110,116,101,114,88,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,51,47,67,104,97,110,110,101,108,51,46,114,101,115,101,116,84,105,109,101,114,89,38,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,51,47,67,104,97,110,110,101,108,51,46,103,101,116,83,97,109,112,108,101,90,54,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,51,47,67,104,97,110,110,101,108,51,46,103,101,116,83,97,109,112,108,101,70,114,111,109,67,121,99,108,101,67,111,117,110,116,101,114,91,59,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,52,47,67,104,97,110,110,101,108,52,46,103,101,116,78,111,105,115,101,67,104,97,110,110,101,108,70,114,101,113,117,101,110,99,121,80,101,114,105,111,100,92,38,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,52,47,67,104,97,110,110,101,108,52,46,103,101,116,83,97,109,112,108,101,93,54,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,52,47,67,104,97,110,110,101,108,52,46,103,101,116,83,97,109,112,108,101,70,114,111,109,67,121,99,108,101,67,111,117,110,116,101,114,94,28,119,97,115,109,47,99,112,117,47,99,112,117,47,67,112,117,46,67,76,79,67,75,95,83,80,69,69,68,95,42,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,83,111,117,110,100,46,109,97,120,68,111,119,110,83,97,109,112,108,101,67,121,99,108,101,115,96,40,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,103,101,116,83,97,109,112,108,101,65,115,85,110,115,105,103,110,101,100,66,121,116,101,97,34,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,109,105,120,67,104,97,110,110,101,108,83,97,109,112,108,101,115,98,53,119,97,115,109,47,109,101,109,111,114,121,47,109,101,109,111,114,121,47,115,101,116,76,101,102,116,65,110,100,82,105,103,104,116,79,117,116,112,117,116,70,111,114,65,117,100,105,111,81,117,101,117,101,99,32,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,97,99,99,117,109,117,108,97,116,101,83,111,117,110,100,100,31,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,99,97,108,99,117,108,97,116,101,83,111,117,110,100,101,28,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,117,112,100,97,116,101,83,111,117,110,100,102,34,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,98,97,116,99,104,80,114,111,99,101,115,115,65,117,100,105,111,103,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,67,104,97,110,110,101,108,49,46,117,112,100,97,116,101,78,82,120,48,104,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,51,47,67,104,97,110,110,101,108,51,46,117,112,100,97,116,101,78,82,120,48,105,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,67,104,97,110,110,101,108,49,46,117,112,100,97,116,101,78,82,120,49,106,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,50,47,67,104,97,110,110,101,108,50,46,117,112,100,97,116,101,78,82,120,49,107,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,51,47,67,104,97,110,110,101,108,51,46,117,112,100,97,116,101,78,82,120,49,108,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,52,47,67,104,97,110,110,101,108,52,46,117,112,100,97,116,101,78,82,120,49,109,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,67,104,97,110,110,101,108,49,46,117,112,100,97,116,101,78,82,120,50,110,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,50,47,67,104,97,110,110,101,108,50,46,117,112,100,97,116,101,78,82,120,50,111,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,51,47,67,104,97,110,110,101,108,51,46,117,112,100,97,116,101,78,82,120,50,112,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,52,47,67,104,97,110,110,101,108,52,46,117,112,100,97,116,101,78,82,120,50,113,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,67,104,97,110,110,101,108,49,46,117,112,100,97,116,101,78,82,120,51,114,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,50,47,67,104,97,110,110,101,108,50,46,117,112,100,97,116,101,78,82,120,51,115,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,51,47,67,104,97,110,110,101,108,51,46,117,112,100,97,116,101,78,82,120,51,116,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,52,47,67,104,97,110,110,101,108,52,46,117,112,100,97,116,101,78,82,120,51,117,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,67,104,97,110,110,101,108,49,46,117,112,100,97,116,101,78,82,120,52,118,36,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,67,104,97,110,110,101,108,49,46,116,114,105,103,103,101,114,119,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,50,47,67,104,97,110,110,101,108,50,46,117,112,100,97,116,101,78,82,120,52,120,36,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,50,47,67,104,97,110,110,101,108,50,46,116,114,105,103,103,101,114,121,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,51,47,67,104,97,110,110,101,108,51,46,117,112,100,97,116,101,78,82,120,52,122,36,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,51,47,67,104,97,110,110,101,108,51,46,116,114,105,103,103,101,114,123,39,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,52,47,67,104,97,110,110,101,108,52,46,117,112,100,97,116,101,78,82,120,52,124,36,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,52,47,67,104,97,110,110,101,108,52,46,116,114,105,103,103,101,114,125,33,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,83,111,117,110,100,46,117,112,100,97,116,101,78,82,53,48,126,33,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,83,111,117,110,100,46,117,112,100,97,116,101,78,82,53,49,127,33,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,83,111,117,110,100,46,117,112,100,97,116,101,78,82,53,50,128,1,44,119,97,115,109,47,115,111,117,110,100,47,114,101,103,105,115,116,101,114,115,47,83,111,117,110,100,82,101,103,105,115,116,101,114,87,114,105,116,101,84,114,97,112,115,129,1,38,119,97,115,109,47,103,114,97,112,104,105,99,115,47,108,99,100,47,76,99,100,46,117,112,100,97,116,101,76,99,100,67,111,110,116,114,111,108,130,1,32,119,97,115,109,47,109,101,109,111,114,121,47,100,109,97,47,115,116,97,114,116,68,109,97,84,114,97,110,115,102,101,114,131,1,39,119,97,115,109,47,109,101,109,111,114,121,47,100,109,97,47,103,101,116,72,100,109,97,83,111,117,114,99,101,70,114,111,109,77,101,109,111,114,121,132,1,44,119,97,115,109,47,109,101,109,111,114,121,47,100,109,97,47,103,101,116,72,100,109,97,68,101,115,116,105,110,97,116,105,111,110,70,114,111,109,77,101,109,111,114,121,133,1,33,119,97,115,109,47,104,101,108,112,101,114,115,47,105,110,100,101,120,47,114,101,115,101,116,66,105,116,79,110,66,121,116,101,134,1,43,119,97,115,109,47,115,111,117,110,100,47,114,101,103,105,115,116,101,114,115,47,83,111,117,110,100,82,101,103,105,115,116,101,114,82,101,97,100,84,114,97,112,115,135,1,32,119,97,115,109,47,106,111,121,112,97,100,47,105,110,100,101,120,47,103,101,116,74,111,121,112,97,100,83,116,97,116,101,136,1,36,119,97,115,109,47,109,101,109,111,114,121,47,114,101,97,100,84,114,97,112,115,47,99,104,101,99,107,82,101,97,100,84,114,97,112,115,137,1,50,119,97,115,109,47,109,101,109,111,114,121,47,108,111,97,100,47,101,105,103,104,116,66,105,116,76,111,97,100,70,114,111,109,71,66,77,101,109,111,114,121,87,105,116,104,84,114,97,112,115,138,1,28,119,97,115,109,47,109,101,109,111,114,121,47,100,109,97,47,104,100,109,97,84,114,97,110,115,102,101,114,139,1,33,119,97,115,109,47,109,101,109,111,114,121,47,100,109,97,47,115,116,97,114,116,72,100,109,97,84,114,97,110,115,102,101,114,140,1,47,119,97,115,109,47,109,101,109,111,114,121,47,109,101,109,111,114,121,47,115,116,111,114,101,80,97,108,101,116,116,101,66,121,116,101,73,110,87,97,115,109,77,101,109,111,114,121,141,1,48,119,97,115,109,47,103,114,97,112,104,105,99,115,47,112,97,108,101,116,116,101,47,105,110,99,114,101,109,101,110,116,80,97,108,101,116,116,101,73,110,100,101,120,73,102,83,101,116,142,1,47,119,97,115,109,47,103,114,97,112,104,105,99,115,47,112,97,108,101,116,116,101,47,119,114,105,116,101,67,111,108,111,114,80,97,108,101,116,116,101,84,111,77,101,109,111,114,121,143,1,43,119,97,115,109,47,116,105,109,101,114,115,47,105,110,100,101,120,47,84,105,109,101,114,115,46,98,97,116,99,104,80,114,111,99,101,115,115,67,121,99,108,101,115,144,1,39,119,97,115,109,47,116,105,109,101,114,115,47,105,110,100,101,120,47,95,99,104,101,99,107,68,105,118,105,100,101,114,82,101,103,105,115,116,101,114,145,1,43,119,97,115,109,47,105,110,116,101,114,114,117,112,116,115,47,105,110,100,101,120,47,114,101,113,117,101,115,116,84,105,109,101,114,73,110,116,101,114,114,117,112,116,146,1,30,119,97,115,109,47,116,105,109,101,114,115,47,105,110,100,101,120,47,117,112,100,97,116,101,84,105,109,101,114,115,147,1,36,119,97,115,109,47,116,105,109,101,114,115,47,105,110,100,101,120,47,98,97,116,99,104,80,114,111,99,101,115,115,84,105,109,101,114,115,148,1,46,119,97,115,109,47,116,105,109,101,114,115,47,105,110,100,101,120,47,84,105,109,101,114,115,46,117,112,100,97,116,101,68,105,118,105,100,101,114,82,101,103,105,115,116,101,114,149,1,43,119,97,115,109,47,116,105,109,101,114,115,47,105,110,100,101,120,47,84,105,109,101,114,115,46,117,112,100,97,116,101,84,105,109,101,114,67,111,117,110,116,101,114,150,1,42,119,97,115,109,47,116,105,109,101,114,115,47,105,110,100,101,120,47,84,105,109,101,114,115,46,117,112,100,97,116,101,84,105,109,101,114,77,111,100,117,108,111,151,1,37,119,97,115,109,47,106,111,121,112,97,100,47,105,110,100,101,120,47,74,111,121,112,97,100,46,117,112,100,97,116,101,74,111,121,112,97,100,152,1,57,119,97,115,109,47,105,110,116,101,114,114,117,112,116,115,47,105,110,100,101,120,47,73,110,116,101,114,114,117,112,116,115,46,117,112,100,97,116,101,73,110,116,101,114,114,117,112,116,82,101,113,117,101,115,116,101,100,153,1,55,119,97,115,109,47,105,110,116,101,114,114,117,112,116,115,47,105,110,100,101,120,47,73,110,116,101,114,114,117,112,116,115,46,117,112,100,97,116,101,73,110,116,101,114,114,117,112,116,69,110,97,98,108,101,100,154,1,38,119,97,115,109,47,109,101,109,111,114,121,47,119,114,105,116,101,84,114,97,112,115,47,99,104,101,99,107,87,114,105,116,101,84,114,97,112,115,155,1,52,119,97,115,109,47,109,101,109,111,114,121,47,115,116,111,114,101,47,101,105,103,104,116,66,105,116,83,116,111,114,101,73,110,116,111,71,66,77,101,109,111,114,121,87,105,116,104,84,114,97,112,115,156,1,25,119,97,115,109,47,99,112,117,47,102,108,97,103,115,47,115,101,116,70,108,97,103,66,105,116,157,1,31,119,97,115,109,47,99,112,117,47,102,108,97,103,115,47,115,101,116,72,97,108,102,67,97,114,114,121,70,108,97,103,158,1,47,119,97,115,109,47,99,112,117,47,102,108,97,103,115,47,99,104,101,99,107,65,110,100,83,101,116,69,105,103,104,116,66,105,116,72,97,108,102,67,97,114,114,121,70,108,97,103,159,1,26,119,97,115,109,47,99,112,117,47,102,108,97,103,115,47,115,101,116,90,101,114,111,70,108,97,103,160,1,30,119,97,115,109,47,99,112,117,47,102,108,97,103,115,47,115,101,116,83,117,98,116,114,97,99,116,70,108,97,103,161,1,27,119,97,115,109,47,99,112,117,47,102,108,97,103,115,47,115,101,116,67,97,114,114,121,70,108,97,103,162,1,33,119,97,115,109,47,104,101,108,112,101,114,115,47,105,110,100,101,120,47,114,111,116,97,116,101,66,121,116,101,76,101,102,116,163,1,54,119,97,115,109,47,109,101,109,111,114,121,47,115,116,111,114,101,47,115,105,120,116,101,101,110,66,105,116,83,116,111,114,101,73,110,116,111,71,66,77,101,109,111,114,121,87,105,116,104,84,114,97,112,115,164,1,52,119,97,115,109,47,99,112,117,47,102,108,97,103,115,47,99,104,101,99,107,65,110,100,83,101,116,83,105,120,116,101,101,110,66,105,116,70,108,97,103,115,65,100,100,79,118,101,114,102,108,111,119,165,1,34,119,97,115,109,47,104,101,108,112,101,114,115,47,105,110,100,101,120,47,114,111,116,97,116,101,66,121,116,101,82,105,103,104,116,166,1,31,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,104,97,110,100,108,101,79,112,99,111,100,101,48,120,167,1,27,119,97,115,109,47,99,112,117,47,102,108,97,103,115,47,103,101,116,67,97,114,114,121,70,108,97,103,168,1,45,119,97,115,109,47,104,101,108,112,101,114,115,47,105,110,100,101,120,47,114,111,116,97,116,101,66,121,116,101,76,101,102,116,84,104,114,111,117,103,104,67,97,114,114,121,169,1,34,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,114,101,108,97,116,105,118,101,74,117,109,112,170,1,46,119,97,115,109,47,104,101,108,112,101,114,115,47,105,110,100,101,120,47,114,111,116,97,116,101,66,121,116,101,82,105,103,104,116,84,104,114,111,117,103,104,67,97,114,114,121,171,1,31,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,104,97,110,100,108,101,79,112,99,111,100,101,49,120,172,1,26,119,97,115,109,47,99,112,117,47,102,108,97,103,115,47,103,101,116,90,101,114,111,70,108,97,103,173,1,31,119,97,115,109,47,99,112,117,47,102,108,97,103,115,47,103,101,116,72,97,108,102,67,97,114,114,121,70,108,97,103,174,1,30,119,97,115,109,47,99,112,117,47,102,108,97,103,115,47,103,101,116,83,117,98,116,114,97,99,116,70,108,97,103,175,1,31,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,104,97,110,100,108,101,79,112,99,111,100,101,50,120,176,1,31,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,104,97,110,100,108,101,79,112,99,111,100,101,51,120,177,1,31,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,104,97,110,100,108,101,79,112,99,111,100,101,52,120,178,1,31,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,104,97,110,100,108,101,79,112,99,111,100,101,53,120,179,1,31,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,104,97,110,100,108,101,79,112,99,111,100,101,54,120,180,1,31,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,104,97,110,100,108,101,79,112,99,111,100,101,55,120,181,1,43,119,97,115,109,47,99,112,117,47,102,108,97,103,115,47,99,104,101,99,107,65,110,100,83,101,116,69,105,103,104,116,66,105,116,67,97,114,114,121,70,108,97,103,182,1,34,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,97,100,100,65,82,101,103,105,115,116,101,114,183,1,46,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,97,100,100,65,84,104,114,111,117,103,104,67,97,114,114,121,82,101,103,105,115,116,101,114,184,1,31,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,104,97,110,100,108,101,79,112,99,111,100,101,56,120,185,1,34,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,115,117,98,65,82,101,103,105,115,116,101,114,186,1,46,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,115,117,98,65,84,104,114,111,117,103,104,67,97,114,114,121,82,101,103,105,115,116,101,114,187,1,31,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,104,97,110,100,108,101,79,112,99,111,100,101,57,120,188,1,34,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,97,110,100,65,82,101,103,105,115,116,101,114,189,1,34,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,120,111,114,65,82,101,103,105,115,116,101,114,190,1,31,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,104,97,110,100,108,101,79,112,99,111,100,101,65,120,191,1,33,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,111,114,65,82,101,103,105,115,116,101,114,192,1,33,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,99,112,65,82,101,103,105,115,116,101,114,193,1,31,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,104,97,110,100,108,101,79,112,99,111,100,101,66,120,194,1,43,119,97,115,109,47,109,101,109,111,114,121,47,108,111,97,100,47,115,105,120,116,101,101,110,66,105,116,76,111,97,100,70,114,111,109,71,66,77,101,109,111,114,121,195,1,40,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,114,111,116,97,116,101,82,101,103,105,115,116,101,114,76,101,102,116,196,1,41,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,114,111,116,97,116,101,82,101,103,105,115,116,101,114,82,105,103,104,116,197,1,52,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,114,111,116,97,116,101,82,101,103,105,115,116,101,114,76,101,102,116,84,104,114,111,117,103,104,67,97,114,114,121,198,1,53,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,114,111,116,97,116,101,82,101,103,105,115,116,101,114,82,105,103,104,116,84,104,114,111,117,103,104,67,97,114,114,121,199,1,39,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,115,104,105,102,116,76,101,102,116,82,101,103,105,115,116,101,114,200,1,50,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,115,104,105,102,116,82,105,103,104,116,65,114,105,116,104,109,101,116,105,99,82,101,103,105,115,116,101,114,201,1,43,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,115,119,97,112,78,105,98,98,108,101,115,79,110,82,101,103,105,115,116,101,114,202,1,47,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,115,104,105,102,116,82,105,103,104,116,76,111,103,105,99,97,108,82,101,103,105,115,116,101,114,203,1,39,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,116,101,115,116,66,105,116,79,110,82,101,103,105,115,116,101,114,204,1,38,119,97,115,109,47,99,112,117,47,105,110,115,116,114,117,99,116,105,111,110,115,47,115,101,116,66,105,116,79,110,82,101,103,105,115,116,101,114,205,1,33,119,97,115,109,47,99,112,117,47,99,98,79,112,99,111,100,101,115,47,104,97,110,100,108,101,67,98,79,112,99,111,100,101,206,1,31,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,104,97,110,100,108,101,79,112,99,111,100,101,67,120,207,1,35,119,97,115,109,47,105,110,116,101,114,114,117,112,116,115,47,105,110,100,101,120,47,115,101,116,73,110,116,101,114,114,117,112,116,115,208,1,31,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,104,97,110,100,108,101,79,112,99,111,100,101,68,120,209,1,31,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,104,97,110,100,108,101,79,112,99,111,100,101,69,120,210,1,31,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,104,97,110,100,108,101,79,112,99,111,100,101,70,120,211,1,30,119,97,115,109,47,99,112,117,47,111,112,99,111,100,101,115,47,101,120,101,99,117,116,101,79,112,99,111,100,101,212,1,53,119,97,115,109,47,105,110,116,101,114,114,117,112,116,115,47,105,110,100,101,120,47,73,110,116,101,114,114,117,112,116,115,46,97,114,101,73,110,116,101,114,114,117,112,116,115,80,101,110,100,105,110,103,213,1,45,119,97,115,109,47,109,101,109,111,114,121,47,115,116,111,114,101,47,115,105,120,116,101,101,110,66,105,116,83,116,111,114,101,73,110,116,111,71,66,77,101,109,111,114,121,214,1,38,119,97,115,109,47,105,110,116,101,114,114,117,112,116,115,47,105,110,100,101,120,47,95,104,97,110,100,108,101,73,110,116,101,114,114,117,112,116,215,1,37,119,97,115,109,47,105,110,116,101,114,114,117,112,116,115,47,105,110,100,101,120,47,99,104,101,99,107,73,110,116,101,114,114,117,112,116,115,216,1,55,119,97,115,109,47,103,114,97,112,104,105,99,115,47,103,114,97,112,104,105,99,115,47,71,114,97,112,104,105,99,115,46,77,65,88,95,67,89,67,76,69,83,95,80,69,82,95,83,67,65,78,76,73,78,69,217,1,50,119,97,115,109,47,103,114,97,112,104,105,99,115,47,103,114,97,112,104,105,99,115,47,71,114,97,112,104,105,99,115,46,98,97,116,99,104,80,114,111,99,101,115,115,67,121,99,108,101,115,218,1,35,119,97,115,109,47,109,101,109,111,114,121,47,109,101,109,111,114,121,47,103,101,116,82,103,98,80,105,120,101,108,83,116,97,114,116,219,1,34,119,97,115,109,47,109,101,109,111,114,121,47,109,101,109,111,114,121,47,115,101,116,80,105,120,101,108,79,110,70,114,97,109,101,220,1,42,119,97,115,109,47,103,114,97,112,104,105,99,115,47,112,114,105,111,114,105,116,121,47,103,101,116,80,114,105,111,114,105,116,121,102,111,114,80,105,120,101,108,221,1,58,119,97,115,109,47,103,114,97,112,104,105,99,115,47,98,97,99,107,103,114,111,117,110,100,87,105,110,100,111,119,47,100,114,97,119,76,105,110,101,79,102,84,105,108,101,70,114,111,109,84,105,108,101,67,97,99,104,101,222,1,55,119,97,115,109,47,103,114,97,112,104,105,99,115,47,98,97,99,107,103,114,111,117,110,100,87,105,110,100,111,119,47,100,114,97,119,76,105,110,101,79,102,84,105,108,101,70,114,111,109,84,105,108,101,73,100,223,1,55,119,97,115,109,47,103,114,97,112,104,105,99,115,47,98,97,99,107,103,114,111,117,110,100,87,105,110,100,111,119,47,100,114,97,119,67,111,108,111,114,80,105,120,101,108,70,114,111,109,84,105,108,101,73,100,224,1,60,119,97,115,109,47,103,114,97,112,104,105,99,115,47,98,97,99,107,103,114,111,117,110,100,87,105,110,100,111,119,47,100,114,97,119,77,111,110,111,99,104,114,111,109,101,80,105,120,101,108,70,114,111,109,84,105,108,101,73,100,225,1,59,119,97,115,109,47,103,114,97,112,104,105,99,115,47,98,97,99,107,103,114,111,117,110,100,87,105,110,100,111,119,47,100,114,97,119,66,97,99,107,103,114,111,117,110,100,87,105,110,100,111,119,83,99,97,110,108,105,110,101,226,1,47,119,97,115,109,47,103,114,97,112,104,105,99,115,47,98,97,99,107,103,114,111,117,110,100,87,105,110,100,111,119,47,114,101,110,100,101,114,66,97,99,107,103,114,111,117,110,100,227,1,43,119,97,115,109,47,103,114,97,112,104,105,99,115,47,98,97,99,107,103,114,111,117,110,100,87,105,110,100,111,119,47,114,101,110,100,101,114,87,105,110,100,111,119,228,1,35,119,97,115,109,47,103,114,97,112,104,105,99,115,47,115,112,114,105,116,101,115,47,114,101,110,100,101,114,83,112,114,105,116,101,115,229,1,36,119,97,115,109,47,103,114,97,112,104,105,99,115,47,103,114,97,112,104,105,99,115,47,95,100,114,97,119,83,99,97,110,108,105,110,101,230,1,41,119,97,115,109,47,103,114,97,112,104,105,99,115,47,103,114,97,112,104,105,99,115,47,95,114,101,110,100,101,114,69,110,116,105,114,101,70,114,97,109,101,231,1,39,119,97,115,109,47,103,114,97,112,104,105,99,115,47,112,114,105,111,114,105,116,121,47,99,108,101,97,114,80,114,105,111,114,105,116,121,77,97,112,232,1,34,119,97,115,109,47,103,114,97,112,104,105,99,115,47,116,105,108,101,115,47,114,101,115,101,116,84,105,108,101,67,97,99,104,101,233,1,59,119,97,115,109,47,103,114,97,112,104,105,99,115,47,103,114,97,112,104,105,99,115,47,71,114,97,112,104,105,99,115,46,77,73,78,95,67,89,67,76,69,83,95,83,80,82,73,84,69,83,95,76,67,68,95,77,79,68,69,234,1,65,119,97,115,109,47,103,114,97,112,104,105,99,115,47,103,114,97,112,104,105,99,115,47,71,114,97,112,104,105,99,115,46,77,73,78,95,67,89,67,76,69,83,95,84,82,65,78,83,70,69,82,95,68,65,84,65,95,76,67,68,95,77,79,68,69,235,1,41,119,97,115,109,47,105,110,116,101,114,114,117,112,116,115,47,105,110,100,101,120,47,114,101,113,117,101,115,116,76,99,100,73,110,116,101,114,114,117,112,116,236,1,32,119,97,115,109,47,109,101,109,111,114,121,47,100,109,97,47,117,112,100,97,116,101,72,98,108,97,110,107,72,100,109,97,237,1,44,119,97,115,109,47,105,110,116,101,114,114,117,112,116,115,47,105,110,100,101,120,47,114,101,113,117,101,115,116,86,66,108,97,110,107,73,110,116,101,114,114,117,112,116,238,1,30,119,97,115,109,47,103,114,97,112,104,105,99,115,47,108,99,100,47,115,101,116,76,99,100,83,116,97,116,117,115,239,1,37,119,97,115,109,47,103,114,97,112,104,105,99,115,47,103,114,97,112,104,105,99,115,47,117,112,100,97,116,101,71,114,97,112,104,105,99,115,240,1,43,119,97,115,109,47,103,114,97,112,104,105,99,115,47,103,114,97,112,104,105,99,115,47,98,97,116,99,104,80,114,111,99,101,115,115,71,114,97,112,104,105,99,115,241,1,24,119,97,115,109,47,105,110,100,101,120,47,101,109,117,108,97,116,105,111,110,83,116,101,112,242,1,17,119,97,115,109,47,105,110,100,101,120,47,117,112,100,97,116,101,243,1,43,119,97,115,109,47,109,101,109,111,114,121,47,109,101,109,111,114,121,47,103,101,116,83,97,118,101,83,116,97,116,101,77,101,109,111,114,121,79,102,102,115,101,116,244,1,50,119,97,115,109,47,109,101,109,111,114,121,47,115,116,111,114,101,47,115,116,111,114,101,66,111,111,108,101,97,110,68,105,114,101,99,116,108,121,84,111,87,97,115,109,77,101,109,111,114,121,245,1,26,119,97,115,109,47,99,112,117,47,99,112,117,47,67,112,117,46,115,97,118,101,83,116,97,116,101,246,1,41,119,97,115,109,47,103,114,97,112,104,105,99,115,47,103,114,97,112,104,105,99,115,47,71,114,97,112,104,105,99,115,46,115,97,118,101,83,116,97,116,101,247,1,42,119,97,115,109,47,105,110,116,101,114,114,117,112,116,115,47,105,110,100,101,120,47,73,110,116,101,114,114,117,112,116,115,46,115,97,118,101,83,116,97,116,101,248,1,34,119,97,115,109,47,106,111,121,112,97,100,47,105,110,100,101,120,47,74,111,121,112,97,100,46,115,97,118,101,83,116,97,116,101,249,1,35,119,97,115,109,47,109,101,109,111,114,121,47,109,101,109,111,114,121,47,77,101,109,111,114,121,46,115,97,118,101,83,116,97,116,101,250,1,34,119,97,115,109,47,116,105,109,101,114,115,47,105,110,100,101,120,47,84,105,109,101,114,115,46,115,97,118,101,83,116,97,116,101,251,1,32,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,83,111,117,110,100,46,115,97,118,101,83,116,97,116,101,252,1,38,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,67,104,97,110,110,101,108,49,46,115,97,118,101,83,116,97,116,101,253,1,38,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,50,47,67,104,97,110,110,101,108,50,46,115,97,118,101,83,116,97,116,101,254,1,38,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,51,47,67,104,97,110,110,101,108,51,46,115,97,118,101,83,116,97,116,101,255,1,38,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,52,47,67,104,97,110,110,101,108,52,46,115,97,118,101,83,116,97,116,101,128,2,20,119,97,115,109,47,105,110,100,101,120,47,115,97,118,101,83,116,97,116,101,129,2,50,119,97,115,109,47,109,101,109,111,114,121,47,108,111,97,100,47,108,111,97,100,66,111,111,108,101,97,110,68,105,114,101,99,116,108,121,70,114,111,109,87,97,115,109,77,101,109,111,114,121,130,2,26,119,97,115,109,47,99,112,117,47,99,112,117,47,67,112,117,46,108,111,97,100,83,116,97,116,101,131,2,41,119,97,115,109,47,103,114,97,112,104,105,99,115,47,103,114,97,112,104,105,99,115,47,71,114,97,112,104,105,99,115,46,108,111,97,100,83,116,97,116,101,132,2,42,119,97,115,109,47,105,110,116,101,114,114,117,112,116,115,47,105,110,100,101,120,47,73,110,116,101,114,114,117,112,116,115,46,108,111,97,100,83,116,97,116,101,133,2,34,119,97,115,109,47,106,111,121,112,97,100,47,105,110,100,101,120,47,74,111,121,112,97,100,46,108,111,97,100,83,116,97,116,101,134,2,35,119,97,115,109,47,109,101,109,111,114,121,47,109,101,109,111,114,121,47,77,101,109,111,114,121,46,108,111,97,100,83,116,97,116,101,135,2,34,119,97,115,109,47,116,105,109,101,114,115,47,105,110,100,101,120,47,84,105,109,101,114,115,46,108,111,97,100,83,116,97,116,101,136,2,32,119,97,115,109,47,115,111,117,110,100,47,115,111,117,110,100,47,83,111,117,110,100,46,108,111,97,100,83,116,97,116,101,137,2,38,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,49,47,67,104,97,110,110,101,108,49,46,108,111,97,100,83,116,97,116,101,138,2,38,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,50,47,67,104,97,110,110,101,108,50,46,108,111,97,100,83,116,97,116,101,139,2,38,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,51,47,67,104,97,110,110,101,108,51,46,108,111,97,100,83,116,97,116,101,140,2,38,119,97,115,109,47,115,111,117,110,100,47,99,104,97,110,110,101,108,52,47,67,104,97,110,110,101,108,52,46,108,111,97,100,83,116,97,116,101,141,2,20,119,97,115,109,47,105,110,100,101,120,47,108,111,97,100,83,116,97,116,101,142,2,5,115,116,97,114,116,0,49,16,115,111,117,114,99,101,77,97,112,112,105,110,103,85,82,76,31,97,115,115,101,116,115,47,105,110,100,101,120,46,117,110,116,111,117,99,104,101,100,46,119,97,115,109,46,109,97,112,]);// This file will not run on it's own

const {
  Module,
  instantiate,
  Memory,
  Table
} = WebAssembly;

const WebAssemblyModule = function(deps = {
  'global': {},
  'env': {
    'memory': new Memory({initial: 10, limit: 100}),
    'table': new Table({initial: 0, element: 'anyfunc'})
  }
}) {
  return instantiate(buffer, deps);
}

module.exports = WebAssemblyModule;


/***/ }),

/***/ "u5ky":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var GenericWorker = __webpack_require__("bxoG");
var crc32 = __webpack_require__("hKHw");
var utils = __webpack_require__("71nt");

/**
 * A worker which calculate the crc32 of the data flowing through.
 * @constructor
 */
function Crc32Probe() {
  GenericWorker.call(this, "Crc32Probe");
  this.withStreamInfo("crc32", 0);
}
utils.inherits(Crc32Probe, GenericWorker);

/**
 * @see GenericWorker.processChunk
 */
Crc32Probe.prototype.processChunk = function (chunk) {
  this.streamInfo.crc32 = crc32(chunk.data, this.streamInfo.crc32 || 0);
  this.push(chunk);
};
module.exports = Crc32Probe;

/***/ }),

/***/ "uCBp":
/***/ (function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ }),

/***/ "vVrn":
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* global Promise */


// load the global object first:
// - it should be better integrated in the system (unhandledRejection in node)
// - the environment may have a custom Promise implementation (see zone.js)

var ES6Promise = null;
if (typeof Promise !== "undefined") {
    ES6Promise = Promise;
} else {
    ES6Promise = __webpack_require__("yv55");
}

/**
 * Let the user use/change some implementations.
 */
module.exports = {
    Promise: ES6Promise
};

/***/ }),

/***/ "xD7E":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var Mutation = global.MutationObserver || global.WebKitMutationObserver;

var scheduleDrain;

if (process.browser) {
  if (Mutation) {
    var called = 0;
    var observer = new Mutation(nextTick);
    var element = global.document.createTextNode('');
    observer.observe(element, {
      characterData: true
    });
    scheduleDrain = function scheduleDrain() {
      element.data = called = ++called % 2;
    };
  } else if (!global.setImmediate && typeof global.MessageChannel !== 'undefined') {
    var channel = new global.MessageChannel();
    channel.port1.onmessage = nextTick;
    scheduleDrain = function scheduleDrain() {
      channel.port2.postMessage(0);
    };
  } else if ('document' in global && 'onreadystatechange' in global.document.createElement('script')) {
    scheduleDrain = function scheduleDrain() {

      // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
      // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
      var scriptEl = global.document.createElement('script');
      scriptEl.onreadystatechange = function () {
        nextTick();

        scriptEl.onreadystatechange = null;
        scriptEl.parentNode.removeChild(scriptEl);
        scriptEl = null;
      };
      global.document.documentElement.appendChild(scriptEl);
    };
  } else {
    scheduleDrain = function scheduleDrain() {
      setTimeout(nextTick, 0);
    };
  }
} else {
  scheduleDrain = function scheduleDrain() {
    process.nextTick(nextTick);
  };
}

var draining;
var queue = [];
//named nextTick for less confusing stack traces
function nextTick() {
  draining = true;
  var i, oldQueue;
  var len = queue.length;
  while (len) {
    oldQueue = queue;
    queue = [];
    i = -1;
    while (++i < len) {
      oldQueue[i]();
    }
    len = queue.length;
  }
  draining = false;
}

module.exports = immediate;
function immediate(task) {
  if (queue.push(task) === 1 && !draining) {
    scheduleDrain();
  }
}

/***/ }),

/***/ "xTyK":
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// A bit simpler than readable streams.
// Implement an async ._write(chunk, encoding, cb), and it'll handle all
// the drain event emission and buffering.



module.exports = Writable;

/*<replacement>*/
var processNextTick = __webpack_require__("Ji/z");
/*</replacement>*/

/*<replacement>*/
var asyncWrite = !process.browser && ['v0.10', 'v0.9.'].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : processNextTick;
/*</replacement>*/

/*<replacement>*/
var Buffer = __webpack_require__("fy20").Buffer;
/*</replacement>*/

Writable.WritableState = WritableState;

/*<replacement>*/
var util = __webpack_require__("jOgh");
util.inherits = __webpack_require__("ihNc");
/*</replacement>*/

/*<replacement>*/
var internalUtil = {
  deprecate: __webpack_require__("njQ8")
};
/*</replacement>*/

/*<replacement>*/
var Stream;
(function () {
  try {
    Stream = __webpack_require__("97RM");
  } catch (_) {} finally {
    if (!Stream) Stream = __webpack_require__("FpCL").EventEmitter;
  }
})();
/*</replacement>*/

var Buffer = __webpack_require__("fy20").Buffer;

util.inherits(Writable, Stream);

function nop() {}

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
  this.next = null;
}

var Duplex;
function WritableState(options, stream) {
  Duplex = Duplex || __webpack_require__("g3Lj");

  options = options || {};

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.writableObjectMode;

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function (er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.bufferedRequest = null;
  this.lastBufferedRequest = null;

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;

  // count buffered requests
  this.bufferedRequestCount = 0;

  // create the two objects needed to store the corked requests
  // they are not a linked list, as no new elements are inserted in there
  this.corkedRequestsFree = new CorkedRequest(this);
  this.corkedRequestsFree.next = new CorkedRequest(this);
}

WritableState.prototype.getBuffer = function writableStateGetBuffer() {
  var current = this.bufferedRequest;
  var out = [];
  while (current) {
    out.push(current);
    current = current.next;
  }
  return out;
};

(function () {
  try {
    Object.defineProperty(WritableState.prototype, 'buffer', {
      get: internalUtil.deprecate(function () {
        return this.getBuffer();
      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.')
    });
  } catch (_) {}
})();

var Duplex;
function Writable(options) {
  Duplex = Duplex || __webpack_require__("g3Lj");

  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Duplex)) return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  if (options) {
    if (typeof options.write === 'function') this._write = options.write;

    if (typeof options.writev === 'function') this._writev = options.writev;
  }

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function () {
  this.emit('error', new Error('Cannot pipe. Not readable.'));
};

function writeAfterEnd(stream, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  processNextTick(cb, er);
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;

  if (!Buffer.isBuffer(chunk) && typeof chunk !== 'string' && chunk !== null && chunk !== undefined && !state.objectMode) {
    var er = new TypeError('Invalid non-string/buffer chunk');
    stream.emit('error', er);
    processNextTick(cb, er);
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function (chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (Buffer.isBuffer(chunk)) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;

  if (typeof cb !== 'function') cb = nop;

  if (state.ended) writeAfterEnd(this, cb);else if (validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function () {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function () {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
  }
};

Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  // node::ParseEncoding() requires lower case.
  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new TypeError('Unknown encoding: ' + encoding);
  this._writableState.defaultEncoding = encoding;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
    chunk = new Buffer(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);

  if (Buffer.isBuffer(chunk)) encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret) state.needDrain = true;

  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = new WriteReq(chunk, encoding, cb);
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
    state.bufferedRequestCount += 1;
  } else {
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  --state.pendingcb;
  if (sync) processNextTick(cb, er);else cb(er);

  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er) onwriteError(stream, state, sync, er, cb);else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(state);

    if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
      clearBuffer(stream, state);
    }

    if (sync) {
      /*<replacement>*/
      asyncWrite(afterWrite, stream, state, finished, cb);
      /*</replacement>*/
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished) onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}

// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;
  var entry = state.bufferedRequest;

  if (stream._writev && entry && entry.next) {
    // Fast case, write everything using _writev()
    var l = state.bufferedRequestCount;
    var buffer = new Array(l);
    var holder = state.corkedRequestsFree;
    holder.entry = entry;

    var count = 0;
    while (entry) {
      buffer[count] = entry;
      entry = entry.next;
      count += 1;
    }

    doWrite(stream, state, true, state.length, buffer, '', holder.finish);

    // doWrite is always async, defer these to save a bit of time
    // as the hot path ends with doWrite
    state.pendingcb++;
    state.lastBufferedRequest = null;
    state.corkedRequestsFree = holder.next;
    holder.next = null;
  } else {
    // Slow case, write chunks one-by-one
    while (entry) {
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);
      entry = entry.next;
      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        break;
      }
    }

    if (entry === null) state.lastBufferedRequest = null;
  }

  state.bufferedRequestCount = 0;
  state.bufferedRequest = entry;
  state.bufferProcessing = false;
}

Writable.prototype._write = function (chunk, encoding, cb) {
  cb(new Error('not implemented'));
};

Writable.prototype._writev = null;

Writable.prototype.end = function (chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished) endWritable(this, state, cb);
};

function needFinish(state) {
  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
}

function prefinish(stream, state) {
  if (!state.prefinished) {
    state.prefinished = true;
    stream.emit('prefinish');
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(state);
  if (need) {
    if (state.pendingcb === 0) {
      prefinish(stream, state);
      state.finished = true;
      stream.emit('finish');
    } else {
      prefinish(stream, state);
    }
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished) processNextTick(cb);else stream.once('finish', cb);
  }
  state.ended = true;
  stream.writable = false;
}

// It seems a linked list but it is not
// there will be only 2 of these for each stream
function CorkedRequest(state) {
  var _this = this;

  this.next = null;
  this.entry = null;

  this.finish = function (err) {
    var entry = _this.entry;
    _this.entry = null;
    while (entry) {
      var cb = entry.callback;
      state.pendingcb--;
      cb(err);
      entry = entry.next;
    }
    if (state.corkedRequestsFree) {
      state.corkedRequestsFree.next = _this;
    } else {
      state.corkedRequestsFree = _this;
    }
  };
}

/***/ }),

/***/ "xe4/":
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// Top level file is just a mixin of submodules & constants


var assign = __webpack_require__("gt5T").assign;

var deflate = __webpack_require__("tmYD");
var inflate = __webpack_require__("LGU4");
var constants = __webpack_require__("0jOE");

var pako = {};

assign(pako, deflate, inflate, constants);

module.exports = pako;

/***/ }),

/***/ "yv55":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var immediate = __webpack_require__("xD7E");

/* istanbul ignore next */
function INTERNAL() {}

var handlers = {};

var REJECTED = ['REJECTED'];
var FULFILLED = ['FULFILLED'];
var PENDING = ['PENDING'];
/* istanbul ignore else */
if (!process.browser) {
  // in which we actually take advantage of JS scoping
  var UNHANDLED = ['UNHANDLED'];
}

module.exports = Promise;

function Promise(resolver) {
  if (typeof resolver !== 'function') {
    throw new TypeError('resolver must be a function');
  }
  this.state = PENDING;
  this.queue = [];
  this.outcome = void 0;
  /* istanbul ignore else */
  if (!process.browser) {
    this.handled = UNHANDLED;
  }
  if (resolver !== INTERNAL) {
    safelyResolveThenable(this, resolver);
  }
}

Promise.prototype.catch = function (onRejected) {
  return this.then(null, onRejected);
};
Promise.prototype.then = function (onFulfilled, onRejected) {
  if (typeof onFulfilled !== 'function' && this.state === FULFILLED || typeof onRejected !== 'function' && this.state === REJECTED) {
    return this;
  }
  var promise = new this.constructor(INTERNAL);
  /* istanbul ignore else */
  if (!process.browser) {
    if (this.handled === UNHANDLED) {
      this.handled = null;
    }
  }
  if (this.state !== PENDING) {
    var resolver = this.state === FULFILLED ? onFulfilled : onRejected;
    unwrap(promise, resolver, this.outcome);
  } else {
    this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
  }

  return promise;
};
function QueueItem(promise, onFulfilled, onRejected) {
  this.promise = promise;
  if (typeof onFulfilled === 'function') {
    this.onFulfilled = onFulfilled;
    this.callFulfilled = this.otherCallFulfilled;
  }
  if (typeof onRejected === 'function') {
    this.onRejected = onRejected;
    this.callRejected = this.otherCallRejected;
  }
}
QueueItem.prototype.callFulfilled = function (value) {
  handlers.resolve(this.promise, value);
};
QueueItem.prototype.otherCallFulfilled = function (value) {
  unwrap(this.promise, this.onFulfilled, value);
};
QueueItem.prototype.callRejected = function (value) {
  handlers.reject(this.promise, value);
};
QueueItem.prototype.otherCallRejected = function (value) {
  unwrap(this.promise, this.onRejected, value);
};

function unwrap(promise, func, value) {
  immediate(function () {
    var returnValue;
    try {
      returnValue = func(value);
    } catch (e) {
      return handlers.reject(promise, e);
    }
    if (returnValue === promise) {
      handlers.reject(promise, new TypeError('Cannot resolve promise with itself'));
    } else {
      handlers.resolve(promise, returnValue);
    }
  });
}

handlers.resolve = function (self, value) {
  var result = tryCatch(getThen, value);
  if (result.status === 'error') {
    return handlers.reject(self, result.value);
  }
  var thenable = result.value;

  if (thenable) {
    safelyResolveThenable(self, thenable);
  } else {
    self.state = FULFILLED;
    self.outcome = value;
    var i = -1;
    var len = self.queue.length;
    while (++i < len) {
      self.queue[i].callFulfilled(value);
    }
  }
  return self;
};
handlers.reject = function (self, error) {
  self.state = REJECTED;
  self.outcome = error;
  /* istanbul ignore else */
  if (!process.browser) {
    if (self.handled === UNHANDLED) {
      immediate(function () {
        if (self.handled === UNHANDLED) {
          process.emit('unhandledRejection', error, self);
        }
      });
    }
  }
  var i = -1;
  var len = self.queue.length;
  while (++i < len) {
    self.queue[i].callRejected(error);
  }
  return self;
};

function getThen(obj) {
  // Make sure we only access the accessor once as required by the spec
  var then = obj && obj.then;
  if (obj && (typeof obj === 'object' || typeof obj === 'function') && typeof then === 'function') {
    return function appyThen() {
      then.apply(obj, arguments);
    };
  }
}

function safelyResolveThenable(self, thenable) {
  // Either fulfill, reject or reject with error
  var called = false;
  function onError(value) {
    if (called) {
      return;
    }
    called = true;
    handlers.reject(self, value);
  }

  function onSuccess(value) {
    if (called) {
      return;
    }
    called = true;
    handlers.resolve(self, value);
  }

  function tryToUnwrap() {
    thenable(onSuccess, onError);
  }

  var result = tryCatch(tryToUnwrap);
  if (result.status === 'error') {
    onError(result.value);
  }
}

function tryCatch(func, value) {
  var out = {};
  try {
    out.value = func(value);
    out.status = 'success';
  } catch (e) {
    out.status = 'error';
    out.value = e;
  }
  return out;
}

Promise.resolve = resolve;
function resolve(value) {
  if (value instanceof this) {
    return value;
  }
  return handlers.resolve(new this(INTERNAL), value);
}

Promise.reject = reject;
function reject(reason) {
  var promise = new this(INTERNAL);
  return handlers.reject(promise, reason);
}

Promise.all = all;
function all(iterable) {
  var self = this;
  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
    return this.reject(new TypeError('must be an array'));
  }

  var len = iterable.length;
  var called = false;
  if (!len) {
    return this.resolve([]);
  }

  var values = new Array(len);
  var resolved = 0;
  var i = -1;
  var promise = new this(INTERNAL);

  while (++i < len) {
    allResolver(iterable[i], i);
  }
  return promise;
  function allResolver(value, i) {
    self.resolve(value).then(resolveFromAll, function (error) {
      if (!called) {
        called = true;
        handlers.reject(promise, error);
      }
    });
    function resolveFromAll(outValue) {
      values[i] = outValue;
      if (++resolved === len && !called) {
        called = true;
        handlers.resolve(promise, values);
      }
    }
  }
}

Promise.race = race;
function race(iterable) {
  var self = this;
  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
    return this.reject(new TypeError('must be an array'));
  }

  var len = iterable.length;
  var called = false;
  if (!len) {
    return this.resolve([]);
  }

  var i = -1;
  var promise = new this(INTERNAL);

  while (++i < len) {
    resolver(iterable[i]);
  }
  return promise;
  function resolver(value) {
    self.resolve(value).then(function (response) {
      if (!called) {
        called = true;
        handlers.resolve(promise, response);
      }
    }, function (error) {
      if (!called) {
        called = true;
        handlers.reject(promise, error);
      }
    });
  }
}

/***/ }),

/***/ "yvBL":
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__("hCo4");
module.exports = __webpack_require__("eX64").setImmediate;

/***/ }),

/***/ "zgxx":
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = {
    /**
     * True if this is running in Nodejs, will be undefined in a browser.
     * In a browser, browserify won't include this file and the whole module
     * will be resolved an empty object.
     */
    isNode: typeof Buffer !== "undefined",
    /**
     * Create a new nodejs Buffer from an existing content.
     * @param {Object} data the data to pass to the constructor.
     * @param {String} encoding the encoding to use.
     * @return {Buffer} a new Buffer.
     */
    newBufferFrom: function newBufferFrom(data, encoding) {
        // XXX We can't use `Buffer.from` which comes from `Uint8Array.from`
        // in nodejs v4 (< v.4.5). It's not the expected implementation (and
        // has a different signature).
        // see https://github.com/nodejs/node/issues/8053
        // A condition on nodejs' version won't solve the issue as we don't
        // control the Buffer polyfills that may or may not be used.
        return new Buffer(data, encoding);
    },
    /**
     * Create a new nodejs Buffer with the specified size.
     * @param {Integer} size the size of the buffer.
     * @return {Buffer} a new Buffer.
     */
    allocBuffer: function allocBuffer(size) {
        if (Buffer.alloc) {
            return Buffer.alloc(size);
        } else {
            return new Buffer(size);
        }
    },
    /**
     * Find out if an object is a Buffer.
     * @param {Object} b the object to test.
     * @return {Boolean} true if the object is a Buffer, false otherwise.
     */
    isBuffer: function isBuffer(b) {
        return Buffer.isBuffer(b);
    },

    isStream: function isStream(obj) {
        return obj && typeof obj.on === "function" && typeof obj.pause === "function" && typeof obj.resume === "function";
    }
};

/***/ })

/******/ });
//# sourceMappingURL=ssr-bundle.js.map