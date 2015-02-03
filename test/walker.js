var Bannockburn = require( '..' ),
    should = require( 'should' );

var parser = Bannockburn.Parser(),
    Walker = Bannockburn.Walker;

describe( "Walker", function() {
    describe( '#on()', function() {
        it( "event handlers should be called", function( done ) {
            ( new Walker() ).on( "FunctionDeclaration", function(node) {
                if( node.name != 'x' ) {
                    throw "Invalid name";
                }
                done();
                return false;
            }).start( parser.parse( "function x(); end" ) );
        } );
    } )
} );