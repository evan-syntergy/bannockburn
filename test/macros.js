var assert = require("assert"),
    should = require( 'should/as-function' ),
    Macros = require( '../lib/macros' );
    
describe('Macros', function(){
  describe('#define()', function(){
    it('should define macros', function(){
      should( ( new Macros() ).define( "A", [ "B", "C" ] ).isDefined( "A" ) ).equal( true );
    });
    it( 'should work with a valueFn defined', function() { 
       should( ( new Macros( { valueFn: function(v) { return v.value; } } ) )
            .define( { value: "A" }, [ { value: "B" } ] )
            .isDefined( { value: "A" } ) ).equal( true );
    });
  })
  
  describe( "#undef()", function() { 
    it( "should remove defined macros", function() { 
      should( ( new Macros() ).define( "A", [ "B", "C" ] ).undef( "A" ).isDefined( "A" ) ).equal( false );
    } );
    it( "should work with a valueFn defined", function() { 
      should( ( new Macros( { valueFn: function(v) { return v.value; } } ) )
            .define( { value: "A" }, [ { value: "B" } ] )
            .undef( { value: "A" } )
            .isDefined( { value: "A" } ) ).equal( false );
    } );
  } );

  describe( "#evaluate()", function() { 
    it( "should evaluate simple macros", function() { 
      should( ( new Macros() ).define( "A", [ "B", "C" ] ).evaluate( "A" )).eql( [ "B", "C" ] );
    } );
    it( "should evaluate deep macros", function() { 
      should( ( new Macros() ).define( "A", [ "B", "C" ] ).define( "B", [ "D", "C" ] ).evaluate( "A" ) ).eql( [ "D", "C", "C" ] );
    } );
    it( "should detect cycles in recursive macros", function() { 
      should( function() { ( new Macros() ).define( "A", [ "B", "C" ] ).define( "B", [ "D", "C" ] ).define( "C", [ "A" ] ).evaluate( "A" ) } ).throw();
    } );
    it( "should work with a valueFn defined", function() { 
       should( ( new Macros( { valueFn: function(v) { return v.value; } } ) )
            .define( { value: "A" }, [ { value:"B"}, {value:"C"} ] ).evaluate( {value:"A"} ) ).eql( [ {value:"B"}, {value:"C"} ] );
    } );
    it( "should work with isEvalItem defined", function() { 
       should( ( new Macros( { canEvalItem: function(v) { return v !== '+'; } } ) )
            .define( "A", [ "B", "+", "C" ] ).define( "+", "D" ).evaluate( "A" ) ).eql( [ "B", "+", "C" ] );
    } );
  } );
})
