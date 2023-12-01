var fs = require('fs');
var os = require('os');

function writeInFile(filename, content, callback) {
    fs.writeFile(filename, content, function(err) {
        if(err) {
            callback("error");
        } else {
            callback("success");
        }
    }); 
}

function readFile(filename, callback) {
    fs.readFile(filename, 'utf8', function (err,data) {
        if (err) {
            callback("error");
        } else {
            callback(data);
        }
    });
}

function getLocalIp() {
    var ifaces = os.networkInterfaces();

    Object.keys(ifaces).forEach(function (ifname) {
        var alias = 0;

        ifaces[ifname].forEach(function (iface) {
            if ('IPv4' !== iface.family || iface.internal !== false) {
                return;
            }

            if (alias >= 1) {
                console.log(" http://"+iface.address+":"+webPort);
            } else {
                console.log(" "+ifname+": ", "http://"+iface.address+":"+webPort);
            }
            ++alias;
        });
    });
}

module.exports = {
    writeInFile: writeInFile,
    readFile: readFile,
    getLocalIp: getLocalIp
};
