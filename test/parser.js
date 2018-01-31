var assert = require("assert"),
  fs = require("fs"),
  makeParser = require("..").Parser,
  language_features = require("../lib/language_features"),
  compare = require("../lib/compare"),
  should = require("should/as-function"),
  stringify = require("json-stringify-safe");

function comp(actual, expected) {
  if (compare(actual, expected) === false) {
    should(actual).eql(expected);
  }
}

var Parser = makeParser();
var StrictParser = makeParser({ strict: true });

describe("Parser", function() {
  describe("#parse()", function() {
    it("should parse empty string", function() {
      should(Parser.parse("")).be.null;
    });
    it("should parse empty functions", function() {
      comp(Parser.parse("function x(); end"), [
        { type: "FunctionDeclaration", name: "x", body: null }
      ]);
    });
    it("should parse functions with parameters", function() {
      comp(Parser.parse("function x(p1,p2); end"), [
        {
          type: "FunctionDeclaration",
          name: "x",
          body: null,
          params: [{ name: { value: "p1" } }, { name: { value: "p2" } }]
        }
      ]);
    });
    it("should parse functions with parameters that have default values", function() {
      comp(Parser.parse("function x(String p1,Integer p2=1); end"), [
        {
          type: "FunctionDeclaration",
          name: "x",
          body: null,
          params: [
            { dataType: "String", name: { value: "p1" } },
            { name: { value: "p2" }, default: { value: "1" } }
          ]
        }
      ]);
    });
    it("should parse functions with variable arguments", function() {
      comp(Parser.parse("function x(String p1,Integer p2=1, ... ); end"), [
        {
          type: "FunctionDeclaration",
          name: "x",
          body: null,
          params: [
            { dataType: "String", name: { value: "p1" } },
            { name: { value: "p2" }, default: { value: "1" } },
            { id: "..." }
          ]
        }
      ]);
    });
    it("should parse return values from functions", function() {
      comp(Parser.parse("function Integer x(Integer y); return y+1; end"), [
        {
          type: "FunctionDeclaration",
          name: "x",
          body: [
            {
              type: "ReturnStatement",
              argument: { type: "BinaryExpression" }
            }
          ]
        }
      ]);
    });
    it("should parse functions that use nodebug", function() {
      comp(
        Parser.parse("function nodebug Integer x(Integer y); return y+1; end"),
        [
          {
            type: "FunctionDeclaration",
            name: "x",
            nodebug: true,
            body: [
              {
                type: "ReturnStatement",
                argument: { type: "BinaryExpression" }
              }
            ]
          }
        ]
      );
    });
    it("should parse c-style for loops", function() {
      comp(Parser.parse("for( i = 0; i < 10; i += 1 ); end;"), [
        { type: "ForCStyleStatement" }
      ]);
    });
    it("should parse for-in loops", function() {
      comp(Parser.parse("for i in { 1, 2, 3 }; end;"), [
        { type: "ForInStatement" }
      ]);
    });
    it("should parse for loops", function() {
      comp(Parser.parse("\n for i = 0 to 100\n end\n"), [
        { type: "ForStatement" }
      ]);
    });
    it("should parse repeat loops", function() {
      comp(Parser.parse("repeat; i = i + 1; until( i > 10 );"), [
        { type: "RepeatStatement" }
      ]);
    });
    it("should parse while loops", function() {
      comp(Parser.parse("while i > 0; i -= 2; end;"), [
        { type: "WhileStatement" }
      ]);
    });
    it("should parse switch statements", function() {
      comp(Parser.parse("switch i; case 1; echo( 'test' ); end; end;"), [
        { type: "SwitchStatement" }
      ]);
    });
    it("should parse empty switch statements", function() {
      comp(Parser.parse("switch i; end;"), [
        { type: "SwitchStatement", cases: [] }
      ]);
    });
    it("should parse switch statement with case with multiple tests", function() {
      comp(Parser.parse("switch i; case 1, 2\n echo( 'test' ); end; end;"), [
        {
          type: "SwitchStatement",
          cases: [{ test: [{ value: 1 }, { value: 2 }] }]
        }
      ]);
    });
    it("should parse switch statements with default", function() {
      comp(Parser.parse("switch i;default; end; end;"), [
        { type: "SwitchStatement", cases: [{ test: null }] }
      ]);
    });
    it("should parse if statements", function() {
      comp(Parser.parse("if i == 23; end;"), [
        {
          type: "IfStatement",
          test: { type: "RelationalExpression" },
          consequent: null
        }
      ]);
    });
    it("should parse if/else statements", function() {
      comp(
        Parser.parse("if i == 23; echo( true ); else; echo( false ); end;"),
        [
          {
            type: "IfStatement",
            test: { type: "RelationalExpression" },
            consequent: [{ type: "ExpressionStatement" }],
            alternate: [{ type: "ExpressionStatement" }]
          }
        ]
      );
    });
    it("should parse if/elseif statements", function() {
      comp(
        Parser.parse(
          "if i == '23' + \"fdsa\"; echo( true ); elseif y; echo( false ); end;"
        ),
        [
          {
            type: "IfStatement",
            test: { type: "RelationalExpression" },
            consequent: [{ type: "ExpressionStatement" }],
            alternate: { type: "ElseifStatement", id: "elseif" }
          }
        ]
      );
    });
    it("should parse if/elseif/else statements", function() {
      comp(
        Parser.parse(
          "if i == 23.0 + 123.001 + .1 + 0.1; echo( true );  elseif y; echo( false );else;echo('else'); end;"
        ),
        [
          {
            type: "IfStatement",
            test: { type: "RelationalExpression" },
            consequent: [{ type: "ExpressionStatement" }],
            alternate: {
              type: "ElseifStatement",
              id: "elseif",
              alternate: [{ type: "ExpressionStatement" }]
            }
          }
        ]
      );
    });
    it("should parse function calls", function() {
      comp(Parser.parse("x()"), [
        {
          type: "ExpressionStatement",
          expression: { type: "CallExpression", callee: { value: "x" } }
        }
      ]);
    });
    it("should parse function calls with one argument", function() {
      comp(Parser.parse("x(1)"), [
        {
          type: "ExpressionStatement",
          expression: {
            type: "CallExpression",
            callee: { value: "x" },
            arguments: [{ value: "1" }]
          }
        }
      ]);
    });
    it("should parse function calls with multiple arguments", function() {
      comp(Parser.parse("x(1,2)"), [
        {
          type: "ExpressionStatement",
          expression: {
            type: "CallExpression",
            callee: { value: "x" },
            arguments: [{ value: "1" }, { value: "2" }]
          }
        }
      ]);
    });
    it("should parse member expressions", function() {
      comp(Parser.parse("x.y"), [
        {
          type: "ExpressionStatement",
          expression: {
            type: "MemberExpression",
            object: { value: "x" },
            property: { value: "y" }
          }
        }
      ]);
    });
    it("should parse complex member expressions", function() {
      comp(Parser.parse("x.( a + b + c + y )"), [
        {
          type: "ExpressionStatement",
          expression: {
            type: "MemberExpression",
            computed: true,
            object: { value: "x" },
            property: { type: "BinaryExpression" }
          }
        }
      ]);
    });
    it("should parse member expression calls", function() {
      comp(Parser.parse("x.( a + b + c + y )()"), [
        {
          type: "ExpressionStatement",
          expression: {
            type: "CallExpression",
            callee: { type: "MemberExpression", computed: true }
          }
        }
      ]);
    });
    it("should parse member expression calls with arguments", function() {
      comp(Parser.parse("x.( a + b + c + y )(1,2,3)"), [
        {
          type: "ExpressionStatement",
          expression: {
            type: "CallExpression",
            callee: { type: "MemberExpression", computed: true },
            arguments: [{ value: "1" }, { value: "2" }, { value: "3" }]
          }
        }
      ]);
    });
    it("should parse this variable", function() {
      comp(Parser.parse("this"), [
        { type: "ExpressionStatement", expression: { type: "ThisExpression" } }
      ]);
    });
    it("should parse implied this", function() {
      comp(Parser.parse(".func"), [
        {
          type: "ExpressionStatement",
          expression: { type: "MemberExpression", object: null }
        }
      ]);
    });
    it("should parse chained assignments", function() {
      comp(Parser.parse("a = b = c"), [
        {
          type: "ExpressionStatement",
          expression: {
            type: "AssignmentExpression",
            left: { value: "a" },
            right: {
              type: "AssignmentExpression",
              left: { value: "b" },
              right: { value: "c" }
            }
          }
        }
      ]);
    });
    ["=", "+=", "-=", "*=", "/=", "%=", "^=", "&=", "|="].forEach(function(op) {
      it("should parse assignment operator " + op, function() {
        comp(Parser.parse("x " + op + " y"), [
          {
            type: "ExpressionStatement",
            expression: {
              type: "AssignmentExpression",
              left: { value: "x" },
              right: { value: "y" },
              operator: op
            }
          }
        ]);
      });
    });
    ["+", "-", "*", "/", "%", "&", "|", "^", "in"].forEach(function(op) {
      it("should parse binary operator " + op, function() {
        comp(Parser.parse("x = y " + op + " z"), [
          {
            type: "ExpressionStatement",
            expression: {
              type: "AssignmentExpression",
              right: { type: "BinaryExpression", operator: op }
            }
          }
        ]);
      });
    });
    ["<", ">", "<=", ">=", "=="].forEach(function(op) {
      it("should parse relational operator " + op, function() {
        comp(Parser.parse("x = y " + op + " z"), [
          {
            type: "ExpressionStatement",
            expression: {
              type: "AssignmentExpression",
              right: { type: "RelationalExpression", operator: op }
            }
          }
        ]);
      });
    });
    ["&&", "||", "^^"].forEach(function(op) {
      it("should parse logical operator " + op, function() {
        comp(Parser.parse("x = x " + op + " z"), [
          {
            type: "ExpressionStatement",
            expression: {
              type: "AssignmentExpression",
              right: { type: "LogicalExpression", operator: op }
            }
          }
        ]);
      });
    });
    [
      ["lt", "<"],
      ["gt", ">"],
      ["and", "&&"],
      ["or", "||"],
      ["xor", "^^"]
    ].forEach(function(op) {
      it("should parse alternate operator name " + op[0], function() {
        comp(Parser.parse("x = x " + op[0] + " z"), [
          {
            type: "ExpressionStatement",
            expression: {
              type: "AssignmentExpression",
              right: { operator: op[1] }
            }
          }
        ]);
      });
    });
    ["!", "-", "~", "$", "$$"].forEach(function(op) {
      it("should parse unary operator " + op, function() {
        comp(Parser.parse("x =      " + op + " z"), [
          {
            type: "ExpressionStatement",
            expression: {
              type: "AssignmentExpression",
              right: { type: "UnaryExpression", operator: op }
            }
          }
        ]);
      });
    });
    [["not", "!"]].forEach(function(op) {
      it("should parse alternate unary operator " + op[0], function() {
        comp(Parser.parse("x =      " + op[0] + " z"), [
          {
            type: "ExpressionStatement",
            expression: {
              type: "AssignmentExpression",
              right: { type: "UnaryExpression", operator: op[1] }
            }
          }
        ]);
      });
    });
    it("should parse ternary expressions", function() {
      comp(Parser.parse("return x == 23 ? 1 : 2"), [
        {
          type: "ReturnStatement",
          argument: {
            type: "ConditionalExpression",
            test: { type: "RelationalExpression" },
            consequent: {},
            alternate: {}
          }
        }
      ]);
    });
    it("should parse global references", function() {
      comp(Parser.parse("$g.test"), [
        {
          type: "ExpressionStatement",
          expression: {
            type: "MemberExpression",
            object: { type: "UnaryExpression", id: "$" }
          }
        }
      ]);
    });
    it("should parse thread global references", function() {
      comp(Parser.parse("$$g.test"), [
        {
          type: "ExpressionStatement",
          expression: {
            type: "MemberExpression",
            object: { type: "UnaryExpression", id: "$$" }
          }
        }
      ]);
    });
    it("should parse break statement", function() {
      comp(Parser.parse("break"), [{ type: "BreakStatement" }]);
    });
    it("should parse continue statement", function() {
      comp(Parser.parse("continue"), [{ type: "ContinueStatement" }]);
    });
    it("should parse breakif statement", function() {
      comp(Parser.parse("breakif 123 > 2"), [
        { type: "BreakIfStatement", argument: { type: "RelationalExpression" } }
      ]);
    });
    it("should parse continueif statement", function() {
      comp(Parser.parse("continueif 123 > 2"), [
        {
          type: "ContinueIfStatement",
          argument: { type: "RelationalExpression" }
        }
      ]);
    });
    it("should parse index specifier", function() {
      comp(Parser.parse("array[123]"), [
        {
          type: "ExpressionStatement",
          expression: { type: "IndexExpression", index: { value: 123 } }
        }
      ]);
    });
    it("should parse range specifier", function() {
      comp(Parser.parse("string[1:15]"), [
        {
          type: "ExpressionStatement",
          expression: {
            type: "RangeExpression",
            fromIndex: { value: 1 },
            toIndex: { value: 15 }
          }
        }
      ]);
    });
    it("should parse range specifier with empty start", function() {
      comp(Parser.parse("string[:15]"), [
        {
          type: "ExpressionStatement",
          expression: {
            type: "RangeExpression",
            fromIndex: null,
            toIndex: { value: 15 }
          }
        }
      ]);
    });
    it("should parse range specifier with empty end", function() {
      comp(Parser.parse("string[1:]"), [
        {
          type: "ExpressionStatement",
          expression: {
            type: "RangeExpression",
            fromIndex: { value: 1 },
            toIndex: null
          }
        }
      ]);
    });
    it("should parse range specifier with empty start and end", function() {
      comp(Parser.parse("string[:]"), [
        {
          type: "ExpressionStatement",
          expression: {
            type: "RangeExpression",
            fromIndex: null,
            toIndex: null
          }
        }
      ]);
    });
    it("should parse labels", function() {
      comp(Parser.parse("label: x=2;"), [
        { id: "(name)", label: true, value: "label" }
      ]);
    });
    it("should parse gotos", function() {
      comp(Parser.parse("goto label"), [
        { type: "GotoStatement", argument: "label" }
      ]);
    });
    it("should parse object references (starting with number)", function() {
      comp(Parser.parse("return #0F623"), [
        {
          type: "ReturnStatement",
          argument: { type: "ObjRefLiteral", value: "#0F623" }
        }
      ]);
    });
    it("should parse object references (starting with hex letter)", function() {
      comp(Parser.parse("return #F6230; Integer F6230 = 123;"), [
        {
          type: "ReturnStatement",
          argument: { type: "ObjRefLiteral", value: "#F6230" }
        }
      ]);
    });
    it("should not allow object references to contain non-hex digits", function() {
      should(function() {
        Parser.parse("return #F6Z30");
      }).throw();
    });
    it("should parse xlates", function() {
      comp(Parser.parse("return [Object.Message]"), [
        { type: "ReturnStatement", argument: { type: "XLateExpression" } }
      ]);
    });
    it("should parse single variable declarations", function() {
      comp(Parser.parse("Integer i;"), [
        {
          type: "VariableDeclaration",
          declarations: [
            {
              type: "VariableDeclarator",
              name: { value: "i" },
              dataType: { value: "Integer" }
            }
          ]
        }
      ]);
    });
    it("should parse multi-variable declarations", function() {
      comp(Parser.parse("Integer i, j;"), [
        {
          type: "VariableDeclaration",
          declarations: [
            {
              type: "VariableDeclarator",
              name: { value: "i" },
              dataType: { value: "Integer" }
            },
            {
              type: "VariableDeclarator",
              name: { value: "j" },
              dataType: { value: "Integer" }
            }
          ]
        }
      ]);
    });
    it("should parse variable declarations with intializer", function() {
      comp(Parser.parse("Integer i = 23;"), [
        {
          type: "VariableDeclaration",
          declarations: [
            {
              type: "VariableDeclarator",
              name: { value: "i" },
              dataType: { value: "Integer" },
              init: { value: 23 }
            }
          ]
        }
      ]);
    });
    it("should parse multi-variable declarations with initializers", function() {
      comp(Parser.parse("Integer i=1, j=i;"), [
        {
          type: "VariableDeclaration",
          declarations: [
            {
              type: "VariableDeclarator",
              name: { value: "i" },
              dataType: { value: "Integer" },
              init: { value: 1 }
            },
            {
              type: "VariableDeclarator",
              name: { value: "j" },
              init: { value: "i" },
              dataType: { value: "Integer" }
            }
          ]
        }
      ]);
    });
    it("should not allow using reserved words as variable names", function() {
      should(function() {
        Parser.parse("switch = 123;");
      }).throw();
    });
    it("should not allow using reserved words as declared variable names", function() {
      should(function() {
        Parser.parse("Integer switch = 123;");
      }).throw();
    });
    it("should allow using variable type names as declared variable names", function() {
      comp(Parser.parse("Integer CAPI = x"), [
        {
          type: "VariableDeclaration",
          declarations: [
            {
              type: "VariableDeclarator",
              name: { value: "CAPI" },
              dataType: { value: "Integer" }
            }
          ]
        }
      ]);
    });
    it("should allow builtin types to be used as variable after declaring them as variable", function() {
      comp(Parser.parse("Integer CAPI = 0; CAPI += 1"), [
        {
          type: "VariableDeclaration",
          declarations: [
            {
              type: "VariableDeclarator",
              name: { value: "CAPI" },
              dataType: { value: "Integer" }
            }
          ]
        },
        {
          type: "ExpressionStatement",
          expression: {
            type: "AssignmentExpression",
            left: { value: "CAPI", id: "(name)" }
          }
        }
      ]);
    });
    it("should not allow reserved words to be used out of place in expressions", function() {
      should(function() {
        Parser.parse("x = switch + 1;");
      }).throw();
      should(function() {
        Parser.parse("if( until ); x = 1; end");
      }).not.throw();
    });
    it("should allow type names alone on a line", function() {
      comp(Parser.parse("Integer"), [{ type: "ExpressionStatement" }]);
    });
    it("should parse variable declarations for all the builtin types", function() {
      language_features.builtin_types.forEach(function(vType) {
        comp(Parser.parse(vType + " i = x"), [
          {
            type: "VariableDeclaration",
            declarations: [
              {
                type: "VariableDeclarator",
                name: { value: "i" },
                dataType: { value: vType }
              }
            ]
          }
        ]);
      });
    });
    it("should fail if declaring unknown variable types", function() {
      should(function() {
        Parser.parse("dummy i = x");
      }).throw();
    });
    it("should parse non-standard variable types if they are passed as additional types", function() {
      var P = makeParser({ additional_types: ["Dummy"] });
      comp(P.parse("dummy i = 23;"), [
        {
          type: "VariableDeclaration",
          declarations: [
            {
              type: "VariableDeclarator",
              name: { value: "i" },
              dataType: { value: "dummy" },
              init: { value: 23 }
            }
          ]
        }
      ]);
    });
    it("should parse chains of dots", function() {
      var P = makeParser();
      comp(P.parse('ctx.var( "Five", 5).stuff.more()'), [
        {
          arity: "statement",
          expression: {
            arguments: [],
            arity: "binary",
            callee: {
              arity: "binary",
              computed: false,
              loc: { end: { col: 29, line: 1 }, start: { col: 0, line: 1 } },
              object: {
                arity: "binary",
                computed: false,
                loc: { end: { col: 24, line: 1 }, start: { col: 0, line: 1 } },
                object: {
                  arguments: [
                    {
                      arity: "literal",
                      value: "Five"
                    },
                    {
                      arity: "literal",
                      value: "5"
                    }
                  ],
                  arity: "binary",
                  callee: {
                    arity: "binary",
                    computed: false,
                    loc: {
                      end: { col: 6, line: 1 },
                      start: { col: 0, line: 1 }
                    },
                    object: {
                      arity: "name",
                      value: "ctx"
                    },
                    property: {
                      arity: "literal",
                      value: "var"
                    },
                    range: [0, 6],
                    type: "MemberExpression",
                    value: "."
                  },
                  type: "CallExpression",
                  value: "("
                },
                property: {
                  arity: "literal",
                  value: "stuff"
                },
                type: "MemberExpression",
                value: "."
              },
              property: {
                arity: "literal",
                value: "more"
              },
              type: "MemberExpression",
              value: "."
            },
            type: "CallExpression",
            value: "("
          },
          type: "ExpressionStatement"
        }
      ]);
    });
    it("should parse a longer script", function() {
      var content = fs.readFileSync("./test/support/f1.Script", "utf-8");
      var result = Parser.parse(content);
      comp(result, [{ type: "VariableDeclaration" }]);
    });
    it("should require variable assignment or declaration", () => {
      should(function() {
        console.log(
          stringify(StrictParser.parse("String i; echo( i )"), null, 2)
        );
      }).not.throw();
    });
    it("wants a sandwich", () => {
      console.log(
        stringify(Parser.parse("Function x( Object ); End;"), null, 2)
      );
    });
    it("should not parse a broken if statement", () => {
      should(function() {
        Parser.parse("Function x( Object y ); if( 1 ) ; End");
      }).throw();
    });
    it("should parse global as function", () => {
      should(function() {
        console.log(stringify(Parser.parse("echo( $$(test) )"), null, 2));
      }).not.throw();
    });
    it("should parse global as function", () => {
      should(function() {
        console.log(stringify(Parser.parse("echo( $$'test' )"), null, 2));
      }).not.throw();
    });
  });
});
