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

  mneme.powerset = function(list) {
    var pow = [[]];
    for (var i=0; i<list.length; i++) {
      var cur = list[i];
      var subpow = mneme.powerset (list.slice(i+1));
      for (var j=0; j<subpow.length; j++) {
        pow.push( [cur].concat(subpow[j]).sort() );
      }
    }
    return pow;
  }

  mneme.create_doc = function (doc, callback) {
    var datestr = new Date().toISOString();
    doc['createtime'] = datestr;
    doc['updatetime'] = datestr;
    return db.post(doc, callback);
  }

  mneme.update_doc = function (doc, callback) {
    var datestr = new Date().toISOString();
    doc['updatetime'] = datestr;
    return db.put(doc, callback);
  }

  mneme.get_doc = function (docid, callback) {
    return db.get(docid, callback);
  }

  var view_tags = {
    map: function (doc) {
      if (doc.tags) {
        var tags_powerset = mneme.powerset(doc.tags);
        for (var i=1; i<tags_powerset.length; i++) {
          emit(tags_powerset[i], null);
        }
      }
    },
    reduce: function (keys, values, rereduce) {
      if (rereduce) {
        return sum(values);
      } else {
        return values.length;
      }
    }
  };

  mneme.get_tags = function (callback) {
    return db.query(view_tags, function(err, response) {
      callback(err, !err ? response.rows : null);
    });
  }

  mneme.get_tag_count = function (tag, callback) {
    return db.query(view_tags, {key: tag.sort()}, function(err, response) {
      callback(err, (!err && response.rows.length) ? response.rows[0].value : 0);
    });
  }

  return mneme;
}
