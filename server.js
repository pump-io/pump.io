connect = require('connect');

function notYetImplemented(req, res, next) {
    res.writeHead(500, {'Content-Type': 'application/json'});
    res.end("\"Not yet implemented\"\n");
}

server = connect.createServer(
    connect.logger(),
    connect.query(),
    connect.router(function(app){
	// Activities
	app.get('/activity/:id', notYetImplemented);
	app.put('/activity/:id', notYetImplemented);
	app.del('/activity/:id', notYetImplemented);
	// Users
	app.get('/user/:nickname', notYetImplemented);
	app.put('/user/:nickname', notYetImplemented);
	app.del('/user/:nickname', notYetImplemented);

	// Feeds

	app.get('/user/:nickname/feed', notYetImplemented);
	app.post('/user/:nickname/feed', notYetImplemented);

	// Inboxen

	app.get('/user/:nickname/inbox', notYetImplemented);
	app.post('/user/:nickname/inbox', notYetImplemented);

	// Global user list

	app.get('/users', notYetImplemented);
	app.post('/users', notYetImplemented);
    })
);

server.listen(process.env.PORT || 8001);
