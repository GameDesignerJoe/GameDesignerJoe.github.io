export class SmartShuffle {
  constructor(clips) {
    this.orig = [...clips]
    this.pool = []
    this._fill()
  }

  _fill() {
    this.pool = [...this.orig].sort(() => Math.random() - 0.5)
  }

  next() {
    if (!this.pool.length) this._fill()
    return this.pool.pop()
  }
}
