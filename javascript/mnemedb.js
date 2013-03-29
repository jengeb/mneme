/*
JSON format for mneme document  
mandatory keys: name, createtime, updatetime

{
  'name': 'brot',
  'createtime': '2013-03-29T11:58:31.343Z',
  'updatetime': '2013-03-29T11:58:31.343Z',
  'tags': [ 'LPG', 'DM', 'Bäckerei' ],
  'description': 'Das leckere Schwarzbrot und nicht das langweilige Toastbrot!',
  'deadline': '2013-03-29T17:58:31.343Z',
  'place': {
    'latitude': 45.23123,
    'longitude': 12.5213
  },
  '_attachments': {
    'picture': {
    }
  }
}
*/

Mneme = function (dbname) {
  var db = Pouch(dbname);

  var mneme = {};

  mneme.create_doc = function (doc, callback) {
    var datestr = new Date().toISOString();
    doc['createtime'] = datestr;
    doc['updatetime'] = datestr;
    return db.post(doc, callback);
  }

  mneme.update_doc = function (doc, callback) {
    return db.put(doc, callback);
  }

  mneme.get_doc = function (docid, callback) {
    return db.get(docid, callback);
  }
  
  return mneme;
}
