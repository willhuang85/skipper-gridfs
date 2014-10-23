# [<img title="skipper-gridfs - GridFS filesystem adapter for Skipper" src="http://i.imgur.com/P6gptnI.png" width="200px" alt="skipper emblem - face of a ship's captain"/>](https://github.com/willhuang85/skipper-gridfs) GridFS Filesystem Adapter

[![NPM version](https://badge.fury.io/js/skipper-gridfs.png)](http://badge.fury.io/js/skipper-gridfs) &nbsp; &nbsp;
[![Build Status](https://travis-ci.org/willhuang85/skipper-gridfs.svg?branch=master)](https://travis-ci.org/willhuang85/skipper-gridfs)

GridFS adapter for receiving [upstreams](https://github.com/balderdashy/skipper#what-are-upstreams). Particularly useful for handling streaming multipart file uploads from the [Skipper](https://github.com/balderdashy/skipper) body parser.


========================================

## Installation

```
$ npm install skipper-gridfs --save
```

Also make sure you have skipper [installed as your body parser](http://beta.sailsjs.org/#/documentation/concepts/Middleware?q=adding-or-overriding-http-middleware).

> Skipper is installed by default in [Sails](https://github.com/balderdashy/sails) v0.10.

========================================


## Usage

```javascript
req.file('avatar')
.upload({
  adapter: require('skipper-gridfs'),
  uri: 'mongodb://jimmy@j1mtr0n1xx@mongo.jimmy.com:27017/coolapp.avatar_uploads'
}, function whenDone(err, uploadedFiles) {
  if (err) return res.negotiate(err);
  else return res.ok({
    files: uploadedFiles,
    textParams: req.params.all()
  });
});
```

For more detailed usage information and a full list of available options, see the Skipper docs, especially the section on "[https://github.com/balderdashy/skipper#uploading-files-to-gridfs](Uploading to GridFS)".


One important adapter-specific option to note is `uri`:

| Option    | Type       | Details |
|-----------|:----------:|---------|
| `uri`     | ((string)) | An optional parameter if you wish the enter your mongodb credentials as a URI, e.g. `mongodb://username:password@localhost:27107/databasename.bucket`.<br/> (Check [mongo client URI syntax](http://api.mongodb.org/java/current/com/mongodb/MongoClientURI.html)).|

>>Note:
>>Please use `uri` instead of passing in separate options for `username`, `password`, `host`, `port`, `dbname` and `bucket`

In addition to the regular file adapter [methods](https://github.com/balderdashy/skipper#what-are-filesystem-adapters), these additional methods are also available:

Method      | Description
 ----------- | ------------------
 `readLastVersion()`      | Get the most recent version of a file in GridFS
 `readVersion()`    | Get a specific version of a file in GridFS
 
 These methods mimic [get_last_version](http://api.mongodb.org/python/current/api/gridfs/#gridfs.GridFS.get_last_version) and [get_version](http://api.mongodb.org/python/current/api/gridfs/#gridfs.GridFS.get_version) from pymongo's gridfs implementation.

========================================

## Contributions

are welcomed :ok_hand:

See [ROADMAP.md](https://github.com/willhuang85/skipper-gridfs/blob/master/ROADMAP.md).

Also be sure to check out [ROADMAP.md in the Skipper repo](https://github.com/balderdashy/skipper/blob/master/ROADMAP.md).

To run the tests:

```shell
$ URI=mongodb://username:password@localhost:27107/databasename.bucket npm test
```


========================================

## License

MIT
