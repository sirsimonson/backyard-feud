const fs = require("node:fs");
const PUBLIC_FOLDER = "public/";
const PORT_WEB = 8080;
const PORT_SOCKET = 8081;

/**
 * Represents a web server.
 * @class
 */
class WebServer {
    /**
     * Creates an instance of WebServer.
     * @constructor
     */
    constructor() {
        this.port = PORT_WEB;
        this.server = require("http").createServer(this.handleRequest.bind(this));
        this.os = require("node:os");
    }

    /**
     * Handles incoming HTTP requests.
     * @param {Object} request - The HTTP request object.
     * @param {Object} response - The HTTP response object.
     */
    handleRequest(request, response) {
        try {
            var rurl = request.url;
            if (rurl == "/") {
                rurl = "/index.html";
            }
            var requestUrl = require("url").parse(rurl);

            // need to use path.normalize so people can't access directories underneath PUBLIC_FOLDER
            var fsPath =
                PUBLIC_FOLDER + require("node:path").normalize(requestUrl.pathname);
            console.log(fsPath);
            // console.log(fsPath);
            var fileStream = require("node:fs").createReadStream(fsPath);
            fileStream.pipe(response);
            fileStream.on("open", function () {
                response.writeHead(200);
            });
            fileStream.on("error", function (e) {
                response.writeHead(404); // assume the file doesn't exist
                response.end();
            });
        } catch (e) {
            response.writeHead(500);
            response.end(); // end the response so browsers don't hang
            console.log(e.stack);
        }
    }

    /**
     * Starts the web server and listens on the specified port.
     */
    listen() {
        this.server.listen(this.port);
        console.log("\nWebserver running on Port:" + this.port);
        console.log("\n---Verbinden von diesem PC---");
        console.log(
            " Browser öffnen und zu Adresse: http://127.0.0.1:" +
            this.port +
            " surfen!"
        );
        console.log("\n---Adressen zum verbinden von anderen Geräten---");
        this.getLocalIp();
        console.log("\n\n------------------------------");
        console.log("\n---SERVER IS UP AND RUNNING---");
        console.log("\n------------------------------");
    }

    /**
     * Retrieves the local IP addresses of the server.
     */
    getLocalIp = () => {
        const ifaces = this.os.networkInterfaces();

        Object.keys(ifaces).forEach((ifname) => {
            let alias = 0;

            ifaces[ifname].forEach((iface) => {
                if ("IPv4" !== iface.family || iface.internal !== false) {
                    return;
                }

                if (alias >= 1) {
                    console.log(` http://${iface.address}:${this.port}`);
                } else {
                    console.log(` ${ifname}: `, `http://${iface.address}:${this.port}`);
                }
                ++alias;
            });
        });
    };
}

/**
 * Represents a WebSocket server.
 */
class WebSocketServer {
    /**
     * Creates an instance of WebSocketServer.
     */
    constructor() {
        this.wss = new (require("ws").Server)({ port: PORT_SOCKET });
        this.subscribers = [];
        this.wss.on("connection", this.handleConnection.bind(this));
        console.log(
            "\nWebsocket server running on Port:" + this.wss.address().port
        );
    }

    /**
     * Handles the close event of a WebSocket connection.
     * @param {WebSocket} ws - The WebSocket connection.
     */
    handleClose(ws) {
        const cId = this.getClientId(ws);
        this.subscribers[cId] = null;
        this.broadcastMessage(cId, "disconnected");
        console.log("Subscriber left: " + this.subscribers.length + " total.\n");
    }

    /**
     * Handles the connection event of a WebSocket server.
     * @param {WebSocket} ws - The WebSocket connection.
     */
    handleConnection(ws) {
        this.subscribers.push(ws);
        ws.send(`${this.subscribers.length - 1}###thatsYou`);
        this.subscribers.forEach((subscriber, i) => {
            if (subscriber) this.broadcastMessage(i, "connected");
        });
        console.log(
            `~~~~~~~~ WELCOME TO SERVER ~~~~~~ s:${this.subscribers.length}`
        );
        ws.on("message", this.handleMessage.bind(this, ws));
        ws.on("close", this.handleClose.bind(this, ws));
    }

    /**
     * Handles the message event of a WebSocket connection.
     * @param {WebSocket} ws - The WebSocket connection.
     * @param {string} message - The received message.
     */
    handleMessage(ws, message) {
        /**
         * Writes content to a file.
         * @param {string} filename - The name of the file.
         * @param {string} content - The content to write.
         * @param {function} callback - The callback function.
         */
        function writeInFile(filename, content, callback) {
            console.log("going to read file:" + filename);
            fs.writeFile(filename, content, function (err) {
                console.log("file:" + filename + " write callback done!");
                if (err) {
                    console.log(err);
                    callback("error");
                } else {
                    callback("success");
                    console.log("The file '" + filename + "' was saved!");
                }
            });
        }

        /**
         * Reads content from a file.
         * @param {string} filename - The name of the file.
         * @param {function} callback - The callback function.
         */
        function readFile(filename, callback) {
            console.log("going to read file:" + filename);
            fs.readFile(filename, "utf8", function (err, data) {
                console.log("file:" + filename + " read callback done!");
                if (err) {
                    console.log(err);
                    callback("error");
                }
                callback(data);
            });
        }
        console.log("msg: " + message);
        message = String(message);
        var parts = message.split("###");
        if (parts[0] != "fileOp") {
            this.broadcastMessage(this.getClientId(ws), message);
        } else {
            if (parts[1] == "write")
                writeInFile(parts[2], parts[3], (ret) => {
                    if (ret == "error") {
                        this.broadcastMessage(
                            this.getClientId(ws),
                            "error###Fehler beim Schreiben einer Datei... siehe Serverlog!"
                        );
                    } else {
                        this.broadcastMessage(
                            this.getClientId(ws),
                            "file###" + String(parts[2]) + "###" + String(parts[3])
                        );
                    }
                });
            else if (parts[1] == "read") {
                readFile(parts[2], (content) => {
                    if (content == "error") {
                        this.broadcastMessage(
                            this.getClientId(ws),
                            "error###Fehler beim Lesen einer Datei... siehe Serverlog!"
                        );
                    } else {
                        this.broadcastMessage(
                            this.getClientId(ws),
                            "file###" + String(parts[2]) + "###" + content
                        );
                    }
                });
            }
        }
    }

    /**
     * Broadcasts a message to all subscribers.
     * @param {number} _clientId - The client ID.
     * @param {string} message - The message to broadcast.
     */
    broadcastMessage(_clientId, message) {
        console.log(
            `broadcast:${String(message).split("###")[0]} length:${this.subscribers.length
            }`
        );
        for (let i = 0; i < this.subscribers.length; i++) {
            if (this.subscribers[i] != null) {
                this.subscribers[i].send(message);
            }
        }
    }

    /**
     * Gets the client ID of a WebSocket connection.
     * @param {WebSocket} ws - The WebSocket connection.
     * @returns {number} The client ID.
     */
    getClientId(ws) {
        return this.subscribers.findIndex((subscriber) => subscriber === ws);
    }
}

function main() {
    new WebServer().listen();
    new WebSocketServer();
}
main();
