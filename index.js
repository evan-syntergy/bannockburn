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
p.parse(`
    // tag:name of tag
    function f()
        Integer i
        for( i = 0; i < 10; i++)
            // tag:sqlnocheck
            echo( "This is what i equals right now: ", \
                Str.Format("%1", i ), \
                " or raw: " + Str.String( i ) \
                )
        end
    End
`);
*/
