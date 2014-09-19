// set up angular
var mneme = angular.module('mneme', ['ngRoute']);

// add mneme-tags element (realized via angularjs' directives)
mneme.directive('mnemeTags', function () {
  return {
    restrict: 'E',
    templateUrl: 'templates/mneme-tags.html',
    scope: {
      tags_get: '=modelGet',
      tagnames_selected: '=modelSelected',
    },
    link: function(scope, element, attrs) {
      scope.tagnames_selected = scope.tagnames_selected || [];
      scope.$watchCollection('tagnames_selected', function (cur) {
        scope.tags_available = scope.tags_get(scope.tagnames_selected);
      });
      scope.add = function (tag) {
        scope.tagnames_selected.push(tag.name);
      };
      scope.remove = function (tagname) {
        _.pull(scope.tagnames_selected, tagname);
      };
    }
  };
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
mneme.controller('OverviewCtrl', function ($scope) {
  $scope.tags_get = function (tagnames_selected) {
    var mnemes = [
      {
        name: 'Soup populaire',
        tags: ['Restaurant', 'never been there', 'Berlin']
      },
      {
        name: 'Bo innovation',
        tags: ['Restaurant', 'never been there', 'Hong Kong', 'Chinese']
      },
      {
        name: '+39',
        tags: ['Restaurant', 'Italian', 'Berlin']
      },
      {
        name: 'Tofu',
        tags: ['shopping list', 'LPG']
      },
      {
        name: 'Nordseekäse',
        tags: ['shopping list', 'LPG']
      },
      {
        name: 'Club-Mate',
        tags: ['shopping list', 'Späti']
      },
      {
        name: 'Noodle soup',
        tags: ['shopping list', 'China']
      }
    ];

    // get the tags of all mnemes
    var tags_all = _.pluck(mnemes, 'tags');

    // strip out all tag arrays which do not contain all selected tags
    var tags_remaining = _.filter(tags_all, function (tags) {
      return _.intersection(
          tags, tagnames_selected
        ).length === tagnames_selected.length;
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
    tags = _.omit(tags, tagnames_selected);

    // reorganize tags as array of objects
    tags = _.map(tags, function (val, key) {
      return {name: key, count: val};
    });

    return tags;
  };
});
