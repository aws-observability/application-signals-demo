"use strict";

angular.module("insuranceList", ["ui.router"]).config([
    "$stateProvider",
    function ($stateProvider) {
        $stateProvider.state("insurances", {
            parent: "app",
            url: "/insurances",
            template: "<insurance-list></insurance-list>",
        });
    },
]);
