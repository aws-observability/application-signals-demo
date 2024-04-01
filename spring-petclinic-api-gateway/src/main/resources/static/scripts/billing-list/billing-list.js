"use strict";

angular.module("billingList", ["ui.router"]).config([
    "$stateProvider",
    function ($stateProvider) {
        $stateProvider.state("billings", {
            parent: "app",
            url: "/billings",
            template: "<billing-list></billing-list>",
        });
    },
]);
