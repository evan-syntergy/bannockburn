var Bannockburn = require(".."),
  should = require("should/as-function");

var parser = Bannockburn.Parser(),
  Walker = Bannockburn.Walker;

var scratch = `function void scratch()
                String	filePath = "C:\\temp\\_SubclassExecute\\"
                Object 	tWriter
                File	outFile
                String	fileName
                String	src

                for tWriter in $Replicator.XMLTableWriterSubsystem.GetItems()

                    if OS.FeatureInfo(tWriter.OSParent, "_SubclassPreExecute")[5]
                        src = Compiler.Source(tWriter._SubclassPreExecute)
                        
                        
                        fileName = filePath + tWriter.OSParent.OSNAME + ".txt"
                        outFile = File.Open( fileName, File.WriteMode )
                        if IsUndefined( outFile )
                            echo( "### Error opening ", fileName, " for output" )
                        else
                            outFile.pLineTermination = ""
                            File.Write( outFile, src )
                            File.Close( outFile )						
                        end	
                    
                    end
                    
                end	
            end`;

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
          if (node.init[0].value !== "C:\\temp\\_SubclassExecute\\") {
            throw new Error("Wrong node init value");
          }
          done();
        })
        .start(parser.parse(scratch));
    });
  });
});
