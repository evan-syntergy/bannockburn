
var opAlternates = {
    'eq': '=',
    'lt': '<',
    'gt': '>',
    'or': '||',
    'and': '&&',
    'xor': '^^',
    'not': '!'
};

var reservedWords = [ "and", "or", "not", "eq", "lt", "gt",
                      "if", "elseif", "for", "switch", "repeat", "while", "end", "function", 
                      "in", "to", "downto", "default", "case", "return", "break", "breakif", "continueif", "continue" ];
                      
var standardTypes = [ "assoc", "boolean", "bytes", "cachetree", "capiconnect", "capierr", "capilog", "capilogin", "dapinode", 
                        "dapisession", "dapistream", "dapiversion", "date", "dialog", "domattr", "domcdatasection", "domcharacterdata", 
                        "domcomment", "domdocument", "domdocumentfragment", "domdocumenttype", "domelement", "domentity", "domentityreference", 
                        "domimplementation", "domnamednodemap", "domnode", "domnodelist", "domnotation", "domparser", "domprocessinginstruction", 
                        "domtext", "dynamic", "error", "file", "filecopy", "fileprefs", "frame", "integer", "javaobject", "list", "long", 
                        "mailmessage", "object", "objref", "patchange", "patfind", "pattern", "real", "recarray", "record", "regex", "saxparser", 
                        "script", "socket", "string", "uapisession", "uapiuser", "ulong", "wapimap", "wapimaptask", "wapisession", "wapisubwork", 
                        "wapiwork", "xslprocessor"];

module.exports = {
    builtin_types: standardTypes,
    reserved_words: reservedWords,
    op_alternates: opAlternates
};