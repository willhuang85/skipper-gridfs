# Skipper GridFS Blob Adapter

[![NPM version](https://badge.fury.io/js/skipper-gridfs.png)](http://badge.fury.io/js/skipper-gridfs) &nbsp; &nbsp;

GridFS adapter for receiving streams of file streams. Particularly useful for streaming multipart file uploads via [Skipper](https://www.github.com/balderdashy/skipper).

========================================

## Installation

```
$ npm install skipper-gridfs --save
```

==============

## Usage

First instantiate a blob adapter (`blobAdapter`):

```js
var blobAdapter = require('skipper-gridfs')();
```

Build a receiver (`receiving`):

```js
var receiving = blobAdapter.receive();
```

Then stream file(s) from a particular field (`req.file('foo')`):

```js
req.file('foo').upload(receiving, function (err, filesUploaded) {
// ...
});
```

========================================

## Options

All options may be passed either into the blob adapter's factory method:

```js
var blobAdapter = require('skipper-gridfs')({
// These options will be applied unless overridden.
});
```

Or directly into a receiver:

```js
var receiving = blobAdapter.receive({
// Options will be applied only to this particular receiver.
});
```


| Option    | Type       | Details |
|-----------|:----------:|---------|
| `dbname`     | ((string)) | Your Mongodb database. Defaults to `"your-mongodb-name"`. |
| `host`     | ((string)) | Your Mongodb host address. Defaults to `"localhost"`. |
| `port`     | ((integer)) | Your Mongodb port address. Defaults to `27107`.|
| `dirname`  | ((string)) | Metadata associated with the Gridstore to emulate directory structure in MongoDb. Defaults to `"/"`
| `saveAs()`  | ((function)) | An optional function that can be used to define the logic for naming files. For example: <br/> `function (file) {return Math.random()+file.name;} });` <br/> By default, the filename of the uploaded file is used, including the extension (e.g. `"Screen Shot 2014-05-06 at 4.44.02 PM.jpg"`.  If a file already exists at `dirname` with the same name, it will be overridden. |
| `bucket`     | ((string)) | Your Mongodb bucket. Defaults to `"fs"` bucket. |
| `username`     | ((string)) | Your Mongodb database username. Defaults to `""`. |
| `password`     | ((string)) | Your Mongodb database password. Defaults to `""`.|
| `uri`     | ((string)) | An optional parameter if you wish the enter your mongodb credentials as a URI, e.g. `mongodb://username:password@localhost:27107/databasename`.<br/> If `uri` is passed in as an option, then the options `dbname`, `host`, `port`, `username` and `password` options are ignored.<br/>Check out the [mongoose api](http://mongoosejs.com/docs/api.html#index_Mongoose-createConnection) for more examples of URIs.|

========================================

## Advanced Usage

#### `upstream.pipe(receiving)`

As an alternative to the `upload()` method, you can pipe an incoming **upstream** returned from `req.file()` (a Readable stream of Readable binary streams) directly to the **receiver** (a Writable stream for Upstreams.)

```js
req.file('foo').pipe(receiving);
```

There is no performance benefit to using `.pipe()` instead of `.upload()`-- they both use streams2.  The `.pipe()` method is available merely as a matter of flexibility/chainability.  Be aware that `.upload()` handles the `error` and `finish` events for you; if you choose to use `.pipe()`, you will of course need to listen for these events manually:

```js
req.file('foo')
.on('error', function onError() { ... })
.on('finish', function onSuccess() { ... })
.pipe(receiving)
```

========================================

## Contributions

are welcomed :ok_hand:
