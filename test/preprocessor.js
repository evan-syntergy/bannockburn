var assert = require("assert"),
    should = require("should"),
    makeParser = require( '..' ),
    _ = require( "lodash" );

var Lexer = makeParser.Lexer;
var preprocessor = makeParser.preprocessor;

function pre( src ) {
    // Init the lexer and read all the tokens into our token buffer.
    var lex = new Lexer( src ), t, tokens = [];
    while( ( t = lex.get() ) !== null ) { 
        tokens.push( t );
    }
 
    // send through preprocessor...
    tokens = preprocessor.run( tokens );
    return tokens;
}

function preVals( src ) { 
    return _.pluck( pre( src ), "value" );
}
    
describe('Preprocessor', function(){
    it( "should remove unknown ifdefs", function() { 
        preVals( "#ifdef TEST\na = 1\n#endif\nX" ).should.eql( [ "X" ] );
    } );
    it( "should include alternates to unknown ifdefs", function() { 
        preVals( "#ifdef TEST\na = 1\n#else\nX\n#endif" ).should.eql( [ "X", "\n" ] );
    } );
    it( "should include unknown ifndefs", function() { 
        preVals( "#ifndef TEST\na = 1\n#endif\nX" ).should.eql( [ "a", "=", "1", "\n", "X" ] );
    } );
    it( "should exclude alternates to unknown ifndefs", function() { 
        preVals( "#ifndef TEST\na = 1\n#else\nX\n#endif" ).should.eql( [ "a", "=", "1", "\n" ] );
    } );
    it( "should include known ifdefs", function() { 
        preVals( "#define TEST\n#ifdef TEST\na = 1\n#endif" ).should.eql( [ "a", "=", "1", "\n" ] );
    } );
    it( "should exclude known ifndefs", function() { 
        preVals( "#define TEST\n#ifndef TEST\na = 1\n#endif" ).should.eql( [] );
    } );
    it( "should respect undefine after define", function() { 
        preVals( "#define TEST 1\n#undef TEST\n#ifdef TEST\na = 1\n#endif" ).should.eql( [] );
    } );
    it( "should replace macros", function() { 
        preVals( "#define TEST 123\nTEST" ).should.eql( ["123"] );
    } );
    it( "should replace macros within macros", function() { 
        preVals( "#define TEST ASDF\n#Define ASDF 5551212\nTEST" ).should.eql( ["5551212"] );
    } );
    it( "should prevent recursive macros", function() { 
        ( function() { 
            preVals( "#define TEST ASDF\n#Define ASDF AAA\n#define AAA TEST\nTEST" );
        } ).should.throw();
    } );
    it( "should not allow endif directives outside of if", function() { 
        ( function() { 
            preVals( "#ifdef TEST\n#endif\n#endif" );
        } ).should.throw();
    } );
    it( "should not allow else directives outside of if", function() { 
        ( function() { 
            preVals( "#ifdef TEST\n#endif\n#else" );
        } ).should.throw();
    } );
    it( "should not allow invalid directives", function() { 
        ( function() { 
            preVals( "#invalid TEST" );
        } ).should.throw();
    } );
    it( "should skip directives within excluded sections", function() { 
        preVals( "#ifdef TEST\n#define X 23\n#endif\nX" ).should.eql( ["X"] );
    } );
    it( "should skip invalid directives within excluded sections", function() { 
        preVals( "#ifdef TEST\n#asdffdsa X 23\n#endif\nX" ).should.eql( ["X"] );
    } );
    it( "should skip non-name directives within excluded sections", function() { 
        preVals( "#ifdef TEST\n#(2345 X 23\n#endif\nX" ).should.eql( ["X"] );
    } );
    it( "should not allow non-name directives in included sections", function() { 
        ( function() { 
            preVals( "#ifndef TEST\n#(2345 X 23\n#endif\nX" );
        } ).should.throw();
    } );
} );

