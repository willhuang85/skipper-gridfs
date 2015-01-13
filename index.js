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

var db;


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

    var db;

    MongoClient.connect(globalOpts.uri,{native_parser:true},function(err,_db){
        db = _db;
    });



    var adapter = {
        ls: function (dirname, cb) {
                var gfs = Grid(db, mongo);
                gfs.collection(globalOpts.bucket).ensureIndex({filename: 1, uploadDate: -1}, function(err, indexName) {
                    if (err) {
                        return cb(err);
                    }
                    gfs.collection(globalOpts.bucket).distinct('filename', {'metadata.dirname': dirname}, function(err, files) {
                        if (err) return cb(err);
                        return cb(null, files);
                    });
                });
        },

        read: function(fd, cb) {

                GridStore.exist(db, fd, globalOpts.bucket, function(err, exists) {
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
                    gridStore.open(function(err, gridStore) {
                      if (err) {
                        return cb(err);
                      }
                      var stream = gridStore.stream(true);
                      stream.pipe(concat(function(data){
                        return cb(null, data);
                      }));

                      stream.on('error', function(err) {

                        return cb(err);
                      });

                      stream.on('close', function() {

                      });
                    });
                });


        },

        readLastVersion: function (fd, cb) {
            this.readVersion(fd, -1, cb);
        },

        readVersion: function(fd, version, cb) {
                var gfs = Grid(db, mongo);
                gfs.collection(globalOpts.bucket).ensureIndex({filename: 1, uploadDate: -1}, function(err, indexName){
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

                        var gridStore = new GridStore(db, fd, 'r', {root: globalOpts.bucket});
                        gridStore.open(function(err, gridStore) {
                          if (err) {
                            return cb(err);
                          }
                          var stream = gridStore.stream(true);
                          stream.pipe(concat(function(data){
                            return cb(null, data);
                          }));

                          stream.on('error', function(err) {
                            return cb(err);
                          });

                          stream.on('close', function() {
                          });
                        });
                    });
                });

        },

        rm: function(fd, cb) {
                var gfs = Grid(db, mongo);
                gfs.remove({filename: fd, root: globalOpts.bucket}, function(err, results) {
                    if (err) return cb(err);
                    return cb();
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
            var uriandbucket = globalOpts.uri.trim();
            globalOpts.uri = uriandbucket.substring(0, uriandbucket.lastIndexOf('.'));
            globalOpts.bucket = uriandbucket.substring(uriandbucket.lastIndexOf('.')+1);            
        }
    }

    function _URIisValid(uri) {
        var regex = /^(mongodb:\/{2})?((\w+?):(\S+?)@|:?@?)([\w._-]+?):(\d+)\/([\w_-]+?).{0,1}([\w_-]+?)$/g;
        return regex.test(uri);
    }
};


