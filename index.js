module.exports = {
    Parser: require("./lib/parser"),
    Walker: require("./lib/walker"),
    Walk: require("./lib/walk"),
    Lexer: require("./lib/lexer"),
    preprocessor: require("./lib/preprocessor")
};

/*
var b = module.exports;
var p = b.Parser();
p.parse("// tag:name of tag\nfunction f(); end;\n");
*/
