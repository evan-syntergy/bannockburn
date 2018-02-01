var assert = require("assert"),
  Bannockburn = require(".."),
  _ = require("lodash"),
  should = require("should/as-function");

var Lexer = Bannockburn.Lexer,
  preprocessor = Bannockburn.preprocessor;

function pre(src) {
  // Init the lexer and read all the tokens into our token buffer.
  var lex = new Lexer(src),
    t,
    tokens = [];
  while ((t = lex.get()) !== null) {
    tokens.push(t);
  }

  // send through preprocessor...
  tokens = preprocessor.run(tokens);
  return tokens;
}

function preVals(src) {
  return _.map(pre(src), "value");
}

describe("Preprocessor", function() {
  it("should remove unknown ifdefs", function() {
    should(preVals("#ifdef TEST\na = 1\n#endif\nX")).eql(["X"]);
  });
  it("should include alternates to unknown ifdefs", function() {
    should(preVals("#ifdef TEST\na = 1\n#else\nX\n#endif")).eql(["X", "\n"]);
  });
  it("should include unknown ifndefs", function() {
    should(preVals("#ifndef TEST\na = 1\n#endif\nX")).eql([
      "a",
      "=",
      "1",
      "\n",
      "X"
    ]);
  });
  it("should exclude alternates to unknown ifndefs", function() {
    should(preVals("#ifndef TEST\na = 1\n#else\nX\n#endif")).eql([
      "a",
      "=",
      "1",
      "\n"
    ]);
  });
  it("should include known ifdefs", function() {
    should(preVals("#define TEST\n#ifdef TEST\na = 1\n#endif")).eql([
      "a",
      "=",
      "1",
      "\n"
    ]);
  });
  it("should exclude known ifndefs", function() {
    should(preVals("#define TEST\n#ifndef TEST\na = 1\n#endif")).eql([]);
  });
  it("should respect undefine after define", function() {
    should(
      preVals("#define TEST 1\n#undef TEST\n#ifdef TEST\na = 1\n#endif")
    ).eql([]);
  });
  it("should replace macros", function() {
    should(preVals("#define TEST 123\nTEST")).eql(["123"]);
  });
  it("should replace macros within macros", function() {
    should(preVals("#define TEST ASDF\n#Define ASDF 5551212\nTEST")).eql([
      "5551212"
    ]);
  });
  it("should prevent recursive macros", function() {
    should(function() {
      preVals("#define TEST ASDF\n#Define ASDF AAA\n#define AAA TEST\nTEST");
    }).throw();
  });
  it("should not allow endif directives outside of if", function() {
    should(function() {
      preVals("#ifdef TEST\n#endif\n#endif");
    }).throw();
  });
  it("should not allow else directives outside of if", function() {
    should(function() {
      preVals("#ifdef TEST\n#endif\n#else");
    }).throw();
  });
  it("should not allow invalid directives", function() {
    should(function() {
      preVals("#invalid TEST");
    }).throw();
  });
  it("should skip directives within excluded sections", function() {
    should(preVals("#ifdef TEST\n#define X 23\n#endif\nX")).eql(["X"]);
  });
  it("should skip invalid directives within excluded sections", function() {
    should(preVals("#ifdef TEST\n#asdffdsa X 23\n#endif\nX")).eql(["X"]);
  });
  it("should skip non-name directives within excluded sections", function() {
    should(preVals("#ifdef TEST\n#(2345 X 23\n#endif\nX")).eql(["X"]);
  });
  it("should not allow non-name directives in included sections", function() {
    should(function() {
      preVals("#ifndef TEST\n#(2345 X 23\n#endif\nX");
    }).throw();
  });
});
