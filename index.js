/**
 * Module dependencies
 */

var Writable = require('stream').Writable;
var util = require('util');
var _ = require('lodash');
var path = require('path');
var concat = require('concat-stream');
var mongoose = require('mongoose');
var Grid = require('gridfs-stream');
Grid.mongo = mongoose.mongo;

/**
 * skipper-gridfs
 *
 * @param  {Object} globalOpts
 * @return {Object}
 */

module.exports = function GridFSStore (globalOpts) {
    globalOpts = globalOpts || {};

    _.defaults(globalOpts, {

        // By default, create new files on Gridstore
        // using their uploaded filenames.
        // (no overwrite-checking is performed!!)
        saveAs: function (__newFile) {
            return __newFile.filename;
        },

        dirname: '/',

        dbname: 'your-mongodb-name',

        host: 'localhost',

        port: 27017,

        bucket: mongoose.mongo.GridStore.DEFAULT_ROOT_COLLECTION,

        username: '',

        password: '',

        uri: '',

        mongoOpts: { db: { native_parser: true, w: 'majority' }}
    });

    _setURI();

    var adapter = {
        ls: function (dirpath, cb) {
            var conn = mongoose.createConnection(globalOpts.uri, globalOpts.mongoOpts);
            var data = new Array();
            conn.once('open', function() {
                var gfs = Grid(conn.db);
                gfs.collection(globalOpts.bucket).find({'metadata.dirPath': dirpath}).toArray(function(err, files) {
                    mongoose.disconnect();
                    if (err) return cb(err);
                    
                    _.each(files, function(file) {
                        data.push(file.filename);
                    });
                    return cb(err, data);
                });
            });
            
        },
        read: function (filepath, cb) {
            var conn = mongoose.createConnection(globalOpts.uri, globalOpts.mongoOpts);
            conn.once('open', function() {
                var gfs = Grid(conn.db);
                gfs.collection(globalOpts.bucket).findOne({'metadata.filePath': filepath}, function(err, file) {
                    if (err) {
                        mongoose.disconnect();
                        return cb(err);
                    }
                    var readstream = gfs.createReadStream({_id: file._id, root: globalOpts.bucket});
                    readstream.pipe(concat(function(data){
                        return cb(null, data);
                    }));

                    readstream.once('error', function(err) {
                        mongoose.disconnect();
                        return cb(err);
                    });

                    readstream.once('end', function() {
                        mongoose.disconnect();
                    });
                });
            });
        },
        rm: function(filepath, cb) {
            var conn = mongoose.createConnection(globalOpts.uri, globalOpts.mongoOpts);
            conn.once('open', function() {
                var gfs = Grid(conn.db);
                gfs.collection(globalOpts.bucket).findOne({'metadata.filePath': filepath}, function(err, file) {
                    if (err) {
                        mongoose.disconnect();
                        cb(err);
                    }
                    gfs.remove({_id: file._id, root: globalOpts.bucket}, function(err) {
                        mongoose.disconnect();
                        if (err) return cb(err);
                        return cb(null, filepath);
                    });
                });

            });
        },
        receive: GridFSReceiver,
        receiver: GridFSReceiver // (synonym for `.receive()`)
    };

    return adapter;


    /**
     * A simple receiver for Skipper that writes Upstreams to
     * gridfs
     *
     *
     * @param  {Object} options
     * @return {Stream.Writable}
     */
    function GridFSReceiver (options) {
        options = options || {};
        options = _.defaults(options, globalOpts);

        var receiver__ = Writable({
            objectMode: true
        });

        var conn = mongoose.createConnection(options.uri, options.mongoOpts);
        // This `_write` method is invoked each time a new file is received
        // from the Readable stream (Upstream) which is pumping filestreams
        // into this receiver.  (filename === `__newFile.filename`).
        receiver__._write = function onFile(__newFile, encoding, done) {

            var filePath, dirPath, filename;
            if (options.id) {
                // If `options.id` was specified, use it directly as the path.
                filePath = options.id;
                dirPath = path.dirname(filePath);
                filename = path.basename(filePath);
            }
            else {
                // Otherwise, use the more sophisiticated options:
                dirPath = path.resolve(options.dirname);
                filename = options.filename || options.saveAs(__newFile);
                filePath = path.join(dirPath, filename);
            }

            receiver__.once('error', function (err) { 
                mongoose.disconnect();      
                console.log('ERROR ON RECEIVER__ ::',err);
                done(err);
            });

            conn.once('open', function() {
                var gfs = Grid(conn.db);

                var outs = gfs.createWriteStream({
                    filename: filename,
                    root: options.bucket,
                    metadata: {
                        filePath: filePath,
                        dirPath: dirPath
                    }
                });
                __newFile.once('error', function (err) {
                    receiver__.emit('error', err);
                    console.log('***** READ error on file ' + __newFile.filename, '::', err);
                });
                outs.once('error', function failedToWriteFile(err) {
                    receiver__.emit('error', err);
                    console.log('Error on output stream- garbage collecting unfinished uploads...');
                });
                outs.once('open', function openedWriteStream() {
                    extra = _.assign({fileId: this.id}, this.options.metadata);
                    __newFile.extra = extra;
                });
                outs.once('close', function doneWritingFile(file) {
                    conn.db.close();
                    done();
                });
                __newFile.pipe(outs);
                
            })
        };
        return receiver__;
    }

    function _setURI() {
        if (globalOpts.uri && _URIisValid(globalOpts.uri)) {
            var startOfBucketIndex = globalOpts.uri.lastIndexOf('.');
            if (startOfBucketIndex > -1) {
                var bucket = globalOpts.uri.substr(startOfBucketIndex+1, globalOpts.uri.length);
                globalOpts.bucket = bucket;
                globalOpts.uri = globalOpts.uri.substr(0, startOfBucketIndex);
            } else {
                globalOpts.uri = globalOpts.uri;
            }
        } else {
            globalOpts.uri = util.format('mongodb://%s:%s@%s:%d/%s', 
                globalOpts.username, 
                globalOpts.password, 
                globalOpts.host, 
                globalOpts.port, 
                globalOpts.dbname);
        }
    }

    function _URIisValid(uri) {
        //TODO
        return true;
    }
};


