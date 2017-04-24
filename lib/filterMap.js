'use strict';

const reduceMap = require('./reduceMap');

function filterMap(map, predicate) {
  return reduceMap(map, (result, value, name) => {
    if (predicate.call(map, value, name)) {
      result[name] = value;
    }

    return result;
  }, {});
}

module.exports = filterMap;