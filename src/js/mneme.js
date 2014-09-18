// set up angular
var mneme = angular.module('mneme', ['ngRoute']);

// add mneme-tags element (realized via angularjs' directives)
mneme.directive('mnemeTags', function() {
  return {
    restrict: 'E',
    templateUrl: 'templates/mneme-tags.html'
  };
});

// set up routes
mneme.config(function($routeProvider) {
  $routeProvider.
    when('/tags', {
      templateUrl: 'templates/tags.html'
    }).
    otherwise({
      redirectTo: '/tags'
    });
});
