var assert = require("assert"),
  Lexer = require("..").Lexer,
  comp = require("./util").comp,
  _ = require("lodash"),
  should = require("should/as-function");

function lex(str) {
  var lex = new Lexer(str),
    t,
    tokens = [];
  while ((t = lex.get()) !== null) {
    tokens.push(t);
  }
  return tokens;
}

function getWSVals(str) {
  var lex = new Lexer(str),
    t,
    tokens = [];
  while ((t = lex.get()) !== null) {
    tokens.push(t);
  }
  return _.map(lex.getWhitespace(), "value");
}

function lexVals(str) {
  return _.map(lex(str), "value");
}

function lexTypes(str) {
  return _.map(lex(str), "type");
}

describe("Lexer", function() {
  describe("#getSource()", function() {
    it("should get the current token and advance", function() {
      var lx = new Lexer("this is a test");
      should(lx.getSource()).equal("this is a test");
    });
  });
  describe("#getWhitespace()", function() {
    it("should keep track of contiguous spaces and tabs.", function() {
      should(getWSVals("this  is \t a test")).eql(["  ", " \t ", " "]);
    });
    it("should keep track of line comments", function() {
      should(getWSVals("this//This is a test")).eql(["//This is a test"]);
    });
  });
  describe("#peek()", function() {
    it("should return the current token without advancing", function() {
      var lx = new Lexer("this is a test");
      should(lx.peek()).have.property("value", "this");
      should(lx.peek()).have.property("value", "this");
      should(lx.get()).have.property("value", "this");
      should(lx.peek()).have.property("value", "is");
      should(lx.peek()).have.property("value", "is");
    });
  });
  describe("#readNextToken()", function() {
    it("should remove whitespace", function() {
      should(lexVals(" this is      a  test   ")).eql([
        "this",
        "is",
        "a",
        "test"
      ]);
    });
    it("should remove single line comments", function() {
      should(lexVals(" this is //     a  test   ")).eql(["this", "is", "\n"]);
    });
    it("should remove single line block comments", function() {
      should(lexVals(" this is /*     a  */ test   ")).eql([
        "this",
        "is",
        "test"
      ]);
    });
    it("should remove single line block comments with no body", function() {
      should(lexVals("//")).eql(["\n"]);
    });
    it("should remove block comments with incomplete closure", function() {
      should(lexVals("/*")).eql([]);
    });
    it("should remove multi-line block comments", function() {
      should(
        lexTypes(" this is /* here \n are some \r\n lines */ test   ")
      ).eql(["name", "name", "(nl)", "name"]);
    });
    it("should remove newline after a continuation", function() {
      should(lexVals(" this is \\\na test   ")).eql([
        "this",
        "is",
        "a",
        "test"
      ]);
    });
    it("should remove newline after a continuation and line comment", function() {
      should(lexVals(" this is \\ // this is a test\na test   ")).eql([
        "this",
        "is",
        "a",
        "test"
      ]);
    });
    it("should remove newline after a continuation and single line block comment", function() {
      should(lexVals(" this is \\ /* this is a test*/ \na test   ")).eql([
        "this",
        "is",
        "a",
        "test"
      ]);
    });
    it("should remove newline after a continuation and two line block comment", function() {
      should(lexVals(" this is \\ /* this is \na test*/ a test   ")).eql([
        "this",
        "is",
        "a",
        "test"
      ]);
    });
    it("should remove only one newline after a continuation followed by a two or greater line block comment", function() {
      should(lexVals(" this is \\ /* this \n is \n a test*/ a test   ")).eql([
        "this",
        "is",
        "",
        "a",
        "test"
      ]);
    });
    it("should parse floating points numbers with leading decimal point", function() {
      should(lexVals(".1")).eql([".1"]);
      should(lexVals(".01")).eql([".01"]);
      should(lexVals(".011")).eql([".011"]);
    });
    it("should parse floating points numbers with trailing decimal point", function() {
      should(lexVals("1.")).eql(["1"]);
      should(lexVals("21.")).eql(["21"]);
      should(lexVals("111.")).eql(["111"]);
    });
    it("should parse floating points numbers", function() {
      should(lexVals("9.0")).eql(["9.0"]);
      should(lexVals("19.0")).eql(["19.0"]);
      should(lexVals("198.992")).eql(["198.992"]);
      should(lexVals("0.992")).eql(["0.992"]);
    });
    it("should tokenize single quote strings", function() {
      should(lexVals("'t'  'te'     'tes'    'test' '' ")).eql([
        "t",
        "te",
        "tes",
        "test",
        ""
      ]);
      should(lexTypes("'t'  'te'     'tes'    'test' '' ")).eql([
        "string",
        "string",
        "string",
        "string",
        "string"
      ]);
    });
    it("should tokenize double quote strings", function() {
      should(lexVals('"t"  "te"     "tes"   "test" "" ')).eql([
        "t",
        "te",
        "tes",
        "test",
        ""
      ]);
      should(lexTypes('"t"  "te"     "tes"   "test" "" ')).eql([
        "string",
        "string",
        "string",
        "string",
        "string"
      ]);
    });
    it("should escape single quotes", function() {
      should(lexVals(" 'cat''s name'   ''''\t '''The'''")).eql([
        "cat's name",
        "'",
        "'The'"
      ]);
      should(lexTypes(" 'cat''s name'   ''''\t '''The'''")).eql([
        "string",
        "string",
        "string"
      ]);
    });
    it("should escape double quotes", function() {
      should(lexVals(' "cat""s name"\t """"\t """The"""')).eql([
        'cat"s name',
        '"',
        '"The"'
      ]);
      should(lexTypes(' "cat""s name"\t """"\t """The"""')).eql([
        "string",
        "string",
        "string"
      ]);
    });
    it("should automatically fix ambiguous sequences of period/ellipsis tokens", function() {
      should(lexVals("function x( .... );end;")).eql([
        "function",
        "x",
        "(",
        "...",
        ")",
        ";",
        "end",
        ";"
      ]);
      should(lexVals("function x( .. );end;")).eql([
        "function",
        "x",
        "(",
        "...",
        ")",
        ";",
        "end",
        ";"
      ]);
    });
    it("should produce a particular token stream", function() {
      should(lexVals("function x(String p1,Integer p2=1); end")).eql([
        "function",
        "x",
        "(",
        "String",
        "p1",
        ",",
        "Integer",
        "p2",
        "=",
        "1",
        ")",
        ";",
        "end"
      ]);
    });
  });
});
