var Bannockburn = require(".."),
  should = require("should/as-function");

var parser = Bannockburn.Parser(),
  Walker = Bannockburn.Walker;

describe("Walker", function() {
  describe("#on()", function() {
    it("event handlers should be called", function(done) {
      new Walker()
        .on("FunctionDeclaration", function(node) {
          if (node.name != "x") {
            throw "Invalid name";
          }
          done();
          return false;
        })
        .start(parser.parse("function x(); end"));
    });
    it("event handlers should be called", function(done) {
      new Walker()
        .on("before:VariableDeclarator.init", function(node) {
          done();
        })
        .start(parser.parse("function x(); String s = 'asdf' + 'fdsa'; end"));
    });
  });
});
