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

  mneme.powerset = function (list) {
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

  // compute set difference x \ y (assumes that x and y are sorted and that
  // the elements are unique)
  // example: x = [ 'a', 'b', 'c', 'd' ]
  //          y = [ 'b', 'd' ]
  //          tags_diff(x, y) == [ 'a', 'c' ]
  mneme.tags_diff = function (x, y) {
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
        var tags_sorted = doc.tags.sort();
        var tags_powerset = mneme.powerset(tags_sorted);
        for (var i=1; i<tags_powerset.length; i++) {
          var tags_remaining = mneme.tags_diff(tags_sorted, tags_powerset[i]);
          emit(tags_powerset[i],
            {
              id: doc._id,
              name: doc.name,
              createtime: doc.createtime,
              updatetime: doc.updatetime,
              description: doc.description,
              deadline: doc.deadline,
              place: doc.place,
              tags_remaining: tags_remaining
            }
          );
        }
      }
    },
    reduce: function (keys, values, rereduce) {
      if (rereduce) {
        var a = values[0], b = values[1];

        var docs = a.docs.concat(b.docs);
        var tags_remaining = a.tags_remaining;

        var btags = Object.keys(b.tags_remaining);
        for (var i=0; i<btags.length; i++) {
          var tag = btags[i];
          if (tags_remaining[tag]) {
            tags_remaining[tag] += b.tags_remaining[tag];
          } else {
            tags_remaining[tag] = b.tags_remaining[tag];
          }
        }
      } else {
        var docs = values;
        var tags_remaining = { };

        // count remaining tags
        for (var i=0; i<values.length; i++) {
          for (var j=0; j<values[i].tags_remaining.length; j++) {
            var tag = values[i].tags_remaining[j];
            if (tags_remaining[tag]) {
              tags_remaining[tag]++;
            } else {
              tags_remaining[tag] = 1;
            }
          }
        }
      }
      return {
        tags_remaining: tags_remaining,
        docs: docs
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
