"use strict";

angular.module("insuranceList").controller("InsuranceListController", [
    "$http",
    function ($http) {
        var self = this;

        $http.get("api/insurance/insurances").then(function (resp) {
            self.insuranceList = resp.data;
        });
    },
]);
