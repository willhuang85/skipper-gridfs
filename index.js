/**
 * Module dependencies
 */

var path = require('path');
var util = require('util');
var Writable = require('stream').Writable;
var mongodburi = require('mongodb-uri');
var _ = require('lodash');
var concat = require('concat-stream');
var Grid = require('gridfs-stream');

var mongo = require('mongodb'),
    GridStore = require('mongodb').GridStore,
    MongoClient = require('mongodb').MongoClient,
    Server = require('mongodb');

function connectionBuilder(opts) {

    var db;

    return function (cb) {

        if (db) {
            cb(db);
        } else {
            MongoClient.connect(opts.uri, {native_parser: true}, function (err, _db) {
                db = _db;
                cb(db);
            });
        }
    };
}


/**
 * skipper-gridfs
 *
 * @param  {Object} globalOpts
 * @return {Object}
 */

module.exports = function GridFSStore (globalOpts) {
    globalOpts = globalOpts || {};

    _.defaults(globalOpts, {

        dbname: 'your-mongodb-name',

        host: 'localhost',

        port: 27017,

        bucket: GridStore.DEFAULT_ROOT_COLLECTION,

        username: '',

        password: '',

        uri: ''
    });

    _setURI();

    var getConnection = connectionBuilder(globalOpts);


    var adapter = {
        ls: function (dirname, cb) {

            getConnection(function (db) {

                var gfs = Grid(db, mongo);
                gfs.collection(globalOpts.bucket).ensureIndex({filename: 1, uploadDate: -1}, function (err, indexName) {
                    if (err) {
                        return cb(err);
                    }
                    gfs.collection(globalOpts.bucket).distinct('filename', {'metadata.dirname': dirname}, function (err, files) {
                        if (err) return cb(err);
                        return cb(null, files);
                    });
                });
            });
        },

        read: function (fd, cb) {
            getConnection(function (db) {
                GridStore.exist(db, fd, globalOpts.bucket, function (err, exists) {
                    if (err) {
                        return cb(err);
                    }
                    if (!exists) {
                        err = new Error('ENOENT');
                        err.name = 'Error (ENOENT)';
                        err.code = 'ENOENT';
                        err.status = 404;
                        err.message = util.format('No file exists in this mongo gridfs bucket with that file descriptor (%s)', fd);
                        return cb(err);
                    }

                    var gridStore = new GridStore(db, fd, 'r', {root: globalOpts.bucket});
                    gridStore.open(function (err, gridStore) {
                        if (err) {
                            return cb(err);
                        }
                        var stream = gridStore.stream(true);
                        stream.pipe(concat(function (data) {
                            return cb(null, data);
                        }));

                        stream.on('error', function (err) {

                            return cb(err);
                        });

                        stream.on('close', function () {

                        });
                    });
                });
            });
        },

        readLastVersion: function (fd, cb) {
            this.readVersion(fd, -1, cb);
        },

        readVersion: function (fd, version, cb) {
            getConnection(function (db) {
                var gfs = Grid(db, mongo);
                gfs.collection(globalOpts.bucket).ensureIndex({filename: 1, uploadDate: -1}, function (err, indexName) {
                    if (err) {
                        return cb(err);
                    }

                    var cursor = gfs.collection(globalOpts.bucket).find({filename: fd});
                    if (version < 0) {
                        skip = Math.abs(version) - 1
                        cursor.limit(-1).skip(skip).sort([['uploadDate', 'desc']])
                    } else {
                        cursor.limit(-1).skip(version).sort([['uploadDate', 'asc']])
                    }
            
                    cursor.nextObject(function(err, file) {
                        if (err) {
                            return cb(err);
                        }
                        if (!file) {
                            err = new Error('ENOENT');
                            err.name = 'Error (ENOENT)';
                            err.code = 'ENOENT';
                            err.status = 404;
                            err.message = util.format('No file exists in this mongo gridfs bucket with that file descriptor (%s)', fd);
                            return cb(err);
                        }

                        var gridStore = new GridStore(db, file._id, 'r', {root: globalOpts.bucket});
                        gridStore.open(function(err, gridStore) {
                          if (err) {
                            db.close();
                            return cb(err);
                          }
                          var stream = gridStore.stream(true);
                          stream.pipe(concat(function(data){
                            return cb(null, data);
                          }));

                            stream.on('error', function (err) {
                                return cb(err);
                            });

                            stream.on('close', function () {
                            });
                        });
                    });
                });
            });
        },

        rm: function (fd, cb) {
            getConnection(function (db) {
                var gfs = Grid(db, mongo);
                gfs.remove({filename: fd, root: globalOpts.bucket}, function (err, results) {
                    if (err) return cb(err);
                    return cb();
                });
            });
        },

        /**
         * A simple receiver for Skipper that writes Upstreams to
         * gridfs
         *
         *
         * @param  {Object} options
         * @return {Stream.Writable}
         */
        receive: function GridFSReceiver (options) {
            options = options || {};
            options = _.defaults(options, globalOpts);

            var receiver__ = Writable({
                objectMode: true
            });

            // This `_write` method is invoked each time a new file is received
            // from the Readable stream (Upstream) which is pumping filestreams
            // into this receiver.  (filename === `__newFile.filename`).
            receiver__._write = function onFile(__newFile, encoding, done) {
                // console.log('write fd:',__newFile.fd);
                var fd = __newFile.fd;


                receiver__.once('error', function (err) {
                    // console.log('ERROR ON RECEIVER__ ::',err);
                    done(err);
                });

                getConnection(function (db) {
                    var gfs = Grid(db, mongo);
                    // console.log('Opened connection for (%s)',fd);

                    var outs = gfs.createWriteStream({
                        filename: fd,
                        root: options.bucket,
                        metadata: {
                            fd: fd,
                            dirname: __newFile.dirname || path.dirname(fd)
                        }
                    });
                    __newFile.once('error', function (err) {
                        receiver__.emit('error', err);
                        // console.log('***** READ error on file ' + __newFile.filename, '::', err);
                    });
                    outs.once('error', function failedToWriteFile(err) {
                        receiver__.emit('error', err);
                        // console.log('Error on file output stream- garbage collecting unfinished uploads...');
                    });
                    outs.once('open', function openedWriteStream() {
                        // console.log('opened output stream for',__newFile.fd);
                        __newFile.extra = _.assign({fileId: this.id}, this.options.metadata);
                    });
                    outs.once('close', function doneWritingFile(file) {
                        // console.log('closed output stream for',__newFile.fd);
                        done();
                    });
                    __newFile.pipe(outs);
                });
            };
            return receiver__;
        }
    };

    return adapter;











    // Helper methods:
    ////////////////////////////////////////////////////////////////////////////////

    function _setURI() {
        if (!globalOpts.uri || !_URIisValid(globalOpts.uri)) {
            globalOpts.uri = mongodburi.format({
                username: globalOpts.username,
                password: globalOpts.password,
                hosts: [{
                    host: globalOpts.host,
                    port: globalOpts.port
                }],
                database: globalOpts.dbname
            });
        } else {
            //Thanks to Java's Mongodb driver ConnectionString.class
            var serverPart;
            var nsPart;
            var userName = '';
            var password = '';
            var database;
            var bucket;
            var prefix = 'mongodb://';

            var unprefixeduri = globalOpts.uri.trim().substring(prefix.length);
            var idx = unprefixeduri.lastIndexOf('/');
            if (idx < 0) {
                serverPart = unprefixeduri;
            } else {
                serverPart = unprefixeduri.substring(0, idx);
                nsPart = unprefixeduri.substring(idx + 1);
            }

            idx = serverPart.indexOf('@');

            if (idx > 0) {
                var authPart = serverPart.substring(0, idx);
                serverPart = serverPart.substring(idx + 1);
                idx = authPart.indexOf(':');
                if (idx == -1) {
                    userName = authPart;
                } else {
                    userName = authPart.substring(0, idx);
                    password = authPart.substring(idx + 1);
                }
            }

            if (nsPart && nsPart.trim() !== '') {
                idx = nsPart.indexOf('.');
                if (idx < 0) {
                    database = nsPart;
                } else {
                    database = nsPart.substring(0, idx);
                    bucket = nsPart.substring(idx + 1);
                }
            }

            bucket = bucket ? bucket : globalOpts.bucket;
            database = database ? database : globalOpts.dbname;
            globalOpts.uri = prefix+userName+(password ? ':' : '')+password+(password&&userName||userName ? '@' : '')+serverPart+'/'+database;
            globalOpts.bucket = bucket;
        }
    }

    function _URIisValid(uri) {
        var regex = /^(mongodb:\/{2})?((\w+?):(\S+?)@|:?@?)([\w._-]+?):(\d+)\/([\w_-]+?).{0,1}([\w_-]+?)$/g;
        return regex.test(uri);
    }
};