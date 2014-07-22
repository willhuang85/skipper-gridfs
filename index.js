/**
 * Module dependencies
 */

var Writable = require('stream').Writable;
var _ = require('lodash');
var mongo = require('mongodb');
var MongoClient = mongo.MongoClient;
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

    var adapter = {
        ls: function (dirpath, cb) {
            return cb(new Error('TODO'));
        },
        read: function (filepath, cb) {
            return cb(new Error('TODO'));
        },
        rm: function(filepath, cb) {
            return cb(new Error('TODO'));
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

            receiver__.once('error', function (err) {
                console.log('ERROR ON RECEIVER__ ::',err);
            });

            db.open(function(err, db) {
                if (err) {
                    receiver__.emit('error', err);
                    return;
                }

                // var db = mongoclient.db(options.dbname);
                var gfs = Grid(db, mongo);
                var outs = gfs.createWriteStream({
                    filename: __newFile.filename
                });
                __newFile.on('error', function (err) {
                    console.log('***** READ error on file ' + __newFile.filename, '::', err);
                });
                outs.on('error', function failedToWriteFile(err) {
                    console.log('Error on output stream- garbage collecting unfinished uploads...');
                });
                outs.on('close', function doneWritingFile() {
                    db.close();
                    done();
                });
                __newFile.pipe(outs);
            })

        };

        return receiver__;
    }


};


