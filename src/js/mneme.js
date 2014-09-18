// set up angular
var mneme = angular.module('mneme', ['ngRoute']);

// add mneme-tags element (realized via angularjs' directives)
mneme.directive('mnemeTags', function () {
  return {
    restrict: 'E',
    templateUrl: 'templates/mneme-tags.html',
    scope: {
      tags_get: '=modelGet',
      tags_selected: '=modelSelected',
    },
    link: function(scope, element, attrs) {
      scope.tags_selected = scope.tags_selected || [];
      scope.add = function (tag) {
        scope.tags_selected.push(tag);
      };
      scope.remove = function (tag) {
        scope.tags_selected.splice(scope.tags_selected.indexOf(tag), 1);
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
  $scope.tags_get = function (tags_selected) {
    var tags = ['Restaurant', 'Italian', 'Chinese', 'Vietnames', 'never been there'];
    return tags.filter(function (el) {
      return tags_selected.indexOf(el)===-1;
    });
  };
});
