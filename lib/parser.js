var Lexer = require("./lexer"),
    preprocessor = require("./preprocessor"),
    language_features = require("./language_features"),
    _ = require("lodash");

/**
 * Expose `makeParser()`.
 */
exports = module.exports = makeParser;

/**
 * Parser errors
 */
function ParseError(token, message) {
    this.name = "ParseError";
    this.message = message || "Parsing terminated due to error.";
    this.token = token;
}

ParseError.prototype = Object.create(Error.prototype);
ParseError.prototype.constructor = ParseError;

function getHumanTokenVal(token) {
    if (token.id === "(end)") {
        return "end of input";
    }

    return "'" + token.value + "'";
}

var token_error = function(t, message) {
    var line = t.loc && t.loc.start ? t.loc.start.line : JSON.stringify(t);

    throw new ParseError(
        t,
        "Error at " + getHumanTokenVal(t) + " on line " + line + ": " + message
    );
};

/**
 * Make a new parser.
 * @return {object}
 */

function makeParser(options) {
    "use strict";
    options = options || {};

    var strict = !!options.strict;

    var whitespace = [],
        lex = null,
        scope,
        symbol_table = {},
        token,
        tokens,
        token_nr,
        NL = "(nl)",
        outerScope = null;

    /* Add operators here to assign special types,
        otherwise they will use BinaryExpression
        or UnaryExpression by default.
    */
    var operatorType = {
        "||": "LogicalExpression",
        "&&": "LogicalExpression",
        "^^": "LogicalExpression",
        "==": "RelationalExpression",
        "<": "RelationalExpression",
        "<=": "RelationalExpression",
        ">=": "RelationalExpression",
        ">": "RelationalExpression"
    };

    if (!options) {
        options = {
            unreachable_code_errors: false,
            additional_types: []
        };
    }

    var builtinTypes = language_features.builtin_types,
        reservedWords = language_features.reserved_words,
        opAlternates = language_features.op_alternates;

    if (options.additional_types && options.additional_types.length) {
        builtinTypes = _.union(
            builtinTypes,
            _.map(options.additional_types, function(f) {
                return f.toLowerCase();
            })
        );
    }

    var itself = function() {
        return this;
    };

    function skip_newlines() {
        while (token.arity === NL) {
            advance(NL);
        }
    }

    function eos() {
        advance(NL);
        skip_newlines();
    }

    var original_scope = {
        findLabelScope: function() {
            var e = this;

            while (e.parent) {
                if (!e.parent.parent) {
                    return e.parent;
                }
                e = e.parent;
            }
            return this;
        },
        findLabel: function(n) {
            var s = this.findLabelScope();
            var v = n.value.toLowerCase();
            return s.labels[v];
        },
        label: function(n) {
            var s = this.findLabelScope();
            var v = n.value.toLowerCase();
            var t = s.labels[v];

            if (_.indexOf(reservedWords, v) > -1) {
                token_error(n, n.value + " not expected here.");
            } else if (t) {
                token_error(
                    n,
                    "The label '" +
                        n.value +
                        "' has already been assigned to another statement in this function."
                );
            }
            s.labels[v] = n;
            n.scope = scope;
            return n;
        },
        define: function(n) {
            var v = n.value.toLowerCase();
            var t = this.def[v];

            if (_.indexOf(reservedWords, v) > -1) {
                token_error(n, n.value + " not expected here.");
            } else if (t) {
                token_error(
                    n,
                    n.value + " has already been defined in this scope."
                );
            }

            this.def[v] = n;
            n.reserved = false;
            n.nud = itself;
            n.led = null;
            n.std = null;
            n.lbp = 0;
            n.scope = scope;

            return n;
        },

        find: function(n) {
            // n is already lowercase...
            var e = this,
                o;

            while (true) {
                o = e.def[n];
                // if (o && typeof o !== "function") {
                if (o) {
                    return e.def[n];
                }
                e = e.parent;
                if (!e) {
                    o = symbol_table[n];
                    var rtn =
                        o && typeof o !== "function"
                            ? o
                            : symbol_table["(name)"];
                    return rtn;
                }
            }
        },

        pop: function() {
            scope = this.parent;
        },

        reserve: function(n) {
            if (n.arity !== "name" || n.reserved) {
                return;
            }
            var v = n.value.toLowerCase();

            var t = this.def[v];
            if (t) {
                if (t.reserved) {
                    return;
                }
                if (t.arity === "name") {
                    token_error(n, "Already defined.");
                }
            }
            this.def[v] = n;
            n.reserved = true;
        }
    };

    function new_scope() {
        var s = scope;
        scope = Object.create(original_scope);
        scope.def = {};
        scope.labels = {};
        scope.parent = s;
        return scope;
    }

    /**
     * Pushes last token back -- reverses advance()
     */
    function reverse() {
        token_nr -= 2;
        advance();
    }

    /**
     * Advances the token.
     * @param {string} [id] - ID to match.
     */
    function advance(id) {
        var a,
            o,
            t,
            v,
            vl,
            alt,
            decl = false,
            setDecl = false,
            assignType = null;

        if (id && token.id !== id) {
            token_error(token, "Expected '" + id + "'.");
        }

        if (token_nr >= tokens.length) {
            // this makes a final token -- but it needs location info.
            o = symbol_table["(end)"];
            token = Object.create(o);

            var lastTok = tokens[tokens.length - 1];

            if (lastTok) {
                token.range = _.clone(lastTok.range);
                token.loc = _.clone(lastTok.loc);
            }

            return;
        }

        t = tokens[token_nr];
        token_nr++;

        v = t.value;
        a = t.type;
        vl = v.toLowerCase();

        // check for operator alternates...
        if (a === "name" && opAlternates.hasOwnProperty(vl)) {
            vl = opAlternates[vl];
            a = "operator";
        }

        switch (a) {
            case "name":
                if (_.indexOf(builtinTypes, vl) !== -1) {
                    // built-in type ...
                    o = scope.find(vl);

                    // setDecl = true;

                    // these should always be in the symbol table.
                    if (o.arity === "name") {
                        // this means they have been redefined.
                        setDecl = true;
                        decl = true;
                    }
                } else {
                    o = scope.find(vl);

                    if (o === symbol_table["(name)"]) {
                        // We've never seen this name in this scope...
                        setDecl = true;
                    } else if (o.arity === "name") {
                        setDecl = true;
                        decl = true;
                    } else if (o.id) {
                        // use the id as the arity -- this is not a name -- probably a statement.
                        a = o.id;
                    }
                }

                break;
            case "operator":
                o = symbol_table[vl];
                if (!o) {
                    token_error(t, "Unknown operator.");
                }
                break;
            case "string":
            case "number":
                o = symbol_table["(literal)"];
                a = "literal";
                break;
            case "objref":
                o = symbol_table["(literal)"];
                a = "literal";
                assignType = "ObjRefLiteral";
                break;
            case NL:
                o = symbol_table[a];
                break;
            default:
                token_error(t, "Unexpected token.");
        }

        // create an object from the type defined in the symbol table.
        token = Object.create(o);
        token.range = _.clone(t.range);
        token.loc = _.clone(t.loc);
        token.value = v;
        token.arity = a;

        if (setDecl) {
            token.decl = decl;
        }

        if (assignType) {
            token.type = assignType;
        }

        return token;
    }

    var expression = function(rbp) {
        var left;
        var t = token;

        // We shouldn't find statement reserved words here...
        if (t.std && t.reservedWord) {
            token_error(t, t.value + " not expected here.");
        }

        advance();
        left = t.nud();
        while (rbp < token.lbp) {
            t = token;
            advance();
            left = t.led(left);
        }
        return left;
    };

    function statement() {
        var n = token,
            v,
            eosTok;

        // try to match labels...
        if (n.arity === "name") {
            advance();

            if (token.id === ":") {
                advance(":");
                scope.label(n); // this also prevents reserved words from being labels.
                n.label = true;
                n.type = "LabelStatement";
                skip_newlines();
                return n;
            }

            if (_.indexOf(builtinTypes, n.value.toLowerCase()) > -1) {
                // if the next character is a name, this is probably a declaration.
                if (token.arity === "name") {
                    return declaration(n);
                } else if (token.id === NL) {
                    // a variable type is allowed to be alone on a line --- essentially a noop.
                    eos();

                    return {
                        type: "ExpressionStatement",
                        range: n.range,
                        loc: n.loc,
                        expression: n,
                        arity: "statement"
                    };
                }
            }

            // reverse and parse as a statement or an expression.
            reverse();
        }

        // if our token has a std function it is one of our statements.
        if (n.std) {
            advance();
            return n.std();
        }

        // anything else will be a statement expression
        return statementExpression();
    }

    var statementExpression = function() {
        var v = expression(0);

        eos();

        // if it's an expression statement, wrap it in an EpressionStatement.
        return {
            type: "ExpressionStatement",
            range: [v.range[0], v.range[1]],
            loc: { start: v.loc.start, end: v.loc.end },
            expression: v,
            arity: "statement"
        };
    };

    var statements = function() {
        var a = [],
            s,
            topLevel = false;

        while (true) {
            if (
                token.id === "end" ||
                token.id === "(end)" ||
                token.id === "else" ||
                token.id === "elseif" ||
                token.id === "until"
            ) {
                break;
            }

            if (!scope.parent && !scope.pseudo) {
                // top level scope.
                if (token.arity !== "function") {
                    token_error(
                        token,
                        "Statements must be within a function or at the beginning of a script."
                    );
                }
            }

            s = statement();

            if (s) {
                if (scope.pseudo) {
                    // for statements in the 'master' pseudo-function,
                    // add scope so we can resolve function calls later.
                    s.scope = scope;
                }

                a.push(s);
            }
        }

        if (a.length === 0) {
            a = null;
        }
        return a;
    };

    var original_symbol = {
        nud: function() {
            if (this.arity === "name") {
                // console.warn("%s was not defined", this.value);
                return this;
            }

            token_error(this, "Error parsing this statement.");
        },
        led: function(left) {
            token_error(this, "Missing operator.");
        }
    };

    var symbol = function(id, bp) {
        var s = symbol_table[id];
        bp = bp || 0;
        if (s) {
            if (bp >= s.lbp) {
                s.lbp = bp;
            }
        } else {
            s = Object.create(original_symbol);
            s.id = s.value = id;
            s.lbp = bp;
            symbol_table[id] = s;
        }
        return s;
    };

    var getLocStart = function(ref) {
        if (ref && ref.loc) {
            return ref.loc.start;
        }
        return null;
    };

    var getLocEnd = function(ref) {
        if (ref && ref.loc) {
            return ref.loc.end;
        }
        return null;
    };

    var constant = function(s, v) {
        var x = symbol(s);
        x.nud = function() {
            scope.reserve(this);
            this.value = symbol_table[this.id].value;
            this.arity = "literal";
            return this;
        };
        x.value = v;
        return x;
    };

    var infix = function infix(id, bp, led) {
        var s = symbol(id, bp);
        s.led =
            led ||
            function infix_left(left) {
                this.left = left;
                this.right = expression(bp);
                this.arity = "binary";
                this.type = operatorType[id] || "BinaryExpression";
                this.operator = this.id;

                this.range = [this.left.range[0], this.right.range[1]];
                this.loc = {
                    start: getLocStart(this.left),
                    end: getLocEnd(this.right)
                };

                return this;
            };
        return s;
    };

    var infixr = function infixr(id, bp, led) {
        var s = symbol(id, bp);
        s.led =
            led ||
            function left(left) {
                this.left = left;
                this.right = expression(bp - 1);
                this.arity = "binary";
                this.type = operatorType[id] || "BinaryExpression";
                this.operator = this.id;

                this.range = [this.left.range[0], this.right.range[1]];
                this.loc = {
                    start: getLocStart(this.left),
                    end: getLocEnd(this.right)
                };

                return this;
            };
        return s;
    };

    var assignment = function assignment(id) {
        return infixr(id, 10, function assignment_infixr(left) {
            if (
                left.id !== "." &&
                left.id !== "[" &&
                left.id !== "$" &&
                left.id !== "$$" &&
                left.arity !== "name"
            ) {
                token_error(left, "Bad lvalue.");
            }

            this.left = left;
            this.right = expression(9);
            this.assignment = true;
            this.arity = "binary";

            this.type = "AssignmentExpression";
            this.operator = this.id;

            this.range = [this.left.range[0], this.right.range[1]];
            this.loc = {
                start: getLocStart(this.left),
                end: getLocEnd(this.right)
            };

            return this;
        });
    };

    var prefix = function prefix(id, nud) {
        var s = symbol(id);
        s.nud =
            nud ||
            function() {
                scope.reserve(this);
                this.argument = expression(70);
                this.arity = "unary";
                this.type = operatorType[id] || "UnaryExpression";
                this.operator = this.id;
                this.prefix = true;
                this.range = [this.range[0], this.argument.range[1]];
                this.loc = {
                    start: getLocStart(this),
                    end: getLocEnd(this.argument)
                };

                return this;
            };
        return s;
    };

    var prefix2 = function prefix2(id, nud) {
        var s = symbol(id);
        s.nud =
            nud ||
            function() {
                scope.reserve(this);
                this.argument = expression(90);
                this.arity = "unary";
                this.type = operatorType[id] || "UnaryExpression";
                this.operator = this.id;
                this.range = [this.range[0], this.argument.range[1]];
                this.loc = {
                    start: getLocStart(this),
                    end: getLocEnd(this.argument)
                };

                return this;
            };
        return s;
    };

    var prefix_infix = function prefix_infix(id, bp, nud, led) {
        var s = symbol(id, bp);
        s.nud = nud;
        s.led = led || nud;
        return s;
    };

    var stmt = function stmt(s, f) {
        var x = symbol(s);

        x.nud = function() {
            token_error(this, s + " statement not expected here");

            /* 
            scope.reserve(this);
            this.expression = expression(70);
            this.arity = "unary";
            return this;
            */
        };
        x.std = f;
        return x;
    };

    // symbols for all builtin-types
    _.each(builtinTypes, symbol);

    // add reserved words to the symbol table.
    reservedWords.forEach(function(r) {
        var t = symbol_table[r];
        if (typeof t === "object") {
            t.reservedWord = true;
        }
    });

    // misc symbols
    symbol(NL);
    symbol("end");
    symbol("(end)");
    symbol("(name)");
    symbol("...");
    symbol(":");
    symbol(";");
    symbol(")");
    symbol("]");
    symbol("}");
    symbol(",");
    symbol("else");
    symbol("until");
    symbol("case");
    symbol("default");
    symbol("to");
    symbol("downto");
    symbol("by");

    // misc constants.
    constant("true", true);
    constant("false", false);
    constant("undefined", null);

    // make literals match themselves.
    symbol("(literal)").nud = itself;

    // this
    symbol("this").nud = function this_nud() {
        scope.reserve(this);
        this.arity = "this";
        this.type = "ThisExpression";
        return this;
    };

    /* Operators */
    assignment("=");
    assignment("+=");
    assignment("-=");
    assignment("*=");
    assignment("/=");
    assignment("%=");
    assignment("&=");
    assignment("|=");
    assignment("^=");

    infix("?", 20, function infix_question(left) {
        this.test = left;
        this.consequent = expression(0);
        advance(":");
        this.alternate = expression(0);

        this.type = "ConditionalExpression";
        this.arity = "ternary";
        this.range = [this.test.range[0], this.alternate.range[1]];
        this.loc = {
            start: getLocStart(this.test),
            end: getLocEnd(this.alternate)
        };
        return this;
    });

    infixr("&", 15);
    infixr("|", 15);
    infixr("^", 15);

    infixr("and", 30);
    infixr("or", 30);
    infixr("&&", 30);
    infixr("||", 30);
    infixr("^^", 30);

    infixr("==", 40);
    infixr("!=", 40);
    infixr("<>", 40);
    infixr("<", 40);
    infixr("<=", 40);
    infixr(">", 40);
    infixr(">=", 40);

    infixr("<<", 45);
    infixr(">>", 45);

    infix("in", 50);

    infix("+", 50);
    infix("-", 50);
    infix("*", 60);
    infix("/", 60);
    infix("%", 60);

    prefix_infix(".", 80, function prefix_infix_dot(left) {
        // infix version.
        this.object = left || null;

        if (token.id === "(") {
            advance("(");
            this.property = expression(10);
            this.computed = true;

            var end = token;
            advance(")");

            this.range = [(this.object || this).range[0], end.range[1]];
            this.loc = {
                start: getLocStart(this.object || this),
                end: getLocEnd(end)
            };
        } else {
            token.arity = "literal";
            this.property = token;
            this.computed = false;
            advance();

            this.range = [
                (this.object || this).range[0],
                this.property.range[1]
            ];
            this.loc = {
                start: getLocStart(this.object || this),
                end: getLocEnd(this.property)
            };
        }

        this.type = "MemberExpression";
        this.arity = "binary";
        return this;
    });

    prefix_infix(
        "[",
        80,
        function prefix_infix_open_sqr_bracket() {
            var name = "",
                start = token;

            while (token.id === "." || token.arity === "name") {
                name += token.value;
                advance();
            }

            var end = token;
            advance("]");

            this.argument = name;
            this.id = "xlate";
            this.arity = "unary";
            this.type = "XLateExpression";
            this.range = [start.range[0], end.range[1]];
            this.loc = { start: getLocStart(start), end: getLocEnd(end) };

            return this;
        },
        function(left) {
            // first should resolve to some object.
            this.object = left;

            var range = _.clone(this);

            if (token.id === ":") {
                // range specifier with empty start index.

                this.fromIndex = null;
                this.toIndex = null;
                this.type = "RangeExpression";

                advance(":");

                if (token.id !== "]") {
                    this.toIndex = expression(0);
                }
            } else {
                // range/index specifier.
                var e = expression(0);

                if (token.id === ":") {
                    // range specifier
                    this.fromIndex = e;
                    this.toIndex = null;
                    this.type = "RangeExpression";

                    advance(":");

                    if (token.id !== "]") {
                        this.toIndex = expression(0);
                    }

                    this.type = "RangeExpression";
                } else {
                    // index specifier.
                    this.index = e;
                    this.type = "IndexExpression";
                }
            }

            this.arity = "binary";
            var end = token;
            advance("]");

            this.range = [this.object.range[0], end.range[1]];
            this.loc = { start: getLocStart(this.object), end: getLocEnd(end) };

            return this;
        }
    );

    infix("(", 80, function(left) {
        var a = [];
        if (left.id === "." || left.id === "[") {
            // function call on member or index
            this.arity = "binary";
            this.callee = left;
            this.arguments = a;
            this.type = "CallExpression";
        } else {
            this.arity = "binary";
            this.callee = left;
            this.arguments = a;
            this.type = "CallExpression";

            if (
                (left.arity !== "unary" || left.id !== "function") &&
                left.arity !== "name" &&
                left.id !== "(" &&
                left.id !== "&&" &&
                left.id !== "||" &&
                left.id !== "?" &&
                left.id !== "$" &&
                left.id !== "$$"
            ) {
                token_error(left, "Expected a variable name.");
            }
        }
        if (token.id !== ")") {
            while (true) {
                a.push(expression(0));
                if (token.id !== ",") {
                    break;
                }
                advance(",");
            }
        }

        var end = token;
        advance(")");

        this.range = [this.callee.range[0], end.range[1]];
        this.loc = { start: getLocStart(this.callee), end: getLocEnd(end) };

        return this;
    });

    prefix2("$$", function() {
        scope.reserve(this);

        if (token.arity === "name") {
            this.argument = token;
            this.argument.arity = "literal"; // treat this as a literal string.
            advance();
        } else {
            this.argument = expression(90);
        }

        this.arity = "unary";
        this.type = operatorType["$$"] || "UnaryExpression";
        this.operator = this.id;
        this.prefix = true;
        this.range = [this.range[0], this.argument.range[1]];
        this.loc = { start: getLocStart(this), end: getLocEnd(this.argument) };

        return this;
    });

    prefix2("$", function() {
        scope.reserve(this);

        if (token.arity === "name") {
            this.argument = token;
            this.argument.arity = "literal"; // treat this as a literal string.
            advance();
        } else {
            this.argument = expression(90);
        }

        this.arity = "unary";
        this.type = operatorType["$"] || "UnaryExpression";
        this.operator = this.id;
        this.prefix = true;
        this.range = [this.range[0], this.argument.range[1]];
        this.loc = { start: getLocStart(this), end: getLocEnd(this.argument) };

        return this;
    });

    prefix("!");
    prefix("-");
    prefix("~");

    prefix("#", function() {
        // this is a special case where the following
        // identifier should be treated as a literal
        // hex value.

        if (token.arity === "name" && /^[a-fA-F0-9]+$/.test(token.value)) {
            this.arity = "literal";
            this.value = "#" + token.value;
            this.id = "(literal)";
            this.type = "ObjRefLiteral";

            this.range = [this.range[0], token.range[1]];
            this.loc = { start: getLocStart(this), end: getLocEnd(token) };

            advance();
        } else {
            token_error(token, "Expected hexadecimal value");
        }

        return this;
    });

    prefix("{", function() {
        var a = [];
        if (token.id !== "}") {
            while (true) {
                a.push(expression(0));
                if (token.id !== ",") {
                    break;
                }
                advance(",");
            }
        }

        var end = token;
        advance("}");

        this.elements = a;
        this.arity = "unary";
        this.type = "ListExpression";
        this.range = [this.range[0], end.range[1]];
        this.loc = { start: getLocStart(this), end: getLocEnd(end) };

        return this;
    });

    // () grouping...
    prefix("(", function() {
        var e = expression(0);

        var end = token;
        advance(")");

        e.range = [this.range[0], end.range[1]];
        e.loc = { start: getLocStart(this), end: getLocEnd(end) };

        return e;
    });

    /* Statements */

    stmt("function", function() {
        var a = [];
        var token1, nameToken;

        if (scope.parent && scope.pseudo) {
            // end implied "master" function.
            scope.pop();
        } else if (scope.parent) {
            token_error(token, "Functions cannot be nested");
        }

        new_scope();

        // Handle undocumented feature -- token nodebug can appear after Function...
        if (token.arity === "name" && token.value.toLowerCase() === "nodebug") {
            // ... just skip this token and set a property called nodebug...
            this.nodebug = true;
            advance();
        }

        // this token can be the return type or the function name...
        if (token.arity === "name") {
            // either return type or name of function
            token1 = token;
            advance();
        } else {
            token_error(token, "Expected name of function or return type");
        }

        this.scope = scope;

        if (token.arity === "name") {
            // This can only be the function name.
            this.name = token.value;
            this.returnType = token1.value;
            this.dataType = token1;
            nameToken = token;
            advance();
        } else {
            // no return type for function -- the return type token becomes the function name.
            this.name = token1.value;
            nameToken = token1;
        }

        this.nameToken = nameToken;

        nameToken.function = true;

        // define the function name in the parent scope.
        scope.parent.define(nameToken);

        // arguments...
        advance("(");
        if (token.id !== ")") {
            while (true) {
                if (token.arity === "operator" && token.value === "...") {
                    // this must be the last argument.
                    a.push(token);
                    advance();
                    break;
                } else if (token.arity !== "name") {
                    token_error(token, "Expected a parameter definition.");
                }

                var varName, varType, t;

                varType = token;
                advance();

                var param = {
                    dataType: null,
                    name: "",
                    default: null
                };

                if (token.arity === "name") {
                    // variable name/type was supplied.
                    varName = token;
                    param.dataType = varType;
                    advance();
                } else {
                    // the varType was actually the name.
                    varName = varType;
                }

                scope.define(varName);
                param.name = varName;

                if (token.id === "=") {
                    advance("=");
                    param["default"] = expression(0);
                }

                a.push(param);

                if (token.id !== ",") {
                    break;
                }
                advance(",");
            }
        }
        this.params = a;

        advance(")");
        eos();

        this.body = statements();

        var end = token;
        advance("end");
        eos();

        scope.pop();

        this.type = "FunctionDeclaration";
        this.arity = "function";
        this.range = [this.range[0], end.range[1]];
        this.loc = { start: getLocStart(this), end: getLocEnd(end) };

        return this;
    });

    function declaration(varType) {
        var a = [],
            n,
            t,
            last;

        var declarator = {
            type: "VariableDeclaration",
            declarations: a,
            declType: varType
        };

        while (true) {
            // n is name of variable.
            n = last = token;
            if (n.arity !== "name") {
                token_error(n, "Expected a new variable name.");
            }

            t = {
                type: "VariableDeclarator",
                name: n,
                init: null,
                dataType: varType
            };

            scope.define(n);
            advance();

            if (token.id === "=") {
                // declaration with assignment.
                advance("=");
                t.init = expression(0);
                last = t.init;
            }

            a.push(t);

            if (token.id !== ",") {
                break;
            }
            advance(",");
        }

        var eosToken = token;
        eos();

        declarator.range = [varType.range[0], last.range[1]];
        declarator.loc = { start: getLocStart(varType), end: getLocEnd(last) };

        return declarator;
    }

    var ifElseIf = function() {
        this.type = this.id === "if" ? "IfStatement" : "ElseifStatement";

        this.test = expression(0);
        eos();

        new_scope();
        this.consequent = statements();
        scope.pop();

        skip_newlines();

        if (token.id === "elseif") {
            // The alternate will be an elseif statement.
            this.alternate = statement();

            this.arity = "statement";
            this.range = [this.range[0], this.alternate.range[1]];
            this.loc = {
                start: getLocStart(this),
                end: getLocEnd(this.alternate)
            };

            // final 'end' has already been matched by the elseif.
            return this;
        } else if (token.id === "else") {
            advance("else");
            eos();

            // the alternate is an array of zero or more statements.
            new_scope();
            this.alternate = statements();
            scope.pop();
        }

        var end = token;
        advance("end");
        eos();

        this.range = [this.range[0], end.range[1]];
        this.loc = { start: getLocStart(this), end: getLocEnd(end) };

        this.arity = "statement";
        return this;
    };

    stmt("if", ifElseIf);
    stmt("elseif", ifElseIf);

    stmt("return", function() {
        if (token.id !== NL) {
            this.argument = expression(0);
        }

        eos();

        if (
            token.id !== "end" &&
            token.id !== "elseif" &&
            token.id !== "else" &&
            token.id !== "(end)"
        ) {
            if (options.unreachable_code_errors) {
                token_error(token, "Unreachable statement.");
            }
        }

        this.range = [
            this.range[0],
            this.argument ? this.argument.range[1] : this.range[1]
        ];
        this.loc = {
            start: getLocStart(this),
            end: getLocEnd(this.argument || this)
        };
        this.type = "ReturnStatement";
        this.arity = "statement";
        return this;
    });

    stmt("break", function() {
        eos();

        if (
            token.id !== "end" &&
            token.id !== "elseif" &&
            token.id !== "else" &&
            token.id !== "(end)"
        ) {
            if (options.unreachable_code_errors) {
                token_error(token, "Unreachable statement.");
            }
        }
        this.arity = "statement";
        this.type = "BreakStatement";

        return this;
    });

    stmt("breakif", function() {
        this.argument = expression(0);
        eos();

        this.arity = "statement";
        this.range = [this.range[0], this.argument.range[1]];
        this.loc = { start: getLocStart(this), end: getLocEnd(this.argument) };
        this.type = "BreakIfStatement";

        return this;
    });

    stmt("continue", function() {
        eos();

        if (
            token.id !== "end" &&
            token.id !== "elseif" &&
            token.id !== "else" &&
            token.id !== "(end)"
        ) {
            if (options.unreachable_code_errors) {
                token_error(token, "Unreachable statement.");
            }
        }

        this.arity = "statement";
        this.type = "ContinueStatement";
        return this;
    });

    stmt("continueif", function() {
        this.argument = expression(0);
        eos();

        this.arity = "statement";
        this.range = [this.range[0], this.argument.range[1]];
        this.loc = { start: getLocStart(this), end: getLocEnd(this.argument) };
        this.type = "ContinueIfStatement";

        return this;
    });

    stmt("while", function() {
        this.test = expression(0);
        eos();

        new_scope();
        this.body = statements();
        scope.pop();

        var end = token;
        advance("end");

        eos();

        this.arity = "statement";

        this.range = [this.range[0], end.range[1]];
        this.loc = { start: getLocStart(this), end: getLocEnd(end) };
        this.type = "WhileStatement";

        return this;
    });

    stmt("repeat", function() {
        eos();

        new_scope();
        this.body = statements();
        scope.pop();

        advance("until");

        this.test = expression(0);

        eos();

        this.arity = "statement";
        this.range = [this.range[0], this.test.range[1]];
        this.loc = { start: getLocStart(this), end: getLocEnd(this.test) };
        this.type = "RepeatStatement";

        return this;
    });

    stmt("for", function() {
        if (token.id === "(") {
            advance("(");

            // c-style for loop.
            this.first = token.id !== NL ? expression(0) : null;
            advance(NL);

            this.second = token.id !== NL ? expression(0) : null;
            advance(NL);

            this.third = token.id !== ")" ? expression(0) : null;

            advance(")");
            eos();

            new_scope();
            this.body = statements();
            scope.pop();

            this.id = "for_c";
            this.type = "ForCStyleStatement";
        } else if (token.arity === "name") {
            // for "x in" or for "x = 1 ..."

            this.first = token;
            advance();

            if (token.id === "=") {
                advance("=");
                this.second = expression(0);

                if (token.id === "to" || token.id === "downto") {
                    this.direction = token;
                    advance();
                }

                this.third = expression(0);

                if (token.id === "by") {
                    advance("by");
                    this.increment = expression(0);
                }

                eos();

                new_scope();
                this.body = statements();
                scope.pop();

                this.id = "for";
                this.type = "ForStatement";
            } else if (token.id === "in") {
                reverse();
                this.first = expression(0);
                eos();

                new_scope();
                this.body = statements();
                scope.pop();

                this.id = "for_in";
                this.type = "ForInStatement";
            } else {
                token_error(token, "Unexpected token.  Expected 'in' or '='.");
            }
        } else {
            token_error(
                token,
                "Unexpected token. Expected '(' or a variable name."
            );
        }

        var end = token;
        advance("end");
        eos();

        this.arity = "statement";

        this.range = [this.range[0], end.range[1]];
        this.loc = { start: getLocStart(this), end: getLocEnd(end) };

        return this;
    });

    stmt("switch", function() {
        this.discriminant = expression(0);
        eos();

        var c, e, s, end;
        this.cases = [];

        while (true) {
            if (token.id === "case") {
                c = token;
                c.test = [];
                advance("case");

                // match 1 or more case values separated by commas.
                while (true) {
                    e = expression(0);
                    c.test.push(e);
                    if (token.id !== ",") {
                        break;
                    }
                    advance(",");
                }
            } else if (token.id === "default") {
                c = token;
                c.test = null;
                advance("default");
            } else break;

            eos();

            new_scope();
            c.consequent = statements();
            c.arity = "binary";
            scope.pop();

            // end of case or default
            end = token;
            advance("end");

            c.type = "SwitchCase";
            c.range = [c.range[0], end.range[1]];
            c.loc = { start: getLocStart(c), end: getLocEnd(end) };

            this.cases.push(c);

            eos();
        }

        // end of switch
        end = token;
        advance("end");

        eos();

        this.arity = "statement";
        this.range = [this.range[0], end.range[1]];
        this.loc = { start: getLocStart(this), end: getLocEnd(end) };
        this.type = "SwitchStatement";

        return this;
    });

    // hopefully not.
    stmt("goto", function() {
        if (token.arity === "name") {
            this.argument = token;
            token.scope = scope;
        } else {
            token_error(token, "Expected label");
        }
        this.arity = "unary";
        this.type = "GotoStatement";
        advance();
        eos();
        return this;
    });

    function addEOIToken(toks) {
        if (toks.length > 0) {
            var lastToken = toks[toks.length - 1];
            if (lastToken.type !== NL) {
                var lastTokenEndPos = lastToken.range[1],
                    lastTokLoc = getLocEnd(lastToken);

                toks.push({
                    type: NL,
                    value: "",
                    range: [lastTokenEndPos + 1, lastTokenEndPos + 1],
                    loc: {
                        start: {
                            line: lastTokLoc.line,
                            col: lastTokLoc.col + 1
                        },
                        end: { line: lastTokLoc.line, col: lastTokLoc.col + 1 }
                    }
                });
            }
        }
        return toks;
    }

    return {
        getTokens: function() {
            return tokens;
        },

        getSource: function() {
            return lex ? lex.getSource() : "";
        },

        getWhitespace: function() {
            return lex ? lex.getWhitespace() : [];
        },

        parse: function parse(source) {
            var t;

            // reset state
            scope = null;
            token = null;
            tokens = [];
            token_nr = 0;

            // Init the lexer and read all the tokens into our token buffer.
            lex = new Lexer(source);
            while ((t = lex.get()) !== null) {
                tokens.push(t);
            }

            // send through preprocessor...
            tokens = preprocessor.run(tokens);

            // if the program doesn't end with some kind of end-of-statement character, add one.
            tokens = addEOIToken(tokens);

            // init and parse.
            new_scope();

            _.each(language_features.declarations, function(f) {
                scope.define(f);
            });

            reservedWords.forEach(function(r) {
                scope.reserve(r);
            });

            advance();

            // skip any leading whitespace...
            skip_newlines();

            // check if there is a "main" function (not wrapped in named function).
            if (tokens.length && token.arity !== "function") {
                // non-function first statement -- so create a pseudo function scope.
                new_scope();
                scope.pseudo = true;
            }

            // process all statements.
            var s = statements();

            advance("(end)");
            scope.pop();
            return s;
        }
    };
}
