"use strict";

angular.module("billingList").controller("BillingListController", [
    "$http",
    function ($http) {
        var self = this;

        $http.get("api/billing/billings").then(function (resp) {
            self.billingList = resp.data;
            $http.get("api/customer/owners/").then(function (response){
                var owners = response.data
                self.owners = {}
                for(var i = 0; i < owners.length; i++) {
                    self.owners["" + owners[i].id] = owners[i];
                }
                for(var i = 0; i < self.billingList.length; i++){
                    self.billingList[i].first_name = self.owners["" + self.billingList[i].owner_id].firstName
                    self.billingList[i].last_name = self.owners["" + self.billingList[i].owner_id].lastName
                }
            })

        });
    },
]);
