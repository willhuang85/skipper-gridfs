# [<img title="skipper-gridfs - GridFS filesystem adapter for Skipper" src="http://i.imgur.com/P6gptnI.png" width="200px" alt="skipper emblem - face of a ship's captain"/>](https://github.com/willhuang85/skipper-gridfs) GridFS Filesystem Adapter

[![NPM version](https://badge.fury.io/js/skipper-gridfs.png)](http://badge.fury.io/js/skipper-gridfs) &nbsp; &nbsp;
[![Build Status](https://travis-ci.org/willhuang85/skipper-gridfs.svg?branch=master)](https://travis-ci.org/willhuang85/skipper-gridfs)

GridFS adapter for receiving [upstreams](https://github.com/balderdashy/skipper#what-are-upstreams). Particularly useful for handling streaming multipart file uploads from the [Skipper](https://github.com/balderdashy/skipper) body parser.

Currently only supports Node 6 and up


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
  uri: 'mongodb://username:password@myhost.com:27017/myDatabase'
}, function whenDone(err, uploadedFiles) {
  if (err) return res.negotiate(err);
  else return res.ok({
    files: uploadedFiles,
    textParams: req.params.all()
  });
});
```

For more detailed usage information and a full list of available options, see the Skipper docs, especially the section on "[Uploading to GridFS](https://github.com/balderdashy/skipper#uploading-files-to-gridfs)".


| Option          | Type       | Details                                                                                                                                                                                                 |
| --------------- | :--------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uri`           | ((string)) | URI to connect to Mongo instance, e.g. `mongodb://username:password@localhost:27107/databasename`.<br/> (Check [mongo client URI syntax](https://docs.mongodb.com/manual/reference/connection-string)). |
| `bucketOptions` | ((object)) | An optional parameter that matches the GridFSBucket options (Check [mongo gridfs bucket options](http://mongodb.github.io/node-mongodb-native/3.1/api/GridFSBucket.html)).                              |
| `mongoOptions`  | ((object)) | An optional paramter that matches the MongoClient.connect options (Check [mongo client options](http://mongodb.github.io/node-mongodb-native/3.1/api/MongoClient.html#.connect)).                       |

========================================

## Contributions

are welcomed :ok_hand:

See [ROADMAP.md](https://github.com/willhuang85/skipper-gridfs/blob/master/ROADMAP.md).

To run the tests:

```shell
$ URI=mongodb://username:password@localhost:27107/databasename npm test
```


========================================

## License

MIT
