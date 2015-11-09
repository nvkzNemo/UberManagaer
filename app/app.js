var fs = require('fs'),
    path = require('path'),
    remote = require('remote'),
    app = remote.require('app'),
    os = remote.require('os'),
    dialog = remote.require('dialog'),
    ncp = require('ncp').ncp,
    rimraf = require('rimraf'),
    xml2js = require('xml2js'),
    unzip = require('unzip'),
    mkdirp = require('mkdirp'),
    _osType = os.type(),
    _osPlatform = os.platform(),
    _osArch = os.arch(),
    _dirHome = app.getPath('home'), // C:/Users/Anton
    _dirAppdata = app.getPath('appData'), // C:/Users/Anton/AppData/Roaming || ~/Library/Application Support
    _dirTemp = app.getPath('temp') + '\\UberManager', // C:/Users/Anton/AppData/Local/Temp
    _dirDesktop = app.getPath('userDesktop'), // C:/Users/Anton/Desktop
    _dirApplications = _dirHome + '\\..\\..\\Program Files (x86)',
    _dirCommonFiles = null,
    extensionsList = [],
    extensionsDirectoriesList = [],
    totalExtensions = 0,
    currentExtensions = 0,
    parser = new xml2js.Parser(),
    xmlObj = null,
    removeButtons = [],
    ignoreList = ["com.adobe.DesignLibraries.angular", "AdobeExchange", "com.adobe.behance.shareonbehance.html", "KulerPanelBundle", "SearchForHelp", "com.adobe.preview", "com.adobe.webpa.crema"];


parser.addListener('end', function(result) {
    xmlObj = result;
});

function getDirectories(srcpath, callback) {
    for (i in srcpath) {
        //console.log("Check " + Number(Number(i) + 1) + " of " + srcpath.length + "\n" + srcpath[i])
        if (exists(srcpath[i])) {
            var files = fs.readdirSync(srcpath[i]);
            files.forEach(function(file) {
                if (fs.statSync(path.join(srcpath[i], file)).isDirectory()) {
                    //console.log('Find a extension: ' + file);
                    if (ignoreList.indexOf(file) < 0) {
                        extensionsDirectoriesList.push(path.join(srcpath[i], file));
                    }
                }
            });
            if (srcpath.length == Number(i) + 1 && callback && typeof(callback) === "function") {
                callback('Done!');
            }
        }
    }
}

function exists(path, make) {
    make = make || false;
    try {
        fs.accessSync(path);
        if (make) {
            return path
        } else {
            return true;
        }
    } catch (ex) {
        if (make) {
            mkdirp(path, function(err){
                if (!err) {
                    return path;
                } else {
                    console.log(err);
                    return null;
                }
            });
        } else {
            return false;
        }
    }
}

function getExtensionInfo(path, newInstall) {
    fs.readFile(path + '/CSXS/manifest.xml', function(err, data) {
        //console.log('Get info for ' + path);
        try {
            parser.parseString(data);
            var ext = {};
            ext.name = xmlObj.ExtensionManifest.$.ExtensionBundleName || xmlObj.ExtensionManifest.$.ExtensionBundleId; // Extension Name
            ext.id = xmlObj.ExtensionManifest.$.ExtensionBundleId;
            ext.path = path;
            ext.ver = xmlObj.ExtensionManifest.$.ExtensionBundleVersion;
            ext.cep = Math.floor(xmlObj.ExtensionManifest.ExecutionEnvironment[0].RequiredRuntimeList[0].RequiredRuntime[0].$.Version);
            var hostsList = xmlObj.ExtensionManifest.ExecutionEnvironment[0].HostList[0].Host;
            ext.hosts = [];
            for (i in hostsList) {
                ext.hosts.push(hostsList[i].$.Name);
            }
            ext.hosts.sort();

            if (newInstall) {
                installExtension(ext);
                return
            }

            extensionsList.push(ext);

            currentExtensions++;
            if (currentExtensions == totalExtensions && totalExtensions != 0) drawExtensionsList(extensionsList);
            //console.log(ext.hosts[i].$.Version.replace(/([\[\]])+/g, '').split(',')); // Supported Versions
            //console.log(xmlObj.ExtensionManifest.Author[0]); // Author
        } catch (e) {
            console.log('​/ ! \\ Error! Can not read manifest.xml file from: ' + path);
            currentExtensions++;
            if (currentExtensions == totalExtensions && totalExtensions != 0) drawExtensionsList(extensionsList);
        }
    });
}


function updateExtensionsList() {

    resetVars();

    if (_osPlatform == "win32") {
        var path1 = exists(_dirCommonFiles + '\\Adobe\\CEPServiceManager4\\extensions', true);
        var path2 = exists(_dirCommonFiles + '\\Adobe\\CEP\\extensions', true);
        var path3 = exists(_dirAppdata + '\\Adobe\\CEPServiceManager4\\extensions', true);
        var path4 = exists( _dirAppdata + '\\Adobe\\CEP\\extensions', true);

        getDirectories([path1, path2, path3, path4], function(msg) {
            totalExtensions = extensionsDirectoriesList.length;
            for (i in extensionsDirectoriesList) {
                getExtensionInfo(extensionsDirectoriesList[i]);
            }
        });

    } else {
        var path1 = exists('/Library/Application Support/Adobe/CEPServiceManager4/extensions', true);
        var path2 = exists('/Library/Application Support/Adobe/CEP/extensions', true);
        var path3 = exists(_dirAppdata + '/Adobe/CEPServiceManager4/extensions', true);
        var path4 = exists(_dirAppdata + '/Adobe/CEP/extensions', true);

        getDirectories([path1, path2, path3, path4], function(msg) {
            totalExtensions = extensionsDirectoriesList.length;
            for (i in extensionsDirectoriesList) {
                getExtensionInfo(extensionsDirectoriesList[i]);
            }
        });
    }

}

function resetVars() {
    extensionsDirectoriesList = [];
    totalExtensions = 0;
    currentExtensions = 0;
    extensionsList = [];
}

function removeDirectories(paths, callback) {
    for (i in paths) {
        rimraf.sync(paths[i]);
    }
    if (callback) {
        callback();
    }
}

function installExtension(ext) {
    var listOfDirectroiesToRemove = [];

    function copyExtension(cepVersions) {
        for (i in cepVersions) {
            ncp(ext.path, _dirAppdata + '/Adobe/' + cepVersions[i] + '/extensions/' + ext.id, function(err) {
                if (!err) {
                    updateExtensionsList();
                } else {
                    console.log(err);
                }
            });
        }
    }

    function checkOldVersions(callback) {
        if (exists(_dirAppdata + '/Adobe/CEP/extensions/' + ext.id)) {
            //console.log('We find & delete old version of installed extension in the CEP folder');
            listOfDirectroiesToRemove.push(_dirAppdata + '/Adobe/CEP/extensions/' + ext.id);
        }

        if (ext.cep < 5) {
            //console.log('This extension does support old CC (CEP' + ext.cep + ')');
            if (exists(_dirAppdata + '/Adobe/CEPServiceManager4/extensions/' + ext.id)) {
                //console.log('We find old version of installed extension in the CEPServiceManager4 folder');
                listOfDirectroiesToRemove.push(_dirAppdata + '/Adobe/CEPServiceManager4/extensions/' + ext.id);
            }
        }

        if (callback && typeof(callback) === "function") {
            callback();
        }
    }

    checkOldVersions(function() {
        if (listOfDirectroiesToRemove.length > 0) {
            //console.log('We was find a ' + listOfDirectroiesToRemove.length + ' old versions of this extension');
            removeDirectories(listOfDirectroiesToRemove, function() {
                copyExtension(['CEP', 'CEPServiceManager4']);
            });
        } else {
            copyExtension(['CEP', 'CEPServiceManager4']);
        }
    });

}

function checkPlatform() {
    if (_osPlatform == 'win32') {
        if (exists(_dirApplications)) {
            _dirCommonFiles = _dirApplications + '\\Common Files';
        } else {
            _dirCommonFiles = _dirHome + '\\..\\..\\Program Files\\Common Files';
            _dirApplications = _dirHome + '\\..\\..\\Program Files';
        }
    } else {
        // Some code for MAC
    }

    updateExtensionsList();
}

checkPlatform();

// ========================================================
//
//
// Application UI
//
//
// ========================================================

document.getElementById('installzxp').onclick = function() {
    var dialogFilter = {
        filters: [{
            name: 'Adobe Extension',
            extensions: ['zxp']
        }, {
            name: 'All Files',
            extensions: ['*']
        }]
    };

    dialog.showOpenDialog(dialogFilter, function(filepath) {
        if (!filepath) return
        var installPath = _dirTemp + '/newextension';
        var readStream = fs.createReadStream(filepath[0]);
        var unzipStream = unzip.Extract({
            path: installPath
        });

        unzipStream.on('close', function() {
            getExtensionInfo(installPath, true);
        });
        unzipStream.on('end', function() {
            getExtensionInfo(installPath, true);
        });
        unzipStream.on('error', function(err) {
            console.log('Error: ' + err);
            updateExtensionsList();
        });

        readStream.pipe(unzipStream);
    });
}

function clearExtensionsList() {
    var myNode = document.getElementById("adobe-extensions-list");
    while (myNode.firstChild) {
        myNode.removeChild(myNode.firstChild);
    }
}

function drawExtensionsListElem(_extensionInfo) {
    function createImg(imgSrc, imgAlt) {
        var img = document.createElement("img");
        img.setAttribute("src", "img/" + imgSrc);
        img.setAttribute("alt", imgAlt);
        return img
    }

    var node = document.createElement("LI");
    var strong = document.createElement("STRONG");
    var textnode = document.createTextNode(_extensionInfo.name);
    var span1 = document.createElement("SPAN");
    var textVersion = span1.appendChild(document.createTextNode(_extensionInfo.ver));
    var span2 = document.createElement("SPAN");
    var removeIcon = createImg("icon_remove.png", "Remove extension");
    var hasPs = false;

    for (g in _extensionInfo.hosts) {
        if (_extensionInfo.hosts[g] == "PHSP" && hasPs == false || _extensionInfo.hosts[g] == "PHXS" && hasPs == false) {
            span2.appendChild(createImg("icon_ps.png", "Photoshop"));
            hasPs = true;
        }
        if (_extensionInfo.hosts[g] == "ILST") {
            span2.appendChild(createImg("icon_ai.png", "Illustrator"));
        }
        if (_extensionInfo.hosts[g] == "IDSN") {
            span2.appendChild(createImg("icon_id.png", "InDesign"));
        }
        if (_extensionInfo.hosts[g] == "PPRO") {
            span2.appendChild(createImg("icon_pr.png", "Premiere Pro"));
        }
        if (_extensionInfo.hosts[g] == "AEFT") {
            span2.appendChild(createImg("icon_ae.png", "After Effects"));
        }
        if (_extensionInfo.hosts[g] == "PRLD") {
            span2.appendChild(createImg("icon_pl.png", "Prelude"));
        }
        if (_extensionInfo.hosts[g] == "FLPR") {
            span2.appendChild(createImg("icon_fl.png", "Flash"));
        }
    }

    span1.className = "extension_version";
    span2.className = "extension_hosts";
    removeIcon.className = "extension_remove";
    removeIcon.setAttribute("data-path", _extensionInfo.path);

    strong.appendChild(textnode);
    node.appendChild(strong);
    node.appendChild(span1);
    node.appendChild(span2);
    node.appendChild(removeIcon);
    document.getElementById("adobe-extensions-list").appendChild(node);
};

function drawExtensionsList(extensionsList) {
    function removeDuplicateFromExtensionsList(extensionsList) {
        var exclude_ids = [];
        var new_list = [];

        for (var i = 0; i < extensionsList.length; i++) {
            if (exclude_ids.indexOf(i) == -1) {
                for (var j = (i + 1); j < extensionsList.length; j++) {
                    if (extensionsList[i].id == extensionsList[j].id) {
                        exclude_ids.push(j);
                        extensionsList[i].path += "," + extensionsList[j].path
                    }
                }
                new_list.push(extensionsList[i]);
            }
        }
        return new_list
    }

    extensionsList = removeDuplicateFromExtensionsList(extensionsList);

    extensionsList.sort(function(a, b) {
        if (a.name > b.name) {
            return 1;
        }
        if (a.name < b.name) {
            return -1;
        }
        return 0;
    });

    // console.log('Clear ext list');
    clearExtensionsList();

    for (i in extensionsList) {
        // console.log('Draw ext elem');
        drawExtensionsListElem(extensionsList[i]);
    }

    removeButtons = document.getElementsByClassName('extension_remove');

    for (var i = 0; i < removeButtons.length; i++) {
        removeButtons[i].addEventListener('click', clickOnRemoveIcon, false);
    }
};

function clickOnRemoveIcon() {
    var paths = (this.getAttribute("data-path")).split(",");

    removeDirectories(paths, function() {
        updateExtensionsList();
    })
}
