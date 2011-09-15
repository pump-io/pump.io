var http = require('http');
 
var server = http.createServer(function (req, res) {
    res.writeHead(200, { "Content-Type": "text/plain" })
    res.end("Hello world\n");
});
 
server.listen(process.env.PORT || 8001);
