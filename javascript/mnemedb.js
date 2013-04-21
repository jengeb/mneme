/*
JSON format for mnemedb document  
mandatory keys: name, createtime, updatetime, enabled

{
  'name': 'brot',
  'createtime': '2013-03-29T11:58:31.343Z',
  'updatetime': '2013-03-29T11:58:31.343Z',
  'enabled': true,
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

Mnemedb = function (dbname) {
  var db = Pouch(dbname);

  var mnemedb = {};

  mnemedb.powerset = function (list) {
    var pow = [[]];
    for (var i=0; i<list.length; i++) {
      var cur = list[i];
      var subpow = mnemedb.powerset (list.slice(i+1));
      for (var j=0; j<subpow.length; j++) {
        pow.push( [cur].concat(subpow[j]).sort() );
      }
    }
    return pow;
  }

  // compute set difference x \ y (assumes that x and y are sorted and that
  // the elements are unique)
  // example: x = [ 'a', 'b', 'c', 'd' ]
  //          y = [ 'b', 'd' ]
  //          tags_diff(x, y) == [ 'a', 'c' ]
  mnemedb.tags_diff = function (x, y) {
    var diff = [];
    var ypos = 0;
    for (var xpos=0; xpos<x.length; xpos++) {
      while (ypos<y.length && y[ypos]<x[xpos]) {
        ypos++;
      }
      if (ypos==y.length || x[xpos] != y[ypos]) {
        diff.push(x[xpos]);
      }
    }
    return diff;
  }

  // sort object by propery value
  // example: obj = { a: 10, b: 4, c: 6 }
  //          sortbyvalue(obj) = [ ['a', 10], ['c', 6], ['b', 4] ]
  mnemedb.sortbyvalue = function (obj) {
    var sorted = [];
    var keys = Object.keys(obj);
    for (var i=0; i<keys.length; i++) {
      sorted.push( [keys[i], obj[keys[i]]] );
    }
    sorted.sort( function(a, b) {
      return b[1]-a[1];
    });
    return sorted;
  }

  mnemedb.get_pouchdb = function () {
    return db;
  }

  mnemedb.create_doc = function (doc, callback) {
    var datestr = new Date().toISOString();
    doc['createtime'] = datestr;
    doc['updatetime'] = datestr;
    doc['enabled'] = true;
    return db.post(doc, callback);
  }

  mnemedb.update_doc = function (doc, callback) {
    var datestr = new Date().toISOString();
    doc['updatetime'] = datestr;
    return db.put(doc, callback);
  }

  mnemedb.get_doc = function (docid, callback) {
    return db.get(docid, callback);
  }

  // enable may be true or false
  mnemedb.set_doc_enabled = function (docid, enabled, callback) {
    return mnemedb.get_doc(docid, function (err, doc) {
      if (!err && doc) {
        doc.enabled = enabled;
        mnemedb.update_doc(doc, callback);
      }
    });
  }

  var view_tags_subsets = {
    map: function (doc) {
      if (doc.enabled) {
        var tags = doc.tags || [];
        var tags_sorted = tags.sort();
        var tags_powerset = mnemedb.powerset(tags_sorted);
        for (var i=0; i<tags_powerset.length; i++) {
          var tags_avail = mnemedb.tags_diff(tags_sorted, tags_powerset[i]);
          emit(tags_powerset[i],
            {
              id: doc._id,
              tags_avail: tags_avail
            }
          );
        }
      }
    },
    reduce: function (keys, values, rereduce) {
      if (rereduce) {
        var a = values[0], b = values[1];

        var docids = a.docids.concat(b.docids);
        var tags_avail = a.tags_avail;

        var btags = Object.keys(b.tags_avail);
        for (var i=0; i<btags.length; i++) {
          var tag = btags[i];
          if (tags_avail[tag]) {
            tags_avail[tag] += b.tags_avail[tag];
          } else {
            tags_avail[tag] = b.tags_avail[tag];
          }
        }
      } else {
        var docids = [];
        var tags_avail = { };

        // count available tags
        for (var i=0; i<values.length; i++) {
          docids.push(values[i].id);
          for (var j=0; j<values[i].tags_avail.length; j++) {
            var tag = values[i].tags_avail[j];
            if (tags_avail[tag]) {
              tags_avail[tag]++;
            } else {
              tags_avail[tag] = 1;
            }
          }
        }
      }
      return {
        docids: docids,
        tags_avail: tags_avail
      }
    }
  };

  // get information for a tags combination
  mnemedb.get_tags_enabled_info = function (tags, callback) {
    return db.query(view_tags_subsets, {key: tags.sort()}, function(err, response) {
      callback(err,
        (!err && response.rows.length)
        ? response.rows[0].value
        : { docids: [], tags_avail: {} }
      );
    });
  }

  var view_tags_enabled = {
    map: function (doc) {
      if (doc.enabled && doc.tags) {
        for (var i=0; i<doc.tags.length; i++) {
          emit(doc.tags[i], null);
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

  mnemedb.get_tags_enabled = function (callback) {
    return db.query(view_tags_enabled, function(err, response) {
      callback(err, !err ? response.rows : null);
    });
  }

  var view_tags_all = {
    map: function (doc) {
      if (doc.tags) {
        for (var i=0; i<doc.tags.length; i++) {
          emit(doc.tags[i], null);
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

  mnemedb.get_tags_all = function (callback) {
    return db.query(view_tags_all, function(err, response) {
      if (!err) {
        var tags = {};
        for (var i=0, obj; obj=response.rows[i++];) {
          tags[obj.key] = obj.value;
        }
      }
      callback(err, !err ? tags : null);
    });
  }

  mnemedb.get_docs = function (keys, callback) {
    return db.allDocs({keys: keys, include_docs: true}, function (err, response) {
      callback(err, response.rows);
    });
  }

  return mnemedb;
}
