// set up angular
var mneme = angular.module(
  'mneme',
  ['ngRoute', 'ui.bootstrap', 'pouchdb', 'angularMoment', 'leaflet-directive']
);

// set up the pouchdb database
mneme.factory('mnemedb', function (pouchdb) {
  var mnemedb = {
    db: pouchdb.create('mnemedb'),
    // the result of queries end up in the following properties
    // (as long as they are undefined, the initial query of the database is
    // not yet completed)
    mnemes: undefined
  };

  // watch the database for changes and update views
  mnemedb.db.changes({
    since: 'now',
    live: true
  }).then(null, null, function (res) {
    // query for mnemes
    mnemedb.db.query(function (doc) {
        if (doc.type==='mneme') {
          emit(doc.name);
        }
      },
      {include_docs: true}
    ).then(function (data) {
      var mnemes = _.pluck(data.rows, 'doc');
      _.forEach(mnemes, function (mneme) {
        mneme.ctime = new Date(mneme.ctime);
        mneme.mtime = new Date(mneme.mtime);
      });
      mnemedb.mnemes = mnemes;
    });
  });

  return mnemedb;
});

var get_tags_counts = function (tags_list) {
  var map = _.map(tags_list, function (tags) {
    var res = {};
    _.forEach(tags || [], function (tag) {
      res[tag] = 1;
    });
    return res;
  });

  return _.reduce(map, function (res, cur) {
    _.forIn(cur, function (val, key) {
      res[key] = res[key] || 0;
      res[key] = res[key] + val;
    });
    return res;
  }, {});
};

// set up routes
mneme.config(function ($routeProvider) {
  $routeProvider
    .when('/overview', {
      templateUrl: 'templates/overview.html',
      reloadOnSearch: false
    })
    .when('/new', {
      templateUrl: 'templates/new.html',
      reloadOnSearch: false
    })
    .when('/edit', {
      templateUrl: 'templates/edit.html',
      reloadOnSearch: false
    })
    .otherwise({
      redirectTo: '/overview'
    });
});

// helper function to sanitize tags that are passed in the URL search part
function sanitize_tags (tags) {
  // sanitize parameters
  if (_.isString(tags)) {
    tags = [tags];
  }
  return _.clone(tags) || [];
}

// kick out all mnemes which do not contain the given tags
mneme.filter('match_tags', function () {
  return function (mnemes, tags) {
    return _.filter(mnemes, function (mneme) {
      return _.intersection(
          mneme.tags, tags
        ).length === tags.length;
    });
  };
});

mneme.filter('match_tags', function () {
  return function (mnemes, tags) {
    return _.filter(mnemes, function (mneme) {
      return _.intersection(
          mneme.tags, tags
        ).length === tags.length;
    });
  };
});

mneme.filter('match_map', function () {
  return function (mnemes, active, bounds) {
    if (!active) {
      return mnemes;
    }
    bounds = L.latLngBounds(bounds.southWest, bounds.northEast);
    return _.filter(mnemes, function (mneme) {
      return mneme.location && bounds.contains(
        L.latLng(mneme.location.lat, mneme.location.lng)
      );
    });
  };
});

// get remaining tags (complementary to selected tags)
mneme.filter('mnemes_tags_remaining', function ($filter) {
  return function (mnemes, filter_tags, filter_map, filter_map_bounds) {
    // kick out all tag arrays which do not contain all selected tags
    mnemes = $filter('match_tags')(mnemes, filter_tags);

    // kick out all mnemes that do not match the map filter
    mnemes = $filter('match_map')(mnemes, filter_map, filter_map_bounds);

    // get tag counts
    var tags_counts = get_tags_counts(_.pluck(mnemes, 'tags'));

    // kick out the already selected tags
    tags = _.omit(tags_counts, filter_tags);

    // reorganize tags as array of objects
    return _.map(tags, function (val, key) {
      return {name: key, count: val};
    });
  };
});

// set up Overview controller
mneme.controller('OverviewCtrl', function ($scope, $timeout, $routeParams,
    $location, $filter, mnemedb, leafletData) {

  // store mnemedb on scope in order to allow deletions
  $scope.mnemedb = mnemedb;

  $scope.filter = {
    // get parameters from query part of URL via $routeParams
    tags: sanitize_tags($routeParams.t),
    tags_remaining: [],
    tags_remaining_limit: 5,
    tags_remove: function (tag) {
      _.pull($scope.filter.tags, tag);
    },
    tags_contains: function (tag) {
      return _.contains($scope.filter.tags, tag);
    },
    // set map center
    map_center: {
      lat: 15,
      lng: 17,
      zoom: 1
    },
    map_markers: {}
  };

  // update $scope.filter.tags_remaining on change of 'filter.tags' and
  // 'mnemedb.mnemes'.
  // Warning: do not simply use filter_tags_get_remaining(...) in the
  // template! This causes angular to run into an infinite loop because of
  // dirty checking...
  var filter_tags_remaining_update = function () {
    $scope.filter.tags_remaining = $filter('mnemes_tags_remaining')(
      $scope.mnemedb.mnemes, $scope.filter.tags,
      $scope.filter.map_show, $scope.filter.map_bounds
    );
  };
  $scope.$watchCollection('filter.tags', filter_tags_remaining_update);
  $scope.$watchCollection('filter.map_show', filter_tags_remaining_update);
  $scope.$watchCollection('filter.map_bounds', filter_tags_remaining_update);
  $scope.$watchCollection('mnemedb.mnemes', filter_tags_remaining_update);

  // invalidate size and fit map when it becomes visible
  $scope.$watch('filter.map_show', function(show) {
    if (show) {
      leafletData.getMap().then(function (map) {
        map.invalidateSize();
        if ($scope.filter.map_markers.length) {
          map.fitBounds(L.latLngBounds($scope.filter.map_markers).pad(0.1));
        }
      });
    }
  });

  $scope.$watchCollection('mnemes_filtered', function (mnemes) {
    // set map markers to current selection
    $scope.filter.map_markers = _.compact(_.map(mnemes, function (mneme) {
      return mneme.location ? {
        lat: mneme.location.lat,
        lng: mneme.location.lng
      } : false;
    }));
  });

  // update 'mnemes_filtered' to match the tag and map filter
  var mnemes_filtered_update = function () {
    var mnemes = $scope.mnemedb.mnemes;

    // kick out all mnemes which do not contain all selected tags
    mnemes = $filter('match_tags')(mnemes, $scope.filter.tags);

    $scope.mnemes_filtered = $filter('match_map')(
      mnemes, $scope.filter.map_show, $scope.filter.map_bounds
    );
  };
  $scope.$watchCollection('filter.tags', mnemes_filtered_update);
  $scope.$watchCollection('filter.map_show', mnemes_filtered_update);
  $scope.$watchCollection('filter.map_bounds', mnemes_filtered_update);
  $scope.$watchCollection('mnemedb.mnemes', mnemes_filtered_update);

  // update URL with filter parameters
  var update_url = function () {
    $location.search({
      t: $scope.filter.tags
    });
  };
  $scope.$watchCollection('filter.tags', update_url);

  // switch to new mneme page
  $scope.new = function () {
    $location.path('/new');
  };

  // switch to edit page
  $scope.edit = function (mneme) {
    $location.search({
      t: $scope.filter.tags,
      id: mneme._id
    });
    $location.path('/edit');
  };
});

mneme.controller('MnemeCtrl', function ($scope, mnemedb, leafletData, $timeout) {
  $scope.mneme = $scope.$parent.mneme;
  $scope.mnemedb = mnemedb;

  // remove a tag
  $scope.tags_remove = function (tag) {
    _.pull($scope.mneme.tags, tag);
  };

  // add a tag via textbox
  $scope.tags_add = function () {
    $scope.mneme.tags.push($scope.tag_new);
    $scope.tag_new = "";
  };

  // validate a new tag from the textbox
  $scope.tag_new_validate = function () {
    return !_.contains($scope.mneme.tags, $scope.tag_new) &&
        $scope.tag_new && $scope.tag_new.length;
  };

  // used tags
  $scope.tags_used = [];
  var tags_used_update = function () {
    // get the tags of all mnemes
    var tags_all = _.pluck($scope.mnemedb.mnemes, 'tags');

    var tags_counts = get_tags_counts(tags_all);

    // kick out the already selected tags
    tags_counts = _.omit(tags_counts, $scope.mneme.tags);

    // reorganize tags as array of objects
    $scope.tags_used = _.map(tags_counts, function (val, key) {
      return {name: key, count: val};
    });
  };
  $scope.$watchCollection('mnemedb.mnemes', tags_used_update);
  $scope.$watchCollection('mneme.tags', tags_used_update);

  // deadline checkbox
  $scope.$watchCollection('mneme.deadline', function (deadline) {
    $scope.deadline_show = deadline !== undefined;
  });
  $scope.deadline_toggle = function (show) {
    $scope.mneme.deadline = show ? new Date() : undefined;
  };

  // datepicker options
  $scope.deadline_date_options = {
    startingDay: 1
  };

  // location checkbox handler
  $scope.location_markers = {};
  /*$scope.location_toggle = function (show) {
    if (show) {
      $scope.location_markers.mneme = {
        lat: $scope.location_center.lat,
        lng: $scope.location_center.lng,
        draggable: true
      };
    } else {
      delete $scope.location_markers['mneme'];
    }
  };*/

  var location = $scope.mneme.location;
  $scope.location_show = location !== undefined;

  if (location) {
    // set center
    $scope.location_center = {
      lat: location.lat,
      lng: location.lng,
      zoom: $scope.location_center && $scope.location_markers.mneme ?
          $scope.location_center.zoom : 13
    };

    // set marker
    $scope.location_markers.mneme = {
      lat: location.lat,
      lng: location.lng,
      draggable: true
    };
  } else {
    // default center
    $scope.location_center = {
      lat: 15,
      lng: 17,
      zoom: 1
    };
    // default marker
    $scope.location_markers.mneme = {
      lat: 15,
      lng: 17,
      draggable: true
    };
  }

  // update center and update mneme property
  var location_update = function () {
    var loc = $scope.location_markers.mneme;
    // set center
    _.extend($scope.location_center, {
      lat: loc.lat,
      lng: loc.lng
    });

    // set mneme property
    $scope.mneme.location = $scope.location_show ? {
      lat: loc.lat,
      lng: loc.lng
    } : undefined;
  };
  $scope.$watch('location_show', location_update);
  $scope.$watchCollection('location_markers.mneme', location_update);

  // invalidate size after show/hide
  $scope.$watch('location_show', function(show) {
    if (show) {
      leafletData.getMap().then(function (map) {
        map.invalidateSize();
      });
    }
  });

  // enable event broadcasts
  $scope.location_events = {
    map: {
      enable: ['click', 'locationfound', 'locationerror'],
      logic: 'emit'
    }
  };

  // get location
  $scope.location_paths = {};
  $scope.$on('leafletDirectiveMap.locationfound', function (event, args) {
    $scope.location_get_status = {
      code: 'success',
      text: 'Location found!'
    };

    // update marker
    var latlng = args.leafletEvent.latlng;
    _.extend($scope.location_markers.mneme, {
      lat: latlng.lat,
      lng: latlng.lng,
    });

    // add accuracy circle
    var radius = args.leafletEvent.accuracy; // in meter
    $scope.location_paths = [{
      type: 'circle',
      radius: radius,
      latlngs: {lat: latlng.lat, lng: latlng.lng},
      clickable: false
    }];

    // determine bounding box
    var deg = L.LatLng.RAD_TO_DEG * radius / 6371000;
    leafletData.getMap().then(function (map) {
      map.fitBounds([
        [latlng.lat - deg, latlng.lng - deg],
        [latlng.lat + deg, latlng.lng + deg]
      ]);
    });
  });
  $scope.$on('leafletDirectiveMap.locationerror', function (event) {
    $scope.location_get_status = {
      code: 'fail',
      text: 'Location could not be determined!'
    };
  });
  $scope.location_get = function () {
    $scope.location_get_status = {
      code: 'active',
      text: 'Obtaining location...'
    };
    leafletData.getMap().then(function (map) {
      map.locate({
        timeout: 20000,
        maximumAge: 60000,
        enableHighAccuracy: true
      });
    });
  };
  $scope.$on('leafletDirectiveMap.click', function(event, args) {
    // update marker
    var latlng = args.leafletEvent.latlng;
    _.extend($scope.location_markers.mneme, {
      lat: latlng.lat,
      lng: latlng.lng,
    });
  });
});

mneme.controller('NewCtrl', function ($scope, $routeParams,
      $location, mnemedb) {

  // the new mneme object
  $scope.mneme = {
    type: 'mneme',
    // get parameters from query part of URL via $routeParams
    tags: sanitize_tags($routeParams.t)
  };

  $scope.validate = function () {
    return $scope.mneme.name && $scope.mneme.name.length;
  };

  $scope.save = function () {
    var mneme = $scope.mneme;

    // set timestamps
    var timestamp = (new Date()).toISOString();
    mneme.ctime = timestamp;
    mneme.mtime = timestamp;

    // set deadline
    if ($scope.mneme.deadline) {
      $scope.mneme.deadline = $scope.mneme.deadline.toISOString();
    }

    mnemedb.db.post(mneme).then(function () {
      $scope.overview();
    });
  };
  $scope.overview = function () {
    $location.search({
      t: $routeParams.t
    });
    $location.path('/overview');
  };
});

mneme.controller('EditCtrl', function ($scope, $routeParams,
      $location, mnemedb) {
  $scope.mnemedb = mnemedb;

  mnemedb.db.get($routeParams.id).then(function (doc) {
    $scope.mneme = doc;
  });

  $scope.validate = function () {
    return $scope.mneme.name && $scope.mneme.name.length;
  };

  $scope.save = function () {
    // update mtime
    var timestamp = (new Date()).toISOString();
    $scope.mneme.mtime = timestamp;

    // set deadline
    if ($scope.mneme.deadline) {
      $scope.mneme.deadline = $scope.mneme.deadline.toISOString();
    }

    // store document
    mnemedb.db.put($scope.mneme).then(function (result) {
      $scope.overview();
    });
  };

  $scope.overview = function () {
    $location.search({
      t: $routeParams.t
    });
    $location.path('/overview');
  };
});
