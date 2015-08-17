!function () {
    'use strict';

    var UNDEFINED = undefined;

    function Semaphore() {
        var that = this;

        that._flags = {};
    }

    module.exports.Semaphore = Semaphore;

    Semaphore.prototype.when = function (names, handler) {
        var that = this,
            flags = that._flags;

        (names || '').split(' ').forEach(function (name) {
            var flag = flags[name] || (flags[name] = new Flag());

            flag.when(handler);
        });

        return that;
    };

    Semaphore.prototype.whenNot = function (names, handler) {
        var flags = this._flags;

        (names || '').split(' ').forEach(function (name) {
            var flag = flags[name] || (flags[name] = new Flag())

            flag.whenNot(handler);
        });

        return that;
    };

    Semaphore.prototype.removeListener = function (names, handler) {
        var that = this,
            flags = that._flags;

        names.split(' ').forEach(function (name) {
            var flag = flags[name];

            if (!flag) { return; }

            flag.removeListener(handler);

            if (flag.empty()) {
                flags[name] = undefined;
            }
        });

        return that;
    };

    Semaphore.prototype.flag = function (name) {
        var that = this,
            flags = that._flags,
            flag = flags[name] || (flags[name] = new Flag());

        flag.flag.apply(flag, [].slice.call(arguments, 1));

        return that;
    };

    Semaphore.prototype.unflag = function (name) {
        var that = this,
            flags = that._flags,
            flag = flags[name] || (flags[name] = new Flag());

        flag.unflag();

        return that;
    };

    Semaphore.prototype.is = function (name) {
        var that = this,
            flag = that._flags[name];

        return flag.is();
    };

    function Flag() {
        var that = this;

        that._when = [];
        that._whenNot = [];
        that.flagged = 0;
    }

    Flag.prototype.flag = function () {
        var that = this;

        if (!that.flagged) {
            that.flagged = 1;

            var states = that.states = [].slice.call(arguments);

            that._when.forEach(function (handler) {
                handler.apply(that, states);
            });
        }
    };

    Flag.prototype.unflag = function () {
        var that = this;

        if (that.flagged) {
            that.flagged = 0;

            that._whenNot.forEach(function (handler) {
                handler();
            });
        }
    };

    Flag.prototype.when = function (handler) {
        var that = this;

        that._when.push(handler);
        that.flagged && handler.call(that, that.state);
    };

    Flag.prototype.whenNot = function (handler) {
        var that = this;

        that._whenNot.push(handler);
        that.flagged && handler.call(that);
    };

    Flag.prototype.removeListener = function (handler) {
        var that = this;

        arrayRemove(that._when, handler);
        arrayRemove(that._whenNot, handler);
    };

    Flag.prototype.empty = function () {
        var that = this;

        return !(that._when.length + that._whenNot.length);
    };

    Flag.prototype.is = function () {
        return this.flagged;
    };

    function arrayRemove(array, item) {
        var i = 0, l = array.length;

        for (; i < l; i++) {
            if (array[i] === item) {
                array.splice(i, 1);
                i--;
                l--;
            }
        }

        return array;
    }
}();