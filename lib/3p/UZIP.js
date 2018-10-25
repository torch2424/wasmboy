// Taken/Modified From: https://github.com/photopea/UZIP.js

let UZIP = {};

// Make it a hacky es module
const uzip = UZIP;
export default uzip;

UZIP['parse'] = function(
  buf // ArrayBuffer
) {
  let rUs = UZIP.bin.readUshort,
    rUi = UZIP.bin.readUint,
    o = 0,
    out = {};
  let data = new Uint8Array(buf);
  let eocd = data.length - 4;

  while (rUi(data, eocd) != 0x06054b50) eocd--;

  o = eocd;
  o += 4; // sign  = 0x06054b50
  o += 4; // disks = 0;
  let cnu = rUs(data, o);
  o += 2;
  let cnt = rUs(data, o);
  o += 2;

  let csize = rUi(data, o);
  o += 4;
  let coffs = rUi(data, o);
  o += 4;

  o = coffs;
  for (let i = 0; i < cnu; i++) {
    let sign = rUi(data, o);
    o += 4;
    o += 4; // versions;
    o += 4; // flag + compr
    o += 4; // time

    let crc32 = rUi(data, o);
    o += 4;
    let csize = rUi(data, o);
    o += 4;
    let usize = rUi(data, o);
    o += 4;

    let nl = rUs(data, o),
      el = rUs(data, o + 2),
      cl = rUs(data, o + 4);
    o += 6; // name, extra, comment
    o += 8; // disk, attribs

    let roff = rUi(data, o);
    o += 4;
    o += nl + el + cl;

    UZIP._readLocal(data, roff, out, csize, usize);
  }
  //console.log(out);
  return out;
};

UZIP._readLocal = function(data, o, out, csize, usize) {
  let rUs = UZIP.bin.readUshort,
    rUi = UZIP.bin.readUint;
  let sign = rUi(data, o);
  o += 4;
  let ver = rUs(data, o);
  o += 2;
  let gpflg = rUs(data, o);
  o += 2;
  //if((gpflg&8)!=0) throw "unknown sizes";
  let cmpr = rUs(data, o);
  o += 2;

  let time = rUi(data, o);
  o += 4;

  let crc32 = rUi(data, o);
  o += 4;
  //let csize = rUi(data, o);  o+=4;
  //let usize = rUi(data, o);  o+=4;
  o += 8;

  let nlen = rUs(data, o);
  o += 2;
  let elen = rUs(data, o);
  o += 2;

  let name = UZIP.bin.readUTF8(data, o, nlen);
  o += nlen;
  o += elen;

  //console.log(sign.toString(16), ver, gpflg, cmpr, crc32.toString(16), "csize, usize", csize, usize, nlen, elen, name, o);

  let file = new Uint8Array(data.buffer, o);
  if (false) {
  } else if (cmpr == 0) out[name] = new Uint8Array(file.buffer.slice(o, o + csize));
  else if (cmpr == 8) {
    let buf = new Uint8Array(usize);
    UZIP.inflateRaw(file, buf);
    //let nbuf = pako["inflateRaw"](file);
    //for(let i=0; i<buf.length; i++) if(buf[i]!=nbuf[i]) {  console.log(buf.length, nbuf.length, usize, i);  throw "e";  }
    out[name] = buf;
  } else throw 'unknown compression method: ' + cmpr;
};

UZIP.inflateRaw = function(file, buf) {
  return UZIP.F.inflate(file, buf);
};
UZIP.inflate = function(file, buf) {
  let CMF = file[0],
    FLG = file[1];
  let CM = CMF & 15,
    CINFO = CMF >>> 4;
  //console.log(CM, CINFO,CMF,FLG);
  return UZIP.inflateRaw(new Uint8Array(file.buffer, file.byteOffset + 2, file.length - 6), buf);
};
UZIP.deflate = function(data, opts /*, buf, off*/) {
  if (opts == null) opts = { level: 6 };
  let off = 0,
    buf = new Uint8Array(50 + Math.floor(data.length * 1.1));
  buf[off] = 120;
  buf[off + 1] = 156;
  off += 2;
  off = UZIP.F.deflateRaw(data, buf, off, opts.level);
  let crc = UZIP.adler(data, 0, data.length);
  buf[off + 0] = (crc >>> 24) & 255;
  buf[off + 1] = (crc >>> 16) & 255;
  buf[off + 2] = (crc >>> 8) & 255;
  buf[off + 3] = (crc >>> 0) & 255;
  return new Uint8Array(buf.buffer, 0, off + 4);
};
UZIP.deflateRaw = function(data, opts) {
  if (opts == null) opts = { level: 6 };
  let buf = new Uint8Array(50 + Math.floor(data.length * 1.1));
  let off;
  off = UZIP.F.deflateRaw(data, buf, off, opts.level);
  return new Uint8Array(buf.buffer, 0, off);
};

UZIP.encode = function(obj) {
  let tot = 0,
    wUi = UZIP.bin.writeUint,
    wUs = UZIP.bin.writeUshort;
  let zpd = {};
  for (let p in obj) {
    let cpr = !UZIP._noNeed(p),
      buf = obj[p],
      crc = UZIP.crc.crc(buf, 0, buf.length);
    zpd[p] = { cpr: cpr, usize: buf.length, crc: crc, file: cpr ? UZIP.deflateRaw(buf) : buf };
  }

  for (let p in zpd) tot += zpd[p].file.length + 30 + 46 + 2 * UZIP.bin.sizeUTF8(p);
  tot += 22;

  let data = new Uint8Array(tot),
    o = 0;
  let fof = [];

  for (let p in zpd) {
    let file = zpd[p];
    fof.push(o);
    o = UZIP._writeHeader(data, o, p, file, 0);
  }
  let i = 0,
    ioff = o;
  for (let p in zpd) {
    let file = zpd[p];
    fof.push(o);
    o = UZIP._writeHeader(data, o, p, file, 1, fof[i++]);
  }
  let csize = o - ioff;

  wUi(data, o, 0x06054b50);
  o += 4;
  o += 4; // disks
  wUs(data, o, i);
  o += 2;
  wUs(data, o, i);
  o += 2; // number of c d records
  wUi(data, o, csize);
  o += 4;
  wUi(data, o, ioff);
  o += 4;
  o += 2;
  return data.buffer;
};
// no need to compress .PNG, .ZIP, .JPEG ....
UZIP._noNeed = function(fn) {
  let ext = fn
    .split('.')
    .pop()
    .toLowerCase();
  return 'png,jpg,jpeg,zip'.indexOf(ext) != -1;
};

UZIP._writeHeader = function(data, o, p, obj, t, roff) {
  let wUi = UZIP.bin.writeUint,
    wUs = UZIP.bin.writeUshort;
  let file = obj.file;

  wUi(data, o, t == 0 ? 0x04034b50 : 0x02014b50);
  o += 4; // sign
  if (t == 1) o += 2; // ver made by
  wUs(data, o, 20);
  o += 2; // ver
  wUs(data, o, 0);
  o += 2; // gflip
  wUs(data, o, obj.cpr ? 8 : 0);
  o += 2; // cmpr

  wUi(data, o, 0);
  o += 4; // time
  wUi(data, o, obj.crc);
  o += 4; // crc32
  wUi(data, o, file.length);
  o += 4; // csize
  wUi(data, o, obj.usize);
  o += 4; // usize

  wUs(data, o, UZIP.bin.sizeUTF8(p));
  o += 2; // nlen
  wUs(data, o, 0);
  o += 2; // elen

  if (t == 1) {
    o += 2; // comment length
    o += 2; // disk number
    o += 6; // attributes
    wUi(data, o, roff);
    o += 4; // usize
  }
  let nlen = UZIP.bin.writeUTF8(data, o, p);
  o += nlen;
  if (t == 0) {
    data.set(file, o);
    o += file.length;
  }
  return o;
};

UZIP.crc = {
  table: (function() {
    let tab = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        if (c & 1) c = 0xedb88320 ^ (c >>> 1);
        else c = c >>> 1;
      }
      tab[n] = c;
    }
    return tab;
  })(),
  update: function(c, buf, off, len) {
    for (let i = 0; i < len; i++) c = UZIP.crc.table[(c ^ buf[off + i]) & 0xff] ^ (c >>> 8);
    return c;
  },
  crc: function(b, o, l) {
    return UZIP.crc.update(0xffffffff, b, o, l) ^ 0xffffffff;
  }
};
UZIP.adler = function(data, o, len) {
  let a = 1,
    b = 0;
  let off = o,
    end = o + len;
  while (off < end) {
    let eend = Math.min(off + 5552, end);
    while (off < eend) {
      a += data[off++];
      b += a;
    }
    a = a % 65521;
    b = b % 65521;
  }
  return (b << 16) | a;
};

UZIP.bin = {
  readUshort: function(buff, p) {
    return buff[p] | (buff[p + 1] << 8);
  },
  writeUshort: function(buff, p, n) {
    buff[p] = n & 255;
    buff[p + 1] = (n >> 8) & 255;
  },
  readUint: function(buff, p) {
    return buff[p + 3] * (256 * 256 * 256) + ((buff[p + 2] << 16) | (buff[p + 1] << 8) | buff[p]);
  },
  writeUint: function(buff, p, n) {
    buff[p] = n & 255;
    buff[p + 1] = (n >> 8) & 255;
    buff[p + 2] = (n >> 16) & 255;
    buff[p + 3] = (n >> 24) & 255;
  },
  readASCII: function(buff, p, l) {
    let s = '';
    for (let i = 0; i < l; i++) s += String.fromCharCode(buff[p + i]);
    return s;
  },
  writeASCII: function(data, p, s) {
    for (let i = 0; i < s.length; i++) data[p + i] = s.charCodeAt(i);
  },
  pad: function(n) {
    return n.length < 2 ? '0' + n : n;
  },
  readUTF8: function(buff, p, l) {
    let s = '',
      ns;
    for (let i = 0; i < l; i++) s += '%' + UZIP.bin.pad(buff[p + i].toString(16));
    try {
      ns = decodeURIComponent(s);
    } catch (e) {
      return UZIP.bin.readASCII(buff, p, l);
    }
    return ns;
  },
  writeUTF8: function(buff, p, str) {
    let strl = str.length,
      i = 0;
    for (let ci = 0; ci < strl; ci++) {
      let code = str.charCodeAt(ci);
      if ((code & (0xffffffff - (1 << 7) + 1)) == 0) {
        buff[p + i] = code;
        i++;
      } else if ((code & (0xffffffff - (1 << 11) + 1)) == 0) {
        buff[p + i] = 192 | (code >> 6);
        buff[p + i + 1] = 128 | ((code >> 0) & 63);
        i += 2;
      } else if ((code & (0xffffffff - (1 << 16) + 1)) == 0) {
        buff[p + i] = 224 | (code >> 12);
        buff[p + i + 1] = 128 | ((code >> 6) & 63);
        buff[p + i + 2] = 128 | ((code >> 0) & 63);
        i += 3;
      } else if ((code & (0xffffffff - (1 << 21) + 1)) == 0) {
        buff[p + i] = 240 | (code >> 18);
        buff[p + i + 1] = 128 | ((code >> 12) & 63);
        buff[p + i + 2] = 128 | ((code >> 6) & 63);
        buff[p + i + 3] = 128 | ((code >> 0) & 63);
        i += 4;
      } else throw 'e';
    }
    return i;
  },
  sizeUTF8: function(str) {
    let strl = str.length,
      i = 0;
    for (let ci = 0; ci < strl; ci++) {
      let code = str.charCodeAt(ci);
      if ((code & (0xffffffff - (1 << 7) + 1)) == 0) {
        i++;
      } else if ((code & (0xffffffff - (1 << 11) + 1)) == 0) {
        i += 2;
      } else if ((code & (0xffffffff - (1 << 16) + 1)) == 0) {
        i += 3;
      } else if ((code & (0xffffffff - (1 << 21) + 1)) == 0) {
        i += 4;
      } else throw 'e';
    }
    return i;
  }
};

UZIP.F = {};

UZIP.F.deflateRaw = function(data, out, opos, lvl) {
  let opts = [
    /*
		 ush good_length; /* reduce lazy search above this match length 
		 ush max_lazy;    /* do not perform lazy search above this match length 
         ush nice_length; /* quit search above this match length 
	*/
    /*      good lazy nice chain */
    /* 0 */ [0, 0, 0, 0, 0] /* store only */,
    /* 1 */ [4, 4, 8, 4, 0] /* max speed, no lazy matches */,
    /* 2 */ [4, 5, 16, 8, 0],
    /* 3 */ [4, 6, 16, 16, 0],

    /* 4 */ [4, 10, 16, 32, 0] /* lazy matches */,
    /* 5 */ [8, 16, 32, 32, 0],
    /* 6 */ [8, 16, 128, 128, 0],
    /* 7 */ [8, 32, 128, 256, 0],
    /* 8 */ [32, 128, 258, 1024, 1],
    /* 9 */ [32, 258, 258, 4096, 1]
  ]; /* max compression */

  let opt = opts[lvl];

  let U = UZIP.F.U,
    goodIndex = UZIP.F._goodIndex,
    hash = UZIP.F._hash,
    putsE = UZIP.F._putsE;
  let i = 0,
    pos = opos << 3,
    cvrd = 0,
    dlen = data.length;

  if (lvl == 0) {
    while (i < dlen) {
      let len = Math.min(0xffff, dlen - i);
      putsE(out, pos, i + len == dlen ? 1 : 0);
      pos = UZIP.F._copyExact(data, i, len, out, pos + 8);
      i += len;
    }
    return pos >>> 3;
  }

  let lits = U.lits,
    strt = U.strt,
    prev = U.prev,
    li = 0,
    lc = 0,
    bs = 0,
    ebits = 0,
    c = 0,
    nc = 0; // last_item, literal_count, block_start
  if (dlen > 2) {
    nc = UZIP.F._hash(data, 0);
    strt[nc] = 0;
  }
  let nmch = 0,
    nmci = 0;

  for (i = 0; i < dlen; i++) {
    c = nc;
    //*
    if (i + 1 < dlen - 2) {
      nc = UZIP.F._hash(data, i + 1);
      let ii = (i + 1) & 0x7fff;
      prev[ii] = strt[nc];
      strt[nc] = ii;
    } //*/
    if (cvrd <= i) {
      if (li > 14000 || lc > 26697) {
        if (cvrd < i) {
          lits[li] = i - cvrd;
          li += 2;
          cvrd = i;
        }
        pos = UZIP.F._writeBlock(i == dlen - 1 || cvrd == dlen ? 1 : 0, lits, li, ebits, data, bs, i - bs, out, pos);
        li = lc = ebits = 0;
        bs = i;
      }

      let mch = 0;
      //if(nmci==i) mch= nmch;  else
      if (i < dlen - 2) mch = UZIP.F._bestMatch(data, i, prev, c, Math.min(opt[2], dlen - i), opt[3]);
      /*
			if(mch!=0 && opt[4]==1 && (mch>>>16)<opt[1] && i+1<dlen-2) {
				nmch = UZIP.F._bestMatch(data, i+1, prev, nc, opt[2], opt[3]);  nmci=i+1;
				//let mch2 = UZIP.F._bestMatch(data, i+2, prev, nnc);  //nmci=i+1;
				if((nmch>>>16)>(mch>>>16)) mch=0;
			}//*/
      let len = mch >>> 16,
        dst = mch & 0xffff; //if(i-dst<0) throw "e";
      if (mch != 0) {
        let len = mch >>> 16,
          dst = mch & 0xffff; //if(i-dst<0) throw "e";
        let lgi = goodIndex(len, U.of0);
        U.lhst[257 + lgi]++;
        let dgi = goodIndex(dst, U.df0);
        U.dhst[dgi]++;
        ebits += U.exb[lgi] + U.dxb[dgi];
        lits[li] = (len << 23) | (i - cvrd);
        lits[li + 1] = (dst << 16) | (lgi << 8) | dgi;
        li += 2;
        cvrd = i + len;
      } else {
        U.lhst[data[i]]++;
      }
      lc++;
    }
  }
  if (bs != i || data.length == 0) {
    if (cvrd < i) {
      lits[li] = i - cvrd;
      li += 2;
      cvrd = i;
    }
    pos = UZIP.F._writeBlock(1, lits, li, ebits, data, bs, i - bs, out, pos);
    li = 0;
    lc = 0;
    li = lc = ebits = 0;
    bs = i;
  }
  while ((pos & 7) != 0) pos++;
  return pos >>> 3;
};
UZIP.F._bestMatch = function(data, i, prev, c, nice, chain) {
  let ci = i & 0x7fff,
    pi = prev[ci];
  //console.log("----", i);
  let dif = (ci - pi + (1 << 15)) & 0x7fff;
  if (pi == ci || c != UZIP.F._hash(data, i - dif)) return 0;
  let tl = 0,
    td = 0; // top length, top distance
  let dlim = Math.min(0x7fff, i);
  while (dif <= dlim && --chain != 0 && pi != ci /*&& c==UZIP.F._hash(data,i-dif)*/) {
    if (tl == 0 || data[i + tl] == data[i + tl - dif]) {
      let cl = UZIP.F._howLong(data, i, dif);
      if (cl > tl) {
        tl = cl;
        td = dif;
        if (tl >= nice) break; //*
        if (dif + 2 < cl) cl = dif + 2;
        let maxd = 0; // pi does not point to the start of the word
        for (let j = 0; j < cl - 2; j++) {
          let ei = (i - dif + j + (1 << 15)) & 0x7fff;
          let li = prev[ei];
          let curd = (ei - li + (1 << 15)) & 0x7fff;
          if (curd > maxd) {
            maxd = curd;
            pi = ei;
          }
        } //*/
      }
    }

    ci = pi;
    pi = prev[ci];
    dif += (ci - pi + (1 << 15)) & 0x7fff;
  }
  return (tl << 16) | td;
};
UZIP.F._howLong = function(data, i, dif) {
  if (data[i] != data[i - dif] || data[i + 1] != data[i + 1 - dif] || data[i + 2] != data[i + 2 - dif]) return 0;
  let oi = i,
    l = Math.min(data.length, i + 258);
  i += 3;
  //while(i+4<l && data[i]==data[i-dif] && data[i+1]==data[i+1-dif] && data[i+2]==data[i+2-dif] && data[i+3]==data[i+3-dif]) i+=4;
  while (i < l && data[i] == data[i - dif]) i++;
  return i - oi;
};
UZIP.F._hash = function(data, i) {
  return (((data[i] << 8) | data[i + 1]) + (data[i + 2] << 4)) & 0xffff;
  //let hash_shift = 0, hash_mask = 255;
  //let h = data[i+1] % 251;
  //h = (((h << 8) + data[i+2]) % 251);
  //h = (((h << 8) + data[i+2]) % 251);
  //h = ((h<<hash_shift) ^ (c) ) & hash_mask;
  //return h | (data[i]<<8);
  //return (data[i] | (data[i+1]<<8));
};
//UZIP.___toth = 0;
UZIP.saved = 0;
UZIP.F._writeBlock = function(BFINAL, lits, li, ebits, data, o0, l0, out, pos) {
  let U = UZIP.F.U,
    putsF = UZIP.F._putsF,
    putsE = UZIP.F._putsE;

  //*
  let T, ML, MD, MH, numl, numd, numh, lset, dset;
  U.lhst[256]++;
  T = UZIP.F.getTrees();
  ML = T[0];
  MD = T[1];
  MH = T[2];
  numl = T[3];
  numd = T[4];
  numh = T[5];
  lset = T[6];
  dset = T[7];

  let cstSize = (((pos + 3) & 7) == 0 ? 0 : 8 - ((pos + 3) & 7)) + 32 + (l0 << 3);
  let fxdSize = ebits + UZIP.F.contSize(U.fltree, U.lhst) + UZIP.F.contSize(U.fdtree, U.dhst);
  let dynSize = ebits + UZIP.F.contSize(U.ltree, U.lhst) + UZIP.F.contSize(U.dtree, U.dhst);
  dynSize += 14 + 3 * numh + UZIP.F.contSize(U.itree, U.ihst) + (U.ihst[16] * 2 + U.ihst[17] * 3 + U.ihst[18] * 7);

  for (let j = 0; j < 286; j++) U.lhst[j] = 0;
  for (let j = 0; j < 30; j++) U.dhst[j] = 0;
  for (let j = 0; j < 19; j++) U.ihst[j] = 0;
  //*/
  let BTYPE = cstSize < fxdSize && cstSize < dynSize ? 0 : fxdSize < dynSize ? 1 : 2;
  putsF(out, pos, BFINAL);
  putsF(out, pos + 1, BTYPE);
  pos += 3;

  let opos = pos;
  if (BTYPE == 0) {
    while ((pos & 7) != 0) pos++;
    pos = UZIP.F._copyExact(data, o0, l0, out, pos);
  } else {
    let ltree, dtree;
    if (BTYPE == 1) {
      ltree = U.fltree;
      dtree = U.fdtree;
    }
    if (BTYPE == 2) {
      UZIP.F.makeCodes(U.ltree, ML);
      UZIP.F.revCodes(U.ltree, ML);
      UZIP.F.makeCodes(U.dtree, MD);
      UZIP.F.revCodes(U.dtree, MD);
      UZIP.F.makeCodes(U.itree, MH);
      UZIP.F.revCodes(U.itree, MH);

      ltree = U.ltree;
      dtree = U.dtree;

      putsE(out, pos, numl - 257);
      pos += 5; // 286
      putsE(out, pos, numd - 1);
      pos += 5; // 30
      putsE(out, pos, numh - 4);
      pos += 4; // 19

      for (let i = 0; i < numh; i++) putsE(out, pos + i * 3, U.itree[(U.ordr[i] << 1) + 1]);
      pos += 3 * numh;
      pos = UZIP.F._codeTiny(lset, U.itree, out, pos);
      pos = UZIP.F._codeTiny(dset, U.itree, out, pos);
    }

    let off = o0;
    for (let si = 0; si < li; si += 2) {
      let qb = lits[si],
        len = qb >>> 23,
        end = off + (qb & ((1 << 23) - 1));
      while (off < end) pos = UZIP.F._writeLit(data[off++], ltree, out, pos);

      if (len != 0) {
        let qc = lits[si + 1],
          dst = qc >> 16,
          lgi = (qc >> 8) & 255,
          dgi = qc & 255;
        pos = UZIP.F._writeLit(257 + lgi, ltree, out, pos);
        putsE(out, pos, len - U.of0[lgi]);
        pos += U.exb[lgi];

        pos = UZIP.F._writeLit(dgi, dtree, out, pos);
        putsF(out, pos, dst - U.df0[dgi]);
        pos += U.dxb[dgi];
        off += len;
      }
    }
    pos = UZIP.F._writeLit(256, ltree, out, pos);
  }
  //console.log(pos-opos, fxdSize, dynSize, cstSize);
  return pos;
};
UZIP.F._copyExact = function(data, off, len, out, pos) {
  let p8 = pos >>> 3;
  out[p8] = len;
  out[p8 + 1] = len >>> 8;
  out[p8 + 2] = 255 - out[p8];
  out[p8 + 3] = 255 - out[p8 + 1];
  p8 += 4;
  out.set(new Uint8Array(data.buffer, off, len), p8);
  //for(let i=0; i<len; i++) out[p8+i]=data[off+i];
  return pos + ((len + 4) << 3);
};
/*
	Interesting facts:
	- decompressed block can have bytes, which do not occur in a Huffman tree (copied from the previous block by reference)
*/

UZIP.F.getTrees = function() {
  let U = UZIP.F.U;
  let ML = UZIP.F._hufTree(U.lhst, U.ltree, 15);
  let MD = UZIP.F._hufTree(U.dhst, U.dtree, 15);
  let lset = [],
    numl = UZIP.F._lenCodes(U.ltree, lset);
  let dset = [],
    numd = UZIP.F._lenCodes(U.dtree, dset);
  for (let i = 0; i < lset.length; i += 2) U.ihst[lset[i]]++;
  for (let i = 0; i < dset.length; i += 2) U.ihst[dset[i]]++;
  let MH = UZIP.F._hufTree(U.ihst, U.itree, 7);
  let numh = 19;
  while (numh > 4 && U.itree[(U.ordr[numh - 1] << 1) + 1] == 0) numh--;
  return [ML, MD, MH, numl, numd, numh, lset, dset];
};
UZIP.F.getSecond = function(a) {
  let b = [];
  for (let i = 0; i < a.length; i += 2) b.push(a[i + 1]);
  return b;
};
UZIP.F.nonZero = function(a) {
  let b = '';
  for (let i = 0; i < a.length; i += 2) if (a[i + 1] != 0) b += (i >> 1) + ',';
  return b;
};
UZIP.F.contSize = function(tree, hst) {
  let s = 0;
  for (let i = 0; i < hst.length; i++) s += hst[i] * tree[(i << 1) + 1];
  return s;
};
UZIP.F._codeTiny = function(set, tree, out, pos) {
  for (let i = 0; i < set.length; i += 2) {
    let l = set[i],
      rst = set[i + 1]; //console.log(l, pos, tree[(l<<1)+1]);
    pos = UZIP.F._writeLit(l, tree, out, pos);
    let rsl = l == 16 ? 2 : l == 17 ? 3 : 7;
    if (l > 15) {
      UZIP.F._putsE(out, pos, rst, rsl);
      pos += rsl;
    }
  }
  return pos;
};
UZIP.F._lenCodes = function(tree, set) {
  let len = tree.length;
  while (len != 2 && tree[len - 1] == 0) len -= 2; // when no distances, keep one code with length 0
  for (let i = 0; i < len; i += 2) {
    let l = tree[i + 1],
      nxt = i + 3 < len ? tree[i + 3] : -1,
      nnxt = i + 5 < len ? tree[i + 5] : -1,
      prv = i == 0 ? -1 : tree[i - 1];
    if (l == 0 && nxt == l && nnxt == l) {
      let lz = i + 5;
      while (lz + 2 < len && tree[lz + 2] == l) lz += 2;
      let zc = Math.min((lz + 1 - i) >>> 1, 138);
      if (zc < 11) set.push(17, zc - 3);
      else set.push(18, zc - 11);
      i += zc * 2 - 2;
    } else if (l == prv && nxt == l && nnxt == l) {
      let lz = i + 5;
      while (lz + 2 < len && tree[lz + 2] == l) lz += 2;
      let zc = Math.min((lz + 1 - i) >>> 1, 6);
      set.push(16, zc - 3);
      i += zc * 2 - 2;
    } else set.push(l, 0);
  }
  return len >>> 1;
};
UZIP.F._hufTree = function(hst, tree, MAXL) {
  let list = [],
    hl = hst.length,
    tl = tree.length,
    i = 0;
  for (i = 0; i < tl; i += 2) {
    tree[i] = 0;
    tree[i + 1] = 0;
  }
  for (i = 0; i < hl; i++) if (hst[i] != 0) list.push({ lit: i, f: hst[i] });
  let end = list.length,
    l2 = list.slice(0);
  if (end == 0) return 0; // empty histogram (usually for dist)
  if (end == 1) {
    let lit = list[0].lit,
      l2 = lit == 0 ? 1 : 0;
    tree[(lit << 1) + 1] = 1;
    tree[(l2 << 1) + 1] = 1;
    return 1;
  }
  list.sort(function(a, b) {
    return a.f - b.f;
  });
  let a = list[0],
    b = list[1],
    i0 = 0,
    i1 = 1,
    i2 = 2;
  list[0] = { lit: -1, f: a.f + b.f, l: a, r: b, d: 0 };
  while (i1 != end - 1) {
    if (i0 != i1 && (i2 == end || list[i0].f < list[i2].f)) {
      a = list[i0++];
    } else {
      a = list[i2++];
    }
    if (i0 != i1 && (i2 == end || list[i0].f < list[i2].f)) {
      b = list[i0++];
    } else {
      b = list[i2++];
    }
    list[i1++] = { lit: -1, f: a.f + b.f, l: a, r: b };
  }
  let maxl = UZIP.F.setDepth(list[i1 - 1], 0);
  if (maxl > MAXL) {
    UZIP.F.restrictDepth(l2, MAXL, maxl);
    maxl = MAXL;
  }
  for (i = 0; i < end; i++) tree[(l2[i].lit << 1) + 1] = l2[i].d;
  return maxl;
};

UZIP.F.setDepth = function(t, d) {
  if (t.lit != -1) {
    t.d = d;
    return d;
  }
  return Math.max(UZIP.F.setDepth(t.l, d + 1), UZIP.F.setDepth(t.r, d + 1));
};

UZIP.F.restrictDepth = function(dps, MD, maxl) {
  let i = 0,
    bCost = 1 << (maxl - MD),
    dbt = 0;
  dps.sort(function(a, b) {
    return b.d == a.d ? a.f - b.f : b.d - a.d;
  });

  for (i = 0; i < dps.length; i++)
    if (dps[i].d > MD) {
      let od = dps[i].d;
      dps[i].d = MD;
      dbt += bCost - (1 << (maxl - od));
    } else break;
  dbt = dbt >>> (maxl - MD);
  while (dbt > 0) {
    let od = dps[i].d;
    if (od < MD) {
      dps[i].d++;
      dbt -= 1 << (MD - od - 1);
    } else i++;
  }
  for (; i >= 0; i--)
    if (dps[i].d == MD && dbt < 0) {
      dps[i].d--;
      dbt++;
    }
  if (dbt != 0) console.log('debt left');
};

UZIP.F._goodIndex = function(v, arr) {
  let i = 0;
  if (arr[i | 16] <= v) i |= 16;
  if (arr[i | 8] <= v) i |= 8;
  if (arr[i | 4] <= v) i |= 4;
  if (arr[i | 2] <= v) i |= 2;
  if (arr[i | 1] <= v) i |= 1;
  return i;
};
UZIP.F._writeLit = function(ch, ltree, out, pos) {
  UZIP.F._putsF(out, pos, ltree[ch << 1]);
  return pos + ltree[(ch << 1) + 1];
};

UZIP.F.inflate = function(data, buf) {
  if (data[0] == 3 && data[1] == 0) return buf ? buf : new Uint8Array(0);
  let F = UZIP.F,
    bitsF = F._bitsF,
    bitsE = F._bitsE,
    decodeTiny = F._decodeTiny,
    makeCodes = F.makeCodes,
    codes2map = F.codes2map,
    get17 = F._get17;
  let U = F.U;

  let noBuf = buf == null;
  if (noBuf) buf = new Uint8Array((data.length >> 2) << 3);

  let BFINAL = 0,
    BTYPE = 0,
    HLIT = 0,
    HDIST = 0,
    HCLEN = 0,
    ML = 0,
    MD = 0;
  let off = 0,
    pos = 0;
  let lmap, dmap;

  while (BFINAL == 0) {
    BFINAL = bitsF(data, pos, 1);
    BTYPE = bitsF(data, pos + 1, 2);
    pos += 3;
    //console.log(BFINAL, BTYPE);

    if (BTYPE == 0) {
      if ((pos & 7) != 0) pos += 8 - (pos & 7);
      let p8 = (pos >>> 3) + 4,
        len = data[p8 - 4] | (data[p8 - 3] << 8); //console.log(len);//bitsF(data, pos, 16),
      if (noBuf) buf = UZIP.F._check(buf, off + len);
      buf.set(new Uint8Array(data.buffer, data.byteOffset + p8, len), off);
      //for(let i=0; i<len; i++) buf[off+i] = data[p8+i];
      //for(let i=0; i<len; i++) if(buf[off+i] != data[p8+i]) throw "e";
      pos = (p8 + len) << 3;
      off += len;
      continue;
    }
    if (noBuf) buf = UZIP.F._check(buf, off + (1 << 17));
    if (BTYPE == 1) {
      lmap = U.flmap;
      dmap = U.fdmap;
      ML = (1 << 9) - 1;
      MD = (1 << 5) - 1;
    }
    if (BTYPE == 2) {
      HLIT = bitsE(data, pos, 5) + 257;
      HDIST = bitsE(data, pos + 5, 5) + 1;
      HCLEN = bitsE(data, pos + 10, 4) + 4;
      pos += 14;

      let ppos = pos;
      for (let i = 0; i < 38; i += 2) {
        U.itree[i] = 0;
        U.itree[i + 1] = 0;
      }
      let tl = 1;
      for (let i = 0; i < HCLEN; i++) {
        let l = bitsE(data, pos + i * 3, 3);
        U.itree[(U.ordr[i] << 1) + 1] = l;
        if (l > tl) tl = l;
      }
      pos += 3 * HCLEN; //console.log(itree);
      makeCodes(U.itree, tl);
      codes2map(U.itree, tl, U.imap);

      lmap = U.lmap;
      dmap = U.dmap;

      let ml = decodeTiny(U.imap, (1 << tl) - 1, HLIT, data, pos, U.ltree);
      ML = (1 << (ml >>> 24)) - 1;
      pos += ml & 0xffffff;
      makeCodes(U.ltree, ml >>> 24);
      codes2map(U.ltree, ml >>> 24, lmap);

      let md = decodeTiny(U.imap, (1 << tl) - 1, HDIST, data, pos, U.dtree);
      MD = (1 << (md >>> 24)) - 1;
      pos += md & 0xffffff;
      makeCodes(U.dtree, md >>> 24);
      codes2map(U.dtree, md >>> 24, dmap);
    }
    //let ooff=off, opos=pos;
    while (true) {
      let code = lmap[get17(data, pos) & ML];
      pos += code & 15;
      let lit = code >>> 4; //U.lhst[lit]++;
      if (lit >>> 8 == 0) {
        buf[off++] = lit;
      } else if (lit == 256) {
        break;
      } else {
        let end = off + lit - 254;
        if (lit > 264) {
          let ebs = U.ldef[lit - 257];
          end = off + (ebs >>> 3) + bitsE(data, pos, ebs & 7);
          pos += ebs & 7;
        }
        //UZIP.F.dst[end-off]++;

        let dcode = dmap[get17(data, pos) & MD];
        pos += dcode & 15;
        let dlit = dcode >>> 4;
        let dbs = U.ddef[dlit],
          dst = (dbs >>> 4) + bitsF(data, pos, dbs & 15);
        pos += dbs & 15;

        //let o0 = off-dst, stp = Math.min(end-off, dst);
        //if(stp>20) while(off<end) {  buf.copyWithin(off, o0, o0+stp);  off+=stp;  }  else
        //if(end-dst<=off) buf.copyWithin(off, off-dst, end-dst);  else
        //if(dst==1) buf.fill(buf[off-1], off, end);  else
        while (off < end) {
          buf[off] = buf[off++ - dst];
          buf[off] = buf[off++ - dst];
          buf[off] = buf[off++ - dst];
          buf[off] = buf[off++ - dst];
        }
        off = end;
        //while(off!=end) {  buf[off]=buf[off++-dst];  }
      }
    }
    //console.log(off-ooff, (pos-opos)>>>3);
  }
  //console.log(UZIP.F.dst);
  //console.log(tlen, dlen, off-tlen+tcnt);
  return buf.length == off ? buf : buf.slice(0, off);
};
UZIP.F._check = function(buf, len) {
  let bl = buf.length;
  if (len <= bl) return buf;
  let nbuf = new Uint8Array(bl << 1);
  for (let i = 0; i < bl; i += 4) {
    nbuf[i] = buf[i];
    nbuf[i + 1] = buf[i + 1];
    nbuf[i + 2] = buf[i + 2];
    nbuf[i + 3] = buf[i + 3];
  }
  return nbuf;
};

UZIP.F._decodeTiny = function(lmap, LL, len, data, pos, tree) {
  let opos = pos;
  let bitsE = UZIP.F._bitsE,
    get17 = UZIP.F._get17;
  let dlen = len << 1,
    i = 0,
    mx = 0;
  //if(pos<1000) console.log("--------");
  //console.log("----", pos, ":",  data[7],data[8], data[9], data[10], data[11]);
  while (i < dlen) {
    let code = lmap[get17(data, pos) & LL];
    pos += code & 15;
    let lit = code >>> 4; //if(pos<1000) console.log(lit, i>>>1);
    //if(i<20)console.log(lit, code>>>9, pos);
    if (lit <= 15) {
      tree[i] = 0;
      tree[i + 1] = lit;
      if (lit > mx) mx = lit;
      i += 2;
    } else {
      let ll = 0,
        n = 0;
      if (lit == 16) {
        n = (3 + bitsE(data, pos, 2)) << 1;
        pos += 2;
        ll = tree[i - 1];
      } else if (lit == 17) {
        n = (3 + bitsE(data, pos, 3)) << 1;
        pos += 3;
      } else if (lit == 18) {
        n = (11 + bitsE(data, pos, 7)) << 1;
        pos += 7;
      }
      let ni = i + n;
      while (i < ni) {
        tree[i] = 0;
        tree[i + 1] = ll;
        i += 2;
      }
    }
  }
  let tl = tree.length;
  while (i < tl) {
    tree[i + 1] = 0;
    i += 2;
  }
  return (mx << 24) | (pos - opos);
};

UZIP.F.makeCodes = function(tree, MAX_BITS) {
  // code, length
  let U = UZIP.F.U;
  let max_code = tree.length;
  let code, bits, n, i, len;

  let bl_count = U.bl_count;
  for (let i = 0; i <= MAX_BITS; i++) bl_count[i] = 0;
  for (i = 1; i < max_code; i += 2) bl_count[tree[i]]++;

  let next_code = U.next_code; // smallest code for each length

  code = 0;
  bl_count[0] = 0;
  for (bits = 1; bits <= MAX_BITS; bits++) {
    code = (code + bl_count[bits - 1]) << 1;
    next_code[bits] = code;
  }

  for (n = 0; n < max_code; n += 2) {
    len = tree[n + 1];
    if (len != 0) {
      tree[n] = next_code[len];
      next_code[len]++;
    }
  }
};
UZIP.F.codes2map = function(tree, MAX_BITS, map) {
  let max_code = tree.length;
  let U = UZIP.F.U,
    r15 = U.rev15;
  for (let i = 0; i < max_code; i += 2)
    if (tree[i + 1] != 0) {
      let lit = i >> 1;
      let cl = tree[i + 1],
        val = (lit << 4) | cl; // :  (0x8000 | (U.of0[lit-257]<<7) | (U.exb[lit-257]<<4) | cl);
      let rest = MAX_BITS - cl,
        i0 = tree[i] << rest,
        i1 = i0 + (1 << rest);
      //tree[i]=r15[i0]>>>(15-MAX_BITS);
      while (i0 != i1) {
        let p0 = r15[i0] >>> (15 - MAX_BITS);
        map[p0] = val;
        i0++;
      }
    }
};
UZIP.F.revCodes = function(tree, MAX_BITS) {
  let r15 = UZIP.F.U.rev15,
    imb = 15 - MAX_BITS;
  for (let i = 0; i < tree.length; i += 2) {
    let i0 = tree[i] << (MAX_BITS - tree[i + 1]);
    tree[i] = r15[i0] >>> imb;
  }
};

UZIP.F._putsE = function(dt, pos, val) {
  val = val << (pos & 7);
  let o = pos >>> 3;
  dt[o] |= val;
  dt[o + 1] |= val >>> 8;
};
UZIP.F._putsF = function(dt, pos, val) {
  val = val << (pos & 7);
  let o = pos >>> 3;
  dt[o] |= val;
  dt[o + 1] |= val >>> 8;
  dt[o + 2] |= val >>> 16;
};

UZIP.F._bitsE = function(dt, pos, length) {
  return ((dt[pos >>> 3] | (dt[(pos >>> 3) + 1] << 8)) >>> (pos & 7)) & ((1 << length) - 1);
};
UZIP.F._bitsF = function(dt, pos, length) {
  return ((dt[pos >>> 3] | (dt[(pos >>> 3) + 1] << 8) | (dt[(pos >>> 3) + 2] << 16)) >>> (pos & 7)) & ((1 << length) - 1);
};
/*
UZIP.F._get9 = function(dt, pos) {
	return ((dt[pos>>>3] | (dt[(pos>>>3)+1]<<8))>>>(pos&7))&511;
} */
UZIP.F._get17 = function(dt, pos) {
  // return at least 17 meaningful bytes
  return (dt[pos >>> 3] | (dt[(pos >>> 3) + 1] << 8) | (dt[(pos >>> 3) + 2] << 16)) >>> (pos & 7);
};
UZIP.F._get25 = function(dt, pos) {
  // return at least 17 meaningful bytes
  return (dt[pos >>> 3] | (dt[(pos >>> 3) + 1] << 8) | (dt[(pos >>> 3) + 2] << 16) | (dt[(pos >>> 3) + 3] << 24)) >>> (pos & 7);
};

UZIP.F.U = {
  next_code: new Uint16Array(16),
  bl_count: new Uint16Array(16),
  ordr: [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],
  of0: [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 999, 999, 999],
  exb: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0],
  ldef: new Uint16Array(32),
  df0: [
    1,
    2,
    3,
    4,
    5,
    7,
    9,
    13,
    17,
    25,
    33,
    49,
    65,
    97,
    129,
    193,
    257,
    385,
    513,
    769,
    1025,
    1537,
    2049,
    3073,
    4097,
    6145,
    8193,
    12289,
    16385,
    24577,
    65535,
    65535
  ],
  dxb: [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0],
  ddef: new Uint32Array(32),
  flmap: new Uint16Array(512),
  fltree: [],
  fdmap: new Uint16Array(32),
  fdtree: [],
  lmap: new Uint16Array(32768),
  ltree: [],
  dmap: new Uint16Array(32768),
  dtree: [],
  imap: new Uint16Array(512),
  itree: [],
  //rev9 : new Uint16Array(  512)
  rev15: new Uint16Array(1 << 15),
  lhst: new Uint32Array(286),
  dhst: new Uint32Array(30),
  ihst: new Uint32Array(19),
  lits: new Uint32Array(15000),
  strt: new Uint16Array(1 << 16),
  prev: new Uint16Array(1 << 15)
};

(function() {
  let U = UZIP.F.U;
  let len = 1 << 15;
  for (let i = 0; i < len; i++) {
    let x = i;
    x = ((x & 0xaaaaaaaa) >>> 1) | ((x & 0x55555555) << 1);
    x = ((x & 0xcccccccc) >>> 2) | ((x & 0x33333333) << 2);
    x = ((x & 0xf0f0f0f0) >>> 4) | ((x & 0x0f0f0f0f) << 4);
    x = ((x & 0xff00ff00) >>> 8) | ((x & 0x00ff00ff) << 8);
    U.rev15[i] = ((x >>> 16) | (x << 16)) >>> 17;
  }

  for (let i = 0; i < 32; i++) {
    U.ldef[i] = (U.of0[i] << 3) | U.exb[i];
    U.ddef[i] = (U.df0[i] << 4) | U.dxb[i];
  }

  let i = 0;
  for (; i <= 143; i++) U.fltree.push(0, 8);
  for (; i <= 255; i++) U.fltree.push(0, 9);
  for (; i <= 279; i++) U.fltree.push(0, 7);
  for (; i <= 287; i++) U.fltree.push(0, 8);
  UZIP.F.makeCodes(U.fltree, 9);
  UZIP.F.codes2map(U.fltree, 9, U.flmap);
  UZIP.F.revCodes(U.fltree, 9);

  for (i = 0; i < 32; i++) U.fdtree.push(0, 5);
  UZIP.F.makeCodes(U.fdtree, 5);
  UZIP.F.codes2map(U.fdtree, 5, U.fdmap);
  UZIP.F.revCodes(U.fdtree, 5);

  for (let i = 0; i < 19; i++) U.itree.push(0, 0);
  for (let i = 0; i < 286; i++) U.ltree.push(0, 0);
  for (let i = 0; i < 30; i++) U.dtree.push(0, 0);
})();
