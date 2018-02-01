var _ = require("lodash"),
  compare = require("../lib/compare"),
  should = require("should/as-function");

function intersect(fullObj, partialObj) {
  var i, key;

  // allow conversions from arguments to array.
  if (_.isArguments(fullObj)) {
    fullObj = pSlice.call(fullObj);
  }
  if (_.isArguments(partialObj)) {
    partialObj = pSlice.call(partialObj);
  }

  if (
    _.isArray(fullObj) &&
    _.isArray(partialObj) &&
    fullObj.length >= partialObj.length
  ) {
    var newFullArray = [];
    for (var i = 0; i < partialObj.length; i++) {
      newFullArray.push(intersect(fullObj[i], partialObj[i]));
    }
    return newFullArray;
  } else if (_.isObject(fullObj) && _.isObject(partialObj)) {
    var newFullObj = _.pick(fullObj, _.keys(partialObj));

    // descend.
    return _.mapValues(newFullObj, (v, k) => intersect(v, partialObj[k]));
  }
  return fullObj;
}

function comp(actual, expected) {
  if (compare(actual, expected) === false) {
    should(intersect(_.cloneDeep(actual), expected)).eql(expected);
  }
}

module.exports = {
  comp: comp
};
