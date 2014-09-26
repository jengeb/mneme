// set up angular
var mneme = angular.module(
  'mneme',
  ['ngRoute', 'ui.bootstrap', 'pouchdb', 'angularMoment']
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

// set up Overview controller
mneme.controller('OverviewCtrl', function ($scope, $timeout, $routeParams,
    $location, mnemedb) {

  // store mnemedb on scope in order to allow deletions
  $scope.mnemedb = mnemedb;

  // get parameters from query part of URL via $routeParams
  $scope.filter_tags = sanitize_tags($routeParams.t);

  $scope.filter_tags_remaining = [];
  $scope.filter_tags_remaining_limit = 5;
  $scope.filter_tags_remove = function (tag) {
    _.pull($scope.filter_tags, tag);
  };
  $scope.filter_tags_contains = function (tag) {
    return _.contains($scope.filter_tags, tag);
  };

  // update remaining filter tags on change of 'filter_tags' and 'mnemes'.
  // Warning: do not simply use filter_tags_get_remaining(...) in the
  // template! This causes angular to run into an infinite loop because of
  // dirty checking...
  var filter_tags_remaining_update = function () {
    // get the tags of all mnemes
    var tags_all = _.pluck($scope.mnemedb.mnemes, 'tags');

    // kick out all tag arrays which do not contain all selected tags
    var tags_remaining = _.filter(tags_all, function (tags) {
      return _.intersection(
          tags, $scope.filter_tags
        ).length === $scope.filter_tags.length;
    });

    var tags_counts = get_tags_counts(tags_remaining);

    // kick out the already selected tags
    tags = _.omit(tags_counts, $scope.filter_tags);

    // reorganize tags as array of objects
    tags = _.map(tags, function (val, key) {
      return {name: key, count: val};
    });

    $scope.filter_tags_remaining = tags;
  };
  $scope.$watchCollection('filter_tags', filter_tags_remaining_update);
  $scope.$watchCollection('mnemedb.mnemes', filter_tags_remaining_update);

  // update 'mnemes_filtered' to match the tag filter
  var mnemes_filtered_update = function () {
    // kick out all mnemes which do not contain all selected tags
    $scope.mnemes_filtered = _.filter($scope.mnemedb.mnemes, function (mneme) {
      return _.intersection(
          mneme.tags, $scope.filter_tags
        ).length === $scope.filter_tags.length;
    });
  };
  $scope.$watchCollection('filter_tags', mnemes_filtered_update);
  $scope.$watchCollection('mnemedb.mnemes', mnemes_filtered_update);

  // update URL with filter parameters
  var update_url = function () {
    $location.search({
      t: $scope.filter_tags
    });
  };
  $scope.$watchCollection('filter_tags', update_url);

  // switch to new mneme page
  $scope.new = function () {
    $location.path('/new');
  };

  // switch to edit page
  $scope.edit = function (mneme) {
    $location.search({
      t: $scope.filter_tags,
      id: mneme._id
    });
    $location.path('/edit');
  };
});

mneme.controller('MnemeCtrl', function ($scope, mnemedb) {
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
