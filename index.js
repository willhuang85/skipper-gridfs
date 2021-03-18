const WritableStream = require('stream').Writable;
const Transform = require('stream').Transform;
const mongodb = require('mongodb');
const path = require('path');
const mime = require('mime');
const _ = require('lodash');
const concat = require('concat-stream');
const buildProgressStream = require('./standalone/build-progress-stream');



const client = (uri, mongoOptions, fn) => {
    const opts = Object.assign({ useNewUrlParser: true }, mongoOptions);
    mongodb.MongoClient.connect(uri, opts, fn);
}

const bucket = (db, bucketOptions) => {
    const opts = Object.assign({}, bucketOptions);
    return new mongodb.GridFSBucket(db, opts);
}

module.exports = function SkipperGridFS(globalOptions) {
    const options = globalOptions || {};

    _.defaults(options, {
        uri: 'mongodb://localhost:27017/mydatabase'
    });

    const adapter = {};
    adapter.rm = (fd, cb) => {
        const errorHandler = (err, client) => {
            if (client) client.close();
            if (cb) cb(err);
        }

        client(options.uri, options.mongoOptions, (err, client) => {
            if (err) {
                errorHandler(err, client);
            }

            bucket(client.db(), options.bucketOptions).delete(fd, (err) => errorHandler(err, client));
            if (cb) cb();
        });
    }

    adapter.ls = (dirpath, cb) => {
        const errorHandler = (err, client) => {
            if (client) client.close();
            if (cb) cb(err);
        }

        const __transform__ = Transform({ objectMode: true });
        __transform__._transform = (chunk, encoding, callback) => {
            return callback(null, chunk._id ? chunk._id : null);
        };

        __transform__.once('done', (client) => {
            client.close();
        });


        client(options.uri, options.mongoOptions, (err, client) => {
            if (err) {
                errorHandler(err, client);
            }

            const stream = bucket(client.db(), options.bucketOptions).find({ 'metadata.dirname': dirpath }).transformStream();
            stream.once('error', (err) => {
                errorHandler(err, client);
            });

            stream.once('end', () => {
                __transform__.emit('done', client);
            });

            stream.pipe(__transform__);
        });

        if (cb) {
            __transform__.pipe(concat((data) => {
                return cb(null, Array.isArray(data) ? data : [data]);
            }));
        } else {
            return __transform__;
        }
    }

    adapter.read = (fd, cb) => {
        const __transform__ = Transform();
        __transform__._transform = (chunk, encoding, callback) => {
            return callback(null, chunk);
        };

        __transform__.once('error', (error, client) => {
            if (client) client.close();
            if (cb) cb(error);
        });

        __transform__.once('done', (client) => {
            if (client) client.close();
        });

        client(options.uri, options.mongoOptions, (err, client) => {
            if (err) {
                __transform__.emit('error', error, client);
            }

            const downloadStream = bucket(client.db(), options.bucketOptions).openDownloadStream(fd);
            downloadStream.once('end', () => {
                __transform__.emit('done', client);
            });
            
            downloadStream.once('error', (error) => {
              __transform__.emit('error', error, client);
            });

            downloadStream.pipe(__transform__);
        });

        if (cb) {
            __transform__.pipe(concat((data) => {
                return cb(null, data);
            }));
        } else {
            return __transform__;
        }
    }

    adapter.receive = (opts) => {
        const receiver__ = WritableStream({ objectMode: true });

        // if onProgress handler was provided, bind an event automatically:
        if (_.isFunction(options.onProgress)) {
            receiver__.on('progress', options.onProgress);
        }

        // Track the progress of all file uploads that pass through this receiver
        // through one or more attached Upstream(s).
        receiver__._files = [];

        receiver__._write = (__newFile, encoding, done) => {
            client(options.uri, options.mongoOptions, (error, client) => {
                if (error) {
                    if (client) client.close();
                    if (done) done(error);
                }

                const fd = __newFile.fd;
                const filename = __newFile.filename;

                const outs__ = bucket(client.db(), options.bucketOptions).openUploadStreamWithId(fd, filename, {
                    metadata: {
                        filename: filename,
                        fd: fd,
                        dirname: __newFile.dirname || path.dirname(fd)
                    },
                    contentType: mime.getType(fd)
                });
               
                outs__.once('finish', () => {
                    receiver__.emit('writefile', __newFile);
                    if (client) client.close();
                    done();
                });

                outs__.once('E_EXCEEDS_UPLOAD_LIMIT', (err) => {
                    //Aborts GridFS Upload Stream cleaning all invalid chunks (garbage collector)
                    outs__.abort(() => {
                        if (client) client.close();
                        return done(err);
                    }); 
                });
                
                outs__.once('error', (err) => {
                    //Aborts GridFS Upload Stream cleaning all invalid chunks (garbage collector)
                    outs__.abort(() => {
                        if (client) client.close();
                        return done(err);
                    }); 
                });

                // Create another stream that simply keeps track of the progress of the file stream and emits `progress` events
                // on the receiver.
                const __progress__ = buildProgressStream(options, __newFile, receiver__, outs__, client, done);


                __newFile
                    .pipe(__progress__)
                    .pipe(outs__);
            });
        }
        return receiver__;
    }
    return adapter;
};

