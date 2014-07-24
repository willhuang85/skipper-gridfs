/**
 * Module dependencies
 */

var Writable = require('stream').Writable;
var _ = require('lodash');
var path = require('path');
var concat = require('concat-stream');
var mongo = require('mongodb');
var Server = mongo.Server;
var Grid = require('gridfs-stream');


/**
 * skipper-gridfs
 *
 * @param  {Object} globalOpts
 * @return {Object}
 */

module.exports = function GridFSStore (globalOpts) {
    globalOpts = globalOpts || {};

    _.defaults(globalOpts, {

        // By default, create new files on disk
        // using their uploaded filenames.
        // (no overwrite-checking is performed!!)
        saveAs: function (__newFile) {
            return __newFile.filename;
        },

        // Max bytes (defaults to ~15MB)
        maxBytes: 15000000,

        // By default, upload files to `/` (within the bucket)
        dirname: '/'
    });
    var adapter = {
        ls: function (dirpath, cb) {
            var db = new mongo.Db(globalOpts.dbname, new Server(globalOpts.host, globalOpts.port), {w: 'majority'});
            var data = new Array();
            db.open(function(err, db) {
                var gfs = Grid(db, mongo);
                gfs.files.find({'metadata.dirPath': dirpath}).toArray(function(err, files) {
                    db.close();
                    
                    _.each(files, function(file) {
                        data.push(file.filename);
                    });
                    cb(err, data);
                });
            });
            
        },
        read: function (filepath, cb) {
            var db = new mongo.Db(globalOpts.dbname, new Server(globalOpts.host, globalOpts.port), {w: 'majority'});
            
            db.open(function(err, db) {
                var gfs = Grid(db, mongo);
                gfs.files.find({'metadata.filePath': filepath}).toArray(function(err, files){
                    var readstream = gfs.createReadStream({_id: files[0]._id});
                    readstream.pipe(concat(function(data){
                        cb(null, data);
                    }));

                    readstream.on('error', function(err) {
                        cb(err);
                    });

                    readstream.on("close", function() {
                        db.close();
                    });
                });
            });
        },
        rm: function(filepath, cb) {
            var db = new mongo.Db(globalOpts.dbname, new Server(globalOpts.host, globalOpts.port), {w: 'majority', native_parser: true});
            db.open(function(err, db) {
                var gfs = Grid(db, mongo);
                gfs.files.find({'metadata.filePath': filepath}).toArray(function(err, files){
                    gfs.remove({_id: files[0]._id}, function(err){
                        db.close();
                        if (err) cb(err);
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

        // This `_write` method is invoked each time a new file is received
        // from the Readable stream (Upstream) which is pumping filestreams
        // into this receiver.  (filename === `__newFile.filename`).
        receiver__._write = function onFile(__newFile, encoding, done) {
            var db = new mongo.Db(options.dbname, new Server(options.host, options.port), {w: 'majority'});

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
                console.log('ERROR ON RECEIVER__ ::',err);
            });

            db.open(function(err, db) {
                if (err) {
                    receiver__.emit('error', err);
                    return;
                }

                var gfs = Grid(db, mongo);
                var outs = gfs.createWriteStream({
                    filename: filename,
                    metadata: {
                        filePath: filePath,
                        dirPath: dirPath
                    }
                });
                __newFile.on('error', function (err) {
                    console.log('***** READ error on file ' + __newFile.filename, '::', err);
                });
                outs.on('error', function failedToWriteFile(err) {
                    console.log('Error on output stream- garbage collecting unfinished uploads...');
                });
                outs.on('close', function doneWritingFile(file) {
                    db.close();
                    done();
                });
                __newFile.pipe(outs);
                
            })

        };

        return receiver__;
    }


};


