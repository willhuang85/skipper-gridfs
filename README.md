skipper-gridfs
==============

## Installation

```
$ npm install skipper-gridfs --save
```

==============

## Usage

First instantiate a blob adapter (`gridfsAdapter`):

```js
var gridfsAdapter = require('skipper-gridfs')();
```

Build a receiver (`receiving`):

```js
var receiving = gridfsAdapter.receive();
```

Then stream file(s) from a particular field (`req.file('foo')`):

```js
req.file('foo').upload(receiving, function (err, filesUploaded) {
// ...
});
```
