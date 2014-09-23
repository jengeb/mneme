// set up angular
var mneme = angular.module('mneme', ['ngRoute', 'ui.bootstrap']);

// set up the pouchdb database
mneme.factory('mnemedb', function() {
  return new PouchDB('mnemedb');
});

// set up routes
mneme.config(function ($routeProvider) {
  $routeProvider.
    when('/tags', {
      templateUrl: 'templates/tags.html'
    }).
    otherwise({
      redirectTo: '/tags'
    });
});

// set up Overview controller
mneme.controller('OverviewCtrl', function ($scope, $timeout, mnemedb) {
  // TODO: remove
  db = mnemedb;

  $scope.mnemedb = mnemedb;

  // query mnemes (all docs with type 'mneme')
  var query_mnemes = function (callback) {
    mnemedb.query(function (doc) {
      if (doc.type==='mneme') {
        emit(doc.name);
      }
    },
    {include_docs: true},
    function(err, data) {
      if (err) {
        console.log(err);
      } else {
        callback(data);
      }
    });
  };

  // subscribe to changes in mneme pouchdb and store results in $scope.mnemes
  // (also populates $scope.mnemes initially)
  mnemedb.changes({
    since: 'now',
    live: true
  }).on('change', function() {
    query_mnemes(function (data) {
      $timeout(function () {
        $scope.mnemes = _.pluck(data.rows, 'doc');
      });
    });
  });

  $scope.filter_tags = [];
  $scope.filter_tags_remaining = [];
  $scope.filter_tags_add = function (tag) {
    $scope.filter_tags.push(tag);
  };
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
    var tags_all = _.pluck($scope.mnemes, 'tags');

    // kick out all tag arrays which do not contain all selected tags
    var tags_remaining = _.filter(tags_all, function (tags) {
      return _.intersection(
          tags, $scope.filter_tags
        ).length === $scope.filter_tags.length;
    });

    var map = _.map(tags_remaining, function (tags) {
      var res = {};
      _.forEach(tags || [], function (tag) {
        res[tag] = 1;
      });
      return res;
    });

    var tags = _.reduce(map, function (res, cur) {
      _.forIn(cur, function (val, key) {
        res[key] = res[key] || 0;
        res[key] = res[key] + val;
      });
      return res;
    }, {});

    // kick out the already selected tags
    tags = _.omit(tags, $scope.filter_tags);

    // reorganize tags as array of objects
    tags = _.map(tags, function (val, key) {
      return {name: key, count: val};
    });

    $scope.filter_tags_remaining = tags;
  };
  $scope.$watchCollection('filter_tags', filter_tags_remaining_update);
  $scope.$watchCollection('mnemes', filter_tags_remaining_update);

  // update 'mnemes_filtered' to match the tag filter
  var mnemes_filtered_update = function () {
    // kick out all mnemes which do not contain all selected tags
    $scope.mnemes_filtered = _.filter($scope.mnemes, function (mneme) {
      return _.intersection(
          mneme.tags, $scope.filter_tags
        ).length === $scope.filter_tags.length;
    });
  };
  $scope.$watchCollection('filter_tags', mnemes_filtered_update);
  $scope.$watchCollection('mnemes', mnemes_filtered_update);
});
