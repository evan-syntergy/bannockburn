var assert = require("assert"),
    should = require("should"),
    Lexer = require( '..' )().Lexer,
    compare = require( "../lib/compare" ),
    _ = require( "lodash" );

function lex( str ) { 
    var lex = new Lexer( str ), t, tokens = [];
    while( ( t = lex.get() ) !== null ) { 
        tokens.push( t );
    }
    return tokens;
}

function getWSVals( str ) { 
    var lex = new Lexer( str ), t, tokens = [];
    while( ( t = lex.get() ) !== null ) { 
        tokens.push( t );
    }
    return _.pluck( lex.getWhitespace(), "value" );
}

function lexVals( str ) { 
    return _.pluck( lex( str ), "value" );
}

function lexTypes( str ) { 
    return _.pluck( lex( str ), "type" );
}    

describe('Lexer', function(){
    describe( "#getSource()", function() { 
        it('should get the current token and advance', function(){
            var lx = new Lexer( "this is a test" );
            lx.getSource().should.equal( "this is a test" );
        } );
    } );
    describe( "#getWhitespace()", function() { 
        it('should keep track of contiguous spaces and tabs.', function(){
            getWSVals( "this  is \t a test" ).should.eql( [ "  ", " \t ", " " ] );
        });
        it('should keep track of line comments', function(){
            getWSVals( "this//This is a test" ).should.eql( [ "//This is a test" ] );
        });
    } );
    describe( "#peek()", function() { 
        it('should return the current token without advancing', function(){
            var lx = new Lexer( "this is a test" );
            lx.peek().should.have.property("value", "this" );
            lx.peek().should.have.property("value", "this" );
            lx.get().should.have.property("value", "this" );
            lx.peek().should.have.property("value", "is" );
            lx.peek().should.have.property("value", "is" );
        });
    } );    
    describe( "#readNextToken()", function() { 
        it('should remove whitespace', function(){
            lexVals( " this is      a  test   " ).should.eql( [ "this", "is", "a", "test" ] );
        });
        it('should remove single line comments', function(){
            lexVals( " this is //     a  test   " ).should.eql( [ "this", "is", "\n" ] );
        });
        it('should remove single line block comments', function(){
            lexVals( " this is /*     a  */ test   " ).should.eql( [ "this", "is", "test" ] );
        });
        it('should remove single line block comments with no body', function(){
            lexVals( "//" ).should.eql( ['\n'] );
        });
        it('should remove block comments with incomplete closure', function(){
            lexVals( "/*" ).should.eql( [] );
        });
        it('should remove multi-line block comments', function(){
            lexTypes( " this is /* here \n are some \r\n lines */ test   " ).should.eql( [ "name", "name", "(nl)", "name" ] );
        });
        it('should remove newline after a continuation', function(){
            lexVals( " this is \\\na test   " ).should.eql( [ "this", "is", "a", "test" ] );
        });
        it('should remove newline after a continuation and line comment', function(){
            lexVals( " this is \\ // this is a test\na test   " ).should.eql( [ "this", "is", "a", "test" ] );
        });
        it('should remove newline after a continuation and single line block comment', function(){
            lexVals( " this is \\ /* this is a test*/ \na test   " ).should.eql( [ "this", "is", "a", "test" ] );
        });
        it('should remove newline after a continuation and two line block comment', function(){
            lexVals( " this is \\ /* this is \na test*/ a test   " ).should.eql( [ "this", "is", "a", "test" ] );
        });
        it('should remove only one newline after a continuation followed by a two or greater line block comment', function(){
            lexVals( " this is \\ /* this \n is \n a test*/ a test   " ).should.eql( [ "this", "is", "", "a", "test" ] );
        });
        it('should parse floating points numbers with leading decimal point', function() { 
            lexVals( ".1" ).should.eql( [ ".1" ] ); 
            lexVals( ".01" ).should.eql( [ ".01" ] ); 
            lexVals( ".011" ).should.eql( [ ".011" ] ); 
        } );        
        it('should parse floating points numbers with trailing decimal point', function() { 
            lexVals( "1." ).should.eql( [ "1" ] ); 
            lexVals( "21." ).should.eql( [ "21" ] ); 
            lexVals( "111." ).should.eql( [ "111" ] ); 
        } );        
        it('should parse floating points numbers', function() { 
            lexVals( "9.0" ).should.eql( [ "9.0" ] ); 
            lexVals( "19.0" ).should.eql( [ "19.0" ] ); 
            lexVals( "198.992" ).should.eql( [ "198.992" ] ); 
            lexVals( "0.992" ).should.eql( [ "0.992" ] ); 
        } );        
        it('should tokenize single quote strings', function(){
            lexVals( "'t'  'te'     'tes'    'test' '' " ).should.eql( [ "t", "te", "tes", "test", "" ] );
            lexTypes( "'t'  'te'     'tes'    'test' '' " ).should.eql( [ "string", "string", "string", "string", "string" ] );
        });
        it('should tokenize double quote strings', function(){
            lexVals( '"t"  "te"     "tes"   "test" "" ' ).should.eql( [ "t", "te", "tes", "test", "" ] );
            lexTypes( '"t"  "te"     "tes"   "test" "" ' ).should.eql( [ "string", "string", "string", "string", "string" ] );
        });
        it('should escape single quotes', function(){
            lexVals( " 'cat''s name'   ''''\t '''The'''" ).should.eql( [ "cat's name", "'", "'The'" ] );
            lexTypes( " 'cat''s name'   ''''\t '''The'''" ).should.eql( [ "string", "string", "string" ] );
        });
        it('should escape double quotes', function(){
            lexVals( ' "cat""s name"\t """"\t """The"""' ).should.eql( [ 'cat"s name', '"', '"The"' ] );
            lexTypes( ' "cat""s name"\t """"\t """The"""' ).should.eql( [ "string", "string", "string" ] );
        });
        it('should automatically fix ambiguous sequences of period/ellipsis tokens', function(){
            lexVals( 'function x( .... );end;' ).should.eql( [ "function", "x", "(", "...", ")", ";","end",";" ] );
            lexVals( 'function x( .. );end;' ).should.eql( [ "function", "x", "(", "...", ")", ";","end",";" ] );
        });
    } );
} );