// relay.js
const http = require('http');
const Gun = require('gun');

const server = http.createServer(function(req, res) {
    if(Gun.serve(req, res)){ return } // Filters Gun requests
    res.writeHead(200);
    res.end('Relay is running!');
});

const gun = Gun({ web: server });

server.listen(8765, () => {
    console.log('Gun Relay running on http://localhost:8765/gun');
});