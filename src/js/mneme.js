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
    var tags = [
      {
        name: 'Restaurant',
        count: 10
      },
      {
        name: 'Italian',
        count: 6
      },
      {
        name: 'Chinese',
        count: 5,
      },
      {
        name: 'Vietnamese',
        count: 2,
      },
      {
        name: 'never been there',
        count: 3
      }
    ];
    return _.filter(tags, function (tag) {
      return !_.contains(tagnames_selected, tag.name);
    });
  };
});
