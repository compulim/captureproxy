'use strict';

const UNDEFINED = undefined;

class Semaphore {
  constructor() {
    this._flags = {};
  }

  when(names, handler) {
    const flags = this._flags;

    (names || '').split(' ').forEach(name => {
      const flag = flags[name] || (flags[name] = new Flag());

      flag.when(handler);
    });

    return this;
  }

  whenNot(names, handler) {
    const flags = this._flags;

    (names || '').split(' ').forEach(name => {
      const flag = flags[name] || (flags[name] = new Flag())

      flag.whenNot(handler);
    });

    return this;
  }

  removeListener(names, handler) {
    const flags = this._flags;

    names.split(' ').forEach(name => {
      const flag = flags[name];

      if (!flag) { return; }

      flag.removeListener(handler);

      if (flag.empty()) {
        flags[name] = undefined;
      }
    });

    return this;
  }

  flag(name) {
    const flags = this._flags;
    const flag = flags[name] || (flags[name] = new Flag());

    flag.flag.apply(flag, [].slice.call(arguments, 1));

    return this;
  }

  unflag(name) {
    const flags = this._flags;
    const flag = flags[name] || (flags[name] = new Flag());

    flag.unflag();

    return this;
  }

  is(name) {
    return this._flags[name].is();
  }
}

class Flag {
  constructor() {
    this._when = [];
    this._whenNot = [];
    this.flagged = 0;
  }

  flag() {
    if (!this.flagged) {
      this.flagged = 1;

      const states = this.states = [].slice.call(arguments);

      this._when.forEach(handler => {
        handler.apply(this, states);
      });
    }
  }

  unflag() {
    if (this.flagged) {
      this.flagged = 0;

      this._whenNot.forEach(handler => handler());
    }
  }

  when(handler) {
    this._when.push(handler);
    this.flagged && handler.call(this, this.state);
  }

  whenNot(handler) {
    this._whenNot.push(handler);
    this.flagged && handler.call(this);
  }

  removeListener(handler) {
    arrayRemove(this._when, handler);
    arrayRemove(this._whenNot, handler);
  }

  empty() {
    return !(this._when.length + this._whenNot.length);
  }

  is() {
    return this.flagged;
  }
}

function arrayRemove(array, item) {
  const l = array.length;
  let   i = 0;

  for (; i < l; i++) {
    if (array[i] === item) {
      array.splice(i, 1);
      i--;
      l--;
    }
  }

  return array;
}

module.exports = {
  Flag,
  Semaphore
};
