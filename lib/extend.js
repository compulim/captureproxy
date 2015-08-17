/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, evil:false, bitwise:false, strict:true, undef:true, curly:true, devel:true, indent:4, maxerr:50, expr:true, loopfunc:true, onevar:false, multistr:true, node:true */

!function () {
    'use strict';

    function isArray(o) {
        return Object.prototype.toString.call(o) === '[object Array]';
    }

    function primitive(o) {
        var type = typeof o;

        return !o || type === 'boolean' || type === 'number' || type === 'string' || isArray(o);
    }

    function extend(to, from) {
        var fromType = typeof from;

        if (primitive(from)) { return from; }

        to = primitive(to) ? {} : to;

        Object.getOwnPropertyNames(from).forEach(function (name) {
            to[name] = extend(to[name], from[name]);
        });

        if (arguments.length > 2) {
            var args = Array.prototype.slice.call(arguments);

            args.splice(1, 1);

            return extend.apply(this, args);
        } else {
            return to;
        }
    }

    module.exports = extend;
}();