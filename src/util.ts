const kHexTbl = '0123456789abcdef'

export class Util {
  static hex(x, order) {
    const s = new Array(order)
    for (let i = 0; i < order; ++i) {
      s[order - i - 1] = kHexTbl[x & 0x0f]
      x >>= 4
    }
    return s.join('')
  }
}
