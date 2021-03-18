/**
* Module dependencies
*/

var _ = require('@sailshq/lodash');
var TransformStream = require('stream').Transform;



/**
* [exports description]
* @param  {[type]} options    [description]
* @param  {[type]} __newFile  [description]
* @param  {[type]} receiver__ [description]
* @param  {[type]} outs__     [description]
* @return {[type]}            [description]
*/
module.exports = function buildProgressStream (options, __newFile, receiver__, outs__) {
    options = options || {};
    var log = options.log || function noOpLog(){};
 
    // Generate a progress stream and unique id for this file
    // then pipe the bytes down to the outs___ stream
    // We will pipe the incoming file stream to this, which will
    var localID = _.uniqueId();
    var guessedTotal = 0;
    var writtenSoFar = 0;
    var __progress__ = new TransformStream();
    __progress__._transform = function(chunk, enctype, next) {

        // Update the guessedTotal to make % estimate
        // more accurate:
        guessedTotal += chunk.length;
        writtenSoFar += chunk.length;

        // Do the actual "writing", which in our case will pipe
        // the bytes to the outs___ stream that writes to GridFS
        this.push(chunk);

        // Emit an event that will calculate our total upload
        // progress and determine whether we're within quota
        this.emit('progress', {
            id: localID,
            fd: __newFile.fd,
            skipperFd: (__newFile.skipperFd || (_.isString(__newFile.fd) ? __newFile.fd : undefined)),
            name: __newFile.name,
            written: writtenSoFar,
            total: guessedTotal,
            percent: (writtenSoFar / guessedTotal) * 100 | 0
        });
        next();
    };
 
    // This event is fired when a single file stream emits a progress event.
    // Each time we receive a file, we must recalculate the TOTAL progress
    // for the aggregate file upload.
    //
    // events emitted look like:
    /*
    {
        percentage: 9.05,
        transferred: 949624,
        length: 10485760,
        remaining: 9536136,
        eta: 10,
        runtime: 0,
        delta: 295396,
        speed: 949624
    }
    */
    __progress__.on('progress', function singleFileProgress(milestone) {
        // Lookup or create new object to track file progress
        var currentFileProgress = _.find(receiver__._files, {
            id: localID
        });
        if (currentFileProgress) {
            currentFileProgress.written = milestone.written;
            currentFileProgress.total = milestone.total;
            currentFileProgress.percent = milestone.percent;
            currentFileProgress.stream = __newFile;
        } else {
        currentFileProgress = {
            id: localID,
            fd: __newFile.fd,
            skipperFd: (__newFile.skipperFd || (_.isString(__newFile.fd) ? __newFile.fd : undefined)),
            name: __newFile.filename,
            written: milestone.written,
            total: milestone.total,
            percent: milestone.percent,
            stream: __newFile
        };
        receiver__._files.push(currentFileProgress);
        }
        ////////////////////////////////////////////////////////////////
 
 
        // Recalculate `totalBytesWritten` so far for this receiver instance
        // (across ALL OF ITS FILES)
        // using the sum of all bytes written to each file in `receiver__._files`
        var totalBytesWritten = _.reduce(receiver__._files, function(memo, status) {
        memo += status.written;
        return memo;
        }, 0);
 
        log(currentFileProgress.percent, '::', currentFileProgress.written, '/', currentFileProgress.total, '       (file #' + currentFileProgress.id + '   :: ' + /*'update#'+counter*/ '' + ')'); //receiver__._files.length+' files)');
 
        // Emit an event on the receiver.  Someone using Skipper may listen for this to show
        // a progress bar, for example.
        receiver__.emit('progress', currentFileProgress);
 
        // and then enforce its `maxBytes`.
        if (options.maxBytes && totalBytesWritten >= options.maxBytes) {
    
            var err = new Error();
            err.code = 'E_EXCEEDS_UPLOAD_LIMIT';
            err.name = 'Upload Error';
            err.maxBytes = options.maxBytes;
            err.written = totalBytesWritten;
            err.message = 'Upload limit of ' + err.maxBytes + ' bytes exceeded (' + err.written + ' bytes written)';
        
            // Stop listening for progress events
            __progress__.removeAllListeners('progress');
            // Unpipe the progress stream, which feeds the GridFS stream, so we don't keep dumping to GridFS
            process.nextTick(function() {
                __progress__.unpipe();
            });
            
            // In skipper-disk, this is the point where Garbage Collecting is done.
            // In skipper-gridfs, the job is done inside the outs__ error listeners using GridFSBucketWriteStream.abort() (see index.js)
            
            outs__.emit('E_EXCEEDS_UPLOAD_LIMIT',err);
            
        
            return;
        }
    });
    
    return __progress__;
};