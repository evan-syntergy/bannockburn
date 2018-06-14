var _ = require("lodash");

var ASTParts = {
  FunctionDeclaration: ["params", "body"],
  VariableDeclaration: ["declarations"],
  VariableDeclarator: ["init"],
  UnaryExpression: ["argument"],
  ThisExpression: [],
  ConditionalExpression: ["test", "consequent", "alternate"],
  MemberExpression: ["object", "property"],
  RangeExpression: ["object", "fromIndex", "toIndex"],
  IndexExpression: ["index"],
  CallExpression: ["callee", "arguments"],
  ListExpression: ["elements"],
  BinaryExpression: ["left", "right"],
  AssignmentExpression: ["left", "right"],
  IfStatement: ["test", "consequent", "alternate"],
  ElseifStatement: ["test", "consequent", "alternate"],
  ReturnStatement: ["argument"],
  BreakStatement: [],
  BreakIfStatement: ["argument"],
  ContinueStatement: [],
  ContinueIfStatement: ["argument"],
  WhileStatement: ["test", "body"],
  RepeatStatement: ["test", "body"],
  ForCStyleStatement: ["first", "second", "third", "body"],
  ForStatement: ["first", "second", "third", "body"],
  ForInStatement: ["first", "body"],
  SwitchStatement: ["discriminant", "cases"],
  SwitchCase: ["test", "consequent"],
  GotoStatement: [],
  ExpressionStatement: ["expression"],
  VariableDeclaration: ["declarations"],
  VariableDeclarator: ["init"]
};

var SYNTAX = {};

_.forOwn(ASTParts, function(v, k) {
  SYNTAX[k] = { children: v, name: k };
});

/**
 * Normalize a node that may be an (empty?) array of statements,
 * a single item, or a null value.
 * Return a non-empty array, or null.
 * @param {Array|Object} variant
 */
function normalBlk(variant) {
  if (_.isArray(variant)) {
    return variant.length ? variant : null;
  }
  return variant ? [variant] : null;
}

/**
 * Walks a parse tree
 * @param block - A node or array of nodes
 * @param walker  - The walker object.
 */
function walkTree(block, walker) {
  if (!block) {
    return;
  } else if (!_.isArray(block)) {
    block = normalizeBlk(block);
  }

  var len = block.length,
    i = -1,
    j,
    prop;

  // process all the nodes in the block.
  while (++i < len) {
    var node = block[i];
    var nodeType = node.type;
    var syntax = SYNTAX[nodeType];
    var children = [];

    if (syntax) {
      // names of possible children.
      children = syntax.children;
    }

    for (j = 0; j < children.length; ++j) {
      prop = children[j];
      node[prop] = normalBlk(node[prop]);
    }

    // process any hooks for the node type.
    if (walker.fire(nodeType, node, children)) {
      // process all possible children attributes (body, argument, left, right, etc...)
      for (j = 0; j < children.length; ++j) {
        prop = children[j];
        var childNodes = node[prop];

        if (childNodes) {
          var pElem = { node: node, type: prop };

          // process any 'before' hooks.
          if (
            walker.fire("before:" + nodeType + "." + prop, node, childNodes)
          ) {
            // and call recursively ...
            walker.walk(childNodes, pElem);

            // process any 'after' hooks.
            walker.fire("after:" + nodeType + "." + prop, node, childNodes);
          }
        }
      }
    }
  }
}

/**
 * Walks an AST.
 * @param actions
 * @param scope
 * @constructor
 */
function Walker(actions, options) {
  this.actions = {};
  this.options = options || {};

  if (actions) {
    this.on.apply(this, actions);
  }
}

Walker.prototype = {
  /**
   * Starts walking the tree.
   * @param root - Node/Nodes to start walking
   */
  start: function(root) {
    this.path = [];
    this.walk(root);
  },

  /**
   *
   * @param nodes - One or more nodes to process
   * @param [pathElem] - The element being walked
   * @param [walkFn] - Walk function
   */
  walk: function(nodes, pathElem, walkFn) {
    walkFn = walkFn || walkTree;

    if (pathElem) {
      this.path.push(pathElem);
    }

    walkFn.call(this.scope, nodes, this);

    if (pathElem) {
      this.path.pop();
    }
  },

  getStartPos: function(n) {
    return n && n.range ? n.range[0] : null;
  },

  getStartLine: function(n) {
    return n && n.loc && n.loc.start ? n.loc.start.line : null;
  },

  getEndPos: function(n) {
    return n && n.range ? n.range[1] : null;
  },

  getEndLine: function(n) {
    return n && n.loc && n.loc.end ? n.loc.end.line : null;
  },

  /**
   * Fires an event for each registered callback.
   * @param typeSpec - The type of statement/expression.
   * @param node - The node
   * @param childNode - The child node / or child properties.
   * @returns {boolean} True if all events fired, false otherwise.
   */
  fire: function(typeSpec, node, childNode) {
    var evtList = this.actions[typeSpec] || [],
      result = true;

    if (evtList.length === 0) {
      // try catch-all if nothing matches directly.
      evtList = this.actions["*"] || [];
    }

    if (evtList.length) {
      var parts = /^(?:(before|after)?:)?(\w+)(?:\.(\w+))?$/.exec(typeSpec);

      result = evtList.every(function(a) {
        return false ===
          a.fn.apply(
            a.scope || this,
            [node, childNode].concat(parts ? parts.slice(1) : [typeSpec])
          )
          ? false
          : true;
      }, this);
    }
    return result;
  },

  /**
   * Registers a listener for a particular event.
   * @param typeSpec - The type of node.
   * @param cb - A callback function
   * @param scope - The scope of the callback.
   * @returns {Walker} - Returns the walker for chaining if needed.
   */
  on: function(typeSpec, cb, scope) {
    var args = Array.prototype.slice.apply(arguments);
    if (_.isArray(typeSpec)) {
      if (_.isFunction(cb)) {
        // handle: on( [ 'func', 'func2', 'func3'], cb, scope )
        typeSpec.forEach(function(n) {
          this.on.apply(this, [n].concat(args.slice(1)));
        }, this);
      } else {
        // handle: on( [ [ 'func', cb, scope ], [ 'func2', cb ] ] )
        this.on.apply(this, typeSpec);
      }
    } else if (_.isObject(typeSpec)) {
      if (arguments.length === 2) {
        scope = cb;
      }
      typeSpec.forEach(function(f, t) {
        this.on(t, f, scope);
      }, this);
    } else {
      var parts = /^(?:(before|after):)?(\w+|\*)((?:\.)\w+)?$/.exec(typeSpec);

      if (!parts) {
        throw Error("Invalid format for parse node specified: " + typeSpec);
      }

      var when = parts[1],
        grammerType = parts[2],
        childParam = parts[3];

      if (when && !childParam) {
        throw Error(
          "before/after specifiers must be used with child parameters: " +
            typeSpec
        );
      }

      if (childParam && !when) {
        args = args.slice(1);
        this.on.apply(this, ["before:" + typeSpec].concat(args));
        this.on.apply(this, ["after:" + typeSpec].concat(args));
      } else {
        var actionList =
          this.actions[typeSpec] || (this.actions[typeSpec] = []);
        actionList.push({ fn: cb, scope: scope || null });
      }
    }

    return this;
  }
};

module.exports = Walker;
