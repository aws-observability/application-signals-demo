"use strict";

/* Global JavaScript error handler. */
angular.module('rumExceptionHandler', [])
    .factory('$exceptionHandler', ['$log', function($log) {
        return function rumExceptionHandler(exception, cause) {
			      cwr('recordError', exception);
            $log.warn(exception, cause);
        };
    }]);

/* App Module */
var petClinicApp = angular.module("petClinicApp", [
    "ui.router",
    "infrastructure",
    "layoutNav",
    "layoutFooter",
    "layoutWelcome",
    "ownerList",
    "ownerDetails",
    "ownerForm",
    "petForm",
    "visits",
    "vetList",
    "insuranceList",
    "billingList",
    "rumExceptionHandler"
]);

petClinicApp.config([
    "$stateProvider",
    "$urlRouterProvider",
    "$locationProvider",
    "$httpProvider",
    function ($stateProvider, $urlRouterProvider, $locationProvider, $httpProvider) {
        // safari turns to be lazy sending the Cache-Control header
        $httpProvider.defaults.headers.common["Cache-Control"] = "no-cache";
        $httpProvider.interceptors.push("HttpErrorHandlingInterceptor");

        $locationProvider.hashPrefix("!");

        $urlRouterProvider.otherwise("/welcome");

        $urlRouterProvider.rule(function ($injector, $location) {
            var path = $location.path();

            let owner  = /(\/owners\/(details\/)?)[^\/]*/;
            path = path.replace(owner, "$1{ownerId}");

            let pet  = /(\/pets\/)[^\/]*/;
            path = path.replace(pet, "$1{petId}");

            if (path === '/welcome') {
                // Simulate a delay making the image visible caused by fetching a
                // feature from an A/B testing service.
                setTimeout(() =>
                    document.getElementById("pets").style.display = "inherit",
                    Math.floor(Math.random() * 4000)
                );
            }

            if (cwr) {
               cwr('recordPageView', path);
               console.log("record rum page view path ", path);
            }
        });

        $stateProvider
            .state("app", {
                abstract: true,
                url: "",
                template: "<ui-view></ui-view>",
            })
            .state("welcome", {
                parent: "app",
                url: "/welcome",
                template: "<layout-welcome></layout-welcome>",
            });
    },
]);

["welcome", "nav", "footer"].forEach(function (c) {
    var mod = "layout" + c.toUpperCase().substring(0, 1) + c.substring(1);
    angular.module(mod, []);
    angular.module(mod).component(mod, {
        templateUrl: "scripts/fragments/" + c + ".html",
    });
});
